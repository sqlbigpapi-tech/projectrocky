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
      .select('id, date, amount, type, name, account_mask, status')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    data.push(...page);
    if (page.length < PAGE) break;
  }
  console.log(`Scanned ${data.length} rows.\n`);

  // Group by date+amount+account_mask. Within a group, if there are >1 rows, they're likely dupes.
  const groups = new Map<string, any[]>();
  for (const t of data) {
    const k = `${t.date}|${Number(t.amount).toFixed(2)}|${t.account_mask || ''}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }

  const dupes: any[] = [];
  for (const [k, rows] of groups) {
    if (rows.length < 2) continue;
    dupes.push({ k, rows });
  }

  console.log(`Suspect duplicate groups (same date+amount+account_mask, >1 row): ${dupes.length}\n`);
  for (const { k, rows } of dupes.slice(0, 30)) {
    console.log(`  ${k}`);
    for (const r of rows) {
      console.log(`     ${r.type.padEnd(20)} ${r.status?.padEnd(8)}  ${r.name?.slice(0, 70)}`);
    }
  }
  if (dupes.length > 30) console.log(`  ... and ${dupes.length - 30} more`);
}
main().catch(e => { console.error(e); process.exit(1); });
