import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const BILL_TITLES = [
  'Pay IRS',
  'Pay Amex Delta Card',
  'Pay Best Buy CC',
  'Pay Shell Card',
  'Pay David Chase Freedom Unlimited (...4985)',
  'Pay Erica Chase Freedom Unlimited',
  'Pay Chase Amazon Prime Visa',
  'Pay AMEX Plat',
  'Pay CitiBank CC',
  'Pay FP&L',
  'Weston Hills Country Club',
];

async function main() {
  const { data, error } = await db
    .from('tasks')
    .update({ is_bill: true })
    .in('title', BILL_TITLES)
    .select('id, title');
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Flagged ${data!.length} tasks as bills:`);
  for (const t of data!) console.log(`  • ${t.title}`);
  const missed = BILL_TITLES.filter(t => !data!.some(d => d.title === t));
  if (missed.length) {
    console.log(`\nNot found (check exact title match):`);
    for (const t of missed) console.log(`  • ${t}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
