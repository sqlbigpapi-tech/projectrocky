'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const GOAL_MIA = 1001000; // fallback for when months haven't loaded yet
const DEFAULT_bigGoal = 1700000;
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MARKETS = ['ATL','BOS','CHI','CIN','CLT','DAL','MIA','NSH','NYC','PHL','PHX','SEA','WDC'] as const;
type Market = typeof MARKETS[number];

type MonthData = {
  month: number;
  plan: number;
  actual: number | null;
  is_forecast: boolean;
  revenue: number | null;
};

function fmt(n: number | null): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1000000) s = '$' + (abs / 1000000).toFixed(1) + 'M';
  else if (abs >= 1000) s = '$' + Math.round(abs / 1000) + 'K';
  else s = '$' + Math.round(abs);
  return n < 0 ? '-' + s : s;
}

function fmtFull(n: number | null): string {
  if (n == null) return '—';
  return '$' + Math.round(n).toLocaleString();
}

function EditRow({
  m,
  onSave,
  onClear,
}: {
  m: MonthData;
  onSave: (actual: number, is_forecast: boolean) => void;
  onClear: () => void;
}) {
  const now = new Date();
  const isPast = m.month < now.getMonth() + 1;
  const [value, setValue] = useState(m.actual != null ? String(Math.round(m.actual)) : '');
  const [isForecast, setIsForecast] = useState(m.is_forecast ?? !isPast);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function save() {
    const n = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!isNaN(n) && n >= 0) onSave(n, isForecast);
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        onClick={() => setIsForecast(f => !f)}
        className={`text-xs font-bold font-mono px-2 py-0.5 rounded border transition ${
          isForecast
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        }`}
      >
        {isForecast ? 'forecast' : 'actual'}
      </button>
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClear(); }}
        placeholder={String(m.plan)}
        className="w-28 bg-zinc-900 border border-zinc-700 focus:border-emerald-500/40 rounded-lg px-2 py-1 text-sm text-emerald-400 text-right font-mono focus:outline-none"
      />
      <button onClick={save} className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition">Save</button>
      <button onClick={onClear} className="text-xs text-zinc-600 hover:text-red-400 transition px-1">✕</button>
    </div>
  );
}

