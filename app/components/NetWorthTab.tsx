'use client';
import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

type Category = 'business' | 'depository' | 'retirement' | 'credit_card' | 'auto_loan' | 'personal_loan';
const LIABILITY_CATS: Category[] = ['credit_card', 'auto_loan', 'personal_loan'];

type Account = {
  id: string;
  name: string;
  category: Category;
  balance: number;
  priority?: boolean;
};

type Snapshot = {
  id: string;
  date: string;
  accounts: Account[];
};

const DEFAULT_ACCOUNTS: Account[] = [
  // Business Equity
  { id: 'sei_shares',       name: 'SEI-Miami LLC Shares',             category: 'business',      balance: 773776.43 },
  // Depository
  { id: 'cd',               name: 'Certificate of Deposit',           category: 'depository',    balance: 259296.65 },
  { id: 'money_market',     name: 'Premiere Money Market',            category: 'depository',    balance: 36479.68  },
  { id: 'spend',            name: 'Spend Account',                    category: 'depository',    balance: 20286.82  },
  { id: 'hysa',             name: 'High Yield Savings Account',       category: 'depository',    balance: 123.04    },
  // Retirement & Investments
  { id: 'ira',              name: 'IRA',                              category: 'retirement',    balance: 208679.41 },
  { id: 'sei_401k',         name: 'SEI 401(k) Plan',                  category: 'retirement',    balance: 59486.19  },
  { id: 'joint',            name: 'Joint Account',                    category: 'retirement',    balance: 3817.63   },
  { id: 'hsa',              name: 'Health Savings Account',           category: 'retirement',    balance: 344.21    },
  { id: 'allegiant_401k',   name: 'Allegiant 401(k) Plan',            category: 'retirement',    balance: 0         },
  // Credit Cards
  { id: 'sw_cc',            name: 'Southwest Rapid Rewards',          category: 'credit_card',   balance: 16000.00, priority: true },
  { id: 'amex_plat',        name: 'Amex Platinum',                    category: 'credit_card',   balance: 6121.63   },
  { id: 'chase_4985',       name: 'Chase Ultimate Rewards (4985)',    category: 'credit_card',   balance: 4601.14   },
  { id: 'chase_prime',      name: 'Chase Prime Visa',                 category: 'credit_card',   balance: 4472.66   },
  { id: 'amex_blue',        name: 'Amex Blue Cash Preferred',         category: 'credit_card',   balance: 3553.68   },
  { id: 'delta_skymiles',   name: 'Delta SkyMiles Reserve',           category: 'credit_card',   balance: 1151.90   },
  { id: 'citi_simplicity',  name: 'Citi Simplicity',                  category: 'credit_card',   balance: 168.66    },
  { id: 'chase_9970',       name: 'Chase Ultimate Rewards (9970)',    category: 'credit_card',   balance: 50.00     },
  // Auto Loans
  { id: 'mercedes',         name: '2020 Mercedes-Benz (Ally)',        category: 'auto_loan',     balance: 25468.68  },
  { id: 'bmw',              name: '2018 BMW X1 (Ally)',               category: 'auto_loan',     balance: 19390.41  },
  // Personal Loans
  { id: 'pl_3084',          name: 'PL Loan Card (3084)',              category: 'personal_loan', balance: 36981.00  },
  { id: 'pl_1869',          name: 'PL Loan Card (1869)',              category: 'personal_loan', balance: 16858.60  },
  { id: 'pl_0419',          name: 'PL Loan Card (0419)',              category: 'personal_loan', balance: 2069.90   },
];


const CAT_LABELS: Record<Category, string> = {
  business:      'Business Equity',
  depository:    'Depository',
  retirement:    'Retirement & Investments',
  credit_card:   'Credit Cards',
  auto_loan:     'Auto Loans',
  personal_loan: 'Personal Loans',
};

const CAT_COLORS: Record<Category, string> = {
  business:      '#f59e0b',
  depository:    '#34d399',
  retirement:    '#818cf8',
  credit_card:   '#f87171',
  auto_loan:     '#fb923c',
  personal_loan: '#f43f5e',
};

