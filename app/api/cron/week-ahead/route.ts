import { getSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_week_ahead').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr   = today.toISOString().split('T')[0];
  const weekStr    = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

  const { data: tasks } = await db
    .from('tasks')
    .select('*')
    .eq('completed', false);

  const weekTasks = (tasks ?? []).filter((t: { due_date: string | null; recurrence: string | null }) =>
    t.recurrence === 'daily' || (t.due_date && t.due_date >= todayStr && t.due_date <= weekStr)
  ).sort((a: { due_date: string | null }, b: { due_date: string | null }) => {
    if (!a.due_date) return -1;
    if (!b.due_date) return 1;
    return a.due_date.localeCompare(b.due_date);
  });

  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const lines: string[] = [`📅 Rocky · Week Ahead`];

  if (weekTasks.length === 0) {
    lines.push(`\nNo tasks due this week. Clean slate.`);
  } else {
    lines.push(`\nTasks this week (${weekTasks.length}):`);
    weekTasks.forEach((t: { title: string; due_date: string | null; priority: string; recurrence: string | null }) => {
      if (t.recurrence === 'daily') {
        lines.push(`• ${t.title} [daily]`);
      } else if (t.due_date) {
        const d = new Date(t.due_date + 'T00:00:00');
        lines.push(`• ${dow[d.getDay()]} ${t.due_date.slice(5)} — ${t.title} [${t.priority}]`);
      }
    });
  }

  await sendSMS(lines.join('\n'));
  return NextResponse.json({ sent: true, count: weekTasks.length });
}
