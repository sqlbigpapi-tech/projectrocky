'use client';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────
function secToHM(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}
function mToMi(m: number) { return (m / 1609.34).toFixed(1); }
function scoreLabel(s: number) {
  if (s >= 85) return 'Optimal';
  if (s >= 70) return 'Good';
  if (s >= 60) return 'Fair';
  return 'Pay Attention';
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
  return `${MONTH_SHORT[parseInt(m)-1]} ${parseInt(day)}`;
}

// ── Concentric Activity Rings ──────────────────────────────────────────────
function ActivityRings({
  move, exercise, stand,
}: { move: number; exercise: number; stand: number }) {
  const rings = [
    { pct: Math.min(1, stand),    color: '#818cf8', r: 32, stroke: 8,  label: 'Stand' },
    { pct: Math.min(1, exercise), color: '#34d399', r: 48, stroke: 8,  label: 'Exercise' },
    { pct: Math.min(1, move),     color: '#f97316', r: 64, stroke: 9,  label: 'Move' },
  ];
  const size = 160;
  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size}>
        {rings.map(({ pct, color, r, stroke }) => {
          const circ = 2 * Math.PI * r;
          const cx = size / 2, cy = size / 2;
          return (
            <g key={r} transform={`rotate(-90 ${cx} ${cy})`}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={stroke} />
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 4px ${color}88)` }} />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Activity</p>
      </div>
    </div>
  );
}

// ── Score Ring ─────────────────────────────────────────────────────────────
function ScoreRing({ score, label, sub, size = 96 }: { score: number | null; label: string; sub?: string; size?: number }) {
  const r = (size / 2) - 9;
  const circ = 2 * Math.PI * r;
  const color = score != null ? scoreColor(score) : '#3f3f46';
  const dash = score != null ? (score / 100) * circ : 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#27272a" strokeWidth="8" />
          {score != null && (
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 5px ${color}66)` }} />
          )}
          <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: size * 0.24, fontFamily: 'monospace', fontWeight: 'bold', fill: color,
              transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
            {score != null ? score : '—'}
          </text>
        </svg>
      </div>
      <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">{label}</p>
      {score != null
        ? <p className="text-xs font-mono -mt-1" style={{ color }}>{scoreLabel(score)}</p>
        : <p className="text-xs text-zinc-700 font-mono -mt-1">No data yet</p>
      }
      {sub && <p className="text-xs text-zinc-600 font-mono -mt-1">{sub}</p>}
    </div>
  );
}

