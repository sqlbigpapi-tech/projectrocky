'use client';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

const GOAL = 1001000;
const DEFAULT_BIG_GOAL = 1700000;
const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type MonthData = {
  month: number;
  plan: number;
  actual: number | null;
  is_forecast: boolean;
};

function fmt(n: number): string {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'K';
  return '$' + Math.round(n);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-xl text-xs font-mono">
      <p className="text-zinc-400 mb-2 uppercase tracking-widest">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-zinc-500">{p.name}:</span>
          <span className="text-white font-bold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function IncomeChartsTab() {
  const [months, setMonths] = useState<MonthData[]>([]);
  const [bigGoal, setBigGoal] = useState(DEFAULT_BIG_GOAL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/income').then(r => r.json()),
      fetch('/api/settings?key=big_uip_goal').then(r => r.json()),
    ]).then(([income, setting]) => {
      setMonths(income.months ?? []);
      if (setting.value) setBigGoal(Number(setting.value));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 bg-zinc-950 border border-zinc-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  // Build chart data
  let runningActual = 0;
  let runningPlan = 0;
  const chartData = months.map(m => {
    runningPlan += m.plan;
    if (m.actual != null) runningActual += m.actual;
    return {
      name: MONTH_NAMES_SHORT[m.month - 1],
      plan: m.plan,
      actual: m.actual != null && !m.is_forecast ? m.actual : undefined,
      forecast: m.actual != null && m.is_forecast ? m.actual : undefined,
      runningActual: m.actual != null ? runningActual : undefined,
      runningPlan,
      variance: m.actual != null ? m.actual - m.plan : undefined,
    };
  });

  const locked = months.filter(m => m.actual != null && !m.is_forecast);
  const ytd = locked.reduce((s, m) => s + (m.actual ?? 0), 0);
  const planYtd = locked.reduce((s, m) => s + m.plan, 0);
  const runRate = locked.length > 0 ? ytd / locked.length : 0;
  const remainingMonths = 12 - locked.length;
  const projectedTotal = ytd + runRate * remainingMonths;
  const pctGoal = (ytd / GOAL) * 100;
  const pctBig = (ytd / bigGoal) * 100;

  // Monthly variance for bar chart
  const varianceData = chartData.filter(d => d.variance !== undefined);

  // Pace line: project remaining months at run rate
  const paceData = chartData.map((d, i) => {
    const m = months[i];
    if (m.actual != null) return { name: d.name, pace: m.actual != null && !m.is_forecast ? (months.slice(0, i + 1).filter(x => x.actual != null && !x.is_forecast).reduce((s, x) => s + (x.actual ?? 0), 0)) : undefined };
    const lockedSoFar = months.slice(0, i).filter(x => x.actual != null && !x.is_forecast).length;
    const remaining = i - lockedSoFar;
    const base = locked.reduce((s, x) => s + (x.actual ?? 0), 0);
    return { name: d.name, pace: base + runRate * (i - locked.length + 1) };
  });
  void paceData;

  // Cumulative chart: running total vs plan vs goals
  const cumulativeData = chartData.map((d, i) => ({
    name: d.name,
    actual: d.runningActual,
    plan: d.runningPlan,
  }));

  return (
    <div className="space-y-6">

      {/* Header KPIs */}
      <div className="rounded-2xl border border-emerald-600/20 bg-gradient-to-br from-emerald-950/20 via-zinc-950 to-zinc-950 p-6">
        <p className="text-xs text-emerald-400/70 uppercase tracking-[0.3em] font-mono mb-4">SEI Miami · 2026 Income Analytics</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">YTD Locked</p>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{fmt(ytd)}</p>
            <p className="text-xs text-zinc-600 font-mono mt-0.5">{locked.length} months actual</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Run Rate</p>
            <p className="text-2xl font-bold text-white tabular-nums">{fmt(runRate)}<span className="text-sm text-zinc-500">/mo</span></p>
            <p className="text-xs text-zinc-600 font-mono mt-0.5">on current pace</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">vs $1M Goal</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: pctGoal >= 100 ? '#34d399' : '#f59e0b' }}>{pctGoal.toFixed(1)}%</p>
            <p className="text-xs text-zinc-600 font-mono mt-0.5">{fmt(projectedTotal)} projected</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">vs {fmt(bigGoal)} UIP</p>
            <p className="text-2xl font-bold text-violet-400 tabular-nums">{pctBig.toFixed(1)}%</p>
            <p className="text-xs text-zinc-600 font-mono mt-0.5">{fmt(bigGoal - ytd)} remaining</p>
          </div>
        </div>
      </div>

      {/* Cumulative Progress Chart */}
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Cumulative Income vs Plan</p>
            <p className="text-xs text-zinc-700 font-mono mt-0.5">running total through the year</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />Actual</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-zinc-600 inline-block rounded border-dashed" />Plan</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPlan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#52525b" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#52525b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={GOAL} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: '$1M', fill: '#f59e0b', fontSize: 10, fontFamily: 'monospace', position: 'insideTopRight' }} />
            <ReferenceLine y={bigGoal} stroke="#a78bfa" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: `${fmt(bigGoal)}`, fill: '#a78bfa', fontSize: 10, fontFamily: 'monospace', position: 'insideTopRight' }} />
            <Area type="monotone" dataKey="plan" name="Plan" stroke="#52525b" strokeWidth={1.5} fill="url(#gradPlan)" strokeDasharray="4 4" dot={false} />
            <Area type="monotone" dataKey="actual" name="Actual" stroke="#34d399" strokeWidth={2.5} fill="url(#gradActual)" dot={{ fill: '#34d399', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#34d399' }} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Bar Chart */}
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Monthly Breakdown</p>
            <p className="text-xs text-zinc-700 font-mono mt-0.5">actual vs plan per month</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500/60 inline-block" />Actual</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/40 inline-block" />Forecast</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-zinc-700 inline-block" />Plan</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="plan" name="Plan" fill="#3f3f46" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="actual" name="Actual" radius={[3, 3, 0, 0]} maxBarSize={28}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.actual != null && d.actual >= months[i].plan ? '#34d399' : '#f59e0b'} fillOpacity={0.8} />
              ))}
            </Bar>
            <Bar dataKey="forecast" name="Forecast" fill="#3b82f6" fillOpacity={0.4} radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Variance Chart */}
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Monthly Variance vs Plan</p>
            <p className="text-xs text-zinc-700 font-mono mt-0.5">how far above or below plan each month</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={varianceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#52525b" strokeWidth={1} />
            <Bar dataKey="variance" name="Variance" radius={[3, 3, 0, 0]} maxBarSize={32}>
              {varianceData.map((d, i) => (
                <Cell key={i} fill={(d.variance ?? 0) >= 0 ? '#34d399' : '#f87171'} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Goal Progress Rings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* $1M Goal */}
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-6">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-5">$1M Goal Progress</p>
          <div className="flex items-center gap-8">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#27272a" strokeWidth="10" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#34d399" strokeWidth="10"
                  strokeDasharray={`${Math.min(pctGoal, 100) * 2.513} 251.3`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-bold text-emerald-400 tabular-nums leading-none">{pctGoal.toFixed(0)}%</p>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-xs text-zinc-600 font-mono">Locked in</p>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(ytd)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-600 font-mono">Remaining</p>
                <p className="text-lg font-bold text-amber-400 tabular-nums">{fmt(Math.max(0, GOAL - ytd))}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-600 font-mono">Projected at pace</p>
                <p className={`text-lg font-bold tabular-nums ${projectedTotal >= GOAL ? 'text-emerald-400' : 'text-amber-400'}`}>{fmt(projectedTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* BIG UIP Goal */}
        <div className="bg-zinc-950 rounded-2xl border border-violet-800/20 p-6">
          <p className="text-xs text-violet-400/70 uppercase tracking-widest font-mono mb-5">BIG UIP · {fmt(bigGoal)} Target</p>
          <div className="flex items-center gap-8">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#27272a" strokeWidth="10" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#a78bfa" strokeWidth="10"
                  strokeDasharray={`${Math.min(pctBig, 100) * 2.513} 251.3`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-bold text-violet-400 tabular-nums leading-none">{pctBig.toFixed(0)}%</p>
              </div>
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-xs text-zinc-600 font-mono">Locked in</p>
                <p className="text-lg font-bold text-white tabular-nums">{fmt(ytd)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-600 font-mono">Remaining</p>
                <p className="text-lg font-bold text-violet-300 tabular-nums">{fmt(Math.max(0, bigGoal - ytd))}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-600 font-mono">Projected at pace</p>
                <p className={`text-lg font-bold tabular-nums ${projectedTotal >= bigGoal ? 'text-violet-400' : 'text-zinc-500'}`}>{fmt(projectedTotal)}</p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
