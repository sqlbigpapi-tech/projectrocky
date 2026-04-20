import { getSupabase } from '@/lib/supabase';
import { getForecast } from '@/lib/billing';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

async function weekAheadSection(db: ReturnType<typeof getSupabase>): Promise<string[]> {
  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_week_ahead').single();
  if (setting?.value === 'false') return [];

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const weekStr = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

  const { data: tasks } = await db.from('tasks').select('*').eq('completed', false);
  const weekTasks = (tasks ?? []).filter((t: { due_date: string | null; recurrence: string | null }) =>
    t.recurrence === 'daily' || (t.due_date && t.due_date >= todayStr && t.due_date <= weekStr)
  ).sort((a: { due_date: string | null }, b: { due_date: string | null }) => {
    if (!a.due_date) return -1;
    if (!b.due_date) return 1;
    return a.due_date.localeCompare(b.due_date);
  });

  const out: string[] = ['📅 Week Ahead'];
  if (weekTasks.length === 0) {
    out.push('Clean slate — no tasks due.');
    return out;
  }
  out.push(`${weekTasks.length} task${weekTasks.length === 1 ? '' : 's'}:`);
  for (const t of weekTasks as { title: string; due_date: string | null; priority: string; recurrence: string | null }[]) {
    if (t.recurrence === 'daily') out.push(`• ${t.title} [daily]`);
    else if (t.due_date) {
      const d = new Date(t.due_date + 'T00:00:00');
      out.push(`• ${DOW[d.getDay()]} ${t.due_date.slice(5)} — ${t.title} [${t.priority}]`);
    }
  }
  return out;
}

async function engagementExpirySection(db: ReturnType<typeof getSupabase>): Promise<string[]> {
  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_engagement_expiry').single();
  if (setting?.value === 'false') return [];

  const { data: engagements } = await db
    .from('engagements')
    .select('id, sow_end, rate, deal_name, consultants (first_name, last_name), clients (name)')
    .neq('status', 'closed');
  if (!engagements?.length) return [];

  const today = new Date();
  const thirtyOut = new Date(today); thirtyOut.setDate(thirtyOut.getDate() + 30);
  const expiring = engagements.filter(e => {
    const end = new Date(e.sow_end);
    return end >= today && end <= thirtyOut;
  });
  if (expiring.length === 0) return [];

  const out: string[] = [`⚠️ ${expiring.length} Engagement${expiring.length > 1 ? 's' : ''} Ending Within 30d`];
  for (const e of expiring) {
    const c = e.consultants as unknown as { first_name: string; last_name: string };
    const cl = e.clients as unknown as { name: string } | null;
    const daysLeft = Math.ceil((new Date(e.sow_end).getTime() - today.getTime()) / 86400000);
    const endDate = new Date(e.sow_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    out.push(`• ${c.first_name} ${c.last_name} @ ${cl?.name ?? 'Unknown'} — ends ${endDate} (${daysLeft}d, $${e.rate}/hr)`);
  }
  const monthlyRevAtRisk = expiring.reduce((s, e) => s + e.rate * 8 * 21, 0);
  out.push(`💰 Monthly rev at risk: $${monthlyRevAtRisk.toLocaleString()}`);
  return out;
}

async function revenueCliffSection(db: ReturnType<typeof getSupabase>): Promise<string[]> {
  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_revenue_cliff').single();
  if (setting?.value === 'false') return [];

  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const nextMonth = currentMonth + 1;
  if (nextMonth > 12) return [];

  const forecast = await getForecast(year);
  const billingByMonth: Record<number, number> = {};
  for (const eng of forecast) {
    for (let m = 1; m <= 12; m++) billingByMonth[m] = (billingByMonth[m] ?? 0) + (eng.months[m]?.billing ?? 0);
  }
  const currentRev = billingByMonth[currentMonth] ?? 0;
  const nextRev = billingByMonth[nextMonth] ?? 0;
  if (currentRev === 0) return [];
  const dropPct = ((currentRev - nextRev) / currentRev) * 100;
  if (dropPct < 20) return [];

  const endingThisMonth = forecast.filter(e => {
    const endDate = new Date(e.sowEnd);
    return endDate.getMonth() + 1 === currentMonth && endDate.getFullYear() === year;
  });

  const out: string[] = [`🚨 Revenue Cliff: ${MONTHS[currentMonth - 1]} → ${MONTHS[nextMonth - 1]} drops ${dropPct.toFixed(0)}%`];
  out.push(`$${Math.round(currentRev).toLocaleString()} → $${Math.round(nextRev).toLocaleString()} (-$${Math.round(currentRev - nextRev).toLocaleString()}/mo)`);
  if (endingThisMonth.length > 0) {
    out.push(`Ending in ${MONTHS[currentMonth - 1]}:`);
    for (const e of endingThisMonth) out.push(`• ${e.consultantName} @ ${e.client} ($${e.rate}/hr)`);
  }
  return out;
}

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  const [week, expiry, cliff] = await Promise.all([
    weekAheadSection(db),
    engagementExpirySection(db),
    revenueCliffSection(db),
  ]);

  const sections = [week, expiry, cliff].filter(s => s.length > 0);
  if (sections.length === 0) return NextResponse.json({ sent: false, reason: 'nothing to report' });

  const lines = ['🗓️ Rocky · Monday Briefing', ...sections.flatMap(s => ['', ...s])];

  await sendSMS(lines.join('\n'));
  return NextResponse.json({
    sent: true,
    sections: sections.length,
    included: { week_ahead: week.length > 0, engagement_expiry: expiry.length > 0, revenue_cliff: cliff.length > 0 },
  });
}
