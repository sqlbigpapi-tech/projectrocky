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
      .select('date, amount, type, name, category')
      .gte('date', '2026-01-01')
      .lte('date', '2026-12-31')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    data.push(...page);
    if (page.length < PAGE) break;
  }

  const months: Record<string, { income: number; expense: number; rows: number }> = {};
  for (const t of data) {
    const m = String(t.date).slice(0, 7);
    months[m] ??= { income: 0, expense: 0, rows: 0 };
    months[m].rows++;
    const amt = Number(t.amount);
    if (t.type === 'income') months[m].income += Math.abs(amt);
    else if (t.type === 'regular') {
      if (amt > 0) months[m].expense += amt;
      else months[m].income += Math.abs(amt);
    }
  }

  console.log('Month     Income      Expense     Net         Rows');
  for (const m of Object.keys(months).sort()) {
    const x = months[m];
    const net = x.income - x.expense;
    console.log(`${m}   $${x.income.toFixed(0).padStart(9)}  $${x.expense.toFixed(0).padStart(9)}  $${net.toFixed(0).padStart(9)}  ${x.rows}`);
  }

  const mayExp = data.filter(t => String(t.date).startsWith('2026-05') && t.type === 'regular' && Number(t.amount) > 0)
                       .sort((a, b) => Number(b.amount) - Number(a.amount))
                       .slice(0, 15);
  console.log('\nTop 15 May 2026 expense rows:');
  for (const t of mayExp) {
    console.log(`  ${t.date}  $${Number(t.amount).toFixed(2).padStart(9)}  ${t.name?.slice(0, 60)}  [${t.category || '—'}]`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
