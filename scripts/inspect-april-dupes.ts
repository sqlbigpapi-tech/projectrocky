import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await db
    .from('transactions')
    .select('id, date, amount, name, account, account_mask, status, type')
    .eq('date', '2026-04-14');
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Rows on 2026-04-14: ${data!.length}\n`);
  for (const r of data!) {
    console.log(`id=${r.id}`);
    console.log(`  amount=${r.amount}  type=${r.type}  status=${r.status}`);
    console.log(`  name=${JSON.stringify(r.name)}`);
    console.log(`  account=${JSON.stringify(r.account)} mask=${r.account_mask}\n`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
