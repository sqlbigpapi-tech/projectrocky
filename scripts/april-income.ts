import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await db
    .from('transactions')
    .select('id, date, name, amount, account, account_mask, category, status')
    .gte('date', '2026-04-01')
    .lte('date', '2026-04-30')
    .eq('type', 'income')
    .order('date', { ascending: true });
  if (error) { console.error(error.message); process.exit(1); }

  console.log(`April 2026 income: ${data!.length} rows\n`);
  let total = 0;
  for (const [i, t] of data!.entries()) {
    const amt = Math.abs(Number(t.amount));
    total += amt;
    console.log(`${String(i + 1).padStart(2)}. ${t.date}  $${amt.toFixed(2).padStart(10)}`);
    console.log(`    name:    ${t.name}`);
    console.log(`    account: ${t.account}  (mask ${t.account_mask || '—'})`);
    console.log(`    cat:     ${t.category || '—'}   status: ${t.status || '—'}`);
    console.log(`    id:      ${t.id}`);
    console.log('');
  }
  console.log(`Total: $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
}

main().catch(e => { console.error(e); process.exit(1); });
