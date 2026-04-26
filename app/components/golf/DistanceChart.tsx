'use client';
import { Club, DAVID_CLUBS } from '@/lib/golf/clubs';

export default function DistanceChart({ clubs = DAVID_CLUBS }: { clubs?: Club[] }) {
  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm font-mono">
          <thead className="bg-zinc-900/60">
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
              <th className="text-left px-4 py-2.5 font-semibold">Club</th>
              <th className="text-right px-4 py-2.5 font-semibold">Loft</th>
              <th className="text-right px-4 py-2.5 font-semibold">Carry</th>
              <th className="text-right px-4 py-2.5 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((c, i) => (
              <tr
                key={c.club}
                className={`border-t border-zinc-800/60 ${i % 2 === 0 ? 'bg-zinc-950/40' : ''}`}
              >
                <td className="px-4 py-2 text-zinc-200">{c.club}</td>
                <td className="px-4 py-2 text-right text-zinc-400">{c.loft}</td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-100">{c.carry}</td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-400">{c.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {clubs.map(c => (
          <div
            key={c.club}
            className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 flex items-center justify-between"
          >
            <div>
              <div className="text-sm font-semibold text-zinc-100">{c.club}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mt-0.5">
                Loft {c.loft}
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-mono tabular-nums text-zinc-100">{c.carry}<span className="text-[10px] text-zinc-500 ml-1">y carry</span></div>
              <div className="text-[11px] font-mono tabular-nums text-zinc-500 mt-0.5">{c.total}y total</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
