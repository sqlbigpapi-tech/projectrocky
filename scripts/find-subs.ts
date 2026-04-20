import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Tx = { date: string; name: string; amount: number; category: string };

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d+/g, '')       // strip numbers
    .replace(/[^a-z\s]/g, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const rows: Tx[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await db
      .from('transactions')
      .select('date, name, amount, category')
      .eq('type', 'regular')
      .neq('status', 'pending')
      .gt('amount', 0)
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${rows.length} expense rows (all-time)\n`);

  // Group by normalized name
  const groups = new Map<string, Tx[]>();
  for (const r of rows) {
    const key = normalizeName(r.name);
    if (!key) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  type Sub = { merchant: string; cadence: 'monthly' | 'quarterly' | 'annual'; amount: number; hits: number; lastSeen: string; totalPaid: number };
  const subs: Sub[] = [];

  for (const [key, txs] of groups) {
    if (txs.length < 2) continue;
    txs.sort((a, b) => a.date.localeCompare(b.date));

    // Look at most common rounded amount
    const amountCounts = new Map<number, number>();
    for (const t of txs) {
      const amt = Math.round(Number(t.amount) * 100) / 100;
      amountCounts.set(amt, (amountCounts.get(amt) ?? 0) + 1);
    }
    const [modalAmount, modalHits] = [...amountCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (modalHits < 2) continue;

    // Keep only txs within 5% of modal amount
    const matched = txs.filter(t => Math.abs(Number(t.amount) - modalAmount) / modalAmount <= 0.05);
    if (matched.length < 2) continue;

    // Compute median days between consecutive hits
    const gaps: number[] = [];
    for (let i = 1; i < matched.length; i++) {
      const d1 = new Date(matched[i - 1].date).getTime();
      const d2 = new Date(matched[i].date).getTime();
      gaps.push((d2 - d1) / 86400000);
    }
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];

    let cadence: Sub['cadence'] | null = null;
    if (median >= 25 && median <= 35) cadence = 'monthly';
    else if (median >= 85 && median <= 95) cadence = 'quarterly';
    else if (median >= 350 && median <= 380) cadence = 'annual';
    if (!cadence) continue;

    const displayMerchant = matched[0].name;
    subs.push({
      merchant: displayMerchant,
      cadence,
      amount: modalAmount,
      hits: matched.length,
      lastSeen: matched[matched.length - 1].date,
      totalPaid: matched.reduce((s, t) => s + Number(t.amount), 0),
    });
  }

  // Sort by monthly-equivalent cost
  const toMonthly = (s: Sub) => s.cadence === 'monthly' ? s.amount : s.cadence === 'quarterly' ? s.amount / 3 : s.amount / 12;
  subs.sort((a, b) => toMonthly(b) - toMonthly(a));

  console.log(`Detected ${subs.length} subscription candidates:\n`);
  let monthlyTotal = 0;
  for (const s of subs) {
    const monthly = toMonthly(s);
    monthlyTotal += monthly;
    console.log(`  $${monthly.toFixed(2).padStart(8)}/mo  ${s.cadence.padEnd(9)}  $${s.amount.toFixed(2).padStart(8)}  ×${String(s.hits).padStart(2)}  last ${s.lastSeen}  ${s.merchant}`);
  }
  console.log(`\nEstimated monthly subscription total: $${monthlyTotal.toFixed(2)} ($${(monthlyTotal * 12).toFixed(2)}/yr)`);
}

main().catch(e => { console.error(e); process.exit(1); });
