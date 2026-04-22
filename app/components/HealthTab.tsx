'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Lazy-load recharts so this ~350KB doesn't ship in the initial bundle.
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const ReferenceLine = dynamic(() => import('recharts').then(m => m.ReferenceLine), { ssr: false });

type OuraReadiness = {
  day: string; score: number;
  temperature_deviation: number | null;
  contributors: Record<string, number>;
};
type OuraSleep = {
  day: string; score: number;
  total_sleep_duration: number; deep_sleep_duration: number;
  rem_sleep_duration: number; light_sleep_duration: number;
  average_hrv: number | null; lowest_heart_rate: number | null;
  efficiency: number | null;
  contributors: Record<string, number>;
};
type OuraActivity = {
  day: string; score: number;
  active_calories: number; total_calories: number;
  steps: number; target_calories: number; target_meters: number;
  equivalent_walking_distance: number;
  high_activity_time: number; medium_activity_time: number;
  low_activity_time: number; sedentary_time: number;
  resting_time: number; inactivity_alerts: number;
  contributors: Record<string, number>;
};

function secToHM(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}
function scoreLabel(s: number) {
  if (s >= 85) return 'Optimal';
  if (s >= 70) return 'Good';
  if (s >= 60) return 'Fair';
  return 'Low';
}
function scoreColor(s: number) {
  if (s >= 85) return '#34d399';
  if (s >= 70) return '#fbbf24';
  return '#f87171';
}
function scoreTW(s: number) {
  if (s >= 85) return 'text-emerald-400';
  if (s >= 70) return 'text-amber-400';
  return 'text-red-400';
}
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDay(d: string) {
  const [, m, day] = d.split('-');
  return `${MONTH_SHORT[parseInt(m) - 1]} ${parseInt(day)}`;
}

function ScoreRing({ score, label, sub, size = 96 }: { score: number | null; label: string; sub?: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const color = score != null ? scoreColor(score) : '#3f3f46';
  const dash = score != null ? (score / 100) * circ : 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth="7" />
          {score != null && (
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={color} strokeWidth="7"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 4px ${color}66)` }}
            />
          )}
          <text
            x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: size * 0.26, fontFamily: 'monospace', fontWeight: 700, fill: color,
              transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}
          >
            {score != null ? score : '—'}
          </text>
        </svg>
      </div>
      <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest">{label}</p>
      {score != null
        ? <p className="text-[10px] font-mono -mt-0.5" style={{ color }}>{scoreLabel(score)}</p>
        : <p className="text-[10px] text-zinc-700 font-mono -mt-0.5">No data</p>}
      {sub && <p className="text-[10px] text-zinc-600 font-mono -mt-0.5">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, unit, sub, color, trend }: {
  label: string; value: string | number; unit?: string; sub?: string; color?: string;
  trend?: { value: number; suffix: string };
}) {
  return (
    <div>
      <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest mb-0.5">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className={`text-lg font-bold tabular-nums font-mono ${color ?? 'text-white'}`}>
          {value}{unit && <span className="text-[11px] text-zinc-500 font-normal ml-0.5">{unit}</span>}
        </p>
        {trend != null && trend.value !== 0 && (
          <span className={`text-[10px] font-mono font-bold ${trend.value > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.value > 0 ? '↑' : '↓'}{Math.abs(trend.value)}{trend.suffix}
          </span>
        )}
      </div>
      {sub && <p className="text-[10px] text-zinc-600 font-mono">{sub}</p>}
    </div>
  );
}

function ContributorBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-zinc-500 font-mono w-32 shrink-0 capitalize">{label.replace(/_/g, ' ')}</p>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color, transition: 'width 0.7s ease' }} />
      </div>
      <p className="text-xs font-bold font-mono w-8 text-right" style={{ color }}>{value}</p>
    </div>
  );
}

