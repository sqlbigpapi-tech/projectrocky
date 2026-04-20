import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

type Tx = { date: string; name: string; amount: number; category: string | null };
type Sub = {
  merchant: string;
  cadence: 'monthly' | 'quarterly' | 'annual';
  amount: number;
  hits: number;
  firstSeen: string;
  lastSeen: string;
  totalPaid: number;
  monthlyEquivalent: number;
  active: boolean; // seen within the last 45 days
  category: string | null;
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\d+/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function GET() {
  try {
    const db = getSupabase();
    // Pull all historic expenses (paginated — supabase caps at 1000)
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
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      rows.push(...(data as Tx[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Group by normalized merchant name
    const groups = new Map<string, Tx[]>();
    for (const r of rows) {
      const key = normalizeName(r.name);
      if (!key) continue;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }

    const subs: Sub[] = [];
    const now = Date.now();
    const activeWindowMs = 45 * 86400000;

    for (const [, txs] of groups) {
      if (txs.length < 2) continue;
      txs.sort((a, b) => a.date.localeCompare(b.date));

      // Modal amount (rounded to cents)
      const amountCounts = new Map<number, number>();
      for (const t of txs) {
        const amt = Math.round(Number(t.amount) * 100) / 100;
        amountCounts.set(amt, (amountCounts.get(amt) ?? 0) + 1);
      }
      const [modalAmount, modalHits] = [...amountCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (modalHits < 2) continue;

      // Keep tx within 5% of modal amount
      const matched = txs.filter(t => Math.abs(Number(t.amount) - modalAmount) / modalAmount <= 0.05);
      if (matched.length < 2) continue;

      // Median gap in days
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

      const lastSeen = matched[matched.length - 1].date;
      const firstSeen = matched[0].date;
      const monthlyEquivalent =
        cadence === 'monthly' ? modalAmount :
        cadence === 'quarterly' ? modalAmount / 3 :
        modalAmount / 12;
      const active = (now - new Date(lastSeen).getTime()) <= activeWindowMs;

      subs.push({
        merchant: matched[matched.length - 1].name,
        cadence,
        amount: modalAmount,
        hits: matched.length,
        firstSeen,
        lastSeen,
        totalPaid: matched.reduce((s, t) => s + Number(t.amount), 0),
        monthlyEquivalent: Math.round(monthlyEquivalent * 100) / 100,
        active,
        category: matched[matched.length - 1].category ?? null,
      });
    }

    subs.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);

    const activeSubs = subs.filter(s => s.active);
    const activeMonthlyTotal = Math.round(activeSubs.reduce((s, x) => s + x.monthlyEquivalent, 0) * 100) / 100;

    return NextResponse.json({
      subscriptions: subs,
      summary: {
        active_count: activeSubs.length,
        inactive_count: subs.length - activeSubs.length,
        active_monthly_total: activeMonthlyTotal,
        active_annual_total: Math.round(activeMonthlyTotal * 12 * 100) / 100,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
