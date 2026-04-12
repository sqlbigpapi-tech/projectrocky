import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function sync() {
  // Get income_tracker actuals for MIA 2026
  const { data: incomeRows } = await db
    .from('income_tracker')
    .select('month, actual, revenue')
    .eq('market', 'MIA')
    .eq('year', 2026)
    .order('month');

  if (!incomeRows) { console.error('No income_tracker data'); return; }

  for (const row of incomeRows) {
    if (row.actual == null && row.revenue == null) continue;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (row.revenue != null) updates.revenue = Math.round(row.revenue);
    if (row.actual != null) {
      updates.net_income = Math.round(row.actual);
      updates.is_forecast = false;
    }

    const { error } = await db
      .from('pl_monthly')
      .update(updates)
      .eq('year', 2026)
      .eq('month', row.month)
      .eq('market', 'MIA');

    if (error) {
      console.error(`Month ${row.month} error:`, error);
    } else {
      console.log(`Month ${row.month}: revenue=${updates.revenue ?? '—'}, net_income=${updates.net_income ?? '—'}`);
    }
  }

  console.log('Sync complete.');
}

sync();
