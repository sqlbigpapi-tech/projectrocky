import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const PAGE = 1000;
  const data: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await db
      .from('transactions')
      .select('id, date, amount, type, name, account, account_mask')
      .gte('date', '2026-01-01')
      .eq('type', 'income')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    data.push(...page);
    if (page.length < PAGE) break;
  }

  // Group by date+amount — any group with >1 is a likely duplicate
  const groups = new Map<string, any[]>();
  for (const t of data) {
    const k = `${t.date}|${Math.abs(Number(t.amount)).toFixed(2)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }

  let dupeTotal = 0;
  let dupeCount = 0;
  console.log('Same-date same-amount income groups (>1 row):\n');
  for (const [k, rows] of groups) {
    if (rows.length < 2) continue;
    const amt = Number(rows[0].amount);
    dupeTotal += amt * (rows.length - 1);
    dupeCount += rows.length - 1;
    console.log(`  ${k}  (${rows.length} rows, $${(amt * (rows.length - 1)).toFixed(2)} excess)`);
    for (const r of rows) {
      console.log(`     ${r.id.slice(0, 8)}  ${r.account || '—'} (${r.account_mask || '—'})  ${r.name?.slice(0, 60)}`);
    }
  }
  console.log(`\nTotal excess income from dupes: $${dupeTotal.toFixed(2)} across ${dupeCount} extra rows`);
}
main().catch(e => { console.error(e); process.exit(1); });
