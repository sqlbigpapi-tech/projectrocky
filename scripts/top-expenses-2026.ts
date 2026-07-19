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
      .select('date, amount, type, name, category, parent_category, account')
      .gte('date', '2026-01-01')
      .lte('date', '2026-12-31')
      .eq('type', 'regular')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    data.push(...page);
    if (page.length < PAGE) break;
  }

  // Top 25 expenses
  const top = data.filter(t => Number(t.amount) > 0).sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 25);
  console.log(`Top 25 expense rows (type=regular) across 2026:`);
  for (const t of top) {
    console.log(`  ${t.date}  $${Number(t.amount).toFixed(2).padStart(9)}  ${t.name?.slice(0, 55).padEnd(55)} ${t.category || '—'} / ${t.parent_category || '—'}`);
  }

  // Merchant totals
  const byName = new Map<string, { total: number; count: number }>();
  for (const t of data.filter(t => Number(t.amount) > 0)) {
    const k = t.name || '<unknown>';
    const r = byName.get(k) ?? { total: 0, count: 0 };
    r.total += Number(t.amount);
    r.count++;
    byName.set(k, r);
  }
  const topMerch = [...byName.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 15);
  console.log(`\nTop 15 expense merchants (all of 2026, type=regular):`);
  for (const [name, r] of topMerch) {
    console.log(`  $${r.total.toFixed(0).padStart(8)}  ${r.count.toString().padStart(3)} txns  ${name?.slice(0, 60)}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
