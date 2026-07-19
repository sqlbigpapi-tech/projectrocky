import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await db
    .from('transactions')
    .select('id, date, name, amount, account, account_mask, category, status, type')
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31')
    .order('date', { ascending: true });
  if (error) { console.error(error.message); process.exit(1); }

  const income = data!.filter(t => t.type === 'income');
  console.log(`May 2026 income (type=income): ${income.length} rows\n`);
  let total = 0;
  for (const [i, t] of income.entries()) {
    const amt = Math.abs(Number(t.amount));
    total += amt;
    console.log(`${String(i + 1).padStart(2)}. ${t.date}  $${amt.toFixed(2).padStart(10)}  ${t.name}`);
    console.log(`    account: ${t.account} (${t.account_mask || '—'})  cat: ${t.category || '—'}  status: ${t.status || '—'}`);
  }
  console.log(`\nMay income total: $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  // Negative-amount rows not tagged as income — potential miscategorized deposits
  const suspects = data!.filter(t => t.type !== 'income' && Number(t.amount) < 0);
  if (suspects.length) {
    console.log(`\n⚠ ${suspects.length} negative-amount rows NOT typed as income (possible miscategorized deposits):`);
    for (const t of suspects) {
      console.log(`   ${t.date}  $${Number(t.amount).toFixed(2).padStart(10)}  ${t.name}  [type=${t.type} cat=${t.category || '—'}]`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
