'use client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

export type MetricKey = 'readiness' | 'sleep' | 'activity' | 'hrv' | 'steps';

type TrendPoint = {
  date: string;
  readiness: number | null;
  sleep: number | null;
  activity: number | null;
  hrv: number | null;
  steps: number | null;
};

export const METRIC_META: Record<MetricKey, { label: string; color: string; unit: string; ref?: number }> = {
  readiness: { label: 'Readiness', color: '#818cf8', unit: '',   ref: 85 },
  sleep:     { label: 'Sleep',     color: '#34d399', unit: '',   ref: 85 },
  activity:  { label: 'Activity',  color: '#fbbf24', unit: '',   ref: 85 },
  hrv:       { label: 'HRV',       color: '#a78bfa', unit: 'ms' },
  steps:     { label: 'Steps',     color: '#f97316', unit: '' },
};

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

export default function HealthTrends({ data, metric }: { data: TrendPoint[]; metric: MetricKey }) {
  const m = METRIC_META[metric];
  const isScore = metric === 'readiness' || metric === 'sleep' || metric === 'activity';
  const yDomain: [number, number] | ['auto', 'auto'] = isScore ? [0, 100] : ['auto', 'auto'];
  const tickFormatter = (v: number) => {
    if (metric === 'steps') return `${Math.round(v / 1000)}k`;
    return String(v);
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
  );
}