function fmt(n: number, compact = false): string {
  if (compact) {
    if (Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
    if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(0) + 'K';
    return '$' + n.toFixed(0);
  }
  return '$' + Math.round(n).toLocaleString('en-US');
}

function calcTotals(accounts: Account[]) {
  const assets = accounts.filter(a => !LIABILITY_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
  const liabilities = accounts.filter(a => LIABILITY_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
  return { assets, liabilities, netWorth: assets - liabilities };
}

function catTotal(accounts: Account[], cat: Category) {
  return accounts.filter(a => a.category === cat).reduce((s, a) => s + a.balance, 0);
}

export default function NetWorthTab() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [editing, setEditing] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAccount, setNewAccount] = useState<{ name: string; category: Category; balance: string }>({ name: '', category: 'depository' as Category, balance: '' });
  const [mounted, setMounted] = useState(false);
  const [recs, setRecs] = useState<{ category: string; priority: string; recommendation: string }[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [recsGeneratedAt, setRecsGeneratedAt] = useState<string | null>(null);

  type Assumptions = { age: string; salary: string; role: string; notes: string };
  const DEFAULT_ASSUMPTIONS: Assumptions = { age: '46', salary: '300000', role: 'Managing Director, part owner of SEI-Miami LLC', notes: 'SEI-Miami ownership stake is 100% vested and liquid. Southwest Rapid Rewards is highest priority debt.' };
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [assumptionsSaving, setAssumptionsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/net-worth')
      .then(r => r.json())
      .then(d => {
        const snaps: Snapshot[] = (d.snapshots ?? []).map((s: any) => ({
          id: s.id,
          date: s.date,
          accounts: s.accounts as Account[],
        }));
        setSnapshots(snaps);
        setEditing(snaps.length > 0 ? snaps[snaps.length - 1].accounts : DEFAULT_ACCOUNTS);
      })
      .catch(() => setEditing(DEFAULT_ACCOUNTS));

    fetch('/api/settings?key=nw_assumptions')
      .then(r => r.json())
      .then(d => { if (d.value) setAssumptions(JSON.parse(d.value)); })
      .catch(() => {});
  }, []);

  async function saveAssumptions() {
    setAssumptionsSaving(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'nw_assumptions', value: JSON.stringify(assumptions) }),
    }).catch(() => {});
    setAssumptionsSaving(false);
    setShowAssumptions(false);
  }

  if (!mounted) return null;

  const current = snapshots.length > 0
    ? snapshots[snapshots.length - 1].accounts
    : DEFAULT_ACCOUNTS;

  const { assets, liabilities, netWorth } = calcTotals(current);

  const prev = snapshots.length > 1
    ? calcTotals(snapshots[snapshots.length - 2].accounts).netWorth
    : null;
  const weekChange = prev != null ? netWorth - prev : null;

  // Trajectory chart data
  const trajectoryData = snapshots.map(s => {
    const { netWorth } = calcTotals(s.accounts);
    return {
      date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      netWorth,
    };
  });
  // If no snapshots yet, show a single point with defaults
  if (trajectoryData.length === 0) {
    trajectoryData.push({ date: 'Today', netWorth: calcTotals(DEFAULT_ACCOUNTS).netWorth });
  }

  // Breakdown bar data
  const breakdownData: { name: string; value: number; color: string }[] = [
    { name: 'Business Equity',        value: catTotal(current, 'business'),   color: CAT_COLORS.business   },
    { name: 'Depository',             value: catTotal(current, 'depository'),  color: CAT_COLORS.depository },
    { name: 'Retirement & Inv.',      value: catTotal(current, 'retirement'),  color: CAT_COLORS.retirement },
  ];

  async function saveSnapshot() {
    setSaving(true);
    try {
      const res = await fetch('/api/net-worth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: editing }),
      });
      const d = await res.json();
      if (d.snapshot) {
        const snap: Snapshot = { id: d.snapshot.id, date: d.snapshot.date, accounts: d.snapshot.accounts };
        setSnapshots(prev => {
          const exists = prev.some(s => s.id === snap.id);
          return exists ? prev.map(s => s.id === snap.id ? snap : s) : [...prev, snap];
        });
      }
      setShowForm(false);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  function updateBalance(id: string, val: string) {
    const num = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
    setEditing(prev => prev.map(a => a.id === id ? { ...a, balance: num } : a));
  }

  function updateName(id: string, name: string) {
    setEditing(prev => prev.map(a => a.id === id ? { ...a, name } : a));
  }

  function removeAccount(id: string) {
    setEditing(prev => prev.filter(a => a.id !== id));
  }

  function addAccount() {
    if (!newAccount.name.trim()) return;
    const account: Account = {
      id: Date.now().toString(),
      name: newAccount.name.trim(),
      category: newAccount.category,
      balance: parseFloat(newAccount.balance.replace(/[^0-9.]/g, '')) || 0,
    };
    setEditing(prev => [...prev, account]);
    setNewAccount({ name: '', category: 'depository' as Category, balance: '' });
  }

  async function getRecommendations() {
    setRecsLoading(true);
    setRecsError(null);
    try {
      const res = await fetch('/api/net-worth/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: current, assumptions }),
      });
      const d = await res.json();
      if (d.error) { setRecsError(d.error); return; }
      setRecs(d.recommendations ?? []);
      setRecsGeneratedAt(d.generatedAt ?? new Date().toISOString());
    } catch {
      setRecsError('Failed to fetch recommendations.');
    } finally {
      setRecsLoading(false);
    }
  }

  const categories: Category[] = ['business', 'depository', 'retirement', 'credit_card', 'auto_loan', 'personal_loan'];

  return (
    <div className="space-y-4">

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Assets',      value: assets,      color: 'text-emerald-400', border: 'border-emerald-600/20', bg: 'from-emerald-950/20' },
          { label: 'Total Liabilities', value: liabilities, color: 'text-red-400',     border: 'border-red-600/20',     bg: 'from-red-950/20'     },
          { label: 'Net Worth',         value: netWorth,    color: 'text-amber-400',   border: 'border-amber-600/20',   bg: 'from-amber-950/20'   },
          { label: 'Debt-to-Asset',     value: null,        color: 'text-zinc-300',    border: 'border-zinc-700',       bg: 'from-zinc-900'       },
        ].map((card, i) => (
          <div key={i} className={`rounded-2xl border ${card.border} bg-gradient-to-br ${card.bg} via-zinc-950 to-zinc-950 p-4`}>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">{card.label}</p>
            {card.value !== null ? (
              <>
                <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{fmt(card.value)}</p>
                {card.label === 'Net Worth' && weekChange !== null && (
                  <p className={`text-xs font-mono mt-1 ${weekChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {weekChange >= 0 ? '+' : ''}{fmt(weekChange)} WoW
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums text-zinc-300">
                  {assets > 0 ? ((liabilities / assets) * 100).toFixed(1) : '0.0'}%
                </p>
                <p className="text-xs text-zinc-600 font-mono mt-1">liabilities / assets</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Net Worth Trajectory */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-4">Net Worth Trajectory</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trajectoryData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmt(v, true)} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                contentStyle={{ background: '#09090b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(v: unknown) => [fmt(Number(v)), 'Net Worth']}
              />
              <Line type="monotone" dataKey="netWorth" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Asset Breakdown */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-4">Asset Breakdown</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={breakdownData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmt(v, true)} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                contentStyle={{ background: '#09090b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(v: unknown) => [fmt(Number(v)), 'Balance']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {breakdownData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Account Breakdown ── */}
      <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Accounts</p>
          <div className="flex items-center gap-2">
            {snapshots.length > 0 && (
              <p className="text-xs text-zinc-600 font-mono">
                Last updated {new Date(snapshots[snapshots.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
            <button
              onClick={() => {
                const defaultById = Object.fromEntries(DEFAULT_ACCOUNTS.map(a => [a.id, a]));
                // Remap old 'liability' accounts to new sub-categories and refresh balances from defaults
                const validCats = ['business','depository','retirement','credit_card','auto_loan','personal_loan'];
                const base = current.map(a => {
                  if (!validCats.includes(a.category)) {
                    const def = defaultById[a.id];
                    return { ...a, category: def?.category ?? 'credit_card' as Category, balance: def?.balance ?? a.balance };
                  }
                  return { ...a };
                });
                const existingIds = new Set(base.map(a => a.id));
                const merged = [...base, ...DEFAULT_ACCOUNTS.filter(a => !existingIds.has(a.id))];
                setEditing(merged);
                setShowForm(!showForm);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              {showForm ? 'Cancel' : 'Update Balances'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map(cat => {
            const accounts = current.filter(a => a.category === cat);
            const total = accounts.reduce((s, a) => s + a.balance, 0);
            const isLiability = LIABILITY_CATS.includes(cat);
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold font-mono uppercase tracking-widest" style={{ color: CAT_COLORS[cat] }}>
                    {CAT_LABELS[cat]}
                  </p>
                  <p className={`text-sm font-bold tabular-nums ${isLiability ? 'text-red-400' : 'text-zinc-300'}`}>{fmt(total)}</p>
                </div>
                <div className="space-y-1.5">
                  {accounts.map(a => (
                    <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800">
                      <div className="flex items-center gap-2">
                        {a.priority && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" title="Pay first" />}
                        <p className="text-sm text-zinc-300">{a.name}</p>
                      </div>
                      <p className={`text-sm font-mono tabular-nums font-medium ${isLiability ? 'text-red-400/80' : 'text-zinc-200'}`}>
                        {fmt(a.balance)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Update Form ── */}
      {showForm && (
        <div className="bg-zinc-950 rounded-xl border border-amber-500/20 p-5">
          <p className="text-xs text-amber-400/70 font-mono uppercase tracking-widest mb-5">Update Balances · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {categories.map(cat => (
              <div key={cat}>
                <p className="text-xs font-bold font-mono uppercase tracking-widest mb-3" style={{ color: CAT_COLORS[cat] }}>
                  {CAT_LABELS[cat]}
                </p>
                <div className="space-y-2">
                  {editing.filter(a => a.category === cat).map(a => (
                    <div key={a.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={a.name}
                        onChange={e => updateName(a.id, e.target.value)}
                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                      <div className="relative shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={a.balance}
                          onChange={e => updateBalance(a.id, e.target.value)}
                          className="w-32 pl-7 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-amber-500/50 transition-colors"
                        />
                      </div>
                      <button onClick={() => removeAccount(a.id)} className="text-zinc-700 hover:text-red-400 transition-colors text-lg leading-none shrink-0" title="Remove">×</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Add new account */}
          <div className="border-t border-zinc-800 pt-5 mb-5">
            <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-3">Add Account</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Account name"
                value={newAccount.name}
                onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))}
                className="flex-1 min-w-40 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <select
                value={newAccount.category}
                onChange={e => setNewAccount(p => ({ ...p, category: e.target.value as Category }))}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-colors"
              >
                {categories.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={newAccount.balance}
                  onChange={e => setNewAccount(p => ({ ...p, balance: e.target.value }))}
                  className="w-32 pl-7 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white font-mono tabular-nums placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <button
                onClick={addAccount}
                disabled={!newAccount.name.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                + Add
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500 font-mono">New net worth</p>
              <p className="text-xl font-bold text-amber-400 tabular-nums">{fmt(calcTotals(editing).netWorth)}</p>
            </div>
            <button
              onClick={saveSnapshot}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold font-mono tracking-widest bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-colors shadow-lg shadow-amber-500/20"
            >
              {saving ? 'Saving…' : 'Save Snapshot'}
            </button>
          </div>
        </div>
      )}

      {/* ── Snapshot History ── */}
      {snapshots.length > 1 && (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-4">Snapshot History</p>
          <div className="space-y-1.5">
            {[...snapshots].reverse().map((s, i) => {
              const { netWorth, assets, liabilities } = calcTotals(s.accounts);
              const prevSnap = [...snapshots].reverse()[i + 1];
              const change = prevSnap ? netWorth - calcTotals(prevSnap.accounts).netWorth : null;
              return (
                <div key={s.id} className="flex items-center gap-4 px-3 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800">
                  <p className="text-xs text-zinc-500 font-mono w-24 shrink-0">
                    {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </p>
                  <p className="text-sm font-bold text-amber-400 tabular-nums font-mono flex-1">{fmt(netWorth)}</p>
                  <p className="text-xs text-zinc-600 font-mono hidden md:block">Assets {fmt(assets, true)} · Liabilities {fmt(liabilities, true)}</p>
                  {change !== null && (
                    <p className={`text-xs font-mono tabular-nums w-20 text-right ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {change >= 0 ? '+' : ''}{fmt(change, true)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AI Recommendations ── */}
      <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">AI Recommendations</p>
            {recsGeneratedAt && (
              <p className="text-xs text-zinc-700 font-mono mt-0.5">
                Last generated {new Date(recsGeneratedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssumptions(v => !v)}
              className="px-3 py-2 rounded-xl text-xs font-mono text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              {showAssumptions ? 'Hide' : 'Assumptions'}
            </button>
            <button
              onClick={getRecommendations}
              disabled={recsLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {recsLoading ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>✦ Get AI Recommendations</>
              )}
            </button>
          </div>
        </div>

        {/* Assumptions editor */}
        {showAssumptions && (
          <div className="mb-5 p-4 rounded-xl border border-zinc-700 bg-zinc-900/50 space-y-3">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Context sent to AI</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 font-mono mb-1 block">Age</label>
                <input
                  type="number"
                  value={assumptions.age}
                  onChange={e => setAssumptions(p => ({ ...p, age: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white font-mono focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-mono mb-1 block">Base Salary</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                  <input
                    type="number"
                    value={assumptions.salary}
                    onChange={e => setAssumptions(p => ({ ...p, salary: e.target.value }))}
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-mono mb-1 block">Role / Title</label>
              <input
                type="text"
                value={assumptions.role}
                onChange={e => setAssumptions(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-mono mb-1 block">Additional Context</label>
              <textarea
                rows={3}
                value={assumptions.notes}
                onChange={e => setAssumptions(p => ({ ...p, notes: e.target.value }))}
                placeholder="E.g. planning to sell SEI stake in 3 years, spouse also employed, targeting early retirement at 55..."
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white resize-none placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={saveAssumptions}
                disabled={assumptionsSaving}
                className="px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
              >
                {assumptionsSaving ? 'Saving…' : 'Save Assumptions'}
              </button>
            </div>
          </div>
        )}

        {recsError && (
          <p className="text-sm text-red-400 font-mono">{recsError}</p>
        )}

        {recs.length === 0 && !recsLoading && !recsError && (
          <p className="text-sm text-zinc-600 font-mono">Hit the button to get a fresh read on your numbers.</p>
        )}

        {recs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recs.map((r, i) => {
              const priorityStyles = {
                high:   { border: 'border-red-500/30',   bg: 'bg-red-500/5',   badge: 'bg-red-500/20 text-red-400',   dot: 'bg-red-400'   },
                medium: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-400' },
                low:    { border: 'border-green-500/30', bg: 'bg-green-500/5', badge: 'bg-green-500/20 text-green-400', dot: 'bg-green-400' },
              };
              const s = priorityStyles[r.priority as keyof typeof priorityStyles] ?? priorityStyles.low;
              return (
                <div key={i} className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400">{r.category}</p>
                    <span className={`flex items-center gap-1.5 text-xs font-bold font-mono px-2 py-0.5 rounded-full ${s.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {r.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">{r.recommendation}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
