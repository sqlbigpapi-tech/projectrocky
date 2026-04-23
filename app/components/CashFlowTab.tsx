'use client';
import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useToast } from '../page';

type MonthlySummary = { month: number; income: number; expenses: number; net: number; savings_rate: number };
type CategoryBreakdown = { category: string; total: number };
type TopMerchant = { name: string; total: number; count: number };
type Transaction = { date: string; name: string; amount: number; category: string; account: string };

interface CashFlowData {
  monthly_summary: MonthlySummary[];
  category_breakdown: CategoryBreakdown[];
  top_merchants: TopMerchant[];
  recent: Transaction[];
  totals: { total_income: number; total_expenses: number; net: number; avg_monthly_expenses: number };
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = [2022, 2023, 2024, 2025, 2026];

function fmt(n: number, compact = false): string {
  if (compact) {
    const abs = Math.abs(n);
    let s: string;
    if (abs >= 1000000) s = '$' + (abs / 1000000).toFixed(1) + 'M';
    else if (abs >= 10000) s = '$' + (abs / 1000).toFixed(1) + 'K';
    else if (abs >= 1000) s = '$' + (abs / 1000).toFixed(1) + 'K';
    else s = '$' + abs.toFixed(0);
    return n < 0 ? '-' + s : s;
  }
  const abs = Math.abs(n);
  const formatted = '$' + Math.round(abs).toLocaleString('en-US');
  return n < 0 ? '-' + formatted : formatted;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 p-4">
            <div className="skeleton h-3 w-20 rounded mb-3" />
            <div className="skeleton h-6 w-28 rounded" />
          </div>
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 p-4">
          <div className="skeleton h-4 w-40 rounded mb-4" />
          <div className="skeleton h-56 w-full rounded" />
        </div>
        <div className="rounded-xl border border-zinc-800 p-4">
          <div className="skeleton h-4 w-40 rounded mb-4" />
          <div className="skeleton h-56 w-full rounded" />
        </div>
      </div>
      {/* Table */}
      <div className="rounded-xl border border-zinc-800 p-4">
        <div className="skeleton h-4 w-32 rounded mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-8 w-full rounded mb-2" />
        ))}
      </div>
    </div>
  );
}

const CAT_COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
  '#22d3ee', '#818cf8', '#c084fc', '#f472b6', '#94a3b8',
  '#e879f9', '#f59e0b',
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
}

