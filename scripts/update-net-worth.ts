import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type Category = 'business' | 'depository' | 'retirement' | 'credit_card' | 'auto_loan' | 'personal_loan';
type Account = { id: string; name: string; category: Category; balance: number; priority?: boolean };

const ACCOUNTS: Account[] = [
  // Business Equity — balance gets overwritten by live share price in the UI
  { id: 'sei_shares',      name: 'SEI-Miami LLC Shares',          category: 'business',      balance: 888797.00 },

  // Depository
  { id: 'cd',              name: 'Certificate of Deposit',        category: 'depository',    balance: 259296.65 },
  { id: 'money_market',    name: 'Premiere Money Market',         category: 'depository',    balance: 36479.68 },
  { id: 'spend',           name: 'Spend Account',                 category: 'depository',    balance: 18212.47 },
  { id: 'hysa',            name: 'High Yield Savings Account',    category: 'depository',    balance: 136.84 },

  // Retirement & Investments
  { id: 'ira',             name: 'IRA',                           category: 'retirement',    balance: 221184.86 },
  { id: 'sei_401k',        name: 'SEI 401(k) Plan',               category: 'retirement',    balance: 63685.65 },
  { id: 'joint',           name: 'Joint Account',                 category: 'retirement',    balance: 4081.41 },
  { id: 'hsa',             name: 'Health Savings Account',        category: 'retirement',    balance: 427.54 },
  { id: 'allegiant_401k',  name: 'Allegiant 401(k) Plan',         category: 'retirement',    balance: 0 },

  // Credit Cards
  { id: 'chase_prime',     name: 'Chase Prime Visa',              category: 'credit_card',   balance: 7556.76 },
  { id: 'chase_4985',      name: 'Chase Ultimate Rewards (4985)', category: 'credit_card',   balance: 4071.48 },
  { id: 'amex_blue',       name: 'Amex Blue Cash Preferred',      category: 'credit_card',   balance: 3553.68 },
  { id: 'amex_plat',       name: 'Amex Platinum',                 category: 'credit_card',   balance: 2277.15 },
  { id: 'delta_skymiles',  name: 'Delta SkyMiles Reserve',        category: 'credit_card',   balance: 1245.96 },
  { id: 'citi_simplicity', name: 'Citi Simplicity',               category: 'credit_card',   balance: 203.09 },
  { id: 'chase_9970',      name: 'Chase Ultimate Rewards (9970)', category: 'credit_card',   balance: 138.45 },
  { id: 'sw_cc',           name: 'Southwest Rapid Rewards',       category: 'credit_card',   balance: 0, priority: true },

  // Auto Loans
  { id: 'mercedes',        name: '2020 Mercedes-Benz (Ally)',     category: 'auto_loan',     balance: 25468.68 },
  { id: 'bmw',             name: '2018 BMW X1 (Ally)',            category: 'auto_loan',     balance: 19390.41 },

  // Personal Loans
  { id: 'pl_3084',         name: 'PL Loan Card (3084)',           category: 'personal_loan', balance: 36981.00 },
  { id: 'pl_1869',         name: 'PL Loan Card (1869)',           category: 'personal_loan', balance: 16606.68 },
  { id: 'pl_0419',         name: 'PL Loan Card (0419)',           category: 'personal_loan', balance: 0 },
];

async function main() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const { data: existing } = await db
    .from('net_worth_snapshots')
    .select('id')
    .gte('date', todayStart.toISOString())
    .lte('date', todayEnd.toISOString())
    .maybeSingle();

  const payload = { accounts: ACCOUNTS, date: now.toISOString() };
  const result = existing
    ? await db.from('net_worth_snapshots').update(payload).eq('id', existing.id).select().single()
    : await db.from('net_worth_snapshots').insert(payload).select().single();

  if (result.error) { console.error('ERROR:', result.error.message); process.exit(1); }

  const assets = ACCOUNTS.filter(a => !['credit_card','auto_loan','personal_loan'].includes(a.category)).reduce((s,a) => s + a.balance, 0);
  const liabilities = ACCOUNTS.filter(a => ['credit_card','auto_loan','personal_loan'].includes(a.category)).reduce((s,a) => s + a.balance, 0);

  console.log(`${existing ? 'Updated' : 'Inserted'} snapshot ${result.data.id}`);
  console.log(`  Assets:      $${assets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`  Liabilities: $${liabilities.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`  Net worth:   $${(assets - liabilities).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
}

main().catch(e => { console.error(e); process.exit(1); });
