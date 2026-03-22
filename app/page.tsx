'use client';
import { useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

function PlaidLinkButton({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [linkToken, setLinkToken] = useState(null);

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
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition">
        Connect a Bank Account
      </button>
    );
  }

  return (
    <button onClick={() => open()} disabled={!ready}
      className="mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition">
      Open Bank Login
    </button>
  );
}

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function Home() {
  const [accessToken, setAccessToken] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (token) => {
    setAccessToken(token);
    setLoading(true);
    const res = await fetch('/api/plaid/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token }),
    });
    const data = await res.json();
    setAccounts(data.accounts || []);
    setTransactions(data.transactions || []);
    setLoading(false);
  };

  const netWorth = accounts.reduce((sum, a) =>
    a.type === 'depository' || a.type === 'investment'
      ? sum + a.balances.current
      : sum - a.balances.current, 0);
  const monthlyIncome = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const monthlyExpenses = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const cashFlow = monthlyIncome - monthlyExpenses;

  const metrics = [
    { label: "Net Worth", value: accounts.length ? fmt(netWorth) : "$—", color: "text-green-400" },
    { label: "Monthly Income", value: accounts.length ? fmt(monthlyIncome) : "$—", color: "text-blue-400" },
    { label: "Monthly Expenses", value: accounts.length ? fmt(monthlyExpenses) : "$—", color: "text-red-400" },
    { label: "Cash Flow", value: accounts.length ? fmt(cashFlow) : "$—", color: cashFlow >= 0 ? "text-green-400" : "text-red-400" },
  ];

  return (
    <main suppressHydrationWarning className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-1">Kong Finance</h1>
        <p className="text-gray-400 mb-8">Welcome back, David</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {metrics.map((card) => (
            <div key={card.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {loading && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center text-gray-400">
            Loading your accounts...
          </div>
        )}

        {accounts.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
            <h2 className="text-lg font-semibold mb-4">Connected Accounts</h2>
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.account_id}
                  className="flex justify-between items-center border-b border-gray-800 pb-3">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-gray-400 capitalize">{account.type} · {account.subtype}</p>
                  </div>
                  <p className="font-bold text-green-400">{fmt(account.balances.current)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {transactions.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
            <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
            <div className="space-y-3">
              {transactions.slice(0, 10).map((txn) => (
                <div key={txn.transaction_id}
                  className="flex justify-between items-center border-b border-gray-800 pb-3">
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

        {!accessToken && !loading && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-2">Connected Accounts</h2>
            <p className="text-gray-400">No accounts connected yet.</p>
            <PlaidLinkButton onSuccess={handleSuccess} />
          </div>
        )}
      </div>
    </main>
  );
}