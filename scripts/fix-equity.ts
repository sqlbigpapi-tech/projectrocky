import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fix() {
  // 1. Fix equity settings
  console.log('Fixing equity settings...');
  await db.from('settings').upsert({ key: 'equity_shares', value: '11401' }, { onConflict: 'key' });
  await db.from('settings').upsert({ key: 'equity_retained_start', value: '423928' }, { onConflict: 'key' });
  console.log('  shares=11401, retained_start=423928');

  // 2. Update 2025 pl_monthly with NI+SP values from Excel dividend sheet
  // Excel Dividend sheet Row 8 (Jan-Dec): these are "NI from Operations + Stock Purchases"
  const nisp2025 = [292270, 112702, 180713, 59249, 74154, -32971, -51887, -22247, 7718, 128081, 171706, 68747];

  console.log('\nUpdating 2025 stock_purchases...');
  for (let m = 1; m <= 12; m++) {
    // Get existing net_income for 2025
    const { data: row } = await db.from('pl_monthly')
      .select('net_income')
      .eq('year', 2025).eq('month', m).eq('market', 'MIA')
      .single();

    if (row) {
      const stockPurchases = nisp2025[m - 1] - row.net_income;
      await db.from('pl_monthly')
        .update({ stock_purchases: Math.round(stockPurchases) })
        .eq('year', 2025).eq('month', m).eq('market', 'MIA');
      console.log(`  2025-${String(m).padStart(2,'0')}: NI=${row.net_income.toLocaleString()}, SP=${Math.round(stockPurchases).toLocaleString()}, Total=${nisp2025[m-1].toLocaleString()}`);
    }
  }

  // 3. Update 2026 stock_purchases from worksheet (Jan-Mar Unit Purchases)
  const sp2026 = { 1: 32364, 2: 58375, 3: 11368 };
  console.log('\nUpdating 2026 stock_purchases...');
  for (const [month, sp] of Object.entries(sp2026)) {
    await db.from('pl_monthly')
      .update({ stock_purchases: sp })
      .eq('year', 2026).eq('month', parseInt(month)).eq('market', 'MIA');
    console.log(`  2026-${String(month).padStart(2,'0')}: SP=${sp.toLocaleString()}`);
  }

  console.log('\nDone.');
}

fix();
