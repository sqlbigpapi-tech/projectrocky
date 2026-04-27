'use client';

import { Club } from '@/lib/golf/clubs';
import { analyzeGaps, GapStatus } from '@/lib/golf/gaps';

const STATUS_TEXT: Record<GapStatus, string> = {
  tight: 'text-red-400',
  wide: 'text-amber-400',
  good: 'text-zinc-600',
};

export default function GapAnalysis({ clubs }: { clubs: Club[] }) {
  if (clubs.length < 2) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm font-mono text-zinc-500">
        Add a couple clubs to see gap analysis.
      </div>
    );
  }

  const { sorted, gaps, summary } = analyzeGaps(clubs);
  const max = sorted[0].carry;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      {/* Summary header */}
      <div className="flex items-center justify-between mb-4 text-[10px] font-mono uppercase tracking-widest">
        <span className="text-zinc-500">Adjacent-club carry gaps</span>
        <div className="flex items-center gap-3">
          {summary.tight > 0 && (
            <span className="text-red-400">{summary.tight} tight</span>
          )}
          {summary.wide > 0 && (
            <span className="text-amber-400">{summary.wide} wide</span>
          )}
          {summary.tight === 0 && summary.wide === 0 && (
            <span className="text-emerald-500">all healthy</span>
          )}
        </div>
      </div>

      {/* Bars + interleaved gaps */}
      <div>
        {sorted.map((c, i) => {
          const w = (c.carry / max) * 100;
          const gap = i < gaps.length ? gaps[i] : null;
          return (
            <div key={c.id ?? `${c.club}-${i}`}>
              <div className="flex items-center gap-2 sm:gap-3 py-1">
                <div className="w-20 sm:w-28 text-[11px] sm:text-xs font-mono text-zinc-300 truncate">
                  {c.club}
                </div>
                <div className="flex-1 relative h-1.5 bg-zinc-900 rounded-sm overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/70 to-emerald-500/30 rounded-sm"
                    style={{ width: `${w}%` }}
                  />
                </div>
                <div className="w-12 sm:w-14 text-right text-[11px] sm:text-xs font-mono tabular-nums text-zinc-200">
                  {c.carry}<span className="text-zinc-600">y</span>
                </div>
              </div>
              {gap && (
                <div className={`flex items-center gap-2 ml-20 sm:ml-28 pl-2 sm:pl-3 my-0.5 text-[10px] font-mono ${STATUS_TEXT[gap.status]}`}>
                  <span className="opacity-50">↕</span>
                  <span className="tabular-nums">{gap.yards}y</span>
                  {gap.status !== 'good' && (
                    <span className="text-[9px] uppercase tracking-widest opacity-90">{gap.status}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-600 leading-relaxed">
        Healthy gap range: 8–18y between adjacent clubs.
        Driver → 3W usually flags wide and that's by design — focus on iron + wedge gaps.
      </div>
    </div>
  );
}
