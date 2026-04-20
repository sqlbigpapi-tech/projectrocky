import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const year = 2026;
  // Paginated pull
  const rows: { date: string; name: string; amount: number; type: string; category: string }[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await db
      .from('transactions')
      .select('date, name, amount, type, category')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .neq('type', 'internal transfer')
      .neq('status', 'pending')
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Non-transfer rows for ${year}: ${rows.length}`);

  const income = rows.filter(r => r.type === 'income').reduce((s, r) => s + Math.abs(r.amount), 0);
  const expenses = rows.filter(r => r.type === 'regular').reduce((s, r) => s + r.amount, 0);
  const net = income - expenses;

  console.log(`  Income:   $${income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`  Expenses: $${expenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`  Net:      $${net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  // Monthly
  console.log(`\nMonthly:`);
  const byMonth = new Map<number, { income: number; expenses: number }>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, { income: 0, expenses: 0 });
  for (const r of rows) {
    const m = new Date(r.date).getMonth() + 1;
    const e = byMonth.get(m)!;
    if (r.type === 'income') e.income += Math.abs(r.amount);
    else e.expenses += r.amount;
  }
  for (const [m, { income, expenses }] of byMonth) {
    if (income === 0 && expenses === 0) continue;
    const sav = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : '—';
    console.log(`  ${String(m).padStart(2, '0')}  income $${income.toFixed(0).padStart(8)}  expenses $${expenses.toFixed(0).padStart(8)}  net $${(income - expenses).toFixed(0).padStart(8)}  sav ${sav}%`);
  }

  // Clawbacks
  const clawbacks = rows.filter(r => r.type === 'income' && r.amount > 0);
  if (clawbacks.length) {
    console.log(`\n⚠ ${clawbacks.length} positive-amount income row(s):`);
    for (const c of clawbacks.slice(0, 5)) console.log(`  ${c.date} ${c.name} ${c.amount}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
