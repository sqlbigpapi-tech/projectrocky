import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // All May rows where amount > 0 (money in) — regardless of type
  const { data, error } = await db
    .from('transactions')
    .select('date, name, amount, account, type, category, status')
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31')
    .gt('amount', 0)
    .order('date');
  if (error) { console.error(error.message); process.exit(1); }

  console.log(`May 2026 — ALL positive-amount rows: ${data!.length}\n`);
  for (const t of data!) {
    const flag = t.type === 'income' ? '✓income' : `  [${t.type}]`;
    console.log(`${t.date}  $${Number(t.amount).toFixed(2).padStart(9)}  ${flag}  ${t.name?.slice(0, 60)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
