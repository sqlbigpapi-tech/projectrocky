import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function seed() {
  // From Excel: ~12,144 shares issued, ~$470K retained earnings at start of 2026
  const settings = [
    { key: 'equity_shares', value: '12144' },
    { key: 'equity_retained_start', value: '470000' },
  ];

  for (const s of settings) {
    const { error } = await db
      .from('settings')
      .upsert({ key: s.key, value: s.value }, { onConflict: 'key' });
    if (error) console.error(`Error setting ${s.key}:`, error);
    else console.log(`Set ${s.key} = ${s.value}`);
  }

  console.log('Equity settings seeded.');
}

seed();
