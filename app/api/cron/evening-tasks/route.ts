import { getSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_evening_tasks').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  const { data: tasks } = await db
    .from('tasks')
    .select('*')
    .eq('completed', false)
    .not('due_date', 'is', null);

  const todayStr = new Date().toISOString().split('T')[0];
  const relevant = (tasks ?? []).filter((t: { due_date: string }) => t.due_date <= todayStr);

  if (relevant.length === 0) return NextResponse.json({ sent: false, reason: 'no tasks' });

  const overdue  = relevant.filter((t: { due_date: string }) => t.due_date < todayStr);
  const dueToday = relevant.filter((t: { due_date: string }) => t.due_date === todayStr);

  const lines: string[] = ['🌙 Rocky · Evening Check-in'];
  if (dueToday.length > 0) {
    lines.push(`\nStill due today (${dueToday.length}):`);
    dueToday.forEach((t: { title: string; priority: string }) => lines.push(`• ${t.title} [${t.priority}]`));
  }
  if (overdue.length > 0) {
    lines.push(`\nOverdue (${overdue.length}):`);
    overdue.forEach((t: { title: string; due_date: string }) => lines.push(`• ${t.title} — was due ${t.due_date}`));
  }

  await sendSMS(lines.join('\n'));
  return NextResponse.json({ sent: true, count: relevant.length });
}
