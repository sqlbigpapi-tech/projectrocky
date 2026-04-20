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
  const year = 2026;
  const { data: all, error } = await db
    .from('transactions')
    .select('*')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);
  if (error) { console.error(error.message); process.exit(1); }

  const total = all!.length;
  console.log(`Total ${year} transactions: ${total}\n`);

  // Type distribution
  const byType = new Map<string, number>();
  for (const t of all!) byType.set(t.type ?? '<empty>', (byType.get(t.type ?? '<empty>') ?? 0) + 1);
  console.log('Types:');
  for (const [k, v] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${v}`);

  // Account distribution
  const byAccount = new Map<string, number>();
  for (const t of all!) byAccount.set(t.account ?? '<empty>', (byAccount.get(t.account ?? '<empty>') ?? 0) + 1);
  console.log('\nAccounts:');
  for (const [k, v] of [...byAccount].sort((a, b) => b[1] - a[1])) console.log(`  ${(k || '<empty>').padEnd(40)} ${v}`);

  // Currently filtered by regex
  const regularRows = all!.filter(t => t.type !== 'internal transfer');
  const ccMatched = regularRows.filter(t => CC_PAYMENT_PATTERNS.some(p => p.test(t.name)));
  console.log(`\nCC payment regex matches: ${ccMatched.length}`);
  const ccTotal = ccMatched.reduce((s, t) => s + Number(t.amount), 0);
  console.log(`  Total filtered by regex: $${ccTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log('  Sample matched names:');
  const sampleNames = [...new Set(ccMatched.map(t => t.name))].slice(0, 15);
  for (const n of sampleNames) console.log(`    - ${n}`);

  // Transactions with category "Transfers" or "Credit Card Payment" that regex DIDN'T catch
  const catPaymentMissed = regularRows.filter(t => {
    const caughtByRegex = CC_PAYMENT_PATTERNS.some(p => p.test(t.name));
    const looksLikePayment = /credit card|transfer|payment/i.test(String(t.category ?? '')) ||
                              /credit card|transfer|payment/i.test(String(t.parent_category ?? ''));
    return looksLikePayment && !caughtByRegex;
  });
  console.log(`\nCategory looks like payment/transfer but regex MISSED: ${catPaymentMissed.length}`);
  for (const t of catPaymentMissed.slice(0, 10)) {
    console.log(`  ${t.date} ${t.name.padEnd(45)} ${t.category} / ${t.parent_category}`);
  }

  // Transactions regex caught but don't look like payments
  const regexOverReach = ccMatched.filter(t => {
    const cat = String(t.category ?? '').toLowerCase();
    const pcat = String(t.parent_category ?? '').toLowerCase();
    return !/credit card|transfer|payment/.test(cat) && !/credit card|transfer|payment/.test(pcat);
  });
  console.log(`\nRegex caught but category says NOT a payment: ${regexOverReach.length}`);
  for (const t of regexOverReach.slice(0, 10)) {
    console.log(`  ${t.date} ${t.name.padEnd(45)} ${t.category} / ${t.parent_category}`);
  }

  // Income sanity — any negatives?
  const income = all!.filter(t => t.type === 'income');
  const negIncome = income.filter(t => Number(t.amount) < 0);
  console.log(`\nIncome rows: ${income.length}, negative-amount income (reversals?): ${negIncome.length}`);
  for (const t of negIncome.slice(0, 5)) console.log(`  ${t.date} ${t.name} ${t.amount}`);

  // Null/unknown types
  const unknownTypes = all!.filter(t => !['income','regular','internal transfer'].includes(String(t.type)));
  console.log(`\nRows with type NOT in [income, regular, internal transfer]: ${unknownTypes.length}`);
  for (const t of unknownTypes.slice(0, 10)) console.log(`  ${t.date} ${t.name.padEnd(45)} type=${t.type}`);
}

main().catch(e => { console.error(e); process.exit(1); });
