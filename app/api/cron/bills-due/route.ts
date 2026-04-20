import { getSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_bills_due').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  const { data: bills } = await db
    .from('tasks')
    .select('title, due_date, bill_amount, recurrence')
    .eq('completed', false)
    .eq('is_bill', true)
    .not('due_date', 'is', null);

  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;
  const in3 = new Date(eastern); in3.setDate(in3.getDate() + 3);
  const in3Str = `${in3.getFullYear()}-${String(in3.getMonth() + 1).padStart(2, '0')}-${String(in3.getDate()).padStart(2, '0')}`;

  type Bill = { title: string; due_date: string; bill_amount: number | null; recurrence: string | null };
  const upcoming = ((bills ?? []) as Bill[])
    .filter(b => b.due_date >= todayStr && b.due_date <= in3Str)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  if (upcoming.length === 0) return NextResponse.json({ sent: false, reason: 'no bills in next 3d' });

  const total = upcoming.reduce((s, b) => s + (b.bill_amount ?? 0), 0);
  const lines: string[] = [`💵 Rocky · ${upcoming.length} bill${upcoming.length === 1 ? '' : 's'} due in next 3 days${total > 0 ? ` · ${fmt(total)} total` : ''}`];

  for (const b of upcoming) {
    const label =
      b.due_date === todayStr ? 'today' :
      b.due_date === in3Str ? 'in 3d' :
      `on ${new Date(b.due_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
    const amt = b.bill_amount != null ? ` — ${fmt(b.bill_amount)}` : '';
    lines.push(`• ${b.title}${amt} (${label})`);
  }

  await sendSMS(lines.join('\n'));
  return NextResponse.json({ sent: true, count: upcoming.length, total });
}
