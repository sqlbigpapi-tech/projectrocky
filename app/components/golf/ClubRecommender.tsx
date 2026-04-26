'use client';
import { useState, useMemo } from 'react';
import { recommendClub, Recommendation } from '@/lib/golf/recommend';
import { Club } from '@/lib/golf/clubs';

function ClubRow({ label, club, accent }: { label: string; club: Club | null; accent: string }) {
  if (!club) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
        <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{label}</div>
        <div className="text-sm text-zinc-600 mt-1">—</div>
      </div>
    );
  }
  return (
    <div className={`rounded-lg border ${accent} px-3 py-2.5`}>
      <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="flex items-baseline justify-between mt-1">
        <div className="text-sm font-semibold text-zinc-100 truncate">{club.club}</div>
        <div className="text-xs font-mono tabular-nums text-zinc-400 ml-2 shrink-0">
          {club.carry}<span className="text-zinc-600">/{club.total}</span>
        </div>
      </div>
    </div>
  );
}

export default function ClubRecommender({ clubs }: { clubs: Club[] }) {
  const [distance, setDistance] = useState<string>('150');
  const [wind, setWind] = useState<string>('0');

  const distNum = Number.parseFloat(distance);
  const windNum = Number.parseFloat(wind) || 0;
  const clamped = Math.max(-20, Math.min(20, windNum));

  const rec: Recommendation | null = useMemo(
    () => recommendClub(distNum, clamped, clubs),
    [distNum, clamped, clubs],
  );

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 md:p-5">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Distance (yds)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={distance}
            onChange={e => setDistance(e.target.value)}
            className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-base font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500/60"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Wind (mph) <span className="text-zinc-600 normal-case">— neg = head, pos = tail</span>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={-20}
            max={20}
            value={wind}
            onChange={e => setWind(e.target.value)}
            className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-base font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500/60"
          />
        </label>
      </div>

      {/* Output */}
      {rec ? (
        <div>
          <div className="flex items-baseline justify-between mb-3 px-1">
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              Plays
            </div>
            <div className="text-sm font-mono tabular-nums text-zinc-300">
              {rec.effectiveDistance}y
              {clamped !== 0 && (
                <span className="text-[10px] text-zinc-500 ml-1.5">
                  ({distNum}y {clamped < 0 ? '+' : '−'}{Math.abs(clamped)} wind)
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <ClubRow label="One More" club={rec.up} accent="border-zinc-800 bg-zinc-950/40" />
            <ClubRow
              label="Pick"
              club={rec.pick}
              accent="border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/10"
            />
            <ClubRow label="One Less" club={rec.down} accent="border-zinc-800 bg-zinc-950/40" />
          </div>

          <div className="mt-3 px-1 text-[11px] font-mono text-zinc-500 tabular-nums">
            {rec.delta === 0
              ? `${rec.pick.club} carries exactly ${rec.pick.carry}y`
              : rec.delta > 0
                ? `${rec.pick.club} carries ${rec.delta}y long — choke down or take ${rec.down ? rec.down.club : 'less'}`
                : `${rec.pick.club} carries ${Math.abs(rec.delta)}y short — swing harder or take ${rec.up ? rec.up.club : 'more'}`}
          </div>
        </div>
      ) : (
        <div className="text-sm font-mono text-zinc-500 px-1">
          {clubs.length === 0 ? 'Add some clubs to your bag first.' : 'Enter a target distance.'}
        </div>
      )}
    </div>
  );
}
