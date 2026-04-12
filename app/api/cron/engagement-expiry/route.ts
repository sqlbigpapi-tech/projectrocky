import { getSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_engagement_expiry').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  const { data: engagements } = await db
    .from('engagements')
    .select('id, sow_end, rate, deal_name, consultants (first_name, last_name), clients (name)')
    .neq('status', 'closed');

  if (!engagements || engagements.length === 0) {
    return NextResponse.json({ sent: false, reason: 'no engagements' });
  }

  const today = new Date();
  const thirtyOut = new Date(today);
  thirtyOut.setDate(thirtyOut.getDate() + 30);

  const expiring = engagements.filter(e => {
    const end = new Date(e.sow_end);
    return end >= today && end <= thirtyOut;
  });

  if (expiring.length === 0) {
    return NextResponse.json({ sent: false, reason: 'none expiring within 30 days' });
  }

  const lines: string[] = [`⚠️ Rocky · ${expiring.length} Engagement${expiring.length > 1 ? 's' : ''} Ending Within 30 Days`];

  for (const e of expiring) {
    const c = e.consultants as unknown as { first_name: string; last_name: string };
    const cl = e.clients as unknown as { name: string } | null;
    const daysLeft = Math.ceil((new Date(e.sow_end).getTime() - today.getTime()) / 86400000);
    const endDate = new Date(e.sow_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    lines.push(`\n• ${c.first_name} ${c.last_name} @ ${cl?.name ?? 'Unknown'}`);
    lines.push(`  $${e.rate}/hr · ends ${endDate} (${daysLeft}d)`);
    if (e.deal_name) lines.push(`  ${e.deal_name}`);
  }

  const monthlyRevAtRisk = expiring.reduce((s, e) => s + e.rate * 8 * 21, 0);
  lines.push(`\n💰 Monthly revenue at risk: $${monthlyRevAtRisk.toLocaleString()}`);

  await sendSMS(lines.join('\n'));
  return NextResponse.json({ sent: true, count: expiring.length });
}
