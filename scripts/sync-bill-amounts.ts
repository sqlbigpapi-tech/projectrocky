import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const MAP: { title: string; accountId: string }[] = [
  { title: 'Pay AMEX Plat',                                  accountId: 'amex_plat' },
  { title: 'Pay Chase Amazon Prime Visa',                    accountId: 'chase_prime' },
  { title: 'Pay David Chase Freedom Unlimited (...4985)',    accountId: 'chase_4985' },
  { title: 'Pay CitiBank CC',                                accountId: 'citi_simplicity' },
  { title: 'Pay Amex Delta Card',                            accountId: 'delta_skymiles' },
];

async function main() {
  const { data: snap, error: snapErr } = await db
    .from('net_worth_snapshots')
    .select('accounts')
    .order('date', { ascending: false })
    .limit(1)
    .single();
  if (snapErr || !snap) { console.error('No snapshot:', snapErr?.message); process.exit(1); }

  const byId: Record<string, number> = {};
  for (const a of snap.accounts as { id: string; balance: number }[]) byId[a.id] = a.balance;

  for (const m of MAP) {
    const amount = byId[m.accountId];
    if (amount == null) { console.log(`  ⚠ no account ${m.accountId} in snapshot`); continue; }
    const { error } = await db.from('tasks').update({ bill_amount: amount }).eq('title', m.title);
    if (error) { console.log(`  ✗ ${m.title}: ${error.message}`); continue; }
    console.log(`  ✓ ${m.title} → $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
