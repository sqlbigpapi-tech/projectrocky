/**
 * One-shot: sync golf_clubs to the 5/8/26 Trackman session bag card.
 * MEAS = directly measured at Trackman.
 * BUILT = built from anchors (interpolated from neighbors).
 *
 * Usage: npx tsx scripts/update-bag-may8-2026.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// Bag-card club name → DB club name
const NAME_MAP: Record<string, string> = {
  'PW': 'Pitching Wedge',
  'GW': 'Gap Wedge',
};

const BAG = [
  { club: 'Driver',     carry: 250, total: 275 },
  { club: '3 Wood',     carry: 235, total: 258 },
  { club: '2 Hybrid',   carry: 215, total: 235 },
  { club: '5 Iron',     carry: 198, total: 213 },
  { club: '6 Iron',     carry: 188, total: 201 },
  { club: '7 Iron',     carry: 178, total: 189 },
  { club: '8 Iron',     carry: 165, total: 175 },
  { club: '9 Iron',     carry: 156, total: 163 },
  { club: 'PW',         carry: 139, total: 145 },
  { club: 'GW',         carry: 126, total: 131 },
  { club: '52° Wedge',  carry: 115, total: 119 },
  { club: '56° Wedge',  carry: 100, total: 103 },
  { club: '60° Wedge',  carry: 87,  total: 89  },
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
