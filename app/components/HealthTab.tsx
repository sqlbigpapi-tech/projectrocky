'use client';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
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
  active_calories: number; steps: number;
  contributors: Record<string, number>;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function secToHM(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 85) return '#34d399';
  if (score >= 70) return '#fbbf24';
  return '#f87171';
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDay(d: string) {
  const [, m, day] = d.split('-');
  return `${MONTH_SHORT[parseInt(m)-1]} ${parseInt(day)}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────
function ScoreRing({ score, label, sub, size = 88 }: { score: number; label: string; sub?: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreBg(score);
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#27272a" strokeWidth="7" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s ease' }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: size * 0.22, fontFamily: 'monospace', fontWeight: 'bold', fill: color, transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px` }}>
          {score}
        </text>
      </svg>
      <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">{label}</p>
      {sub && <p className="text-xs text-zinc-600 font-mono -mt-1">{sub}</p>}
    </div>
  );
}

function ContributorBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-zinc-500 font-mono w-36 shrink-0 truncate capitalize">{label.replace(/_/g, ' ')}</p>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: scoreBg(value) }} />
      </div>
      <p className="text-xs font-bold font-mono w-8 text-right" style={{ color: scoreBg(value) }}>{value}</p>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs font-mono shadow-xl">
      <p className="text-zinc-400 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function HealthTab() {
  const [readiness, setReadiness] = useState<OuraReadiness[]>([]);
  const [sleep,     setSleep]     = useState<OuraSleep[]>([]);
  const [activity,  setActivity]  = useState<OuraActivity[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [noToken,   setNoToken]   = useState(false);
  const [error,     setError]     = useState('');
  const [range,     setRange]     = useState<7 | 14 | 30>(14);

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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-32 bg-zinc-950 border border-zinc-800 rounded-2xl animate-pulse" />
      ))}
    </div>
  );

  // ── Connect ──────────────────────────────────────────────────────────────
  if (noToken) return (
    <div className="flex flex-col items-center justify-center py-24 gap-5">
      <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-2xl">◎</div>
      <p className="text-xl font-bold text-white">Connect Your Oura Ring</p>
      <p className="text-sm text-zinc-500 font-mono text-center max-w-sm">
        Sign in with Oura to see your readiness, sleep, and activity data.
      </p>
      <a href="/api/oura/login"
        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition">
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

  // ── Derived data ─────────────────────────────────────────────────────────
  const today   = readiness[readiness.length - 1] ?? null;
  const todaySleep    = sleep[sleep.length - 1] ?? null;
  const todayActivity = activity[activity.length - 1] ?? null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - range);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const rangedReadiness = readiness.filter(d => d.day >= cutoffStr);
  const rangedSleep     = sleep.filter(d => d.day >= cutoffStr);
  const rangedActivity  = activity.filter(d => d.day >= cutoffStr);

  // Trend chart data (merge all three by day)
  const trendDays = rangedReadiness.map(r => {
    const s = rangedSleep.find(x => x.day === r.day);
    const a = rangedActivity.find(x => x.day === r.day);
    return {
      date:      fmtDay(r.day),
      Readiness: r.score,
      Sleep:     s?.score ?? null,
      Activity:  a?.score ?? null,
    };
  });

  // Sleep duration chart
  const sleepChart = rangedSleep.map(s => ({
    date:  fmtDay(s.day),
    Deep:  Math.round(s.deep_sleep_duration / 3600 * 10) / 10,
    REM:   Math.round(s.rem_sleep_duration  / 3600 * 10) / 10,
    Light: Math.round(s.light_sleep_duration / 3600 * 10) / 10,
    total: s.total_sleep_duration,
  }));

  const avgSleep    = rangedSleep.length ? rangedSleep.reduce((s, d) => s + d.total_sleep_duration, 0) / rangedSleep.length : 0;
  const avgHRV      = rangedSleep.filter(d => d.average_hrv).length
    ? rangedSleep.filter(d => d.average_hrv).reduce((s, d) => s + (d.average_hrv ?? 0), 0) / rangedSleep.filter(d => d.average_hrv).length
    : 0;
  const avgReadiness = rangedReadiness.length ? rangedReadiness.reduce((s, d) => s + d.score, 0) / rangedReadiness.length : 0;
  const avgActivity  = rangedActivity.length  ? rangedActivity.reduce((s, d) => s + d.score, 0)  / rangedActivity.length  : 0;

  const hasData = today || todaySleep || todayActivity;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Hero: Today's Scores ── */}
      <div className="rounded-2xl border border-indigo-600/20 bg-gradient-to-br from-indigo-950/20 via-zinc-950 to-zinc-950 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-indigo-400/70 uppercase tracking-[0.3em] font-mono">Oura Ring · Today</p>
            {today && (
              <p className="text-xs text-zinc-600 font-mono mt-0.5">{fmtDay(today.day)}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {([7, 14, 30] as const).map(d => (
              <button key={d} onClick={() => setRange(d)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${range === d ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-zinc-600 hover:text-white'}`}>
                {d}D
              </button>
            ))}
          </div>
        </div>

        {!hasData ? (
          <p className="text-sm text-zinc-500 font-mono text-center py-6">
            Connected ✓ — data will appear after your first night wearing the ring.
          </p>
        ) : (
          <div className="flex items-center justify-around gap-4">
            {today      && <ScoreRing score={today.score}           label="Readiness" sub={today.temperature_deviation != null ? `${today.temperature_deviation > 0 ? '+' : ''}${today.temperature_deviation.toFixed(2)}°C` : undefined} />}
            {todaySleep && <ScoreRing score={todaySleep.score}      label="Sleep"     sub={secToHM(todaySleep.total_sleep_duration)} />}
            {todayActivity && <ScoreRing score={todayActivity.score} label="Activity" sub={`${todayActivity.steps.toLocaleString()} steps`} />}
          </div>
        )}

        {/* Period averages */}
        {hasData && (
          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-zinc-800/60">
            {[
              { label: `${range}d avg readiness`, value: Math.round(avgReadiness), color: scoreColor(avgReadiness) },
              { label: `${range}d avg sleep`,     value: secToHM(avgSleep),        color: 'text-indigo-300' },
              { label: `${range}d avg activity`,  value: Math.round(avgActivity),  color: scoreColor(avgActivity) },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-xl font-bold tabular-nums font-mono ${s.color}`}>{s.value}</p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Score Trends ── */}
      {trendDays.length > 1 && (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-5">Score Trends · {range} days</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendDays} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                {[['readGrad','#818cf8'],['sleepGrad','#6ee7b7'],['actGrad','#fbbf24']].map(([id, color]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={85} stroke="#34d399" strokeDasharray="4 3" strokeOpacity={0.25} />
              <ReferenceLine y={70} stroke="#fbbf24" strokeDasharray="4 3" strokeOpacity={0.25} />
              <Area type="monotone" dataKey="Readiness" stroke="#818cf8" strokeWidth={2} fill="url(#readGrad)" dot={false} connectNulls />
              <Area type="monotone" dataKey="Sleep"     stroke="#6ee7b7" strokeWidth={2} fill="url(#sleepGrad)" dot={false} connectNulls />
              <Area type="monotone" dataKey="Activity"  stroke="#fbbf24" strokeWidth={2} fill="url(#actGrad)"  dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-3">
            {[['Readiness','#818cf8'],['Sleep','#6ee7b7'],['Activity','#fbbf24']].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Last Night's Sleep ── */}
      {todaySleep && (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Last Night's Sleep</p>
            <span className={`text-sm font-bold font-mono ${scoreColor(todaySleep.score)}`}>{todaySleep.score} / 100</span>
          </div>

          {/* Stage grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total',  value: secToHM(todaySleep.total_sleep_duration), color: 'text-zinc-200' },
              { label: 'Deep',   value: secToHM(todaySleep.deep_sleep_duration),  color: 'text-indigo-400' },
              { label: 'REM',    value: secToHM(todaySleep.rem_sleep_duration),   color: 'text-violet-400' },
              { label: 'Light',  value: secToHM(todaySleep.light_sleep_duration), color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/60 rounded-xl p-3">
                <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-1">{s.label}</p>
                <p className={`text-lg font-bold tabular-nums font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Stage bar */}
          {(() => {
            const total = todaySleep.total_sleep_duration;
            const deepPct  = (todaySleep.deep_sleep_duration  / total) * 100;
            const remPct   = (todaySleep.rem_sleep_duration   / total) * 100;
            const lightPct = (todaySleep.light_sleep_duration / total) * 100;
            return (
              <div className="mb-4">
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  <div className="bg-indigo-500 rounded-l-full" style={{ width: `${deepPct}%` }} />
                  <div className="bg-violet-500"                style={{ width: `${remPct}%`  }} />
                  <div className="bg-blue-500/60 rounded-r-full" style={{ width: `${lightPct}%` }} />
                </div>
                <div className="flex gap-4 mt-2">
                  {[['Deep','bg-indigo-500'],['REM','bg-violet-500'],['Light','bg-blue-500/60']].map(([l, c]) => (
                    <span key={l} className="flex items-center gap-1.5 text-xs text-zinc-600 font-mono">
                      <span className={`w-2 h-2 rounded-full ${c}`} />
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* HRV / Low HR / Efficiency */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {todaySleep.average_hrv && (
              <div className="bg-zinc-900/60 rounded-xl p-3">
                <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-1">Avg HRV</p>
                <p className="text-lg font-bold text-violet-400 font-mono">{Math.round(todaySleep.average_hrv)}<span className="text-xs text-zinc-600 font-normal ml-1">ms</span></p>
                {avgHRV > 0 && <p className="text-xs text-zinc-600 font-mono mt-0.5">{range}d avg {Math.round(avgHRV)}ms</p>}
              </div>
            )}
            {todaySleep.lowest_heart_rate && (
              <div className="bg-zinc-900/60 rounded-xl p-3">
                <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-1">Low HR</p>
                <p className="text-lg font-bold text-rose-400 font-mono">{todaySleep.lowest_heart_rate}<span className="text-xs text-zinc-600 font-normal ml-1">bpm</span></p>
              </div>
            )}
            {todaySleep.efficiency && (
              <div className="bg-zinc-900/60 rounded-xl p-3">
                <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-1">Efficiency</p>
                <p className={`text-lg font-bold font-mono ${scoreColor(todaySleep.efficiency)}`}>{todaySleep.efficiency}<span className="text-xs text-zinc-600 font-normal ml-0.5">%</span></p>
              </div>
            )}
          </div>

          {/* Sleep contributors */}
          {todaySleep.contributors && Object.keys(todaySleep.contributors).length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-3">Contributors</p>
              {Object.entries(todaySleep.contributors).map(([k, v]) => (
                <ContributorBar key={k} label={k} value={v} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Sleep Duration Trend ── */}
      {sleepChart.length > 1 && (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Sleep Duration</p>
            <p className="text-xs text-zinc-600 font-mono">{range}d · hours per night</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sleepChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${v}h`} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={8} stroke="#34d399" strokeDasharray="4 3" strokeOpacity={0.3} label={{ value: '8h', fill: '#34d399', fontSize: 10, fontFamily: 'monospace' }} />
              <Bar dataKey="Deep"  stackId="a" fill="#6366f1" radius={[0,0,0,0]} maxBarSize={24} />
              <Bar dataKey="REM"   stackId="a" fill="#8b5cf6" radius={[0,0,0,0]} maxBarSize={24} />
              <Bar dataKey="Light" stackId="a" fill="#3b82f6" fillOpacity={0.6} radius={[3,3,0,0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-3">
            {[['Deep','#6366f1'],['REM','#8b5cf6'],['Light','#3b82f6']].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Readiness ── */}
      {today && today.contributors && Object.keys(today.contributors).length > 0 && (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Readiness Breakdown</p>
            {today.temperature_deviation != null && (
              <span className="text-xs font-mono text-zinc-500">
                Body temp {today.temperature_deviation > 0 ? '+' : ''}{today.temperature_deviation.toFixed(2)}°C
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {Object.entries(today.contributors).map(([k, v]) => (
              <ContributorBar key={k} label={k} value={v} />
            ))}
          </div>
        </div>
      )}

      {/* ── Activity ── */}
      {todayActivity && (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Activity Breakdown</p>
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-sm font-bold text-amber-400 font-mono">{todayActivity.steps.toLocaleString()}</p>
                <p className="text-xs text-zinc-600 font-mono">steps</p>
              </div>
              <div>
                <p className="text-sm font-bold text-orange-400 font-mono">{todayActivity.active_calories.toLocaleString()}</p>
                <p className="text-xs text-zinc-600 font-mono">active cal</p>
              </div>
            </div>
          </div>
          {todayActivity.contributors && Object.keys(todayActivity.contributors).length > 0 && (
            <div className="space-y-2.5">
              {Object.entries(todayActivity.contributors)
                .filter(([k]) => k !== 'class_5_min')
                .map(([k, v]) => (
                  <ContributorBar key={k} label={k} value={v} />
                ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