export default function IncomeTab() {
  const [market, setMarket] = useState<Market>('MIA');
  const [months, setMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [bigGoal, setBigGoal] = useState(DEFAULT_bigGoal);
  const [editingBigGoal, setEditingBigGoal] = useState(false);
  const [bigGoalInput, setBigGoalInput] = useState('');
  const [customMonthly, setCustomMonthly] = useState('');
  const [trailing12, setTrailing12] = useState<number | null>(null);
  const [equityMonths, setEquityMonths] = useState<{ month: number; trailing12: number; isForecast: boolean }[]>([]);
  const [priorYearNI, setPriorYearNI] = useState<Record<number, number>>({});
  const [uipRunRate, setUipRunRate] = useState(120000);

  useEffect(() => {
    setLoading(true);
    setEditing(null);
    fetch(`/api/income?market=${market}`)
      .then(r => r.json())
      .then(d => setMonths(d.months ?? []))
      .finally(() => setLoading(false));
  }, [market]);

  useEffect(() => {
    setBigGoal(DEFAULT_bigGoal);
    fetch(`/api/settings?key=big_uip_goal_${market}`)
      .then(r => r.json())
      .then(d => { if (d.value) setBigGoal(Number(d.value)); });
    fetch('/api/equity?year=2026')
      .then(r => r.json())
      .then(d => {
        if (d.latest?.trailing12 != null) setTrailing12(d.latest.trailing12);
        if (d.months) setEquityMonths(d.months.map((m: any) => ({ month: m.month, trailing12: m.trailing12, isForecast: m.isForecast })));
      })
      .catch(() => {});
    fetch('/api/pl?year=2025')
      .then(r => r.json())
      .then(d => {
        const byMonth: Record<number, number> = {};
        for (const m of d.months ?? []) byMonth[m.month] = m.net_income;
        setPriorYearNI(byMonth);
      })
      .catch(() => {});
  }, [market]);


  async function saveBigGoal() {
    const n = parseFloat(bigGoalInput.replace(/[^0-9.]/g, ''));
    if (!isNaN(n) && n > 0) {
      setBigGoal(n);
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `big_uip_goal_${market}`, value: String(n) }),
      });
    }
    setEditingBigGoal(false);
  }

  async function handleSave(month: number, actual: number, is_forecast: boolean) {
    setSaving(month);
    setEditing(null);
    const res = await fetch('/api/income', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, actual, is_forecast, market }),
    });
    const { month: updated } = await res.json();
    setMonths(prev => prev.map(m => m.month === month ? { ...m, ...updated } : m));
    setSaving(null);
  }

  async function handleClear(month: number) {
    setSaving(month);
    setEditing(null);
    const res = await fetch('/api/income', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, actual: null, is_forecast: false, market }),
    });
    const { month: updated } = await res.json();
    setMonths(prev => prev.map(m => m.month === month ? { ...m, ...updated } : m));
    setSaving(null);
  }

  // Derived stats
  const GOAL = months.length > 0 ? months.reduce((s, m) => s + m.plan, 0) : GOAL_MIA;
  const locked = months.filter(m => m.actual != null);
  const actuals = months.filter(m => m.actual != null && !m.is_forecast);
  const forecasts = months.filter(m => m.actual != null && m.is_forecast);
  const ytd = locked.reduce((s, m) => s + (m.actual ?? 0), 0);
  const planYtd = locked.reduce((s, m) => s + m.plan, 0);
  const remaining = Math.max(0, GOAL - ytd);
  const remainingMonths = 12 - locked.length;
  const pct = (ytd / GOAL) * 100;
  const beat = ytd - planYtd;
  const best = locked.length > 0 ? locked.reduce((a, b) => (b.actual ?? 0) > (a.actual ?? 0) ? b : a) : null;
  const runRate = locked.length > 0 ? ytd / locked.length : 0;
  const ytdRevenue = months.filter(m => m.revenue != null).reduce((s, m) => s + (m.revenue ?? 0), 0);

  const actualTotal = actuals.reduce((s, m) => s + (m.actual ?? 0), 0);
  const forecastTotal = forecasts.reduce((s, m) => s + (m.actual ?? 0), 0);
  const actualPct = Math.min(100, (actualTotal / GOAL) * 100);
  const forecastPct = Math.min(100 - actualPct, (forecastTotal / GOAL) * 100);
  const planPct = Math.min(100, (planYtd / GOAL) * 100);

  // BIG UIP goal stats — based on Trailing 12 months, not YTD
  const t12Value = trailing12 ?? 0;
  const bigPct = (t12Value / bigGoal) * 100;
  const bigRemaining = Math.max(0, bigGoal - t12Value);

  // UIP T12 projection chart data
  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const uipChartData = useMemo(() => {
    // Actual T12 history from equity months
    const lastActualMonth = equityMonths.filter(m => !m.isForecast).length;
    const data: { label: string; t12: number; projected: number | null; type: 'actual' | 'projected' }[] = [];

    // Add actual months
    for (const m of equityMonths.filter(em => !em.isForecast)) {
      data.push({ label: MONTH_SHORT[m.month - 1] + ' 26', t12: m.trailing12, projected: m.trailing12, type: 'actual' });
    }

    // Project forward from last actual T12 using run rate
    if (lastActualMonth > 0 && Object.keys(priorYearNI).length > 0) {
      let projT12 = equityMonths[lastActualMonth - 1]?.trailing12 ?? t12Value;
      // 2026 actuals for months 1-lastActual (needed for rolloff in 2027)
      const actuals2026: Record<number, number> = {};
      for (const m of months.filter(mo => mo.actual != null)) actuals2026[m.month] = m.actual!;

      for (let m = lastActualMonth + 1; m <= 24; m++) {
        const calMonth = ((m - 1) % 12) + 1;
        const year = m <= 12 ? 26 : 27;
        // What rolls off: if projecting into 2026, roll off 2025. Into 2027, roll off 2026.
        let rolloff = 0;
        if (m <= 12) {
          rolloff = priorYearNI[calMonth] ?? 0;
        } else {
          rolloff = actuals2026[calMonth] ?? uipRunRate; // if no actual, assume prior run rate
        }
        projT12 = projT12 - rolloff + uipRunRate;
        data.push({ label: MONTH_SHORT[calMonth - 1] + ' ' + year, t12: projT12, projected: projT12, type: 'projected' });
        // Stop if we've gone far enough
        if (m > 18) break;
      }
    }

    return data;
  }, [equityMonths, priorYearNI, uipRunRate, t12Value, months]);

  // Find if/when projection hits goal
  const hitMonth = uipChartData.find(d => d.type === 'projected' && d.t12 >= bigGoal);
  const plateauValue = uipRunRate * 12;
  const breakEvenRate = Math.ceil(bigGoal / 12);
  const willNeverHit = plateauValue < bigGoal;
  const uipVerdict = hitMonth
    ? `At ${fmt(uipRunRate)}/mo you hit ${fmt(bigGoal)} by ${hitMonth.label}. Amaze amaze amaze!`
    : willNeverHit
      ? `At ${fmt(uipRunRate)}/mo T12 caps at ${fmt(plateauValue)} — will never reach ${fmt(bigGoal)}. Need ${fmt(breakEvenRate)}/mo minimum.`
      : `At ${fmt(uipRunRate)}/mo you hit ${fmt(bigGoal)}. Check the chart for timing.`;

  // Running totals
  let running = 0;
  const runningTotals = months.map(m => {
    if (m.actual != null) running += m.actual;
    return m.actual != null ? running : null;
  });

  // Scenarios
  const onPlanAvg = remainingMonths > 0
    ? months.filter(m => m.actual == null).reduce((s, m) => s + m.plan, 0) / remainingMonths
    : 0;
  const conservative = remainingMonths > 0 ? remaining / remainingMonths : 0;
  const scenarios = [
    { name: 'Conservative', monthly: conservative, desc: 'minimum to hit goal' },
    { name: 'On Plan', monthly: onPlanAvg, desc: 'avg of remaining plan months' },
    { name: 'Current Pace', monthly: runRate, desc: `based on ${locked.length} locked months` },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-[var(--card)] border border-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-2xl border border-emerald-600/20 overflow-hidden bg-gradient-to-br from-emerald-950/20 via-zinc-950 to-zinc-950">
        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-emerald-400/70 uppercase tracking-[0.3em] font-mono">SEI {market} · Net Income Tracker</p>
            <div className="flex flex-wrap gap-1">
              {MARKETS.map(m => (
                <button key={m} onClick={() => setMarket(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono tracking-widest transition ${
                    market === m
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-600 hover:text-zinc-300 border border-transparent'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end justify-between gap-4 mb-5">
            <div className="flex gap-8 items-end">
              <div>
                <p className="text-4xl font-bold text-emerald-400 tabular-nums tracking-tight">{fmtFull(ytd)}</p>
                <p className="text-xs text-zinc-500 font-mono mt-1">YTD net income</p>
              </div>
              {ytdRevenue > 0 && (
                <div>
                  <p className="text-2xl font-bold text-blue-400 tabular-nums tracking-tight">{fmtFull(ytdRevenue)}</p>
                  <p className="text-xs text-zinc-500 font-mono mt-1">YTD revenue</p>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-zinc-300 tabular-nums">{pct.toFixed(1)}%</p>
              <p className="text-xs text-zinc-500 font-mono mt-1">of {fmt(GOAL)} plan</p>
            </div>
          </div>

          {/* Plan Goal Progress */}
          <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-1.5">{fmt(GOAL)} Plan</p>
          <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div className="absolute left-0 top-0 h-full bg-white/8 rounded-full" style={{ width: `${planPct}%` }} />
            <div className="absolute top-0 h-full bg-emerald-400/30 rounded-full" style={{ left: `${actualPct}%`, width: `${forecastPct}%` }} />
            <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${actualPct}%`, background: 'linear-gradient(90deg, #059669, #34d399)' }} />
          </div>
          <div className="flex items-center gap-4 bg-[var(--card)]/60 rounded-xl px-4 py-3 border border-zinc-800 mb-4">
            <p className="text-xs text-zinc-500 font-mono flex-1">Remaining to {fmt(GOAL)}</p>
            <p className="text-lg font-bold text-amber-400 tabular-nums">{fmtFull(remaining)}</p>
            <div className="text-right text-xs font-mono">
              <p className="text-zinc-500">{fmt(remainingMonths > 0 ? remaining / remainingMonths : 0)}/mo needed</p>
              <p className="text-emerald-400">{pct.toFixed(1)}% there</p>
            </div>
          </div>

          {/* UIP T12 Projection */}
          <div className="bg-[var(--card)]/30 rounded-xl border border-violet-800/20 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-violet-400/70 font-mono uppercase tracking-widest">UIP · Rolling 12</p>
                <span className="text-xs text-violet-400 font-bold font-mono">{bigPct.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-600 font-mono">Run rate</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px]">$</span>
                    <input
                      type="number"
                      step="5000"
                      value={uipRunRate}
                      onChange={e => setUipRunRate(Number(e.target.value) || 0)}
                      className="w-24 pl-5 pr-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-violet-400 font-mono tabular-nums focus:outline-none focus:border-violet-500/40 transition-colors"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-600 font-mono">/mo</span>
                </div>
                {editingBigGoal ? (
                  <div className="flex items-center gap-1">
                    <input autoFocus type="number" value={bigGoalInput} onChange={e => setBigGoalInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveBigGoal(); if (e.key === 'Escape') setEditingBigGoal(false); }}
                      className="w-24 bg-zinc-900 border border-violet-700/40 rounded px-2 py-1 text-[11px] text-violet-300 font-mono focus:outline-none" />
                    <button onClick={saveBigGoal} className="text-[10px] text-violet-400 font-mono">save</button>
                  </div>
                ) : (
                  <button onClick={() => { setBigGoalInput(String(bigGoal)); setEditingBigGoal(true); }}
                    className="text-[10px] text-zinc-600 font-mono hover:text-violet-400 transition-colors">
                    Goal: {fmt(bigGoal)}
                  </button>
                )}
              </div>
            </div>

            {/* Summary row */}
            <div className="flex items-center gap-6 mb-3">
              <div>
                <p className="text-[10px] text-zinc-600 font-mono">T12 Now</p>
                <p className="text-lg font-bold text-violet-400 tabular-nums">{fmt(t12Value)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 font-mono">Remaining</p>
                <p className="text-sm font-bold text-zinc-400 tabular-nums">{fmt(bigRemaining)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 font-mono">Break-even</p>
                <p className="text-sm font-bold text-zinc-400 tabular-nums">{fmt(breakEvenRate)}/mo</p>
              </div>
            </div>

            {/* Chart */}
            {uipChartData.length > 0 && (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={uipChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tickFormatter={v => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${Math.round(v/1000)}K`} tick={{ fill: '#a1a1aa', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={50} domain={[0, (max: number) => Math.max(max, bigGoal * 1.1)]} />
                  <Tooltip
                    contentStyle={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(v: unknown) => ['$' + Math.round(Number(v)).toLocaleString(), 'T12']}
                  />
                  <ReferenceLine y={bigGoal} stroke="#818cf8" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: fmt(bigGoal), position: 'right', fill: '#818cf8', fontSize: 9, fontFamily: 'monospace' }} />
                  <Line type="monotone" dataKey="t12" stroke="#a78bfa" strokeWidth={3} dot={(props: any) => {
                    const d = uipChartData[props.index];
                    if (!d) return <circle key={props.index} />;
                    return <circle key={props.index} cx={props.cx} cy={props.cy} r={d.type === 'actual' ? 3 : 2} fill={d.type === 'actual' ? '#a78bfa' : '#a78bfa50'} stroke={d.type === 'actual' ? '#a78bfa' : 'none'} />;
                  }} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* Verdict */}
            <p className={`text-xs font-mono mt-2 ${hitMonth ? 'text-emerald-400' : 'text-amber-400'}`}>{uipVerdict}</p>
          </div>

          <div className="flex gap-4 text-xs text-zinc-600 font-mono">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'linear-gradient(90deg,#059669,#34d399)' }} />Actual</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-400/30 inline-block" />Forecast</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-white/10 inline-block" />Plan YTD</span>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Vs Plan YTD', value: (beat >= 0 ? '+' : '') + fmt(beat), sub: `vs ${fmt(planYtd)} plan`, color: beat >= 0 ? 'text-emerald-400' : 'text-amber-400' },
          { label: '% of Plan', value: planYtd > 0 ? (ytd / planYtd * 100).toFixed(1) + '%' : '—', sub: `${fmt(ytd)} actual vs ${fmt(planYtd)} plan`, color: ytd >= planYtd ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Best Month', value: best ? fmt(best.actual) : '—', sub: best ? MONTH_NAMES[best.month - 1] : '—', color: 'text-amber-400' },
          { label: 'Run Rate Avg', value: fmt(runRate), sub: 'per locked month', color: 'text-blue-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[var(--card)] rounded-xl border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-2">{kpi.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-zinc-600 font-mono mt-1 truncate">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div className="bg-[var(--card)] rounded-xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Monthly Breakdown</p>
          <p className="text-xs text-zinc-600 font-mono italic">click a row to update</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Month', 'Plan', 'Actual / Forecast', 'vs Plan', 'Running Total', `% ${fmt(GOAL)}`, `% ${fmt(bigGoal)}`, ''].map((h, i) => (
                  <th key={i} className={`px-5 py-2.5 text-xs font-mono text-zinc-600 uppercase tracking-widest font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => {
                const rt = runningTotals[i];
                const variance = m.actual != null ? m.actual - m.plan : null;
                const isEditing = editing === m.month;
                const isSaving = saving === m.month;
                const rowBg = m.actual != null && !m.is_forecast
                  ? 'bg-emerald-500/[0.03]'
                  : m.actual != null && m.is_forecast
                  ? 'bg-blue-500/[0.03]'
                  : '';

                return (
                  <tr key={m.month} className={`border-b border-[var(--border)]/60 last:border-0 ${rowBg} hover:bg-[var(--card)]/40 transition-colors`}>
                    {/* Month */}
                    <td className="px-5 py-3 text-left">
                      <span className="text-zinc-300 font-medium">{MONTH_NAMES[m.month - 1]}</span>
                      <span className={`ml-2 text-xs font-bold font-mono px-1.5 py-0.5 rounded border ${
                        m.actual != null && !m.is_forecast ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        m.actual != null && m.is_forecast ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-zinc-800 text-zinc-600 border-zinc-700'
                      }`}>
                        {m.actual != null && !m.is_forecast ? 'actual' : m.actual != null ? 'forecast' : 'open'}
                      </span>
                    </td>
                    {/* Plan */}
                    <td className="px-5 py-3 text-right font-mono text-zinc-500">{fmt(m.plan)}</td>
                    {/* Actual/Forecast */}
                    <td className="px-5 py-3 text-right">
                      {isEditing ? (
                        <EditRow
                          m={m}
                          onSave={(actual, is_forecast) => handleSave(m.month, actual, is_forecast)}
                          onClear={() => setEditing(null)}
                        />
                      ) : isSaving ? (
                        <span className="text-xs text-zinc-600 font-mono">saving…</span>
                      ) : (
                        <button onClick={() => setEditing(m.month)} className="font-mono tabular-nums hover:opacity-70 transition-opacity">
                          {m.actual != null ? (
                            <span className={m.is_forecast ? 'text-blue-400' : 'text-emerald-400'}>{fmt(m.actual)}</span>
                          ) : (
                            <span className="text-zinc-700">+ enter</span>
                          )}
                        </button>
                      )}
                    </td>
                    {/* vs Plan */}
                    <td className="px-5 py-3 text-right font-mono">
                      {variance != null ? (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                          variance >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {variance >= 0 ? '+' : ''}{fmt(variance)}
                        </span>
                      ) : <span className="text-zinc-700">—</span>}
                    </td>
                    {/* Running total */}
                    <td className="px-5 py-3 text-right font-mono text-zinc-400">{rt != null ? fmt(rt) : <span className="text-zinc-700">—</span>}</td>
                    {/* % of $1M goal */}
                    <td className="px-5 py-3 text-right font-mono text-zinc-500">{rt != null ? (rt / GOAL * 100).toFixed(1) + '%' : <span className="text-zinc-700">—</span>}</td>
                    {/* % of $1.7M BIG UIP goal */}
                    <td className="px-5 py-3 text-right font-mono text-violet-400/60">{rt != null ? (rt / bigGoal * 100).toFixed(1) + '%' : <span className="text-zinc-700">—</span>}</td>
                    {/* Clear */}
                    <td className="px-5 py-3 text-right">
                      {m.actual != null && !isEditing && (
                        <button onClick={() => handleClear(m.month)} className="text-zinc-700 hover:text-red-400 text-xs transition-colors font-mono">✕</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="border-t border-zinc-700 bg-[var(--card)]/40">
                <td className="px-5 py-3 text-left font-bold text-zinc-300 font-mono text-xs uppercase tracking-widest">Full Year</td>
                <td className="px-5 py-3 text-right font-mono text-zinc-500">{fmt(months.reduce((s, m) => s + m.plan, 0))}</td>
                <td className="px-5 py-3 text-right font-mono text-emerald-400 font-bold">{fmt(ytd)} so far</td>
                <td className="px-5 py-3 text-right">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${beat >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {beat >= 0 ? '+' : ''}{fmt(beat)} YTD
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-mono text-zinc-300">{fmtFull(ytd)}</td>
                <td className="px-5 py-3 text-right font-mono text-zinc-400">{pct.toFixed(1)}%</td>
                <td className="px-5 py-3 text-right font-mono text-violet-400/60">{bigPct.toFixed(1)}%</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Scenarios */}
      <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-4">
          {remainingMonths > 0 ? `Run Rate Scenarios · ${remainingMonths} open months remaining` : 'All months locked — full year complete'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {scenarios.map(sc => {
            const projected = ytd + sc.monthly * remainingMonths;
            const over = projected - GOAL;
            const bigOver = projected - bigGoal;
            return (
              <div key={sc.name} className="bg-[var(--card)]/60 rounded-xl border border-zinc-800 p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-2">{sc.name}</p>
                <p className="text-2xl font-bold text-emerald-400 tabular-nums">{fmtFull(Math.round(projected))}</p>
                <p className="text-xs text-zinc-600 font-mono mt-1">
                  {fmt(sc.monthly)}/mo
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-600">{fmt(GOAL)} plan</span>
                    <span className={over >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {(projected / GOAL * 100).toFixed(0)}% {over >= 0 ? '(' + fmt(over) + ' over)' : '(' + fmt(Math.abs(over)) + ' short)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-violet-400/60">{fmt(bigGoal)} UIP</span>
                    <span className={bigOver >= 0 ? 'text-violet-400' : 'text-zinc-500'}>
                      {(projected / bigGoal * 100).toFixed(0)}% {bigOver >= 0 ? '(' + fmt(bigOver) + ' over)' : '(' + fmt(Math.abs(bigOver)) + ' short)'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Custom scenario card */}
          {(() => {
            const customVal = parseFloat(customMonthly.replace(/[^0-9.]/g, ''));
            const hasValue = !isNaN(customVal) && customVal > 0;
            const projected = hasValue ? ytd + customVal * remainingMonths : null;
            const over = projected != null ? projected - GOAL : null;
            const bigOver = projected != null ? projected - bigGoal : null;
            return (
              <div className="bg-[var(--card)]/60 rounded-xl border border-amber-800/30 p-4">
                <p className="text-xs text-amber-400/70 uppercase tracking-widest font-mono mb-2">What If</p>
                <div className="mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-600 font-mono">$</span>
                    <input
                      type="number"
                      value={customMonthly}
                      onChange={e => setCustomMonthly(e.target.value)}
                      placeholder="enter monthly"
                      className="w-full bg-[var(--card)] border border-zinc-700 focus:border-amber-500/40 rounded-lg px-2 py-1.5 text-lg font-bold text-amber-400 font-mono tabular-nums focus:outline-none placeholder:text-zinc-700 placeholder:text-sm placeholder:font-normal"
                    />
                  </div>
                  <p className="text-xs text-zinc-600 font-mono mt-1">/mo · {remainingMonths} months left</p>
                </div>
                {projected != null ? (
                  <>
                    <p className="text-2xl font-bold text-white tabular-nums mb-2">{fmtFull(Math.round(projected))}</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-600">{fmt(GOAL)} plan</span>
                        <span className={over! >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {(projected / GOAL * 100).toFixed(0)}% {over! >= 0 ? '(' + fmt(over!) + ' over)' : '(' + fmt(Math.abs(over!)) + ' short)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-violet-400/60">{fmt(bigGoal)} UIP</span>
                        <span className={bigOver! >= 0 ? 'text-violet-400' : 'text-zinc-500'}>
                          {(projected / bigGoal * 100).toFixed(0)}% {bigOver! >= 0 ? '(' + fmt(bigOver!) + ' over)' : '(' + fmt(Math.abs(bigOver!)) + ' short)'}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-700 font-mono">projected total appears here</p>
                )}
              </div>
            );
          })()}
        </div>
      </div>

    </div>
  );
}
