'use client';
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

type Row = { date: string; metric: string; qty: number | null; min_val: number | null; max_val: number | null; unit: string };

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d: string) {
  const [, m, day] = d.split('-');
  return `${MONTH_SHORT[parseInt(m) - 1]} ${parseInt(day)}`;
}

function latest(rows: Row[], metric: string): number | null {
  const found = [...rows].filter(r => r.metric === metric && r.qty != null).sort((a,b) => b.date.localeCompare(a.date));
  return found[0]?.qty ?? null;
}

function byDate(rows: Row[], metric: string) {
  return rows.filter(r => r.metric === metric && r.qty != null).map(r => ({ date: fmtDate(r.date), raw: r.date, value: r.qty! }));
}

function avg(rows: Row[], metric: string): number | null {
  const vals = rows.filter(r => r.metric === metric && r.qty != null).map(r => r.qty!);
  return vals.length ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : null;
}

function CustomTooltip({ active, payload, label, unit }: { active?: boolean; payload?: {value:number;color:string;name:string}[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs font-mono shadow-xl">
      <p className="text-zinc-400 mb-2">{label}</p>
      {payload.map((p,i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white font-bold">{Math.round(p.value).toLocaleString()} {unit}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value, unit, sub, color = 'text-white', icon }: { label: string; value: string | number | null; unit?: string; sub?: string; color?: string; icon?: string }) {
  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-lg">{icon}</span>}
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">{label}</p>
      </div>
      {value != null ? (
        <p className={`text-2xl font-bold tabular-nums ${color}`}>
          {typeof value === 'number' ? Math.round(value).toLocaleString() : value}
          {unit && <span className="text-sm text-zinc-500 font-normal ml-1">{unit}</span>}
        </p>
      ) : (
        <p className="text-2xl font-bold text-zinc-700">—</p>
      )}
      {sub && <p className="text-xs text-zinc-600 font-mono mt-1">{sub}</p>}
    </div>
  );
}

export default function HealthTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 14 | 30>(14);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setRows(d.metrics ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-4">
      {Array.from({length:4}).map((_,i) => <div key={i} className="h-32 bg-zinc-950 border border-zinc-800 rounded-2xl animate-pulse" />)}
    </div>
  );

  // Filter to selected range
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - range);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const ranged = rows.filter(r => r.date >= cutoffStr);

  // No data state
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-4xl">🍎</p>
        <p className="text-lg font-bold text-white">No health data yet</p>
        <p className="text-sm text-zinc-500 font-mono text-center max-w-md">
          Configure Health Auto Export on your iPhone to send data to:
        </p>
        <code className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-emerald-400 font-mono">
          https://finance-dashboard-one-henna.vercel.app/api/health
        </code>
        <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-sm text-zinc-400 font-mono space-y-2 max-w-md">
          <p className="text-white font-bold mb-3">Setup steps:</p>
          <p>1. Download <span className="text-amber-400">Health Auto Export</span> from App Store</p>
          <p>2. Open app → Automations → Add Automation</p>
          <p>3. Set export type to <span className="text-emerald-400">REST API</span></p>
          <p>4. Paste the URL above as the endpoint</p>
          <p>5. Select your metrics (steps, heart rate, HRV, sleep, calories)</p>
          <p>6. Set schedule (hourly or daily)</p>
          <p>7. Tap <span className="text-blue-400">Export Now</span> to send first batch</p>
        </div>
      </div>
    );
  }

  // Chart data
  const stepsData   = byDate(ranged, 'step_count');
  const hrData      = byDate(ranged, 'heart_rate');
  const hrvData     = byDate(ranged, 'heart_rate_variability');
  const exerciseData = byDate(ranged, 'apple_exercise_time');
  const activeData  = byDate(ranged, 'active_energy');
  const restingHrData = byDate(ranged, 'resting_heart_rate');

  // Latest values (from all rows, not just ranged)
  const todaySteps   = latest(rows, 'step_count');
  const todayHR      = latest(rows, 'resting_heart_rate') ?? latest(rows, 'heart_rate');
  const todayHRV     = latest(rows, 'heart_rate_variability');
  const todayExercise = latest(rows, 'apple_exercise_time');
  const todayCalories= latest(rows, 'active_energy');
  const todayWeight  = latest(rows, 'body_mass');

  const avgSteps    = avg(ranged, 'step_count');
  const avgExercise = avg(ranged, 'apple_exercise_time');
  const avgHRV      = avg(ranged, 'heart_rate_variability');

  const STEP_GOAL = 10000;
  const stepPct = todaySteps ? Math.min(100, (todaySteps / STEP_GOAL) * 100) : 0;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="rounded-2xl border border-rose-600/20 bg-gradient-to-br from-rose-950/20 via-zinc-950 to-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-rose-400/70 uppercase tracking-[0.3em] font-mono">Apple Health · David Ortiz</p>
          <div className="flex items-center gap-1">
            {([7,14,30] as const).map(d => (
              <button key={d} onClick={() => setRange(d)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${range === d ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-zinc-600 hover:text-white'}`}>
                {d}D
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Steps Today" value={todaySteps} icon="👟" color="text-emerald-400"
            sub={avgSteps ? `avg ${avgSteps.toLocaleString()}/day` : undefined} />
          <KpiCard label="Resting HR" value={todayHR} unit="bpm" icon="❤️" color="text-rose-400"
            sub="latest reading" />
          <KpiCard label="HRV" value={todayHRV} unit="ms" icon="🫀" color="text-violet-400"
            sub={avgHRV ? `avg ${avgHRV}ms` : undefined} />
          <KpiCard label="Exercise" value={todayExercise} unit="min" icon="🏃" color="text-green-400"
            sub={avgExercise ? `avg ${Math.round(avgExercise)}min` : undefined} />
          <KpiCard label="Active Cal" value={todayCalories} unit="kcal" icon="🔥" color="text-amber-400"
            sub="today" />
          {todayWeight && <KpiCard label="Weight" value={todayWeight.toFixed(1)} unit="lbs" icon="⚖️" color="text-cyan-400" sub="latest" />}
        </div>

        {/* Step goal bar */}
        {todaySteps != null && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-zinc-500">Step goal progress</span>
              <span className="text-emerald-400">{todaySteps.toLocaleString()} / {STEP_GOAL.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${stepPct}%`, background: stepPct >= 100 ? 'linear-gradient(90deg,#059669,#34d399)' : '#10b981' }} />
            </div>
          </div>
        )}
      </div>

      {/* Steps Chart */}
      {stepsData.length > 0 && (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Daily Steps</p>
              <p className="text-xs text-zinc-700 font-mono mt-0.5">last {range} days</p>
            </div>
            <p className="text-sm font-bold text-emerald-400 font-mono">{avgSteps?.toLocaleString()} avg</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stepsData} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Math.round(v/1000)}k`} tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<CustomTooltip unit="steps" />} />
              <ReferenceLine y={STEP_GOAL} stroke="#34d399" strokeDasharray="4 3" strokeOpacity={0.3} />
              <Bar dataKey="value" name="Steps" radius={[3,3,0,0]} maxBarSize={28}>
                {stepsData.map((d,i) => <Cell key={i} fill={d.value >= STEP_GOAL ? '#34d399' : '#10b981'} fillOpacity={d.value >= STEP_GOAL ? 0.9 : 0.6} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* HR + HRV row */}
      {(restingHrData.length > 0 || hrData.length > 0 || hrvData.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Heart Rate */}
          {(restingHrData.length > 0 || hrData.length > 0) && (
            <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-5">Heart Rate</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={restingHrData.length > 0 ? restingHrData : hrData} margin={{top:4,right:4,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto','auto']} tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<CustomTooltip unit="bpm" />} />
                  <Area type="monotone" dataKey="value" name="BPM" stroke="#f43f5e" strokeWidth={2} fill="url(#hrGrad)" dot={{fill:'#f43f5e',r:3,strokeWidth:0}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* HRV */}
          {hrvData.length > 0 && (
            <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">HRV</p>
                <p className="text-xs text-zinc-600 font-mono">heart rate variability</p>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={hrvData} margin={{top:4,right:4,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={<CustomTooltip unit="ms" />} />
                  <Area type="monotone" dataKey="value" name="HRV" stroke="#a78bfa" strokeWidth={2} fill="url(#hrvGrad)" dot={{fill:'#a78bfa',r:3,strokeWidth:0}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Exercise Time */}
      {exerciseData.length > 0 && (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Exercise Time</p>
              <p className="text-xs text-zinc-700 font-mono mt-0.5">minutes per day</p>
            </div>
            {avgExercise && <p className="text-sm font-bold text-green-400 font-mono">{Math.round(avgExercise)}min avg</p>}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={exerciseData} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<CustomTooltip unit="min" />} />
              <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 3" strokeOpacity={0.3} />
              <Bar dataKey="value" name="Exercise" radius={[3,3,0,0]} maxBarSize={28}>
                {exerciseData.map((d,i) => <Cell key={i} fill={d.value >= 30 ? '#22c55e' : '#4ade80'} fillOpacity={0.75} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Active Calories */}
      {activeData.length > 0 && (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Active Calories</p>
            <p className="text-sm font-bold text-amber-400 font-mono">{avg(ranged,'active_energy')?.toLocaleString()} avg kcal</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={activeData} margin={{top:4,right:4,left:0,bottom:0}}>
              <defs>
                <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'#52525b',fontSize:10,fontFamily:'monospace'}} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip unit="kcal" />} />
              <Area type="monotone" dataKey="value" name="Calories" stroke="#f59e0b" strokeWidth={2} fill="url(#calGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
