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

  // Fetch calendar
  const base = new URL(request.url).origin;
  let meetings: { summary: string; start: string; isAllDay: boolean }[] = [];
  try {
    const calRes = await fetch(`${base}/api/calendar?date=${todayStr}`);
    const calData = await calRes.json();
    meetings = (calData.events ?? []).filter((e: { isAllDay: boolean }) => !e.isAllDay);
  } catch {}

  // Build message — only send if there's something to report
  if (relevant.length === 0 && meetings.length === 0) {
    return NextResponse.json({ sent: false, reason: 'no tasks or meetings' });
  }

  const lines: string[] = ['☀️ Rocky · Good Morning'];

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
