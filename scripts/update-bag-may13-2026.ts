/**
 * One-shot: sync golf_clubs to the 5/13/26 Command Center bag update.
 *
 * Usage: npx tsx scripts/update-bag-may13-2026.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const NAME_MAP: Record<string, string> = {
  'PW': 'Pitching Wedge',
  '48 GW': 'Gap Wedge',
};

const BAG = [
  { club: 'Driver',     carry: 260, total: 277 },
  { club: '3 Wood',     carry: 225, total: 251 },
  { club: '2 Hybrid',   carry: 210, total: 234 },
  { club: '5 Iron',     carry: 195, total: 216 },
  { club: '6 Iron',     carry: 185, total: 199 },
  { club: '7 Iron',     carry: 170, total: 184 },
  { club: '8 Iron',     carry: 160, total: 169 },
  { club: '9 Iron',     carry: 150, total: 159 },
  { club: 'PW',         carry: 135, total: 143 },
  { club: '48 GW',      carry: 120, total: 126 },
  { club: '52° Wedge',  carry: 110, total: 114 },
  { club: '56° Wedge',  carry: 100, total: 104 },
  { club: '60° Wedge',  carry: 85,  total: 92  },
];

async function main() {
  for (const row of BAG) {
    const dbName = NAME_MAP[row.club] ?? row.club;
    const { data: existing, error: selErr } = await db
      .from('golf_clubs')
      .select('id, club, carry, total')
      .eq('club', dbName);
    if (selErr) throw selErr;
    if (!existing || existing.length === 0) { console.warn(`skip: no row for ${dbName}`); continue; }
    if (existing.length > 1) { console.warn(`skip: ${existing.length} rows for ${dbName}`); continue; }

    const before = existing[0];
    if (before.carry === row.carry && before.total === row.total) {
      console.log(`= ${dbName}: ${row.carry}/${row.total} (unchanged)`);
      continue;
    }

    const { error: updErr } = await db
      .from('golf_clubs')
      .update({ carry: row.carry, total: row.total, updated_at: new Date().toISOString() })
      .eq('id', before.id);
    if (updErr) throw updErr;
    console.log(`✓ ${dbName}: ${before.carry}/${before.total} → ${row.carry}/${row.total}`);
  }

  const { data: after } = await db
    .from('golf_clubs')
    .select('club, loft, carry, total, model')
    .order('position', { ascending: true });
  console.log('\nfinal bag:');
  console.table(after);
}

main().catch(e => { console.error(e); process.exit(1); });
