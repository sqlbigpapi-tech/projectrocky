import { getSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

const LIABILITY_CATS = ['liability', 'credit_card', 'auto_loan', 'personal_loan'];

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_liability_zero').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  const { data: snapshots } = await db
    .from('net_worth_snapshots')
    .select('*')
    .order('date', { ascending: true });

  if (!snapshots || snapshots.length === 0) return NextResponse.json({ sent: false, reason: 'no snapshots' });

  const snap = snapshots[snapshots.length - 1];
  const zeroed = (snap.accounts as { name: string; category: string; balance: number }[])
    .filter(a => LIABILITY_CATS.includes(a.category) && a.balance === 0);

  if (zeroed.length === 0) return NextResponse.json({ sent: false, reason: 'no zero liabilities' });

  // Track already-notified to avoid repeat alerts
  const { data: notified } = await db.from('settings').select('value').eq('key', 'notif_liability_zero_seen').single();
  const seen: string[] = notified?.value ? JSON.parse(notified.value) : [];
  const newlyZeroed = zeroed.filter(a => !seen.includes(a.name));

  if (newlyZeroed.length === 0) return NextResponse.json({ sent: false, reason: 'already notified' });

  const lines = [
    `🎉 Rocky · Liability Paid Off!`,
    ``,
    ...newlyZeroed.map(a => `✓ ${a.name} — balance is $0`),
  ];

  await sendSMS(lines.join('\n'));

  const updatedSeen = [...seen, ...newlyZeroed.map(a => a.name)];
  await db.from('settings').upsert({ key: 'notif_liability_zero_seen', value: JSON.stringify(updatedSeen) }, { onConflict: 'key' });

  return NextResponse.json({ sent: true, count: newlyZeroed.length });
}
