'use client';
import { useState, useEffect, useRef } from 'react';
import TellerConnectButton from './components/TellerConnect';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import BillsTab from './components/BillsTab';
import SportsTab from './components/SportsTab';
import WeatherTab from './components/WeatherTab';
import BriefingTab from './components/BriefingTab';
import NewsTab from './components/NewsTab';
import BDTargetsTab from './components/BDTargetsTab';

type Account = { account_id: string; name: string; type: string; subtype: string; balances: { current: number } };
type Transaction = { transaction_id: string; name: string; date: string; amount: number; category?: string[] };
type Bill = { name: string; amount: number; nextDate: string; daysUntil: number; frequency: string };
type ConnectedItem = { accessToken: string; accounts: Account[]; transactions: Transaction[]; bills: Bill[] };

const COLORS = ['#F59E0B','#ffffff','#EF4444','#10b981','#F97316','#a78bfa','#fb923c','#34d399'];

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function SpendingChart({ transactions }: { transactions: Transaction[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const byCategory: Record<string, number> = {};
  for (const t of transactions.filter(t => t.amount > 0)) {
    const cat = t.category?.[0] || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + t.amount;
  }
  const data = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (data.length === 0 || !mounted) return null;

  return (
    <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800">
      <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono mb-4">Spending by Category</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }} />
          <Legend wrapperStyle={{ fontSize: '13px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}


export default function Home() {
  const [tab, setTab] = useState<'briefing' | 'dashboard' | 'accounts' | 'bills' | 'sports' | 'weather' | 'news' | 'bd'>('briefing');
  const [billsDueSoon, setBillsDueSoon] = useState(0);
  const [items, setItems] = useState<ConnectedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [seiValue, setSeiValue] = useState<string>('');
  const [hiddenAccounts, setHiddenAccounts] = useState<Set<string>>(new Set());
  const seiDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seiLoaded = useRef(false);

  const fetchItem = async (token: string) => {
    const res = await fetch('/api/teller/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token }),
    });
    const data = await res.json();
    setItems(prev => [...prev, {
      accessToken: token,
      accounts: data.accounts || [],
      transactions: data.transactions || [],
      bills: [],
    }]);
  };

  useEffect(() => {
    const stored = localStorage.getItem('hidden_accounts');
    if (stored) setHiddenAccounts(new Set(JSON.parse(stored)));
  }, []);

  function hideAccount(accountId: string) {
    setHiddenAccounts(prev => {
      const next = new Set(prev);
      next.add(accountId);
      localStorage.setItem('hidden_accounts', JSON.stringify([...next]));
      return next;
    });
  }

  function unhideAccount(accountId: string) {
    setHiddenAccounts(prev => {
      const next = new Set(prev);
      next.delete(accountId);
      localStorage.setItem('hidden_accounts', JSON.stringify([...next]));
      return next;
    });
  }

  useEffect(() => {
    async function loadSaved() {
      const [itemsRes, seiRes] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/settings'),
      ]);
      const { items: tokens } = await itemsRes.json();
      const { value } = await seiRes.json();
      if (value) {
        seiLoaded.current = true;
        setSeiValue(value);
      } else {
        seiLoaded.current = true;
      }
      if (tokens?.length) {
        setLoading(true);
        await Promise.all(tokens.map((token: string) => fetchItem(token)));
        setLoading(false);
      }
    }
    loadSaved();
  }, []);

  useEffect(() => {
    if (!seiLoaded.current) return;
    if (seiDebounce.current) clearTimeout(seiDebounce.current);
    seiDebounce.current = setTimeout(() => {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: seiValue }),
      });
    }, 800);
  }, [seiValue]);

  const handleSuccess = async (token: string) => {
    setLoading(true);
    await Promise.all([
      fetchItem(token),
      fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      }),
    ]);
    setLoading(false);
  };

  const handleRemove = async (accessToken: string) => {
    await fetch('/api/items', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });
    setItems(prev => prev.filter(i => i.accessToken !== accessToken));
  };

  const allAccounts = items.flatMap(i => i.accounts).filter(a => !hiddenAccounts.has(a.account_id));
  const allTransactions = items.flatMap(i => i.transactions).filter(t =>
    !hiddenAccounts.has((t as { account_id?: string }).account_id ?? '')
  );
  const allBills = items.flatMap(i => i.bills).sort((a, b) => a.daysUntil - b.daysUntil);

  const seiParsed = parseFloat(seiValue.replace(/,/g, '')) || 0;
  const netWorth = allAccounts.reduce((sum, a) =>
    a.type === 'depository' || a.type === 'investment'
      ? sum + a.balances.current
      : sum - a.balances.current, 0) + seiParsed;
  const monthlyIncome = allTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const monthlyExpenses = allTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const cashFlow = monthlyIncome - monthlyExpenses;

  const metrics = [
    { label: 'Net Worth', value: allAccounts.length || seiParsed ? fmt(netWorth) : '$—', color: 'text-amber-400' },
    { label: 'Monthly Income', value: allAccounts.length ? fmt(monthlyIncome) : '$—', color: 'text-emerald-400' },
    { label: 'Monthly Expenses', value: allAccounts.length ? fmt(monthlyExpenses) : '$—', color: 'text-red-400' },
    { label: 'Cash Flow', value: allAccounts.length ? fmt(cashFlow) : '$—', color: cashFlow >= 0 ? 'text-emerald-400' : 'text-red-400' },
  ];

  const TAB_LABELS: Record<string, string> = {
    briefing: 'BRIEFING',
    dashboard: 'FINANCE',
    accounts: 'ACCOUNTS',
    bills: 'BILLS',
    sports: 'SPORTS',
    weather: 'WEATHER',
    news: 'NEWS',
    bd: 'BD TARGETS',
  };

  return (
    <main suppressHydrationWarning className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Command center header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b border-zinc-800">
          <div>
            <p className="text-xs text-amber-400 uppercase tracking-[0.3em] font-mono mb-1">Ortiz Command Center</p>
            <h1 className="text-3xl font-bold text-white tracking-tight">Mission Control</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-mono">Parkland, FL</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(['briefing', 'dashboard', 'accounts', 'bills', 'sports', 'weather', 'news', 'bd'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative px-5 py-2 rounded-lg text-xs font-bold transition font-mono tracking-widest ${
                tab === t
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:text-white hover:border-zinc-600'
              }`}>
              {TAB_LABELS[t]}
              {t === 'bills' && billsDueSoon > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {billsDueSoon}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Briefing Tab */}
        {tab === 'briefing' && (
          <BriefingTab
            bills={allBills}
            cashFlow={cashFlow}
            monthlyIncome={monthlyIncome}
            monthlyExpenses={monthlyExpenses}
            netWorth={netWorth}
            hasAccounts={allAccounts.length > 0}
          />
        )}

        {/* Weather Tab */}
        {tab === 'weather' && <WeatherTab />}

        {/* News Tab */}
        {tab === 'news' && <NewsTab />}

        {/* BD Targets Tab */}
        {tab === 'bd' && <BDTargetsTab />}

        {/* Dashboard Tab */}
        {tab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {metrics.map((card) => (
                <div key={card.label} className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-2">{card.label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
                </div>
              ))}
              <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-2">SEI Ownership</p>
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-bold text-amber-400">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={seiValue}
                    onChange={e => setSeiValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent pl-6 text-2xl font-bold text-amber-400 placeholder-zinc-700 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-zinc-600 mt-1">Included in net worth</p>
              </div>
            </div>

            {loading && (
              <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800 text-center text-zinc-500 mb-6">
                Loading your accounts...
              </div>
            )}

            {allTransactions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <SpendingChart transactions={allTransactions} />
                <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800">
                  <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono mb-4">Top 5 Purchases · This Month</h2>
                  <div className="space-y-3">
                    {[...allTransactions]
                      .filter(t => {
                        if (t.amount <= 0) return false;
                        const now = new Date();
                        const d = new Date(t.date);
                        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                      })
                      .sort((a, b) => b.amount - a.amount)
                      .slice(0, 5)
                      .map((t, i) => (
                        <div key={t.transaction_id} className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                          <span className="text-zinc-600 text-sm w-4">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{t.name}</p>
                            <p className="text-sm text-zinc-500">{t.date}</p>
                          </div>
                          <p className="font-bold text-red-400 shrink-0">{fmt(t.amount)}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {allBills.length > 0 && (
              <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800 mb-6">
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono mb-4">Upcoming Bills</h2>
                <div className="space-y-3">
                  {allBills.map((bill, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-zinc-800 pb-3">
                      <div>
                        <p className="font-medium">{bill.name}</p>
                        <p className="text-sm text-zinc-500 capitalize">{bill.frequency} · due {bill.nextDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-400">{fmt(bill.amount)}</p>
                        <p className={`text-xs mt-0.5 ${bill.daysUntil <= 7 ? 'text-yellow-400' : 'text-zinc-600'}`}>
                          {bill.daysUntil === 0 ? 'due today' : `in ${bill.daysUntil}d`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allTransactions.length > 0 && (
              <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800 mb-6">
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono mb-4">Recent Transactions</h2>
                <div className="space-y-3">
                  {allTransactions.slice(0, 10).map((txn) => (
                    <div key={txn.transaction_id} className="flex justify-between items-center border-b border-zinc-800 pb-3">
                      <div>
                        <p className="font-medium">{txn.name}</p>
                        <p className="text-sm text-zinc-500">{txn.date} · {txn.category?.[0] || 'Uncategorized'}</p>
                      </div>
                      <p className={`font-bold ${txn.amount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {txn.amount > 0 ? '-' : '+'}{fmt(Math.abs(txn.amount))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 && !loading && (
              <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800">
                <h2 className="text-lg font-semibold mb-2">Get Started</h2>
                <p className="text-zinc-400 mb-4">Connect a bank account to see your finances.</p>
                <TellerConnectButton onSuccess={handleSuccess} />
              </div>
            )}
          </>
        )}

        {/* Sports Tab */}
        {tab === 'sports' && <SportsTab />}

        {/* Bills Tab */}
        {tab === 'bills' && (
          <BillsTab
            plaidBills={allBills}
            transactions={allTransactions}
            onDueCount={setBillsDueSoon}
          />
        )}

        {/* Accounts Tab */}
        {tab === 'accounts' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono">Connected Institutions</h2>
              <TellerConnectButton onSuccess={handleSuccess} label="Add Account" />
            </div>

            {loading && (
              <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800 text-center text-zinc-500 mb-4">
                Connecting...
              </div>
            )}

            {items.length === 0 && !loading && (
              <div className="bg-zinc-950 rounded-xl p-6 border border-zinc-800 text-zinc-500">
                No accounts connected yet.
              </div>
            )}

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={item.accessToken} className="bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="flex justify-between items-center p-4 border-b border-zinc-800">
                    <p className="font-semibold text-white">Institution {idx + 1}</p>
                    <button
                      onClick={() => handleRemove(item.accessToken)}
                      className="text-sm text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-300/50 px-3 py-1 rounded-lg transition">
                      Remove
                    </button>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {item.accounts.map(account => {
                      const isHidden = hiddenAccounts.has(account.account_id);
                      return (
                        <div key={account.account_id} className={`flex justify-between items-center px-4 py-3 ${isHidden ? 'opacity-40' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{account.name}</p>
                            <p className="text-sm text-zinc-500 capitalize">{account.type} · {account.subtype}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-amber-400">{fmt(account.balances.current)}</p>
                            <button
                              onClick={() => isHidden ? unhideAccount(account.account_id) : hideAccount(account.account_id)}
                              className={`text-xs px-2 py-1 rounded-lg border transition ${
                                isHidden
                                  ? 'text-emerald-400 border-emerald-400/30 hover:border-emerald-400/60'
                                  : 'text-zinc-500 border-zinc-700 hover:text-red-400 hover:border-red-400/40'
                              }`}
                            >
                              {isHidden ? 'Restore' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
