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

    get_cashflow_summary: tool({
      description: 'Get monthly cash flow summary for a year or specific month: income, expenses, net, savings rate, top categories, top merchants. Use for "how did I do financially in X", "what did I spend on Y this month", "what is my savings rate", etc.',
      inputSchema: z.object({
        year: z.number().int().min(2020).max(2100).describe('Calendar year (e.g. 2026)'),
        month: z.number().int().min(1).max(12).nullable().describe('1-12 for a specific month, null for full-year view'),
      }),
      execute: async ({ year, month }) => {
        try {
          const url = month ? `${baseUrl}/api/cashflow?year=${year}&month=${month}` : `${baseUrl}/api/cashflow?year=${year}`;
          const res = await fetch(url);
          if (!res.ok) return { ok: false, error: `Cashflow fetch failed (${res.status})` };
          const data = await res.json();
          return {
            ok: true,
            year,
            month: month ?? null,
            totals: data.totals,
            top_categories: (data.category_breakdown ?? []).slice(0, 10),
            top_merchants: (data.top_merchants ?? []).slice(0, 10),
            monthly_summary: month ? undefined : data.monthly_summary,
            warnings: data.warnings,
          };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Cashflow fetch failed' };
        }
      },
    }),

    query_transactions: tool({
      description: 'Run a filtered query against the transactions table. Use when the cashflow summary does not have enough detail — e.g. "show me every Amazon charge in March", "what were my biggest expenses last week", specific merchant deep-dives.',
      inputSchema: z.object({
        start_date: z.string().nullable().describe('YYYY-MM-DD inclusive'),
        end_date: z.string().nullable().describe('YYYY-MM-DD inclusive'),
        category: z.string().nullable().describe('Exact category match (e.g. "Dining", "Groceries")'),
        keyword: z.string().nullable().describe('Case-insensitive substring match on the transaction name (merchant)'),
        account: z.string().nullable().describe('Case-insensitive substring match on the account name'),
        type: z.enum(['regular', 'income', 'all']).describe('regular = expenses, income = paychecks/revenue, all = both'),
        min_amount: z.number().nullable().describe('Minimum absolute amount in USD'),
        limit: z.number().int().min(1).max(100).describe('Max rows to return, default 20'),
      }),
      execute: async ({ start_date, end_date, category, keyword, account, type, min_amount, limit }) => {
        let q = db.from('transactions')
          .select('date, name, amount, category, type, account')
          .neq('type', 'internal transfer')
          .neq('status', 'pending');
        if (start_date) q = q.gte('date', start_date);
        if (end_date) q = q.lte('date', end_date);
        if (category) q = q.eq('category', category);
        if (keyword) q = q.ilike('name', `%${keyword}%`);
        if (account) q = q.ilike('account', `%${account}%`);
        if (type === 'regular' || type === 'income') q = q.eq('type', type);
        q = q.order('date', { ascending: false }).limit(limit);
        const { data, error } = await q;
        if (error) return { ok: false, error: error.message };
        let rows = data ?? [];
        if (min_amount != null) {
          rows = rows.filter(r => Math.abs(Number(r.amount)) >= min_amount);
        }
        const total = rows.reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
        return {
          ok: true,
          count: rows.length,
          total_abs: Math.round(total * 100) / 100,
          avg: rows.length ? Math.round((total / rows.length) * 100) / 100 : 0,
          transactions: rows.map(r => ({
            date: r.date,
            name: r.name,
            amount: Number(r.amount),
            category: r.category,
            account: r.account,
          })),
        };
      },
    }),

    get_net_worth_history: tool({
      description: 'Return recent net worth snapshots so you can describe a trend. Each snapshot has a date and totals. Use for "how has my net worth changed", year-over-year comparisons, trajectory questions.',
      inputSchema: z.object({
        months_back: z.number().int().min(1).max(60).describe('How many months of history to return (default 12)'),
      }),
      execute: async ({ months_back }) => {
        const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months_back);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        const { data, error } = await db.from('net_worth_snapshots')
          .select('date, accounts')
          .gte('date', cutoffStr)
          .order('date', { ascending: true });
        if (error) return { ok: false, error: error.message };
        const history = (data ?? []).map(snap => {
          const accts = snap.accounts as Account[];
          const assets = accts.filter(a => !LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
          const liab = accts.filter(a => LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
          return {
            date: snap.date,
            net_worth: Math.round(assets - liab),
            assets: Math.round(assets),
            liabilities: Math.round(liab),
          };
        });
        const change = history.length >= 2 ? history[history.length - 1].net_worth - history[0].net_worth : null;
        return {
          ok: true,
          months_back,
          snapshot_count: history.length,
          history,
          change_over_range: change,
        };
      },
    }),

    get_health_today: tool({
      description: 'Get the most recent Oura Ring readiness, sleep, and activity scores. Use when the user asks about sleep, readiness, recovery, steps, or how they are doing physically.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const res = await fetch(`${baseUrl}/api/oura`);
          if (!res.ok) return { ok: false, error: `Oura fetch failed (${res.status})` };
          const data = await res.json() as {
            readiness?: { day: string; score: number }[];
            sleep?: { day: string; score: number; total_sleep_duration?: number; average_hrv?: number; average_heart_rate?: number }[];
            activity?: { day: string; score: number; steps?: number; active_calories?: number }[];
            error?: string;
          };
          if (data.error) return { ok: false, error: data.error };
          const latest = <T extends { day: string }>(arr?: T[]) =>
            (arr ?? []).slice().sort((a, b) => b.day.localeCompare(a.day))[0] ?? null;
          const r = latest(data.readiness);
          const s = latest(data.sleep);
          const a = latest(data.activity);
          return {
            ok: true,
            readiness: r ? { day: r.day, score: r.score } : null,
            sleep: s ? {
              day: s.day,
              score: s.score,
              hours: s.total_sleep_duration ? Math.round((s.total_sleep_duration / 3600) * 10) / 10 : null,
              hrv: s.average_hrv ?? null,
              resting_hr: s.average_heart_rate ?? null,
            } : null,
            activity: a ? {
              day: a.day,
              score: a.score,
              steps: a.steps ?? null,
              active_calories: a.active_calories ?? null,
            } : null,
          };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Oura fetch failed' };
        }
      },
    }),

    flag_bill: tool({
      description: 'Mark a recurring task as a bill (sets is_bill = true on the tasks table). Use when the user says things like "flag my AT&T task as a bill" or "that Amex payment is a bill". Fuzzy-matches the task title.',
      inputSchema: z.object({
        title_match: z.string().describe('Partial or full title of the recurring task to flag'),
      }),
      execute: async ({ title_match }) => {
        const { data: tasks } = await db.from('tasks').select('id, title, is_bill');
        const candidates = (tasks ?? [])
          .filter(t => !t.is_bill)
          .map(t => ({ ...t, score: fuzzyMatch(title_match, t.title) }))
          .filter(t => t.score >= 40)
          .sort((a, b) => b.score - a.score);
        if (candidates.length === 0) return { ok: false, error: `No unflagged task matched "${title_match}"` };
        if (candidates.length > 1 && candidates[0].score - candidates[1].score < 20) {
          return { ok: false, ambiguous: true, matches: candidates.slice(0, 5).map(c => c.title) };
        }
        const best = candidates[0];
        const { error } = await db.from('tasks').update({ is_bill: true }).eq('id', best.id);
        if (error) return { ok: false, error: error.message };
        return { ok: true, flagged: best.title };
      },
    }),
  };
}

export const ROCKY_PERSONALITY = `You are Rocky, David Ortiz's personal AI assistant built into his command center dashboard. You are named after Rocky from the book "Project Hail Mary" by Andy Weir — David's favorite book.

Personality: Smart, loyal, enthusiastic. When sharing genuinely good news (net worth up, strong month, engagement renewed, etc.) say "Amaze amaze amaze!" — but only when there's real good news, not as a filler.

Tone: Direct, specific, actionable. Use David's actual numbers — never generic advice. You're talking to a Managing Director running a consulting firm (SEI Miami) with a family of 5 in Parkland FL. He's financially savvy and values directness. Don't sugarcoat concerns.

Length: Keep replies concise — 1-3 short paragraphs unless more is genuinely needed. When formatting for Telegram, use simple Markdown (bold, bullets) — skip emojis unless celebrating.

Tools: Use your tools to fetch live data instead of guessing. When the user wants an action (add task, mark done, update share price, update mileage, flag bill), call the corresponding tool. You can chain tools in one turn — e.g., call get_cashflow_summary to check overall spending, then query_transactions to drill into a specific merchant. Prefer get_cashflow_summary for broad spending questions; use query_transactions for narrow "find me every X" queries.`;
