/**
 * One-shot: sync golf_clubs DB rows to the new Trackman numbers (May 2026).
 *
 * Driver:   loft 10.5° → 9°, model "Qi4d" → "Qi4D"
 * 3 Wood:   carry 220→240, total 238→262, model "Callaway Paradym HL" → "TaylorMade Qi4D"
 * 2 Hybrid: carry 205→218, total 220→240
 *
 * Usage:
 *   npx tsx scripts/update-bag-may2026.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type Patch = {
  match: { club: string };
  set: { loft?: string; carry?: number; total?: number; model?: string };
};

const PATCHES: Patch[] = [
  { match: { club: 'Driver' },   set: { loft: '9°', model: 'TaylorMade Qi4D LS' } },
  { match: { club: '3 Wood' },   set: { loft: '15°', carry: 240, total: 262, model: 'TaylorMade Qi4D' } },
  { match: { club: '2 Hybrid' }, set: { carry: 218, total: 240, model: 'TaylorMade Qi4D' } },
];

async function main() {
  const db = createClient(URL, KEY, { auth: { persistSession: false } });

  for (const p of PATCHES) {
    const { data: existing, error: selErr } = await db
      .from('golf_clubs')
      .select('id, club, loft, carry, total, model')
      .eq('club', p.match.club);
    if (selErr) throw selErr;
    if (!existing || existing.length === 0) {
      console.warn(`skip: no row for ${p.match.club}`);
      continue;
    }
    if (existing.length > 1) {
      console.warn(`skip: ${existing.length} rows for ${p.match.club} (ambiguous)`);
      continue;
    }
    const before = existing[0];
    const { error: updErr } = await db
      .from('golf_clubs')
      .update({ ...p.set, updated_at: new Date().toISOString() })
      .eq('id', before.id);
    if (updErr) throw updErr;
    console.log(`✓ ${p.match.club}:`, p.set);
  }

  const { data: after } = await db
    .from('golf_clubs')
    .select('club, loft, carry, total, model')
    .order('position', { ascending: true });
  console.log('\nfinal bag:');
  console.table(after);
}

main().catch(e => { console.error(e); process.exit(1); });
