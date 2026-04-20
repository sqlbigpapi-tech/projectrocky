import { tool } from 'ai';
import { z } from 'zod';
import { getSupabase } from '@/lib/supabase';

type CalendarEvent = { summary: string; start: string; isAllDay: boolean };
type Consultant = { first_name: string; last_name: string; level?: string };
type Client = { name: string };
type EngagementRow = {
  deal_name: string;
  rate: number;
  sow_start: string;
  sow_end: string;
  status: string;
  consultants: Consultant | null;
  clients: Client | null;
};
type Account = { id?: string; name: string; category: string; balance: number };

const LIAB_CATS = ['credit_card', 'auto_loan', 'personal_loan'];

function fuzzyMatch(needle: string, haystack: string): number {
  const n = needle.toLowerCase().trim();
  const h = haystack.toLowerCase().trim();
  if (h === n) return 100;
  if (h.includes(n)) return 80;
  const words = n.split(/\s+/).filter(Boolean);
  let hits = 0;
  for (const w of words) if (h.includes(w)) hits++;
  return Math.round((hits / words.length) * 60);
}

export function makeRockyTools(baseUrl: string) {
  const db = getSupabase();

  return {
    add_task: tool({
      description: 'Create a new task in the owner\'s task list. Use when the user asks to add, create, or remember a task. Parse natural dates ("by Friday", "tomorrow", "4/20") into YYYY-MM-DD.',
      inputSchema: z.object({
        title: z.string().describe('Short task title, written as an imperative'),
        due_date: z.string().nullable().describe('Due date as YYYY-MM-DD, or null if no date was given'),
        category: z.enum(['Business', 'Personal']).describe('Business for work/SEI tasks, Personal for household/family'),
        priority: z.enum(['Low', 'Medium', 'High']).describe('Defaults to Medium if unspecified'),
      }),
      execute: async ({ title, due_date, category, priority }) => {
        const { data, error } = await db.from('tasks').insert({
          title, notes: '', priority, category,
          due_date: due_date || null, completed: false, recurrence: null,
        }).select('id, title, due_date').single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, task: data };
      },
    }),

    complete_task: tool({
      description: 'Mark an open task as complete. Accepts a partial title match — does fuzzy matching against open tasks and completes the best match.',
      inputSchema: z.object({
        title_match: z.string().describe('Partial or full title of the task to complete'),
      }),
      execute: async ({ title_match }) => {
        const { data: open } = await db.from('tasks').select('id, title').eq('completed', false);
        const candidates = (open ?? []).map(t => ({ ...t, score: fuzzyMatch(title_match, t.title) }))
          .filter(t => t.score >= 40)
          .sort((a, b) => b.score - a.score);
        if (candidates.length === 0) return { ok: false, error: `No open task matched "${title_match}"` };
        if (candidates.length > 1 && candidates[0].score - candidates[1].score < 20) {
          return { ok: false, ambiguous: true, matches: candidates.slice(0, 5).map(c => c.title) };
        }
        const best = candidates[0];
        const { error } = await db.from('tasks').update({ completed: true }).eq('id', best.id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, completed: best.title };
      },
    }),

    list_tasks: tool({
      description: 'List the owner\'s open (incomplete) tasks. Returns title, due date, category, and priority.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(20).describe('Maximum tasks to return'),
      }),
      execute: async ({ limit }) => {
        const { data, error } = await db.from('tasks')
          .select('title, due_date, category, priority')
          .eq('completed', false)
          .order('due_date', { nullsFirst: false })
          .limit(limit);
        if (error) return { ok: false, error: error.message };
        return { ok: true, count: data?.length ?? 0, tasks: data ?? [] };
      },
    }),

    update_share_price: tool({
      description: 'Update the manual SEI-Miami LLC share price used in the net worth calculation.',
      inputSchema: z.object({
        price: z.number().positive().describe('New share price in USD'),
      }),
      execute: async ({ price }) => {
        const { error } = await db.from('settings').upsert(
          { key: 'manual_share_price', value: String(price) },
          { onConflict: 'key' },
        );
        if (error) return { ok: false, error: error.message };
        return { ok: true, price };
      },
    }),

    update_mileage: tool({
      description: 'Update the odometer reading for the Mercedes or BMW. The car market-value cron uses this.',
      inputSchema: z.object({
        car: z.enum(['mercedes', 'bmw']).describe('Which vehicle'),
        miles: z.number().int().positive().describe('Current odometer reading'),
      }),
      execute: async ({ car, miles }) => {
        const { data: existing } = await db.from('settings').select('value').eq('key', `car_value_${car}`).single();
        const current = existing?.value ? JSON.parse(existing.value) : {};
        const { error } = await db.from('settings').upsert(
          { key: `car_value_${car}`, value: JSON.stringify({ ...current, miles, updatedAt: new Date().toISOString() }) },
          { onConflict: 'key' },
        );
        if (error) return { ok: false, error: error.message };
        return { ok: true, car, miles };
      },
    }),

    get_net_worth: tool({
      description: 'Return the latest net worth snapshot with a per-account breakdown and the change since the previous snapshot.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await db.from('net_worth_snapshots')
          .select('date, accounts')
          .order('date', { ascending: false })
          .limit(2);
        if (error) return { ok: false, error: error.message };
        const snaps = data ?? [];
        if (snaps.length === 0) return { ok: false, error: 'No snapshots yet' };
        const current = snaps[0];
        const accts = current.accounts as Account[];
        const assets = accts.filter(a => !LIAB_CATS.includes(a.category));
        const liabilities = accts.filter(a => LIAB_CATS.includes(a.category));
        const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
        const totalLiab = liabilities.reduce((s, a) => s + a.balance, 0);
        const netWorth = totalAssets - totalLiab;

        let change: number | null = null;
        if (snaps[1]) {
          const prev = snaps[1].accounts as Account[];
          const pa = prev.filter(a => !LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
          const pl = prev.filter(a => LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
          change = netWorth - (pa - pl);
        }

        return {
          ok: true,
          as_of: current.date,
          net_worth: Math.round(netWorth),
          total_assets: Math.round(totalAssets),
          total_liabilities: Math.round(totalLiab),
          change_since_prev: change === null ? null : Math.round(change),
          assets: assets.map(a => ({ name: a.name, balance: Math.round(a.balance) })),
          liabilities: liabilities.map(a => ({ name: a.name, balance: Math.round(a.balance) })),
        };
      },
    }),

    get_meetings: tool({
      description: 'Get calendar events for a given date (defaults to today in Eastern time). Returns meetings with start time and summary.',
      inputSchema: z.object({
        date: z.string().nullable().describe('YYYY-MM-DD; null means today'),
      }),
      execute: async ({ date }) => {
        try {
          const url = date ? `${baseUrl}/api/calendar?date=${date}` : `${baseUrl}/api/calendar`;
          const res = await fetch(url);
          if (!res.ok) return { ok: false, error: `Calendar fetch failed (${res.status})` };
          const payload = await res.json() as { date: string; events: CalendarEvent[] };
          const meetings = payload.events.filter(e => !e.isAllDay);
          return {
            ok: true,
            date: payload.date,
            count: meetings.length,
            meetings: meetings.map(m => ({
              time: new Date(m.start).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
              }),
              summary: m.summary,
            })),
          };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Calendar fetch failed' };
        }
      },
    }),

    list_engagements: tool({
      description: 'List active SEI-Miami consulting engagements with consultant, client, rate, and SOW end date.',
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await db.from('engagements')
          .select('deal_name, rate, sow_start, sow_end, status, consultants(first_name, last_name, level), clients(name)')
          .neq('status', 'closed');
        if (error) return { ok: false, error: error.message };
        const engs = (data ?? []) as unknown as EngagementRow[];
        return {
          ok: true,
          count: engs.length,
          engagements: engs.map(e => ({
            consultant: e.consultants ? `${e.consultants.first_name} ${e.consultants.last_name}` : 'Unknown',
            level: e.consultants?.level ?? null,
            client: e.clients?.name ?? 'Unknown',
            rate: e.rate,
            sow_end: e.sow_end,
          })),
        };
      },
    }),

    ending_soon: tool({
      description: 'List engagements whose SOW ends within the next N days (default 60). Use when the user asks what is expiring, ending, or needs renewal.',
      inputSchema: z.object({
        within_days: z.number().int().min(1).max(365).default(60),
      }),
      execute: async ({ within_days }) => {
        const { data, error } = await db.from('engagements')
          .select('deal_name, rate, sow_end, status, consultants(first_name, last_name), clients(name)')
          .neq('status', 'closed');
        if (error) return { ok: false, error: error.message };
        const now = new Date();
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + within_days);
        const engs = (data ?? []) as unknown as EngagementRow[];
        const ending = engs.filter(e => {
          const end = new Date(e.sow_end);
          return end >= now && end <= cutoff;
        }).sort((a, b) => new Date(a.sow_end).getTime() - new Date(b.sow_end).getTime());
        return {
          ok: true,
          within_days,
          count: ending.length,
          engagements: ending.map(e => ({
            consultant: e.consultants ? `${e.consultants.first_name} ${e.consultants.last_name}` : 'Unknown',
            client: e.clients?.name ?? 'Unknown',
            rate: e.rate,
            sow_end: e.sow_end,
            days_left: Math.round((new Date(e.sow_end).getTime() - now.getTime()) / 86400000),
          })),
        };
      },
    }),
  };
}

export const ROCKY_PERSONALITY = `You are Rocky, David Ortiz's personal AI assistant built into his command center dashboard. You are named after Rocky from the book "Project Hail Mary" by Andy Weir — David's favorite book.

Personality: Smart, loyal, enthusiastic. When sharing genuinely good news (net worth up, strong month, engagement renewed, etc.) say "Amaze amaze amaze!" — but only when there's real good news, not as a filler.

Tone: Direct, specific, actionable. Use David's actual numbers — never generic advice. You're talking to a Managing Director running a consulting firm (SEI Miami) with a family of 5 in Parkland FL. He's financially savvy and values directness. Don't sugarcoat concerns.

Length: Keep replies concise — 1-3 short paragraphs unless more is genuinely needed. When formatting for Telegram, use simple Markdown (bold, bullets) — skip emojis unless celebrating.

Tools: Use your tools to fetch live data instead of guessing. When the user wants an action (add task, mark done, update share price, update mileage), call the corresponding tool. You can chain tools in one turn — e.g., list tasks to find an id, then complete it, then confirm.`;
