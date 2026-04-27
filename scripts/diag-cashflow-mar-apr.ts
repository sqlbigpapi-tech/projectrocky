import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CC_PAYMENT_PATTERNS = [
  /epay.*chase/i,
  /amex.*epayment/i,
  /ach.*amex/i,
  /ckfpos.*online.*american.*express/i,
  /payment.*citi.*card.*online/i,
  /payment.*american.*express/i,
  /^online transfer/i,
  /^online payment to/i,
];

async function main() {
  const months = [{ y: 2026, m: 3, label: 'March 2026' }, { y: 2026, m: 4, label: 'April 2026' }];

  for (const { y, m, label } of months) {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = m === 12 ? `${y}-12-31` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const { data, error } = await db
      .from('transactions')
      .select('*')
      .gte('date', start)
      .lt('date', end);
    if (error) { console.error(error.message); continue; }
    const all = data ?? [];

    console.log(`\n══════════ ${label} ══════════`);
    console.log(`Total rows: ${all.length}`);

    // Reproduce the cashflow API filter: drop internal transfers + pending
    const filtered = all.filter(t => t.type !== 'internal transfer' && t.status !== 'pending');

    // Tally income vs expenses the same way the API does
    let income = 0, expenses = 0;
    for (const t of filtered) {
      if (t.type === 'income') income += Math.abs(Number(t.amount));
      else expenses += Number(t.amount);
    }
    const net = income - expenses;
    console.log(`API would compute: income $${income.toFixed(2)} · expenses $${expenses.toFixed(2)} · net $${net.toFixed(2)}`);

    // Suspect 1: regular-type rows that LOOK like CC payments
    const suspectCcPayments = filtered.filter(t =>
      t.type === 'regular' && CC_PAYMENT_PATTERNS.some(p => p.test(t.name ?? ''))
    );
    if (suspectCcPayments.length) {
      const total = suspectCcPayments.reduce((s, t) => s + Number(t.amount), 0);
      console.log(`\n  ⚠ ${suspectCcPayments.length} regular rows look like CC payments — sum $${total.toFixed(2)}:`);
      for (const t of suspectCcPayments) {
        console.log(`     ${t.date}  ${String(t.name).padEnd(45)}  $${Number(t.amount).toFixed(2)}  [${t.account ?? '?'}]`);
      }
    }

    // Suspect 2: regular rows whose category or parent_category SCREAMS payment but regex missed
    const catLooksPayment = filtered.filter(t => {
      const cat = String(t.category ?? '').toLowerCase();
      const pcat = String(t.parent_category ?? '').toLowerCase();
      const matchedRegex = CC_PAYMENT_PATTERNS.some(p => p.test(t.name ?? ''));
      const looks = /credit card|transfer|payment/.test(cat) || /credit card|transfer|payment/.test(pcat);
      return t.type === 'regular' && looks && !matchedRegex;
    });
    if (catLooksPayment.length) {
      const total = catLooksPayment.reduce((s, t) => s + Number(t.amount), 0);
      console.log(`\n  ⚠ ${catLooksPayment.length} regular rows w/ payment-like category but regex MISSED — sum $${total.toFixed(2)}:`);
      for (const t of catLooksPayment) {
        console.log(`     ${t.date}  ${String(t.name).padEnd(45)}  $${Number(t.amount).toFixed(2)}  [${t.category}]`);
      }
    }

    // Top 5 expenses for sanity
    const topExpenses = filtered
      .filter(t => t.type !== 'income')
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
    console.log(`\n  Top 5 expenses (sanity check):`);
    for (const t of topExpenses) {
      console.log(`     ${t.date}  ${String(t.name).padEnd(45)}  $${Number(t.amount).toFixed(2)}  [${t.type}/${t.category ?? '-'}]`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
