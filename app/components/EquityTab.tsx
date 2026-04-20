'use client';
import { useState, useEffect, useRef } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface EquityMonth {
  month: number;
  netIncome: number;
  stockPurchases: number;
  nisp: number;
  isForecast: boolean;
  distributable: number;
  trailing12: number;
  retainedEarnings: number;
  valuation: number;
  sharePrice: number;
  eps: number;
  dividendPerShare: number;
}

interface EquityData {
  months: EquityMonth[];
  totalShares: number;
  retainedEarnings: number;
  latest: EquityMonth | null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDollar = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtShare = (n: number) => `$${n.toFixed(2)}`;
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs font-mono">
      <p className="text-zinc-400 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtShare(p.value)}
        </p>
      ))}
    </div>
  );
};

function EditableSP({ value, saving, onSave }: { value: number; saving: boolean; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
  const commit = () => {
    const parsed = parseFloat(draft.replace(/[$,]/g, ''));
    if (!isNaN(parsed) && parsed !== value) onSave(parsed);
    setEditing(false);
  };
  if (saving) return <span className="text-amber-400 animate-pulse">…</span>;
  if (editing) return (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className="bg-zinc-800 border border-amber-500 text-white text-xs font-mono text-right px-2 py-0.5 rounded outline-none w-20" />
  );
  return (
    <span onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="cursor-pointer hover:text-amber-400 transition" title="Click to edit">
      {fmtDollar(value)}
    </span>
  );
}

function EquitySettings({ shares, retained, onSave }: { shares: number; retained: number; onSave: () => void }) {
  const [editShares, setEditShares] = useState(String(shares));
  const [editRetained, setEditRetained] = useState(String(retained));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await Promise.all([
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'equity_shares', value: editShares }) }),
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'equity_retained', value: editRetained }) }),
    ]);
    setSaving(false);
    onSave();
  }

  const inputCls = 'bg-zinc-800 border border-zinc-700 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 w-full';

  return (
    <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-5 mb-6">
      <p className="text-xs text-amber-400 font-mono font-bold uppercase tracking-widest mb-4">Equity Settings</p>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Total Shares Issued</label>
          <input value={editShares} onChange={e => setEditShares(e.target.value)} type="number" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Retained Earnings Balance</label>
          <input value={editRetained} onChange={e => setEditRetained(e.target.value)} type="number" className={inputCls} />
        </div>
        <div className="flex items-end">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest bg-amber-500 text-black disabled:opacity-40 transition">
            {saving ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EquityTab() {
  const [data, setData] = useState<EquityData | null>(null);
  const [year, setYear] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSP, setSavingSP] = useState<number | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/equity?year=${year}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [year]);

  async function updateStockPurchases(month: number, value: number) {
    setSavingSP(month);
    await fetch('/api/pl', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, market: 'MIA', stock_purchases: value }),
    });
    load();
    setSavingSP(null);
  }

  if (loading || !data) return <p className="text-zinc-600 font-mono text-xs">Loading…</p>;

  const { months, totalShares, retainedEarnings, latest } = data;

  const chartData = months.map(m => ({
    name: MONTHS[m.month - 1],
    'Share Price': parseFloat(m.sharePrice.toFixed(2)),
    'Dividend/Share': parseFloat(m.dividendPerShare.toFixed(2)),
    forecast: m.isForecast,
  }));

  const ytdDividend = months.filter(m => !m.isForecast).reduce((s, m) => s + m.dividendPerShare, 0);
  const fullYearDividend = months.reduce((s, m) => s + m.dividendPerShare, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white font-mono tracking-widest">EQUITY & DIVIDENDS</h2>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {totalShares.toLocaleString()} shares issued · {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-800 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowSettings(!showSettings)}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest transition ${showSettings ? 'bg-zinc-800 text-zinc-400' : 'bg-amber-500 text-black'}`}>
            {showSettings ? 'CLOSE' : 'SETTINGS'}
          </button>
        </div>
      </div>

      {showSettings && <EquitySettings shares={totalShares} retained={retainedEarnings} onSave={() => { setShowSettings(false); load(); }} />}

      {/* KPI Cards */}
      {latest && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Share Price</p>
            <p className="text-3xl font-bold text-amber-400 font-mono">{fmtShare(latest.sharePrice)}</p>
            <p className="text-[10px] text-zinc-600 font-mono mt-1">
              as of {MONTHS[latest.month - 1]} {latest.isForecast ? '(fcst)' : '(actual)'}
            </p>
          </div>
          <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Valuation</p>
            <p className="text-2xl font-bold text-white font-mono">{fmtShort(latest.valuation)}</p>
            <p className="text-[10px] text-zinc-600 font-mono mt-1">5x trailing 12 + retained</p>
          </div>
          <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">YTD Dividend/Share</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono">{fmtShare(ytdDividend)}</p>
            <p className="text-[10px] text-zinc-600 font-mono mt-1">full year est: {fmtShare(fullYearDividend)}</p>
          </div>
          <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Trailing 12 NI</p>
            <p className={`text-2xl font-bold font-mono ${latest.trailing12 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {latest.trailing12 < 0 ? '-' : ''}{fmtShort(Math.abs(latest.trailing12))}
            </p>
            <p className="text-[10px] text-zinc-600 font-mono mt-1">rolling 12 months</p>
          </div>
        </div>
      )}

      {/* Share Price Chart */}
      <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-5 mb-8">
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-4">Share Price Trend</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#52525b" />
            <Area dataKey="Share Price" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-zinc-600 uppercase tracking-widest border-b border-zinc-800">
              <th className="text-left pb-3 pr-3">Month</th>
              <th className="text-right pb-3 pr-3">Net Income</th>
              <th className="text-right pb-3 pr-3">Trailing 12</th>
              <th className="text-right pb-3 pr-3">Retained</th>
              <th className="text-right pb-3 pr-3">Valuation</th>
              <th className="text-right pb-3">Share Price</th>
            </tr>
          </thead>
          <tbody>
            {months.map(m => (
              <tr key={m.month} className={`border-b border-zinc-900 hover:bg-[var(--card)] ${m.isForecast ? 'opacity-60' : ''}`}>
                <td className="py-3 pr-3 text-zinc-400 font-bold">
                  {MONTHS[m.month - 1]}
                  {m.isForecast && <span className="text-zinc-700 ml-1 text-[10px]">F</span>}
                </td>
                <td className={`py-3 pr-3 text-right ${m.netIncome < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {m.netIncome < 0 ? '-' : ''}{fmtDollar(m.netIncome)}
                </td>
                <td className={`py-3 pr-3 text-right ${m.trailing12 < 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                  {m.trailing12 < 0 ? '-' : ''}{fmtShort(Math.abs(m.trailing12))}
                </td>
                <td className="py-3 pr-3 text-right text-zinc-400">{fmtShort(m.retainedEarnings)}</td>
                <td className="py-3 pr-3 text-right text-zinc-300">{fmtShort(m.valuation)}</td>
                <td className="py-3 text-right text-amber-400 font-bold">{fmtShare(m.sharePrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-700">
              <td className="pt-4 text-zinc-400 font-bold">TOTAL</td>
              <td className="pt-4 text-right text-white font-bold pr-3">
                {fmtDollar(months.reduce((s, m) => s + m.netIncome, 0))}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
