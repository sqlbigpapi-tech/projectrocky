import { getSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_month_close').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  const now = new Date();
  const prevMonth = now.getMonth(); // 0-indexed, so this is last month since cron runs on 1st
  const prevMonthNum = prevMonth === 0 ? 12 : prevMonth;
  const year = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();

  // Check if last month's actuals are already uploaded
  const { data: pl } = await db
    .from('pl_monthly')
    .select('revenue, net_income, is_forecast')
    .eq('year', year)
    .eq('month', prevMonthNum)
    .eq('market', 'MIA')
    .single();

  const hasActuals = pl && !pl.is_forecast && pl.revenue > 0;

  // Get YTD summary
  const { data: ytdData } = await db
    .from('pl_monthly')
    .select('net_income, is_forecast')
    .eq('year', now.getFullYear())
    .eq('market', 'MIA')
    .lte('month', prevMonthNum);

  const ytdActual = (ytdData ?? []).filter(m => !m.is_forecast);
  const ytdNI = ytdActual.reduce((s, m) => s + m.net_income, 0);

  const lines: string[] = [`📊 Rocky · Month-End Close Reminder`];
  lines.push(`\n${MONTHS[prevMonthNum - 1]} ${year} has closed.`);

  if (hasActuals) {
    lines.push(`\n✅ Actuals already uploaded`);
    lines.push(`  Revenue: $${pl.revenue.toLocaleString()}`);
    lines.push(`  Net Income: $${pl.net_income.toLocaleString()}`);
  } else {
    lines.push(`\n❌ No actuals uploaded yet for ${MONTHS[prevMonthNum - 1]}`);
    lines.push(`  Upload the ${MONTHS[prevMonthNum - 1]} worksheet in FIN MODEL → UPLOAD`);
  }

  lines.push(`\nYTD Net Income: $${ytdNI.toLocaleString()} (${ytdActual.length} months actual)`);

  await sendSMS(lines.join('\n'));
  return NextResponse.json({ sent: true, month: prevMonthNum, hasActuals });
}
