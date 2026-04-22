import { getSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  // Check notification enabled
  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_daily_tasks').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  // Fetch tasks
  const { data: tasks } = await db
    .from('tasks')
    .select('*')
    .eq('completed', false)
    .not('due_date', 'is', null);

  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;
  const relevant = (tasks ?? []).filter((t: { due_date: string }) => t.due_date <= todayStr);

  const overdue  = relevant.filter((t: { due_date: string }) => t.due_date < todayStr);
  const dueToday = relevant.filter((t: { due_date: string }) => t.due_date === todayStr);

  // Fetch calendar + Oura in parallel
  const base = new URL(request.url).origin;
  const [calRes, ouraRes] = await Promise.all([
    fetch(`${base}/api/calendar?date=${todayStr}`).catch(() => null),
    fetch(`${base}/api/oura`).catch(() => null),
  ]);

  let meetings: { summary: string; start: string; isAllDay: boolean }[] = [];
  try {
    if (calRes) {
      const calData = await calRes.json();
      meetings = (calData.events ?? []).filter((e: { isAllDay: boolean }) => !e.isAllDay);
    }
  } catch {}

  type OuraReadiness = { day: string; score: number };
  type OuraSleepRow  = { day: string; score: number; total_sleep_duration?: number; average_hrv?: number };
  type OuraSummary = { readiness: OuraReadiness[]; sleep: OuraSleepRow[] };
  let health: { line: string; alert: string | null } | null = null;
  try {
    if (ouraRes) {
      const o = (await ouraRes.json()) as OuraSummary & { error?: string };
      if (!o.error) {
        const latest = <T extends { day: string }>(arr?: T[]) =>
          (arr ?? []).slice().sort((a, b) => b.day.localeCompare(a.day))[0] ?? null;
        const r = latest(o.readiness);
        const s = latest(o.sleep);
        const last7 = (o.sleep ?? []).slice(-7).filter(d => d.average_hrv).map(d => d.average_hrv!);
        const prev7 = (o.sleep ?? []).slice(-14, -7).filter(d => d.average_hrv).map(d => d.average_hrv!);
        const avgL = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : 0;
        const avgP = prev7.length ? prev7.reduce((a, b) => a + b, 0) / prev7.length : 0;
        const hrvPct = avgP > 0 ? Math.round(((avgL - avgP) / avgP) * 100) : 0;

        const bits: string[] = [];
        if (r) bits.push(`Readiness ${r.score}`);
        if (s?.total_sleep_duration) {
          const h = Math.floor(s.total_sleep_duration / 3600);
          const m = Math.floor((s.total_sleep_duration % 3600) / 60);
          bits.push(`Sleep ${h}h ${m}m`);
        }
        if (s?.average_hrv) {
          const trend = hrvPct === 0 ? '' : ` (${hrvPct > 0 ? '↑' : '↓'}${Math.abs(hrvPct)}%)`;
          bits.push(`HRV ${Math.round(s.average_hrv)}ms${trend}`);
        }

        let alert: string | null = null;
        if (r && r.score < 70) alert = `Readiness ${r.score} — ease in today`;
        else if (hrvPct <= -10) alert = `HRV down ${Math.abs(hrvPct)}% week-over-week — recovery light recommended`;
        else if (s && s.score < 70) alert = `Sleep score ${s.score} — low tank, prioritize rest tonight`;

        if (bits.length > 0) health = { line: `🫀 ${bits.join(' · ')}`, alert };
      }
    }
  } catch {}

  // Build message — only send if there's something to report
  if (relevant.length === 0 && meetings.length === 0 && !health) {
    return NextResponse.json({ sent: false, reason: 'no tasks, meetings, or health data' });
  }

  const lines: string[] = ['☀️ Rocky · Good Morning'];

  // Health strip (compact, one line + optional alert)
  if (health) {
    lines.push(`\n${health.line}`);
    if (health.alert) lines.push(`⚠️ ${health.alert}`);
  }

  // Calendar
  if (meetings.length > 0) {
    lines.push(`\n📅 ${meetings.length} meeting${meetings.length > 1 ? 's' : ''} today:`);
    meetings.forEach((m: { summary: string; start: string }) => {
      const time = new Date(m.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
      lines.push(`• ${time} — ${m.summary}`);
    });
  }

  // Tasks
  if (dueToday.length > 0) {
    lines.push(`\n✅ Due today (${dueToday.length}):`);
    dueToday.forEach((t: { title: string }) => lines.push(`• ${t.title}`));
  }
  if (overdue.length > 0) {
    lines.push(`\n⚠️ Overdue (${overdue.length}):`);
    overdue.forEach((t: { title: string; due_date: string }) => lines.push(`• ${t.title} — was due ${t.due_date}`));
  }

  if (meetings.length === 0 && relevant.length === 0) {
    lines.push('\nNo meetings or tasks today. Clear day.');
  }

  await sendSMS(lines.join('\n'));
  return NextResponse.json({ sent: true, tasks: relevant.length, meetings: meetings.length });
}
