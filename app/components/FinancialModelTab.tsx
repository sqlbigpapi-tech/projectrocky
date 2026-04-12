'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface PLMonth {
  id: string;
  year: number;
  month: number;
  market: string;
  revenue: number;
  sga: number;
  cons_labor: number;
  profit_share: number;
  net_income: number;
  is_forecast: boolean;
  notes: string | null;
}

interface ScenarioAdj {
  id: string;
  label: string;
  type: 'add' | 'lose';
  count: number;
  rate: number;
  costRate: number;
  startMonth: number;
  endMonth: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// Approximate working days per month (2026, after public holidays)
const WORK_DAYS = [20, 19, 21, 21, 19, 21, 21, 20, 20, 21, 18, 21];

const fmt = (n: number) => n === 0 ? '—' : `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1000000) return `$${(n/1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${(n/1000).toFixed(0)}K`;
  return `$${n}`;
};
const fmtDelta = (n: number) => `${n >= 0 ? '+' : '-'}${fmtShort(Math.abs(n))}`;

function EditableCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  const commit = () => {
    const parsed = parseFloat(draft.replace(/[$,]/g, ''));
    if (!isNaN(parsed)) onSave(parsed);
    setEditing(false);
  };
  if (editing) {
    return (
      <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-full bg-zinc-800 border border-amber-500 text-white text-xs font-mono text-right px-2 py-1 rounded outline-none" />
    );
  }
  return (
    <span onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="cursor-pointer hover:text-amber-400 transition-colors text-right block w-full" title="Click to edit">
      {fmt(value)}
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs font-mono">
      <p className="text-zinc-400 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? '' : '-'}{fmtShort(Math.abs(p.value))}
        </p>
      ))}
    </div>
  );
};

function WorksheetUpload({ onDone }: { onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ year: number; monthsUpdated: number; details: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function handleFile(file: File) {
    setUploading(true); setError(null); setResult(null);
    const form = new FormData();
    form.append('file', file); form.append('market', 'MIA');
    const r = await fetch('/api/upload-worksheet', { method: 'POST', body: form });
    const d = await r.json();
    if (d.error) setError(d.error); else { setResult(d); onDone(); }
    setUploading(false);
  }
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 mb-6">
      <p className="text-xs text-amber-400 font-mono font-bold uppercase tracking-widest mb-3">Upload Monthly Worksheet</p>
      <p className="text-xs text-zinc-500 font-mono mb-4">Drop an xlsx to update actuals (Revenue, SGA, Cons Labor, Net Income, Stock Purchases)</p>
      <div onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-amber-500'); }}
        onDragLeave={e => e.currentTarget.classList.remove('border-amber-500')}
        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-amber-500'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center cursor-pointer hover:border-zinc-500 transition">
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {uploading ? <p className="text-amber-400 font-mono text-xs animate-pulse">Parsing…</p> : <p className="text-zinc-500 font-mono text-xs">Drag & drop .xlsx or click to browse</p>}
      </div>
      {error && <p className="text-red-400 font-mono text-xs mt-3">{error}</p>}
      {result && (
        <div className="mt-3">
          <p className="text-emerald-400 font-mono text-xs font-bold">{result.year} — {result.monthsUpdated} months updated</p>
          <div className="mt-2 max-h-32 overflow-y-auto">
            {result.details.map((d, i) => <p key={i} className="text-zinc-500 font-mono text-[10px]">{d}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

function getScenarioDeltas(scenarios: ScenarioAdj[]) {
  const revDeltas = new Array(12).fill(0);
  const niDeltas = new Array(12).fill(0);
  for (const s of scenarios) {
    for (let m = s.startMonth; m <= s.endMonth; m++) {
      const hours = s.count * 8 * WORK_DAYS[m - 1];
      const rev = hours * s.rate;
      const cost = hours * s.costRate;
      const gross = rev - cost;
      const ps = gross * 0.1;
      const ni = gross - ps;
      const sign = s.type === 'add' ? 1 : -1;
      revDeltas[m - 1] += rev * sign;
      niDeltas[m - 1] += ni * sign;
    }
  }
  return { revDeltas, niDeltas };
}

function ScenarioPanel({ scenarios, onChange }: { scenarios: ScenarioAdj[]; onChange: (s: ScenarioAdj[]) => void }) {
  const [type, setType] = useState<'add' | 'lose'>('add');
  const [count, setCount] = useState('1');
  const [rate, setRate] = useState('200');
  const [costRate, setCostRate] = useState('85');
  const [startMonth, setStartMonth] = useState(String(new Date().getMonth() + 2 > 12 ? 12 : new Date().getMonth() + 2));
  const [endMonth, setEndMonth] = useState('12');
  const [label, setLabel] = useState('');

  const inputCls = 'bg-zinc-800 border border-zinc-700 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500';

  function addScenario() {
    const adj: ScenarioAdj = {
      id: Date.now().toString(),
      label: label || `${type === 'add' ? '+' : '-'}${count} @ $${rate}/hr (cost $${costRate})`,
      type,
      count: parseInt(count),
      rate: parseFloat(rate),
      costRate: parseFloat(costRate),
      startMonth: parseInt(startMonth),
      endMonth: parseInt(endMonth),
    };
    onChange([...scenarios, adj]);
    setLabel('');
  }

  const { revDeltas, niDeltas } = getScenarioDeltas(scenarios);
  const totalRevDelta = revDeltas.reduce((s, d) => s + d, 0);
  const totalNiDelta = niDeltas.reduce((s, d) => s + d, 0);

  return (
    <div className="bg-zinc-950 border border-amber-500/30 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-amber-400 font-mono font-bold uppercase tracking-widest">Scenario Builder</p>
        {scenarios.length > 0 && (
          <button onClick={() => onChange([])} className="text-xs text-zinc-600 font-mono hover:text-red-400 transition">Clear All</button>
        )}
      </div>

      {/* Active scenarios */}
      {scenarios.length > 0 && (
        <div className="mb-4 space-y-2">
          {scenarios.map(s => {
            const monthRange = s.startMonth === s.endMonth
              ? MONTHS[s.startMonth - 1]
              : `${MONTHS[s.startMonth - 1]}–${MONTHS[s.endMonth - 1]}`;
            return (
              <div key={s.id} className="flex items-center justify-between bg-zinc-900 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${s.type === 'add' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {s.type === 'add' ? '+' : '-'}{s.count}
                  </span>
                  <span className="text-xs text-white font-mono">{s.label}</span>
                  <span className="text-xs text-zinc-500 font-mono">bill ${s.rate} · cost ${s.costRate} · {monthRange}</span>
                </div>
                <button onClick={() => onChange(scenarios.filter(x => x.id !== s.id))}
                  className="text-zinc-600 hover:text-red-400 text-xs font-mono">x</button>
              </div>
            );
          })}
          <div className="flex gap-6 pt-2 border-t border-zinc-800 mt-3">
            <p className="text-xs text-zinc-500 font-mono">
              Revenue: <span className={`font-bold ${totalRevDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtDelta(totalRevDelta)}</span>
            </p>
            <p className="text-xs text-zinc-500 font-mono">
              Net Income: <span className={`font-bold ${totalNiDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtDelta(totalNiDelta)}</span>
            </p>
            <p className="text-xs text-zinc-500 font-mono">
              Margin: <span className="font-bold text-amber-400">{totalRevDelta !== 0 ? `${((totalNiDelta / totalRevDelta) * 100).toFixed(0)}%` : '—'}</span>
            </p>
          </div>
        </div>
      )}

      {/* Add form */}
      <div className="grid grid-cols-7 gap-3 items-end">
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Type</label>
          <select value={type} onChange={e => setType(e.target.value as 'add' | 'lose')} className={inputCls + ' w-full'}>
            <option value="add">Add</option>
            <option value="lose">Lose</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Count</label>
          <input value={count} onChange={e => setCount(e.target.value)} type="number" min="1" className={inputCls + ' w-full'} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Bill Rate $/hr</label>
          <input value={rate} onChange={e => setRate(e.target.value)} type="number" className={inputCls + ' w-full'} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Cost Rate $/hr</label>
          <input value={costRate} onChange={e => setCostRate(e.target.value)} type="number" className={inputCls + ' w-full'} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">From</label>
          <select value={startMonth} onChange={e => setStartMonth(e.target.value)} className={inputCls + ' w-full'}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">To</label>
          <select value={endMonth} onChange={e => setEndMonth(e.target.value)} className={inputCls + ' w-full'}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <button onClick={addScenario}
          className="px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest bg-amber-500 text-black transition hover:bg-amber-400">
          ADD
        </button>
      </div>
      <div className="mt-3">
        <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Label (optional)</label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. New NCL extension"
          className={inputCls + ' w-full'} />
      </div>
    </div>
  );
}

export default function FinancialModelTab() {
  const [months, setMonths] = useState<PLMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [year, setYear] = useState(2026);
  const [market] = useState('MIA');
  const [showUpload, setShowUpload] = useState(false);
  const [showScenario, setShowScenario] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioAdj[]>([]);

  useEffect(() => { load(); }, [year, market]);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/pl?year=${year}&market=${market}`);
    const d = await r.json();
    setMonths(d.months ?? []);
    setLoading(false);
  }

  async function updateField(month: PLMonth, field: keyof PLMonth, value: number | boolean | string) {
    const key = `${month.month}-${String(field)}`;
    setSaving(key);
    const r = await fetch('/api/pl', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: month.year, month: month.month, market: month.market, [field]: value }),
    });
    const d = await r.json();
    if (d.month) {
      setMonths(prev => prev.map(m => m.month === month.month ? d.month : m));
    }
    setSaving(null);
  }

  const { revDeltas: scenarioRevDeltas, niDeltas: scenarioNiDeltas } = getScenarioDeltas(scenarios);
  const hasScenario = scenarios.length > 0;

  const ytdMonths = months.filter(m => !m.is_forecast);
  const ytdRevenue = ytdMonths.reduce((s, m) => s + m.revenue, 0);
  const ytdNetIncome = ytdMonths.reduce((s, m) => s + m.net_income, 0);
  const ytdExpenses = ytdMonths.reduce((s, m) => s + m.sga + m.cons_labor, 0);
  const impliedRevenue = ytdRevenue > 0 ? ytdRevenue : ytdMonths.reduce((s, m) => s + Math.max(0, m.net_income + m.sga + m.cons_labor + m.profit_share), 0);
  const ytdMargin = impliedRevenue > 0 ? ((ytdNetIncome / impliedRevenue) * 100).toFixed(1) : null;

  const chartData = months.map((m, i) => {
    const revDelta = scenarioRevDeltas[i];
    const niDelta = scenarioNiDeltas[i];
    return {
      name: MONTHS[m.month - 1],
      Revenue: m.revenue,
      Expenses: m.sga + m.cons_labor,
      'Net Income': m.net_income,
      ...(hasScenario ? { 'Scenario Revenue': m.revenue + revDelta, 'Scenario NI': m.net_income + niDelta } : {}),
    };
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white font-mono tracking-widest">FINANCIAL MODEL</h2>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            MIA · {year} · click any value to edit
            {hasScenario && <span className="text-amber-400 ml-2">· scenario active</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-800 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => { setShowScenario(!showScenario); setShowUpload(false); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest transition ${showScenario ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'}`}>
            SCENARIO
          </button>
          <button onClick={() => { setShowUpload(!showUpload); setShowScenario(false); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest transition ${showUpload ? 'bg-zinc-800 text-zinc-400' : 'bg-amber-500 text-black'}`}>
            {showUpload ? 'CLOSE' : 'UPLOAD'}
          </button>
        </div>
      </div>

      {showUpload && <WorksheetUpload onDone={() => { setShowUpload(false); load(); }} />}
      {showScenario && <ScenarioPanel scenarios={scenarios} onChange={setScenarios} />}

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'YTD Net Income', value: `${ytdNetIncome < 0 ? '-' : ''}${fmtShort(Math.abs(ytdNetIncome))}`, color: ytdNetIncome >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'YTD Revenue', value: ytdRevenue > 0 ? fmtShort(ytdRevenue) : '—', color: 'text-emerald-400' },
          { label: 'YTD Expenses', value: ytdExpenses > 0 ? fmtShort(ytdExpenses) : '—', color: 'text-zinc-300' },
          { label: 'Net Margin', value: ytdMargin ? `${ytdMargin}%` : '—', color: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">{k.label}</p>
            <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {!loading && months.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 mb-8">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmtShort(v)} tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', color: '#71717a' }} />
              <ReferenceLine y={0} stroke="#52525b" strokeWidth={1} />
              <Bar dataKey="Revenue" fill="#10b981" fillOpacity={hasScenario ? 0.3 : 0.7} radius={[3,3,0,0]} />
              <Bar dataKey="Expenses" fill="#f43f5e" fillOpacity={0.6} radius={[3,3,0,0]} />
              <Line dataKey="Net Income" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
              {hasScenario && (
                <>
                  <Bar dataKey="Scenario Revenue" fill="#10b981" fillOpacity={0.7} radius={[3,3,0,0]} />
                  <Line dataKey="Scenario NI" stroke="#818cf8" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#818cf8' }} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-zinc-600 font-mono text-xs">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-zinc-600 uppercase tracking-widest border-b border-zinc-800">
                <th className="text-left pb-3 pr-4 w-16">Month</th>
                <th className="text-right pb-3 pr-4">Revenue</th>
                {hasScenario && <th className="text-right pb-3 pr-4 text-indigo-400">Scen Rev</th>}
                <th className="text-right pb-3 pr-4">SG&A</th>
                <th className="text-right pb-3 pr-4">Cons Labor</th>
                <th className="text-right pb-3 pr-4">Profit Share</th>
                <th className="text-right pb-3 pr-4">Net Income</th>
                {hasScenario && <th className="text-right pb-3 pr-4 text-indigo-400">Scen NI</th>}
                <th className="text-center pb-3 pr-4">Type</th>
                <th className="text-left pb-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => {
                const isNeg = m.net_income < 0;
                const revDelta = scenarioRevDeltas[i];
                const niDelta = scenarioNiDeltas[i];
                const scenRev = m.revenue + revDelta;
                const scenNI = m.net_income + niDelta;
                return (
                  <tr key={m.month} className="border-b border-zinc-900 hover:bg-zinc-950 group">
                    <td className="py-3 pr-4 text-zinc-400 font-bold">{MONTHS[m.month - 1]}</td>
                    <td className="py-3 pr-4 text-emerald-400">
                      <EditableCell value={m.revenue} onSave={v => updateField(m, 'revenue', v)} />
                    </td>
                    {hasScenario && (
                      <td className={`py-3 pr-4 text-right ${revDelta > 0 ? 'text-indigo-400' : revDelta < 0 ? 'text-red-400' : 'text-zinc-700'}`}>
                        {revDelta !== 0 ? fmtShort(scenRev) : '·'}
                        {revDelta !== 0 && <span className="text-[10px] ml-1">({fmtDelta(revDelta)})</span>}
                      </td>
                    )}
                    <td className="py-3 pr-4 text-zinc-300">
                      <EditableCell value={m.sga} onSave={v => updateField(m, 'sga', v)} />
                    </td>
                    <td className="py-3 pr-4 text-zinc-300">
                      <EditableCell value={m.cons_labor} onSave={v => updateField(m, 'cons_labor', v)} />
                    </td>
                    <td className="py-3 pr-4 text-zinc-400">
                      <EditableCell value={m.profit_share} onSave={v => updateField(m, 'profit_share', v)} />
                    </td>
                    <td className={`py-3 pr-4 font-bold ${isNeg ? 'text-red-400' : 'text-white'}`}>
                      <EditableCell value={m.net_income} onSave={v => updateField(m, 'net_income', v)} />
                    </td>
                    {hasScenario && (
                      <td className={`py-3 pr-4 text-right font-bold ${scenNI < 0 ? 'text-red-400' : 'text-indigo-400'}`}>
                        {niDelta !== 0 ? fmtShort(scenNI) : '·'}
                      </td>
                    )}
                    <td className="py-3 pr-4 text-center">
                      <button onClick={() => updateField(m, 'is_forecast', !m.is_forecast)}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition ${m.is_forecast ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}>
                        {m.is_forecast ? 'FCST' : 'ACTUAL'}
                      </button>
                    </td>
                    <td className="py-3">
                      <input defaultValue={m.notes ?? ''} onBlur={e => updateField(m, 'notes', e.target.value)}
                        placeholder="add note…"
                        className="bg-transparent text-zinc-500 placeholder-zinc-700 text-xs font-mono w-full outline-none focus:text-white focus:border-b focus:border-zinc-600" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700">
                <td className="pt-4 text-zinc-400 font-bold">TOTAL</td>
                <td className="pt-4 text-right text-emerald-400 font-bold pr-4">{fmtShort(months.reduce((s,m) => s+m.revenue, 0))}</td>
                {hasScenario && (
                  <td className="pt-4 text-right text-indigo-400 font-bold pr-4">
                    {fmtShort(months.reduce((s,m,i) => s+m.revenue+scenarioRevDeltas[i], 0))}
                  </td>
                )}
                <td className="pt-4 text-right text-zinc-300 pr-4">{fmtShort(months.reduce((s,m) => s+m.sga, 0))}</td>
                <td className="pt-4 text-right text-zinc-300 pr-4">{fmtShort(months.reduce((s,m) => s+m.cons_labor, 0))}</td>
                <td className="pt-4 text-right text-zinc-400 pr-4">{fmtShort(months.reduce((s,m) => s+m.profit_share, 0))}</td>
                <td className={`pt-4 text-right font-bold pr-4 ${months.reduce((s,m) => s+m.net_income,0) < 0 ? 'text-red-400' : 'text-white'}`}>
                  {fmtShort(months.reduce((s,m) => s+m.net_income, 0))}
                </td>
                {hasScenario && (
                  <td className="pt-4 text-right text-indigo-400 font-bold pr-4">
                    {fmtShort(months.reduce((s,m,i) => s+m.net_income+scenarioNiDeltas[i], 0))}
                  </td>
                )}
                <td /><td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {saving && <p className="text-xs text-amber-400 font-mono mt-3 animate-pulse">Saving…</p>}
    </div>
  );
}