export default function CashFlowTab() {
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Drill-down filter (clicked category or merchant)
  type Filter = { kind: 'category' | 'merchant'; value: string } | null;
  const [filter, setFilter] = useState<Filter>(null);
  const [filteredTx, setFilteredTx] = useState<Transaction[] | null>(null);
  const [filteredTotal, setFilteredTotal] = useState<number>(0);
  const [filterLoading, setFilterLoading] = useState(false);

  function fetchData(y: number, m: number | null) {
    setLoading(true);
    let url = `/api/cashflow?year=${y}`;
    if (m != null) url += `&month=${m}`;
    fetch(url)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData(year, month);
  }, [year, month]);

  useEffect(() => {
    if (!filter) { setFilteredTx(null); return; }
    setFilterLoading(true);
    const params = new URLSearchParams({ year: String(year), limit: '200' });
    if (month != null) params.set('month', String(month));
    if (filter.kind === 'category') params.set('category', filter.value);
    else params.set('merchant', filter.value);
    fetch(`/api/transactions?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setFilteredTx(d.transactions ?? []);
        setFilteredTotal(d.total ?? 0);
      })
      .catch(() => { setFilteredTx([]); setFilteredTotal(0); })
      .finally(() => setFilterLoading(false));
  }, [filter, year, month]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/cashflow/upload', { method: 'POST', body: form });
      const d = await res.json();
      if (res.ok) {
        toast(`${d.rows_upserted ?? d.rows_processed ?? 0} transactions imported`, 'success');
        fetchData(year, month);
      } else {
        toast(d.error ?? 'Upload failed', 'error');
      }
    } catch {
      toast('Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (!data) return <p className="text-zinc-500 text-sm font-mono text-center py-12">Failed to load cash flow data.</p>;

  const { totals, monthly_summary, category_breakdown, top_merchants, recent = [] } = data;
  const savingsRate = totals.total_income > 0 ? ((totals.total_income - totals.total_expenses) / totals.total_income) * 100 : 0;

  const chartData = monthly_summary.map(m => ({
    name: MONTHS[m.month - 1] ?? `M${m.month}`,
    Income: m.income,
    Expenses: m.expenses,
    Net: m.net,
  }));

  const sortedCategories = [...category_breakdown].sort((a, b) => b.total - a.total);
  const maxCatTotal = sortedCategories.length > 0 ? sortedCategories[0].total : 1;

  return (
    <div className="space-y-6">
      {/* Header row: filters + upload */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm font-mono rounded-lg px-3 py-1.5 focus:border-amber-500/40 focus:outline-none"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={month ?? ''}
          onChange={e => setMonth(e.target.value ? Number(e.target.value) : null)}
          className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm font-mono rounded-lg px-3 py-1.5 focus:border-amber-500/40 focus:outline-none"
        >
          <option value="">All Months</option>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>

        <div className="ml-auto">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>
      </div>

      {/* Active drill-down filter chip */}
      {filter && (
        <div className="flex items-center gap-2 -mt-2">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Filtered by</span>
          <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1">
            <span className="text-[10px] font-mono text-amber-400/70 uppercase">{filter.kind}</span>
            <span className="text-xs font-mono text-amber-400 font-bold">{filter.value}</span>
            <button onClick={() => setFilter(null)} className="text-amber-400/60 hover:text-amber-300 text-xs ml-1">✕</button>
          </span>
          {filteredTx && (
            <span className="text-[11px] font-mono text-zinc-500">
              {filteredTx.length} txns · {fmt(filteredTotal)}
            </span>
          )}
        </div>
      )}

      {/* Section 1: Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Income */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-1">Total Income</p>
          <p className="text-lg font-bold font-mono text-emerald-400">{fmt(totals.total_income)}</p>
          {monthly_summary.length > 0 && (
            <p className="text-[10px] text-zinc-600 font-mono mt-1">
              ~{fmt(totals.total_income / monthly_summary.length, true)}/mo
            </p>
          )}
        </div>

        {/* Total Expenses */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-1">Total Expenses</p>
          <p className="text-lg font-bold font-mono text-red-400">{fmt(totals.total_expenses)}</p>
          {monthly_summary.length > 0 && (
            <p className="text-[10px] text-zinc-600 font-mono mt-1">
              ~{fmt(totals.total_expenses / monthly_summary.length, true)}/mo
            </p>
          )}
        </div>

        {/* Net Cash Flow */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-1">Net Cash Flow</p>
          <p className={`text-lg font-bold font-mono ${totals.net >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
            {fmt(totals.net)}
          </p>
          <p className="text-[10px] text-zinc-600 font-mono mt-1">
            {totals.net >= 0 ? 'surplus' : 'deficit'}
          </p>
        </div>

        {/* Savings Rate */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono mb-1">Savings Rate</p>
          <p className={`text-lg font-bold font-mono ${savingsRate >= 20 ? 'text-emerald-400' : savingsRate >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
            {savingsRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-zinc-600 font-mono mt-1">of income saved</p>
        </div>
      </div>

      {/* Section 2: Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Income vs Expenses */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <h3 className="text-xs font-bold text-zinc-400 font-mono uppercase tracking-wider mb-4">Monthly Income vs Expenses</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmt(v, true)} tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Income" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-zinc-600 text-xs font-mono text-center py-16">No monthly data</p>
          )}
        </div>

        {/* Spending by Category — click to filter */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <h3 className="text-xs font-bold text-zinc-400 font-mono uppercase tracking-wider mb-4">Spending by Category</h3>
          {sortedCategories.length > 0 ? (
            <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
              {sortedCategories.map((cat, i) => (
                <button
                  key={cat.category}
                  onClick={() => setFilter({ kind: 'category', value: cat.category })}
                  className={`w-full flex items-center gap-2 rounded px-1 py-1 transition hover:bg-zinc-800/60 ${
                    filter?.kind === 'category' && filter.value === cat.category ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <span className="text-[11px] font-mono text-zinc-400 w-28 truncate shrink-0 text-left" title={cat.category}>
                    {cat.category}
                  </span>
                  <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${(cat.total / maxCatTotal) * 100}%`,
                        backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-zinc-300 w-16 text-right shrink-0">
                    {fmt(cat.total, true)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-zinc-600 text-xs font-mono text-center py-16">No category data</p>
          )}
        </div>
      </div>

      {/* Section 3: Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Merchants */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <h3 className="text-xs font-bold text-zinc-400 font-mono uppercase tracking-wider mb-3">Top Merchants</h3>
          {top_merchants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-zinc-600">
                    <th className="text-left py-1.5 font-medium">Merchant</th>
                    <th className="text-right py-1.5 font-medium">Total</th>
                    <th className="text-right py-1.5 font-medium">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {top_merchants.map((m, i) => (
                    <tr
                      key={i}
                      onClick={() => setFilter({ kind: 'merchant', value: m.name })}
                      className={`border-t border-[var(--border)]/50 cursor-pointer transition hover:bg-zinc-800/60 ${
                        filter?.kind === 'merchant' && filter.value === m.name ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <td className="py-1.5 text-zinc-300 truncate max-w-[180px]" title={m.name}>{m.name}</td>
                      <td className="py-1.5 text-right text-red-400">{fmt(m.total, true)}</td>
                      <td className="py-1.5 text-right text-zinc-500">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-zinc-600 text-xs font-mono text-center py-8">No merchant data</p>
          )}
        </div>

        {/* Transactions — shows filtered results when drill-down is active, else month view */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <h3 className="text-xs font-bold text-zinc-400 font-mono uppercase tracking-wider mb-3">
            {filter
              ? `${filter.kind === 'category' ? 'Category' : 'Merchant'}: ${filter.value}`
              : month != null ? `${MONTHS[month - 1]} Transactions` : 'Recent Transactions'}
          </h3>
          {filter ? (
            filterLoading ? (
              <p className="text-zinc-600 text-xs font-mono text-center py-8">Loading…</p>
            ) : (filteredTx ?? []).length > 0 ? (
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr className="text-zinc-600">
                      <th className="text-left py-1.5 font-medium">Date</th>
                      <th className="text-left py-1.5 font-medium">Name</th>
                      <th className="text-right py-1.5 font-medium">Amount</th>
                      <th className="text-left py-1.5 font-medium">Account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredTx ?? []).map((t, i) => (
                      <tr key={i} className="border-t border-[var(--border)]/50">
                        <td className="py-1.5 text-zinc-500 whitespace-nowrap">
                          {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-1.5 text-zinc-300 truncate max-w-[140px]" title={t.name}>{t.name}</td>
                        <td className={`py-1.5 text-right ${t.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(t.amount)}
                        </td>
                        <td className="py-1.5 text-zinc-600 truncate max-w-[100px]" title={t.account}>{t.account}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-zinc-600 text-xs font-mono text-center py-8">No transactions match this filter.</p>
            )
          ) : month == null ? (
            <p className="text-zinc-600 text-xs font-mono text-center py-8">Click a category or merchant to drill in — or pick a month.</p>
          ) : recent.length > 0 ? (
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs font-mono">
                <thead className="sticky top-0 bg-zinc-900">
                  <tr className="text-zinc-600">
                    <th className="text-left py-1.5 font-medium">Date</th>
                    <th className="text-left py-1.5 font-medium">Name</th>
                    <th className="text-right py-1.5 font-medium">Amount</th>
                    <th className="text-left py-1.5 font-medium">Category</th>
                    <th className="text-left py-1.5 font-medium">Account</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t, i) => (
                    <tr key={i} className="border-t border-[var(--border)]/50">
                      <td className="py-1.5 text-zinc-500 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-1.5 text-zinc-300 truncate max-w-[140px]" title={t.name}>{t.name}</td>
                      <td className={`py-1.5 text-right ${t.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(t.amount)}
                      </td>
                      <td className="py-1.5 text-zinc-500 truncate max-w-[100px]" title={t.category}>{t.category}</td>
                      <td className="py-1.5 text-zinc-600 truncate max-w-[100px]" title={t.account}>{t.account}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-zinc-600 text-xs font-mono text-center py-8">No transactions this month</p>
          )}
        </div>
      </div>

      {/* Subscriptions */}
      <SubscriptionsCard />
    </div>
  );
}

type Sub = {
  merchant: string;
  cadence: 'monthly' | 'quarterly' | 'annual';
  amount: number;
  hits: number;
  firstSeen: string;
  lastSeen: string;
  totalPaid: number;
  monthlyEquivalent: number;
  active: boolean;
  category: string | null;
};

function SubscriptionsCard() {
  const [data, setData] = useState<{ subscriptions: Sub[]; summary: { active_count: number; inactive_count: number; active_monthly_total: number; active_annual_total: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-5"><div className="skeleton h-4 w-32 rounded mb-4" /><div className="skeleton h-24 w-full rounded" /></div>;
  if (!data) return null;

  const shown = showInactive ? data.subscriptions : data.subscriptions.filter(s => s.active);
  const cadenceColor = (c: Sub['cadence']) => c === 'monthly' ? 'text-emerald-400' : c === 'quarterly' ? 'text-amber-400' : 'text-violet-400';

  return (
    <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">Subscriptions</p>
          <div className="flex items-baseline gap-3 mt-1">
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{fmt(data.summary.active_monthly_total)}/mo</p>
            <p className="text-xs text-zinc-500 font-mono">≈ {fmt(data.summary.active_annual_total)}/yr</p>
          </div>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
            {data.summary.active_count} active · {data.summary.inactive_count} inactive (detected from recurring charges)
          </p>
        </div>
        <button
          onClick={() => setShowInactive(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-widest transition border ${showInactive ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'text-zinc-600 border-zinc-800 hover:text-white'}`}
        >
          {showInactive ? 'Hide inactive' : 'Show inactive'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-zinc-600 uppercase tracking-widest border-b border-zinc-800">
              <th className="text-left pb-2 pr-3">Merchant</th>
              <th className="text-left pb-2 pr-3">Cadence</th>
              <th className="text-right pb-2 pr-3">Per Charge</th>
              <th className="text-right pb-2 pr-3">Monthly</th>
              <th className="text-right pb-2 pr-3">Total Paid</th>
              <th className="text-right pb-2 pr-3">Last Seen</th>
              <th className="text-right pb-2">Hits</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s, i) => (
              <tr key={i} className={`border-b border-zinc-900 ${s.active ? '' : 'opacity-40'}`}>
                <td className="py-2 pr-3 text-zinc-200 truncate max-w-[260px]" title={s.merchant}>{s.merchant}</td>
                <td className={`py-2 pr-3 font-bold ${cadenceColor(s.cadence)}`}>{s.cadence}</td>
                <td className="py-2 pr-3 text-right text-zinc-300 tabular-nums">{fmt(s.amount)}</td>
                <td className="py-2 pr-3 text-right text-white font-bold tabular-nums">{fmt(s.monthlyEquivalent)}</td>
                <td className="py-2 pr-3 text-right text-zinc-400 tabular-nums">{fmt(s.totalPaid)}</td>
                <td className="py-2 pr-3 text-right text-zinc-500 tabular-nums">{new Date(s.lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                <td className="py-2 text-right text-zinc-500 tabular-nums">{s.hits}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-700">
              <td colSpan={4} className="pt-3 pr-3 text-right text-zinc-500 uppercase tracking-widest">Total Paid (shown)</td>
              <td className="pt-3 pr-3 text-right text-emerald-400 font-bold tabular-nums">{fmt(shown.reduce((s, x) => s + x.totalPaid, 0))}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