// ── Metric Card ────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, unit, sub, color = 'text-white', trend }: {
  icon: string; label: string; value: string | number; unit?: string;
  sub?: string; color?: string; trend?: { value: number; label: string };
}) {
  return (
    <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <span className="text-base">{icon}</span>
        {trend && (
          <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded-full ${
            trend.value > 0 ? 'text-emerald-400 bg-emerald-500/10' :
            trend.value < 0 ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 bg-zinc-800'
          }`}>
            {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'}{Math.abs(trend.value)}{trend.label}
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {value}{unit && <span className="text-sm text-zinc-500 font-normal ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-zinc-600 font-mono mt-1">{sub}</p>}
      <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mt-2">{label}</p>
    </div>
  );
}

// ── Contributor Row ────────────────────────────────────────────────────────
function ContributorBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-zinc-500 font-mono w-40 shrink-0 capitalize">{label.replace(/_/g, ' ')}</p>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color, transition: 'width 0.7s ease' }} />
      </div>
      <p className="text-xs font-bold font-mono w-8 text-right" style={{ color }}>{value}</p>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs font-mono shadow-xl">
      <p className="text-zinc-400 mb-2">{label}</p>
      {payload.map((p: any, i: number) => p.value != null && (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function HealthTab() {
  const [readiness, setReadiness] = useState<OuraReadiness[]>([]);
  const [sleep,     setSleep]     = useState<OuraSleep[]>([]);
  const [activity,  setActivity]  = useState<OuraActivity[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [noToken,   setNoToken]   = useState(false);
  const [error,     setError]     = useState('');
  const [range,     setRange]     = useState<7 | 14 | 30>(14);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetch('/api/oura')
      .then(r => r.json())
      .then(d => {
        if (d.error === 'no_token') { setNoToken(true); return; }
        if (d.error) { setError(d.error); return; }
        setReadiness(d.readiness ?? []);
        setSleep(d.sleep ?? []);
        setActivity(d.activity ?? []);
        setFetchedAt(new Date());
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-28 bg-[var(--card)] border border-zinc-800 rounded-2xl animate-pulse" />
      ))}
    </div>
  );

  if (noToken) return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-3xl">◎</div>
      <p className="text-xl font-bold text-white">Connect Your Oura Ring</p>
      <p className="text-sm text-zinc-500 font-mono text-center max-w-sm">Authorize Oura to see your readiness, sleep, and activity.</p>
      <a href="/api/oura/login" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition">
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

  // ── Derived ──────────────────────────────────────────────────────────────
  const todayR = readiness.length > 0 ? readiness[readiness.length - 1] : null;
  const todayS = sleep.length     > 0 ? sleep[sleep.length - 1]         : null;
  const todayA = activity.length  > 0 ? activity[activity.length - 1]   : null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - range);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const rangedR = readiness.filter(d => d.day >= cutoffStr);
  const rangedS = sleep.filter(d => d.day >= cutoffStr);
  const rangedA = activity.filter(d => d.day >= cutoffStr);

  // Week-over-week for sleep score & HRV
  const last7S  = sleep.slice(-7);
  const prev7S  = sleep.slice(-14, -7);
  const avgLast7Score = last7S.length  ? last7S.reduce((s, d) => s + d.score, 0) / last7S.length  : 0;
  const avgPrev7Score = prev7S.length  ? prev7S.reduce((s, d) => s + d.score, 0) / prev7S.length  : 0;
  const sleepTrend = avgPrev7Score > 0 ? Math.round(avgLast7Score - avgPrev7Score) : 0;

  const last7HRV = last7S.filter(d => d.average_hrv).map(d => d.average_hrv!);
  const prev7HRV = prev7S.filter(d => d.average_hrv).map(d => d.average_hrv!);
  const avgLast7HRV = last7HRV.length ? last7HRV.reduce((a, b) => a + b, 0) / last7HRV.length : 0;
  const avgPrev7HRV = prev7HRV.length ? prev7HRV.reduce((a, b) => a + b, 0) / prev7HRV.length : 0;
  const hrvTrend = avgPrev7HRV > 0 ? Math.round(((avgLast7HRV - avgPrev7HRV) / avgPrev7HRV) * 100) : 0;

  // Activity rings
  const movePct     = todayA ? todayA.active_calories / Math.max(todayA.target_calories, 1) : 0;
  const exerciseMins = todayA ? Math.round((todayA.medium_activity_time + todayA.high_activity_time) / 60) : 0;
  const exercisePct  = exerciseMins / 30;
  const standPct     = todayA ? (todayA.contributors.move_every_hour ?? 0) / 100 : 0;

  // Trend charts
  const trendData = rangedR.map(r => {
    const s = rangedS.find(x => x.day === r.day);
    const a = rangedA.find(x => x.day === r.day);
    return { date: fmtDay(r.day), Readiness: r.score, Sleep: s?.score ?? null, Activity: a?.score ?? null };
  });
  // Fall back to activity-only trend if no readiness
  const activityTrend = rangedA.map(a => ({
    date: fmtDay(a.day),
    Steps: a.steps,
    'Active Cal': a.active_calories,
  }));

  const sleepChart = rangedS.map(s => ({
    date:  fmtDay(s.day),
    Deep:  +(s.deep_sleep_duration  / 3600).toFixed(2),
    REM:   +(s.rem_sleep_duration   / 3600).toFixed(2),
    Light: +(s.light_sleep_duration / 3600).toFixed(2),
  }));

  const hrvChart = rangedS.filter(d => d.average_hrv).map(s => ({
    date: fmtDay(s.day),
    HRV:  Math.round(s.average_hrv!),
  }));

  const avgHRV = hrvChart.length ? Math.round(hrvChart.reduce((s, d) => s + d.HRV, 0) / hrvChart.length) : 0;

  // Today's date label
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xl font-bold text-white">Health</p>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {dateLabel} · Oura Ring
            {fetchedAt && (
              <span className="text-zinc-500"> · fetched {fetchedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {([7, 14, 30] as const).map(d => (
            <button key={d} onClick={() => setRange(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                range === d ? 'bg-zinc-700 text-white' : 'text-zinc-600 hover:text-white'
              }`}>{d}D</button>
          ))}
        </div>
      </div>

      {/* ── Today's Three Scores ── */}
      <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-6">
        <p className="text-xs text-zinc-600 uppercase tracking-[0.3em] font-mono mb-6">Today's Scores</p>
        <div className="flex items-start justify-around gap-4">
          <ScoreRing score={todayR?.score ?? null} label="Readiness"
            sub={todayR?.temperature_deviation != null
              ? `${todayR.temperature_deviation > 0 ? '+' : ''}${todayR.temperature_deviation.toFixed(2)}°C body temp`
              : undefined} />
          <ScoreRing score={todayS?.score ?? null} label="Sleep"
            sub={todayS ? secToHM(todayS.total_sleep_duration) : undefined} />
          <ScoreRing score={todayA?.score ?? null} label="Activity"
            sub={todayA ? `${todayA.steps.toLocaleString()} steps` : undefined} />
        </div>
        {!todayR && !todayS && (
          <p className="text-xs text-zinc-700 font-mono text-center mt-5">
            Sleep + readiness scores appear after your first night with the ring
          </p>
        )}
      </div>

      {/* ── Activity Rings + Stats ── */}
      {todayA && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-6">
          <p className="text-xs text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">Activity Rings</p>
          <div className="flex items-center gap-8">
            <ActivityRings move={movePct} exercise={exercisePct} stand={standPct} />
            <div className="flex-1 space-y-4">
              {[
                { label: 'Move',     color: '#f97316', value: `${todayA.active_calories} / ${todayA.target_calories} cal`, pct: movePct },
                { label: 'Exercise', color: '#34d399', value: `${exerciseMins} / 30 min`,                                   pct: exercisePct },
                { label: 'Stand',    color: '#818cf8', value: `${todayA.contributors.move_every_hour ?? 0}%`,               pct: standPct },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                      <span className="text-xs font-bold font-mono text-zinc-300">{r.label}</span>
                    </div>
                    <span className="text-xs font-mono text-zinc-500">{r.value}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(100, r.pct * 100)}%`, background: r.color,
                        boxShadow: `0 0 6px ${r.color}88`, transition: 'width 1s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity metric grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[var(--border)]/60">
            <MetricCard icon="👟" label="Steps" value={todayA.steps.toLocaleString()}
              sub={`${mToMi(todayA.equivalent_walking_distance)} mi walked`} color="text-amber-400" />
            <MetricCard icon="🔥" label="Active Calories" value={todayA.active_calories}
              sub={`${todayA.total_calories.toLocaleString()} total cal`} color="text-orange-400" />
            <MetricCard icon="⚡" label="Active Time"
              value={secToHM(todayA.medium_activity_time + todayA.high_activity_time)}
              sub={`${secToHM(todayA.low_activity_time)} light`} color="text-green-400" />
            <MetricCard icon="🪑" label="Rest Time" value={secToHM(todayA.sedentary_time + todayA.resting_time)}
              sub={`${todayA.inactivity_alerts} inactivity alerts`}
              color={todayA.inactivity_alerts > 0 ? 'text-amber-400' : 'text-zinc-400'} />
          </div>
        </div>
      )}

      {/* ── Sleep Last Night ── */}
      {todayS && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-zinc-600 uppercase tracking-[0.3em] font-mono">Sleep</p>
            <div className="flex items-center gap-3">
              {sleepTrend !== 0 && (
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${sleepTrend > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                  {sleepTrend > 0 ? '↑' : '↓'}{Math.abs(sleepTrend)} pts vs last week
                </span>
              )}
              <span className={`text-sm font-bold font-mono ${scoreTW(todayS.score)}`}>{todayS.score} · {scoreLabel(todayS.score)}</span>
            </div>
          </div>

          {/* Stage summary */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total', value: secToHM(todayS.total_sleep_duration), color: 'text-zinc-200', icon: '🌙' },
              { label: 'Deep',  value: secToHM(todayS.deep_sleep_duration),  color: 'text-indigo-400', icon: '💤' },
              { label: 'REM',   value: secToHM(todayS.rem_sleep_duration),   color: 'text-violet-400', icon: '🧠' },
              { label: 'Light', value: secToHM(todayS.light_sleep_duration), color: 'text-blue-400',   icon: '☁️' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/60 rounded-xl p-3 text-center">
                <p className="text-base mb-1">{s.icon}</p>
                <p className={`text-base font-bold tabular-nums font-mono ${s.color}`}>{s.value}</p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Stage proportion bar */}
          {(() => {
            const t = todayS.total_sleep_duration;
            const dp = (todayS.deep_sleep_duration / t) * 100;
            const rp = (todayS.rem_sleep_duration  / t) * 100;
            const lp = (todayS.light_sleep_duration / t) * 100;
            return (
              <div className="mb-5">
                <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                  <div className="bg-indigo-500 rounded-l-full transition-all duration-700" style={{ width: `${dp}%` }} title={`Deep ${dp.toFixed(0)}%`} />
                  <div className="bg-violet-500 transition-all duration-700"             style={{ width: `${rp}%` }} title={`REM ${rp.toFixed(0)}%`} />
                  <div className="bg-blue-500/60 rounded-r-full transition-all duration-700" style={{ width: `${lp}%` }} title={`Light ${lp.toFixed(0)}%`} />
                </div>
                <div className="flex justify-between mt-2">
                  <div className="flex gap-4">
                    {[['Deep','bg-indigo-500'],['REM','bg-violet-500'],['Light','bg-blue-500/60']].map(([l,c]) => (
                      <span key={l} className="flex items-center gap-1.5 text-xs text-zinc-600 font-mono">
                        <span className={`w-2 h-2 rounded-full ${c}`} /> {l}
                      </span>
                    ))}
                  </div>
                  {todayS.efficiency && (
                    <span className={`text-xs font-bold font-mono ${scoreTW(todayS.efficiency)}`}>{todayS.efficiency}% efficient</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* HRV + Low HR */}
          <div className="grid grid-cols-2 gap-3">
            {todayS.average_hrv && (
              <div className="bg-zinc-900/60 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-1">HRV</p>
                    <p className="text-2xl font-bold text-violet-400 font-mono tabular-nums">
                      {Math.round(todayS.average_hrv)}<span className="text-sm text-zinc-500 font-normal ml-1">ms</span>
                    </p>
                    {avgHRV > 0 && <p className="text-xs text-zinc-600 font-mono mt-1">{range}d avg {avgHRV}ms</p>}
                  </div>
                  {hrvTrend !== 0 && (
                    <span className={`text-xs font-bold font-mono px-2 py-1 rounded-xl ${
                      hrvTrend > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                    }`}>{hrvTrend > 0 ? '↑' : '↓'}{Math.abs(hrvTrend)}%</span>
                  )}
                </div>
              </div>
            )}
            {todayS.lowest_heart_rate && (
              <div className="bg-zinc-900/60 rounded-xl p-4">
                <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-1">Lowest HR</p>
                <p className="text-2xl font-bold text-rose-400 font-mono tabular-nums">
                  {todayS.lowest_heart_rate}<span className="text-sm text-zinc-500 font-normal ml-1">bpm</span>
                </p>
                <p className="text-xs text-zinc-600 font-mono mt-1">during sleep</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HRV Trend ── */}
      {hrvChart.length > 1 && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-zinc-600 uppercase tracking-[0.3em] font-mono">HRV Trend</p>
              <p className="text-xs text-zinc-700 font-mono mt-0.5">heart rate variability · {range} days</p>
            </div>
            {avgHRV > 0 && <p className="text-sm font-bold text-violet-400 font-mono">{avgHRV}ms avg</p>}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={hrvChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              {avgHRV > 0 && <ReferenceLine y={avgHRV} stroke="#a78bfa" strokeDasharray="4 3" strokeOpacity={0.4} />}
              <Area type="monotone" dataKey="HRV" stroke="#a78bfa" strokeWidth={3} fill="url(#hrvGrad)"
                dot={{ fill: '#a78bfa', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Sleep Duration Trend ── */}
      {sleepChart.length > 1 && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-zinc-600 uppercase tracking-[0.3em] font-mono">Sleep Duration</p>
            <p className="text-xs text-zinc-600 font-mono">{range} nights · hours</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sleepChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${v}h`} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={8} stroke="#34d399" strokeDasharray="4 3" strokeOpacity={0.3} />
              <Bar dataKey="Deep"  stackId="a" fill="#6366f1" maxBarSize={28} />
              <Bar dataKey="REM"   stackId="a" fill="#8b5cf6" maxBarSize={28} />
              <Bar dataKey="Light" stackId="a" fill="#3b82f6" fillOpacity={0.6} radius={[3,3,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-3">
            {[['Deep','#6366f1'],['REM','#8b5cf6'],['Light','#3b82f6']].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Score Trends ── */}
      {trendData.length > 1 && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-5">
          <p className="text-xs text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">Score Trends · {range} days</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                {[['rG','#818cf8'],['sG','#34d399'],['aG','#fbbf24']].map(([id, c]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={c} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={85} stroke="#34d399" strokeDasharray="4 3" strokeOpacity={0.2} />
              <ReferenceLine y={70} stroke="#fbbf24" strokeDasharray="4 3" strokeOpacity={0.2} />
              <Area type="monotone" dataKey="Readiness" stroke="#818cf8" strokeWidth={2.5} fill="url(#rG)" dot={false} connectNulls />
              <Area type="monotone" dataKey="Sleep"     stroke="#34d399" strokeWidth={2.5} fill="url(#sG)" dot={false} connectNulls />
              <Area type="monotone" dataKey="Activity"  stroke="#fbbf24" strokeWidth={2.5} fill="url(#aG)" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-3">
            {[['Readiness','#818cf8'],['Sleep','#34d399'],['Activity','#fbbf24']].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: c }} />{l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Activity Steps Trend ── */}
      {activityTrend.length > 1 && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-5">
          <p className="text-xs text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">Steps · {range} days</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={activityTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="stepsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Math.round(v/1000)}k`} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Steps" stroke="#f97316" strokeWidth={3} fill="url(#stepsGrad)"
                dot={false} activeDot={{ r: 5, fill: '#f97316' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Readiness Contributors ── */}
      {todayR?.contributors && Object.keys(todayR.contributors).length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-5">
          <p className="text-xs text-zinc-600 uppercase tracking-[0.3em] font-mono mb-5">Readiness Breakdown</p>
          <div className="space-y-3">
            {Object.entries(todayR.contributors).map(([k, v]) => <ContributorBar key={k} label={k} value={v} />)}
          </div>
          {todayR.temperature_deviation != null && (
            <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
              <p className="text-xs text-zinc-500 font-mono">Body Temperature Deviation</p>
              <p className={`text-sm font-bold font-mono ${Math.abs(todayR.temperature_deviation) < 0.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {todayR.temperature_deviation > 0 ? '+' : ''}{todayR.temperature_deviation.toFixed(2)}°C
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
