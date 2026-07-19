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
      .select('date, amount, name, status, account_mask')
      .gte('date', '2026-01-01')
      .eq('type', 'income')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    data.push(...page);
    if (page.length < PAGE) break;
  }

  const sei = data.filter(t => /sei/i.test(t.name));
  const months: Record<string, { rows: any[]; total: number }> = {};
  for (const t of sei) {
    const m = String(t.date).slice(0, 7);
    months[m] ??= { rows: [], total: 0 };
    months[m].rows.push(t);
    months[m].total += Math.abs(Number(t.amount));
  }

  let ytd = 0;
  for (const m of Object.keys(months).sort()) {
    const x = months[m];
    ytd += x.total;
    console.log(`\n${m}  —  $${x.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}  (${x.rows.length} deposits)`);
    for (const r of x.rows) {
      console.log(`   ${r.date}  $${Math.abs(Number(r.amount)).toFixed(2).padStart(10)}  [${r.status}]  ${r.name}`);
    }
  }
  console.log(`\nSEI YTD total: $${ytd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
}
main().catch(e => { console.error(e); process.exit(1); });
