'use client';
import { useState, useEffect, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import BillsTab from './components/BillsTab';

type Account = { account_id: string; name: string; type: string; subtype: string; balances: { current: number } };
type Transaction = { transaction_id: string; name: string; date: string; amount: number; category?: string[] };
type Bill = { name: string; amount: number; nextDate: string; daysUntil: number; frequency: string };
type ConnectedItem = { accessToken: string; accounts: Account[]; transactions: Transaction[]; bills: Bill[] };

const COLORS = ['#6366f1','#22d3ee','#f59e0b','#10b981','#f43f5e','#a78bfa','#fb923c','#34d399'];

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
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => fmt(Number(v))} />
          <Legend wrapperStyle={{ fontSize: '13px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlaidLinkButton({ onSuccess, label = 'Connect a Bank Account' }: { onSuccess: (token: string) => void; label?: string }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const getLinkToken = async () => {
    const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
    const data = await res.json();
    setLinkToken(data.link_token);
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      const res = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      const data = await res.json();
      onSuccess(data.access_token);
    },
  });

  if (!linkToken) {
    return (
      <button onClick={getLinkToken}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg transition text-sm">
        + {label}
      </button>
    );
  }

  return (
    <button onClick={() => open()} disabled={!ready}
      className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-lg transition text-sm">
      Open Bank Login
    </button>
  );
}

export default function Home() {
  const [tab, setTab] = useState<'dashboard' | 'accounts' | 'bills'>('dashboard');
  const [billsDueSoon, setBillsDueSoon] = useState(0);
  const [items, setItems] = useState<ConnectedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [seiValue, setSeiValue] = useState<string>('');
  const seiDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seiLoaded = useRef(false);

  const fetchItem = async (token: string) => {
    const [accountsRes, recurringRes] = await Promise.all([
      fetch('/api/plaid/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      }),
      fetch('/api/plaid/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token, account_ids: [] }),
      }),
    ]);
    const accountsData = await accountsRes.json();
    const recurringData = await recurringRes.json();
    setItems(prev => [...prev, {
      accessToken: token,
      accounts: accountsData.accounts || [],
      transactions: accountsData.transactions || [],
      bills: recurringData.bills || [],
    }]);
  };

  // Load persisted data on mount
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

  // Debounce SEI value persistence — skip until after initial load
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
    await Promise.all([
      fetch('/api/plaid/remove-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      }),
      fetch('/api/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      }),
    ]);
    setItems(prev => prev.filter(i => i.accessToken !== accessToken));
  };

  const allAccounts = items.flatMap(i => i.accounts);
  const allTransactions = items.flatMap(i => i.transactions);
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
    { label: 'Net Worth', value: allAccounts.length || seiParsed ? fmt(netWorth) : '$—', color: 'text-green-400' },
    { label: 'Monthly Income', value: allAccounts.length ? fmt(monthlyIncome) : '$—', color: 'text-blue-400' },
    { label: 'Monthly Expenses', value: allAccounts.length ? fmt(monthlyExpenses) : '$—', color: 'text-red-400' },
    { label: 'Cash Flow', value: allAccounts.length ? fmt(cashFlow) : '$—', color: cashFlow >= 0 ? 'text-green-400' : 'text-red-400' },
  ];

  return (
    <main suppressHydrationWarning className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-1"><span suppressHydrationWarning>🦍</span> Kong Finance</h1>
        <p className="text-gray-400 mb-6">Welcome back, David</p>

        {/* Tabs */}
        <div className="flex gap-3 mb-8">
          {(['dashboard', 'accounts', 'bills'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative px-6 py-2.5 rounded-xl text-sm font-semibold transition capitalize tracking-wide ${
                tab === t
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-gray-900 text-gray-400 border border-gray-800 hover:text-white hover:border-gray-600'
              }`}>
              {t}
              {t === 'bills' && billsDueSoon > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {billsDueSoon}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {tab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {metrics.map((card) => (
                <div key={card.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <p className="text-gray-400 text-sm mb-1">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm mb-1">SEI Ownership Value</p>
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-bold text-purple-400">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={seiValue}
                    onChange={e => setSeiValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent pl-6 text-2xl font-bold text-purple-400 placeholder-gray-700 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">Included in net worth</p>
              </div>
            </div>

            {loading && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center text-gray-400 mb-6">
                Loading your accounts...
              </div>
            )}

            {allTransactions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <SpendingChart transactions={allTransactions} />
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <h2 className="text-lg font-semibold mb-4">Top 5 Purchases</h2>
                  <div className="space-y-3">
                    {[...allTransactions]
                      .filter(t => t.amount > 0)
                      .sort((a, b) => b.amount - a.amount)
                      .slice(0, 5)
                      .map((t, i) => (
                        <div key={t.transaction_id} className="flex items-center gap-3 border-b border-gray-800 pb-3">
                          <span className="text-gray-600 text-sm w-4">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{t.name}</p>
                            <p className="text-sm text-gray-400">{t.date}</p>
                          </div>
                          <p className="font-bold text-red-400 shrink-0">{fmt(t.amount)}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {allBills.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
                <h2 className="text-lg font-semibold mb-4">Upcoming Bills</h2>
                <div className="space-y-3">
                  {allBills.map((bill, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-gray-800 pb-3">
                      <div>
                        <p className="font-medium">{bill.name}</p>
                        <p className="text-sm text-gray-400 capitalize">{bill.frequency} · due {bill.nextDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-400">{fmt(bill.amount)}</p>
                        <p className={`text-xs mt-0.5 ${bill.daysUntil <= 7 ? 'text-yellow-400' : 'text-gray-500'}`}>
                          {bill.daysUntil === 0 ? 'due today' : `in ${bill.daysUntil}d`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allTransactions.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
                <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
                <div className="space-y-3">
                  {allTransactions.slice(0, 10).map((txn) => (
                    <div key={txn.transaction_id} className="flex justify-between items-center border-b border-gray-800 pb-3">
                      <div>
                        <p className="font-medium">{txn.name}</p>
                        <p className="text-sm text-gray-400">{txn.date} · {txn.category?.[0] || 'Uncategorized'}</p>
                      </div>
                      <p className={`font-bold ${txn.amount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {txn.amount > 0 ? '-' : '+'}{fmt(Math.abs(txn.amount))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 && !loading && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-semibold mb-2">Get Started</h2>
                <p className="text-gray-400 mb-4">Connect a bank account to see your finances.</p>
                <PlaidLinkButton onSuccess={handleSuccess} />
              </div>
            )}
          </>
        )}

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
              <h2 className="text-lg font-semibold">Connected Institutions</h2>
              <PlaidLinkButton onSuccess={handleSuccess} label="Add Account" />
            </div>

            {loading && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center text-gray-400 mb-4">
                Connecting...
              </div>
            )}

            {items.length === 0 && !loading && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-gray-400">
                No accounts connected yet.
              </div>
            )}

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={item.accessToken} className="bg-gray-900 rounded-xl border border-gray-800">
                  <div className="flex justify-between items-center p-4 border-b border-gray-800">
                    <p className="font-semibold text-white">Institution {idx + 1}</p>
                    <button
                      onClick={() => handleRemove(item.accessToken)}
                      className="text-sm text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-300/50 px-3 py-1 rounded-lg transition">
                      Remove
                    </button>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {item.accounts.map(account => (
                      <div key={account.account_id} className="flex justify-between items-center px-4 py-3">
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-sm text-gray-400 capitalize">{account.type} · {account.subtype}</p>
                        </div>
                        <p className="font-bold text-green-400">{fmt(account.balances.current)}</p>
                      </div>
                    ))}
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
