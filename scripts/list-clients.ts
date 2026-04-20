import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: clients, error } = await db.from('clients').select('*').order('name');
  if (error) { console.error(error.message); process.exit(1); }

  console.log(`Clients (${clients!.length}):\n`);
  for (const c of clients!) {
    console.log(JSON.stringify(c, null, 2));
    console.log();
  }

  // Engagement count per client
  const { data: eng, error: e2 } = await db.from('engagements').select('client_id').order('client_id');
  if (e2) { console.error(e2.message); process.exit(1); }
  const byClient = new Map<string, number>();
  for (const e of eng!) byClient.set(e.client_id, (byClient.get(e.client_id) ?? 0) + 1);

  console.log('\nEngagement counts:');
  for (const c of clients!) {
    console.log(`  ${c.name.padEnd(40)} ${byClient.get(c.id) ?? 0} engagement(s)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
