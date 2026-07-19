import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Delete the short-name duplicates on 2026-04-14
// Delete the PENDING duplicates (the POSTED row with full ACH descriptor is the canonical one).
// Income amounts are stored negative in this schema.
const TARGETS = [
  { date: '2026-04-14', name: 'Ach Dep Sei-osv', amount: -26264.55 },
  { date: '2026-04-14', name: 'Ach Dep Sei - Miami Llc', amount: -7192.29 },
];

async function main() {
  for (const t of TARGETS) {
    const { data, error } = await db
      .from('transactions')
      .select('id, date, amount, name, account_mask')
      .eq('date', t.date)
      .eq('name', t.name)
      .eq('amount', t.amount);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data || data.length === 0) { console.warn(`No match for ${t.name}`); continue; }
    if (data.length > 1) { console.warn(`Ambiguous: ${data.length} matches for ${t.name}`); continue; }
    const row = data[0];
    const { error: delErr } = await db.from('transactions').delete().eq('id', row.id);
    if (delErr) { console.error(delErr.message); process.exit(1); }
    console.log(`Deleted ${row.id}  ${row.date}  $${row.amount}  ${row.name}  (${row.account_mask})`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
