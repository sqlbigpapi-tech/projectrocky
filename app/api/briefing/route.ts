import { getSupabase } from '@/lib/supabase';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

type Account = { category: string; balance: number };
type SleepRow = { day: string; score: number; total_sleep_duration?: number };
type EngagementRow = {
  sow_end: string;
  status: string;
  consultants: { first_name: string; last_name: string } | null;
  clients: { name: string } | null;
  rate: number;
};
type CalEvent = { summary: string; start: string; isAllDay: boolean };

const LIAB_CATS = ['credit_card', 'auto_loan', 'personal_loan'];

export type TimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening' | 'late';

function bucketFor(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'late';
}

// Per-instance cache. New Rocky call at most ~once per hour per instance.
let cached: { at: number; summary: string; hour: number } | null = null;
const CACHE_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = eastern.getHours();
  const bucket = bucketFor(hour);

  if (cached && Date.now() - cached.at < CACHE_MS && cached.hour === hour) {
    return NextResponse.json({ summary: cached.summary, timeOfDay: bucket, cached: true });
  }

  const db = getSupabase();
  const base = new URL(request.url).origin;

  const [nwResult, taskResult, engResult, calRes, ouraRes] = await Promise.all([
    db.from('net_worth_snapshots').select('date, accounts').order('date', { ascending: false }).limit(2),
    db.from('tasks').select('title, due_date, is_bill').eq('completed', false),
    db.from('engagements').select('sow_end, status, rate, consultants(first_name, last_name), clients(name)').neq('status', 'closed'),
    fetch(`${base}/api/calendar`).catch(() => null),
    fetch(`${base}/api/oura`).catch(() => null),
  ]);

  const calData = calRes && calRes.ok ? await calRes.json() : null;
  const ouraData = ouraRes && ouraRes.ok ? await ouraRes.json() : null;

  // --- Net worth + delta ---
  const nwSnaps = nwResult.data ?? [];
  let nwContext = 'No net worth snapshot.';
  if (nwSnaps[0]) {
    const cur = nwSnaps[0].accounts as Account[];
    const assets = cur.filter(a => !LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
    const liab = cur.filter(a => LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
    const current = Math.round(assets - liab);
    nwContext = `Net worth: $${current.toLocaleString()}`;
    if (nwSnaps[1]) {
      const prev = nwSnaps[1].accounts as Account[];
      const pA = prev.filter(a => !LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      const pL = prev.filter(a => LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      const delta = current - Math.round(pA - pL);
      const days = Math.max(1, Math.round((new Date(nwSnaps[0].date).getTime() - new Date(nwSnaps[1].date).getTime()) / 86400000));
      nwContext += ` (${delta >= 0 ? '+' : ''}$${delta.toLocaleString()} over ${days} day${days !== 1 ? 's' : ''})`;
    }
  }

  // --- Tasks ---
  const today = new Date(eastern); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const todayISO = today.toISOString().slice(0, 10);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);
  const tasks = (taskResult.data ?? []) as { title: string; due_date: string | null; is_bill: boolean | null }[];
  const overdue = tasks.filter(t => t.due_date && t.due_date < todayISO);
  const todayDue = tasks.filter(t => t.due_date === todayISO);
  const tomorrowDue = tasks.filter(t => t.due_date === tomorrowISO);

  // --- Meetings ---
  const events = (calData?.events ?? []) as CalEvent[];
  const meetings = events.filter(e => !e.isAllDay);
  const now = new Date();
  const nextMeeting = meetings.find(m => new Date(m.start) > now);
  const firstTomorrow: CalEvent | undefined = undefined; // only if we fetch tomorrow's calendar explicitly

  // --- Engagements ---
  const engs = (engResult.data ?? []) as unknown as EngagementRow[];
  const sixtyOut = new Date(today); sixtyOut.setDate(sixtyOut.getDate() + 60);
  const endingSoon = engs.filter(e => {
    const end = new Date(e.sow_end);
    return end >= today && end <= sixtyOut;
  });

  // --- Oura ---
  const sleepRows = (ouraData?.sleep ?? []) as SleepRow[];
  const latestSleep = sleepRows.slice().sort((a, b) => b.day.localeCompare(a.day))[0];

  const dataBlock = `
Local time: ${eastern.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })} (${bucket})

${nwContext}

Tasks:
  Overdue: ${overdue.length}${overdue.length > 0 ? ` — top: ${overdue.slice(0, 2).map(t => t.title).join(', ')}` : ''}
  Due today: ${todayDue.length}${todayDue.length > 0 ? ` — ${todayDue.slice(0, 3).map(t => t.title).join(', ')}` : ''}
  Due tomorrow: ${tomorrowDue.length}

Meetings today: ${meetings.length}${nextMeeting ? ` — next: ${nextMeeting.summary} at ${new Date(nextMeeting.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}` : ''}

Engagements ending within 60 days: ${endingSoon.length}${endingSoon.length > 0 ? ` — first out: ${endingSoon[0].consultants?.first_name} ${endingSoon[0].consultants?.last_name} @ ${endingSoon[0].clients?.name} on ${endingSoon[0].sow_end}` : ''}

Last logged sleep: ${latestSleep ? `${latestSleep.score} score, ${Math.round((latestSleep.total_sleep_duration ?? 0) / 360) / 10}h, for ${latestSleep.day}` : 'unknown'}
  `.trim();

  const toneByBucket: Record<TimeOfDay, string> = {
    morning:   'It\'s morning. Lead with overnight changes and what matters most today. 2-3 short sentences.',
    midday:    'It\'s midday. Status check — progress on today, next meeting, anything pulling the day off course. 2-3 short sentences.',
    afternoon: 'It\'s afternoon. Push toward the end of the day — what\'s still open, what\'s high-leverage to close before end of day. 2-3 short sentences.',
    evening:   'It\'s evening. Recap the day in one sentence, then call out tomorrow\'s top item. 2-3 short sentences.',
    late:      'It\'s late. Keep it light. Brief look-ahead to tomorrow. 1-2 short sentences.',
  };

  try {
    const { text } = await generateText({
      model: 'anthropic/claude-sonnet-4.6',
      maxOutputTokens: 250,
      system: `You are Rocky, David Ortiz's personal AI assistant (named after Rocky from Project Hail Mary). Voice: direct, specific, warm, occasionally enthusiastic. Write a briefing using David's actual numbers — never generic advice.

Tone rules:
- Use "Amaze amaze amaze!" only if there's real good news (net worth up, strong sleep, big win). Don't force it.
- Don't sugarcoat concerns. If something looks off, say it.
- Plain prose, no bullet lists or markdown headings. Conversational.
- No greeting salutation — a greeting is shown above your text.

${toneByBucket[bucket]}`,
      prompt: dataBlock,
    });

    const summary = text.trim();
    cached = { at: Date.now(), summary, hour };
    return NextResponse.json({ summary, timeOfDay: bucket, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Briefing generation failed';
    return NextResponse.json({ error: message, timeOfDay: bucket }, { status: 500 });
  }
}
