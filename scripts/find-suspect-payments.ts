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
      .select('date, amount, type, name, category, parent_category')
      .gte('date', '2026-01-01')
      .eq('type', 'regular')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    data.push(...page);
    if (page.length < PAGE) break;
  }

  const NEEDLES = ['citibank', 'best buy', 'barclay', 'capital one', 'discover', 'amex', 'american express', 'chase', 'crdt cd', 'credit crd', 'epay', 'card serv'];
  const hits = data.filter(t => NEEDLES.some(n => t.name?.toLowerCase().includes(n)));

  const byName = new Map<string, { total: number; count: number }>();
  for (const t of hits) {
    const k = t.name || '<unk>';
    const r = byName.get(k) ?? { total: 0, count: 0 };
    r.total += Number(t.amount);
    r.count++;
    byName.set(k, r);
  }
  console.log('Remaining regular-typed rows matching CC-payment keywords:');
  for (const [n, r] of [...byName.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  $${r.total.toFixed(0).padStart(7)}  ${r.count.toString().padStart(3)}  ${n}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
