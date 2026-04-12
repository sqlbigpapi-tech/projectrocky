import { getForecast } from '@/lib/billing';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const { getSupabase } = await import('@/lib/supabase');
  const db = getSupabase();
  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_revenue_cliff').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const nextMonth = currentMonth + 1;

  if (nextMonth > 12) {
    return NextResponse.json({ sent: false, reason: 'end of year' });
  }

  const forecast = await getForecast(year);

  // Sum billing by month
  const billingByMonth: Record<number, number> = {};
  for (const eng of forecast) {
    for (let m = 1; m <= 12; m++) {
      billingByMonth[m] = (billingByMonth[m] ?? 0) + (eng.months[m]?.billing ?? 0);
    }
  }

  const currentRev = billingByMonth[currentMonth] ?? 0;
  const nextRev = billingByMonth[nextMonth] ?? 0;

  if (currentRev === 0) {
    return NextResponse.json({ sent: false, reason: 'no current month revenue' });
  }

  const dropPct = ((currentRev - nextRev) / currentRev) * 100;

  if (dropPct < 20) {
    return NextResponse.json({ sent: false, reason: `drop only ${dropPct.toFixed(0)}%, under 20% threshold` });
  }

  // Find which engagements are ending this month (causing the drop)
  const endingThisMonth = forecast.filter(e => {
    const endDate = new Date(e.sowEnd);
    return endDate.getMonth() + 1 === currentMonth && endDate.getFullYear() === year;
  });

  const lines: string[] = [`🚨 Rocky · Revenue Cliff Alert`];
  lines.push(`\n${MONTHS[currentMonth - 1]} → ${MONTHS[nextMonth - 1]} revenue drops ${dropPct.toFixed(0)}%`);
  lines.push(`  $${Math.round(currentRev).toLocaleString()} → $${Math.round(nextRev).toLocaleString()}`);
  lines.push(`  Delta: -$${Math.round(currentRev - nextRev).toLocaleString()}/mo`);

  if (endingThisMonth.length > 0) {
    lines.push(`\nEngagements ending in ${MONTHS[currentMonth - 1]}:`);
    for (const e of endingThisMonth) {
      lines.push(`• ${e.consultantName} @ ${e.client} ($${e.rate}/hr)`);
    }
  }

  lines.push(`\nReview scenarios in FIN MODEL → SCENARIO`);

  await sendSMS(lines.join('\n'));
  return NextResponse.json({ sent: true, dropPct: Math.round(dropPct), currentRev, nextRev });
}
