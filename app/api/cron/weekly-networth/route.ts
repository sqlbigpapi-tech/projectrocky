import { getSupabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

const LIABILITY_CATS = ['liability', 'credit_card', 'auto_loan', 'personal_loan'];

function fmt(n: number) {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000
    ? `$${(abs / 1_000_000).toFixed(2)}M`
    : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `-${s}` : s;
}

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  const { data: setting } = await db.from('settings').select('value').eq('key', 'notif_weekly_networth').single();
  if (setting?.value === 'false') return NextResponse.json({ skipped: true });

  const { data: snapshots } = await db
    .from('net_worth_snapshots')
    .select('*')
    .order('date', { ascending: true });

  if (!snapshots || snapshots.length === 0) return NextResponse.json({ sent: false, reason: 'no snapshots' });

  const snap = snapshots[snapshots.length - 1];
  const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  const calcNW = (s: typeof snap) => {
    const assets = s.accounts.filter((a: { category: string }) => !LIABILITY_CATS.includes(a.category)).reduce((sum: number, a: { balance: number }) => sum + a.balance, 0);
    const liabs  = s.accounts.filter((a: { category: string }) =>  LIABILITY_CATS.includes(a.category)).reduce((sum: number, a: { balance: number }) => sum + a.balance, 0);
    return { assets, liabs, nw: assets - liabs };
  };

  const { assets, liabs, nw } = calcNW(snap);
  const prevNW = prev ? calcNW(prev).nw : null;
  const change = prevNW !== null ? nw - prevNW : null;

  const date = new Date(snap.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const lines = [
    `💰 Rocky · Weekly Net Worth (${date})`,
    ``,
    `Total Assets:      ${fmt(assets)}`,
    `Total Liabilities: ${fmt(liabs)}`,
    `Net Worth:         ${fmt(nw)}`,
  ];
  if (change !== null) {
    lines.push(`Since Last:        ${change >= 0 ? '+' : ''}${fmt(change)}`);
  }

  await sendSMS(lines.join('\n'));
  return NextResponse.json({ sent: true });
}