type TooltipPayload = { value: number | null; name?: string; color?: string; fill?: string };
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-zinc-400 mb-1.5">{label}</p>
      {payload.map((p, i) => p.value != null && (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

type MetricKey = 'readiness' | 'sleep' | 'activity' | 'hrv' | 'steps';
const METRIC_META: Record<MetricKey, { label: string; color: string; unit: string; ref?: number }> = {
  readiness: { label: 'Readiness', color: '#818cf8', unit: '',    ref: 85 },
  sleep:     { label: 'Sleep',     color: '#34d399', unit: '',    ref: 85 },
  activity:  { label: 'Activity',  color: '#fbbf24', unit: '',    ref: 85 },
  hrv:       { label: 'HRV',       color: '#a78bfa', unit: 'ms' },
  steps:     { label: 'Steps',     color: '#f97316', unit: '' },
};

export default function HealthTab() {
  const [readiness, setReadiness] = useState<OuraReadiness[]>([]);
  const [sleep, setSleep] = useState<OuraSleep[]>([]);
  const [activity, setActivity] = useState<OuraActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [noToken, setNoToken] = useState(false);
  const [error, setError] = useState('');
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [metric, setMetric] = useState<MetricKey>('readiness');
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  useEffect(() => {
    fetch('/api/oura')
      .then(r => r.json())
      .then(d => {
        if (d.error === 'no_token') { setNoToken(true); return; }
        if (d.error) { setError(d.error); return; }
        setReadiness(d.readiness ?? []);
        setSleep(d.sleep ?? []);
        setActivity(d.activity ?? []);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 bg-[var(--card)] border border-zinc-800 rounded-xl animate-pulse" />
      ))}
    </div>
  );

  if (noToken) return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-2xl text-indigo-400">◎</div>
      <p className="text-lg font-bold text-white">Connect Your Oura Ring</p>
      <p className="text-sm text-zinc-500 font-mono text-center max-w-sm">Authorize Oura to see your readiness, sleep, and activity.</p>
      <a href="/api/oura/login" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition">
        Connect Oura Ring →
      </a>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <p className="text-red-400 font-mono text-sm">{error}</p>
      <a href="/api/oura/login" className="text-xs text-indigo-400 underline">Reconnect Oura</a>
    </div>
  );

  const todayR = readiness.length > 0 ? readiness[readiness.length - 1] : null;
  const todayS = sleep.length     > 0 ? sleep[sleep.length - 1]         : null;
  const todayA = activity.length  > 0 ? activity[activity.length - 1]   : null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - range);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const rangedR = readiness.filter(d => d.day >= cutoffStr);
  const rangedS = sleep.filter(d => d.day >= cutoffStr);
  const rangedA = activity.filter(d => d.day >= cutoffStr);

  const last7S = sleep.slice(-7);
  const prev7S = sleep.slice(-14, -7);
  const last7HRV = last7S.filter(d => d.average_hrv).map(d => d.average_hrv!);
  const prev7HRV = prev7S.filter(d => d.average_hrv).map(d => d.average_hrv!);
  const avgLast7HRV = last7HRV.length ? last7HRV.reduce((a, b) => a + b, 0) / last7HRV.length : 0;
  const avgPrev7HRV = prev7HRV.length ? prev7HRV.reduce((a, b) => a + b, 0) / prev7HRV.length : 0;
  const hrvTrend = avgPrev7HRV > 0 ? Math.round(((avgLast7HRV - avgPrev7HRV) / avgPrev7HRV) * 100) : 0;

  // Build one chart dataset; trend view picks one key to render.
  const allDays = Array.from(new Set([
    ...rangedR.map(d => d.day),
    ...rangedS.map(d => d.day),
    ...rangedA.map(d => d.day),
  ])).sort();
  const trendData = allDays.map(day => {
    const r = rangedR.find(x => x.day === day);
    const s = rangedS.find(x => x.day === day);
    const a = rangedA.find(x => x.day === day);
    return {
      date: fmtDay(day),
      readiness: r?.score ?? null,
      sleep: s?.score ?? null,
      activity: a?.score ?? null,
      hrv: s?.average_hrv ? Math.round(s.average_hrv) : null,
      steps: a?.steps ?? null,
    };
  });

  const m = METRIC_META[metric];
  const isScore = metric === 'readiness' || metric === 'sleep' || metric === 'activity';
  const yDomain: [number, number] | ['auto', 'auto'] = isScore ? [0, 100] : ['auto', 'auto'];
  const tickFormatter = (v: number) => {
    if (metric === 'steps') return `${Math.round(v / 1000)}k`;
    return String(v);
  };

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-white">Health</p>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{dateLabel} · Oura Ring</p>
        </div>
        <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          {([7, 14, 30] as const).map(d => (
            <button key={d} onClick={() => setRange(d)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition ${
                range === d ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'
              }`}>{d}D</button>
          ))}
        </div>
      </div>

      {/* Today hero: 3 rings + compact stat bar */}
      <div className="rounded-xl border border-zinc-800 bg-[var(--card)] p-5">
        <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-mono mb-4">Today</p>
        <div className="flex items-start justify-around gap-4 mb-5">
          <ScoreRing
            score={todayR?.score ?? null}
            label="Readiness"
            sub={todayR?.temperature_deviation != null
              ? `${todayR.temperature_deviation > 0 ? '+' : ''}${todayR.temperature_deviation.toFixed(2)}°C`
              : undefined}
          />
          <ScoreRing
            score={todayS?.score ?? null}
            label="Sleep"
            sub={todayS ? secToHM(todayS.total_sleep_duration) : undefined}
          />
          <ScoreRing
            score={todayA?.score ?? null}
            label="Activity"
            sub={todayA ? `${todayA.steps.toLocaleString()} steps` : undefined}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-zinc-800/80">
          {todayS?.average_hrv != null && (
            <Stat
              label="HRV"
              value={Math.round(todayS.average_hrv)}
              unit="ms"
              color="text-violet-400"
              trend={hrvTrend !== 0 ? { value: hrvTrend, suffix: '%' } : undefined}
            />
          )}
          {todayS?.lowest_heart_rate != null && (
            <Stat label="Low HR" value={todayS.lowest_heart_rate} unit="bpm" color="text-rose-400" />
          )}
          {todayS?.efficiency != null && (
            <Stat label="Efficiency" value={`${todayS.efficiency}%`} color={scoreTW(todayS.efficiency)} />
          )}
          {todayA && (
            <Stat label="Steps" value={todayA.steps.toLocaleString()} color="text-amber-400" />
          )}
          {todayA && (
            <Stat
              label="Active Cal"
              value={todayA.active_calories}
              sub={`of ${todayA.target_calories} goal`}
              color="text-orange-400"
            />
          )}
        </div>
      </div>

      {/* Sleep last night */}
      {todayS && (
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-mono">Last Night</p>
            <span className={`text-xs font-bold font-mono ${scoreTW(todayS.score)}`}>
              {todayS.score} · {scoreLabel(todayS.score)}
            </span>
          </div>

          {/* Stage bar */}
          {(() => {
            const t = todayS.total_sleep_duration;
            const dp = (todayS.deep_sleep_duration  / t) * 100;
            const rp = (todayS.rem_sleep_duration   / t) * 100;
            const lp = (todayS.light_sleep_duration / t) * 100;
            return (
              <>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-2">
                  <div className="bg-indigo-500 rounded-l-full transition-all duration-700" style={{ width: `${dp}%` }} title={`Deep ${dp.toFixed(0)}%`} />
                  <div className="bg-violet-500 transition-all duration-700"             style={{ width: `${rp}%` }} title={`REM ${rp.toFixed(0)}%`} />
                  <div className="bg-blue-500/60 rounded-r-full transition-all duration-700" style={{ width: `${lp}%` }} title={`Light ${lp.toFixed(0)}%`} />
                </div>
                <div className="flex items-center gap-5 text-[11px] font-mono text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    Deep <span className="text-zinc-300">{secToHM(todayS.deep_sleep_duration)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    REM <span className="text-zinc-300">{secToHM(todayS.rem_sleep_duration)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500/60" />
                    Light <span className="text-zinc-300">{secToHM(todayS.light_sleep_duration)}</span>
                  </span>
                  <span className="ml-auto text-zinc-600">Total <span className="text-white">{secToHM(todayS.total_sleep_duration)}</span></span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Trends — single chart, metric toggle */}
      {trendData.length > 1 && (
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-mono">Trends · {range}D</p>
            <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              {(Object.keys(METRIC_META) as MetricKey[]).map(k => (
                <button
                  key={k}
                  onClick={() => setMetric(k)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition ${
                    metric === k ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'
                  }`}
                >{METRIC_META[k].label}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={m.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis
                domain={yDomain}
                tickFormatter={tickFormatter}
                tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip content={<CustomTooltip />} />
              {isScore && m.ref && <ReferenceLine y={m.ref} stroke={m.color} strokeDasharray="4 3" strokeOpacity={0.25} />}
              <Area
                type="monotone"
                dataKey={metric}
                name={m.label}
                stroke={m.color}
                strokeWidth={2.5}
                fill="url(#trendGrad)"
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Readiness breakdown — collapsed by default */}
      {todayR?.contributors && Object.keys(todayR.contributors).length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]">
          <button
            onClick={() => setBreakdownOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[var(--card)]/40 transition"
          >
            <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-mono">Readiness Breakdown</p>
            <span className={`text-zinc-600 text-xs transition-transform ${breakdownOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {breakdownOpen && (
            <div className="px-5 pb-5 space-y-2.5">
              {Object.entries(todayR.contributors).map(([k, v]) => <ContributorBar key={k} label={k} value={v} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
