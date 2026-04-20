import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CC_PAYMENT_PATTERNS = [
  /epay.*chase/i,
  /amex.*epayment/i,
  /ach.*amex/i,
  /ckfpos.*online.*american.*express/i,
  /payment.*citi.*card.*online/i,
  /payment.*american.*express/i,
  /^online transfer/i,
  /^online payment to/i,
];

async function main() {
  // Pull everything in pages of 1000
  const all: { id: string; date: string; name: string; type: string }[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await db.from('transactions').select('id, date, name, type').range(from, from + PAGE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Total rows in DB: ${all.length}`);

  const toReclassify = all.filter(t =>
    t.type === 'regular' && CC_PAYMENT_PATTERNS.some(p => p.test(t.name))
  );
  console.log(`Matching 'regular' rows to reclassify as 'internal transfer': ${toReclassify.length}`);

  if (toReclassify.length === 0) { console.log('Nothing to do.'); return; }

  const ids = toReclassify.map(t => t.id);
  const BATCH = 500;
  let updated = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { data, error } = await db
      .from('transactions')
      .update({ type: 'internal transfer' })
      .in('id', batch)
      .select('id');
    if (error) { console.error(error.message); process.exit(1); }
    updated += data?.length ?? 0;
  }
  console.log(`Reclassified ${updated} rows.`);
}

main().catch(e => { console.error(e); process.exit(1); });
