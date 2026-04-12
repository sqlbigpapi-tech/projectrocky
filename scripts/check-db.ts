import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data: e, error: eErr } = await db.from('engagements').select('id, status, rate').limit(3);
  console.log('engagements:', e, 'error:', eErr);

  const { data: c, error: cErr } = await db.from('consultants').select('id, first_name').limit(3);
  console.log('consultants:', c, 'error:', cErr);

  const { data: cl, error: clErr } = await db.from('clients').select('id, name').limit(3);
  console.log('clients:', cl, 'error:', clErr);

  // Test the join that billing uses
  const { data: joined, error: jErr } = await db
    .from('engagements')
    .select('id, rate, status, consultants (first_name, last_name, level), clients (name)')
    .neq('status', 'closed')
    .limit(3);
  console.log('joined:', JSON.stringify(joined, null, 2), 'error:', jErr);
}

check();
