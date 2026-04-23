import { getSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { getWeeklyMoneySignals, formatWeeklyMoneyBlock } from '@/lib/moneySignals';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();
  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_weekly_money').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  const base = new URL(request.url).origin;

  try {
    const signals = await getWeeklyMoneySignals(base);
    const lines = formatWeeklyMoneyBlock(signals);
    await sendSMS(lines.join('\n'));
    return NextResponse.json({
      sent: true,
      total: signals.totalSpend,
      prev: signals.prevWeekSpend,
      active_subs: signals.activeSubscriptionsCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Weekly money recap failed' },
      { status: 500 },
    );
  }
}
