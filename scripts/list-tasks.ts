import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await db.from('tasks').select('id, title, category, recurrence, completed').order('created_at', { ascending: false });
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Total: ${data!.length}`);
  for (const t of data!) {
    console.log(`  [${t.completed ? '✓' : ' '}] ${t.category.padEnd(8)} ${(t.recurrence ?? '-').padEnd(8)} ${t.title}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
