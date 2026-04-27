'use client';

import { useEffect, useState } from 'react';

type ExpertPick = {
  sport: string;
  game: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;
  pick: string;
  expert: string;
  source: string;
};

type MoneylineLine = { price: number; book: string };
type PointLine = { price: number; book: string; point: number };
type GameLines = {
  id: string;
  sport: string;
  startsAt: string;
  home: string;
  away: string;
  bestLines: {
    moneyline?: { home: MoneylineLine; away: MoneylineLine };
    spread?:    { home: PointLine;     away: PointLine };
    total?:     { over:  PointLine;    under: PointLine };
  };
  bookCount: number;
};

function americanFmt(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function timeFmt(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}

/** Match an expert pick to a game by full team name. Picks match if either side matches. */
function pickMatchesGame(pick: ExpertPick, g: GameLines): boolean {
  if (!pick.homeTeam && !pick.awayTeam) return false;
  const gh = g.home.toLowerCase();
  const ga = g.away.toLowerCase();
  const ph = pick.homeTeam.toLowerCase();
  const pa = pick.awayTeam.toLowerCase();
  // Exact full-name pair (either orientation), or single-side full-name match
  const homeHit = ph && (ph === gh || ph === ga);
  const awayHit = pa && (pa === gh || pa === ga);
  return Boolean(homeHit || awayHit);
}

export default function BetsPage() {
  const [games, setGames] = useState<GameLines[] | null>(null);
  const [picks, setPicks] = useState<ExpertPick[] | null>(null);
  const [oddsErr, setOddsErr] = useState<string | null>(null);
  const [picksErr, setPicksErr] = useState<string | null>(null);
  const [credits, setCredits] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bets/odds')
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `status ${r.status}`);
        setGames(d.games ?? []);
        setCredits(d.creditsRemaining ?? null);
      })
      .catch(e => setOddsErr(String(e)));
    fetch('/api/bets/picks')
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `status ${r.status}`);
        setPicks(d.picks ?? []);
      })
      .catch(e => setPicksErr(String(e)));
  }, []);

  const groupedBySport = (games ?? []).reduce<Record<string, GameLines[]>>((acc, g) => {
    (acc[g.sport] ??= []).push(g);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-3xl mx-auto p-5 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <a href="/" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition">← Rocky</a>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
            Best Bets
          </h1>
          <div className="w-12 text-right">
            {credits && <span className="text-[9px] font-mono text-zinc-600 tabular-nums">{credits} cr</span>}
          </div>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 text-center mb-6">
          Aggregator · house has the edge
        </p>

        {/* Slate (with picks attached per game) */}
        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-bold text-zinc-100">Tonight&apos;s Slate</h2>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Lines + expert picks</span>
          </div>
          {picksErr && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 mb-3 text-xs font-mono text-red-300">
              Picks unavailable: {picksErr}
            </div>
          )}
          {oddsErr && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-mono text-red-300">
              Odds unavailable: {oddsErr}
            </div>
          )}
          {games === null && !oddsErr && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-xs font-mono text-zinc-500">
              Loading lines…
            </div>
          )}
          {games && games.length === 0 && !oddsErr && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-xs font-mono text-zinc-500">
              No games in the next 36 hours.
            </div>
          )}
          {games && games.length > 0 && (
            <div className="space-y-5">
              {Object.entries(groupedBySport).map(([sport, sportGames]) => (
                <div key={sport}>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2 px-1">{sport}</div>
                  <div className="space-y-2">
                    {sportGames.map(g => {
                      const relPicks = (picks ?? []).filter(p => pickMatchesGame(p, g));
                      const bl = g.bestLines;
                      return (
                        <div key={g.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                          <div className="flex items-baseline justify-between mb-2">
                            <div className="text-sm font-semibold text-zinc-100">
                              {g.away} <span className="text-zinc-600">@</span> {g.home}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500">{timeFmt(g.startsAt)}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                            {/* Spread */}
                            <div className="rounded-lg bg-zinc-900/60 p-2">
                              <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Spread</div>
                              {bl.spread ? (
                                <div className="space-y-0.5">
                                  <div className="flex justify-between">
                                    <span className="text-zinc-300 truncate">{g.away.split(' ').pop()}</span>
                                    <span className="tabular-nums text-zinc-100">{bl.spread.away.point > 0 ? '+' : ''}{bl.spread.away.point} <span className="text-zinc-500">{americanFmt(bl.spread.away.price)}</span></span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-300 truncate">{g.home.split(' ').pop()}</span>
                                    <span className="tabular-nums text-zinc-100">{bl.spread.home.point > 0 ? '+' : ''}{bl.spread.home.point} <span className="text-zinc-500">{americanFmt(bl.spread.home.price)}</span></span>
                                  </div>
                                </div>
                              ) : <div className="text-zinc-600">—</div>}
                            </div>
                            {/* Moneyline */}
                            <div className="rounded-lg bg-zinc-900/60 p-2">
                              <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">ML</div>
                              {bl.moneyline ? (
                                <div className="space-y-0.5">
                                  <div className="flex justify-between">
                                    <span className="text-zinc-300 truncate">{g.away.split(' ').pop()}</span>
                                    <span className="tabular-nums text-zinc-100">{americanFmt(bl.moneyline.away.price)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-300 truncate">{g.home.split(' ').pop()}</span>
                                    <span className="tabular-nums text-zinc-100">{americanFmt(bl.moneyline.home.price)}</span>
                                  </div>
                                </div>
                              ) : <div className="text-zinc-600">—</div>}
                            </div>
                            {/* Total */}
                            <div className="rounded-lg bg-zinc-900/60 p-2">
                              <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Total</div>
                              {bl.total ? (
                                <div className="space-y-0.5">
                                  <div className="flex justify-between">
                                    <span className="text-zinc-300">O</span>
                                    <span className="tabular-nums text-zinc-100">{bl.total.over.point} <span className="text-zinc-500">{americanFmt(bl.total.over.price)}</span></span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-300">U</span>
                                    <span className="tabular-nums text-zinc-100">{bl.total.under.point} <span className="text-zinc-500">{americanFmt(bl.total.under.price)}</span></span>
                                  </div>
                                </div>
                              ) : <div className="text-zinc-600">—</div>}
                            </div>
                          </div>
                          {relPicks.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-1">
                              {relPicks.map((p, i) => (
                                <div key={i} className="text-[11px] font-mono">
                                  <span className="text-amber-400">{p.pick}</span>
                                  <span className="text-zinc-500"> · {p.expert}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 text-[9px] font-mono text-zinc-700 text-right">{g.bookCount} books</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Picks that didn't match any game on the slate (different sport, outside 36h, or parse miss) */}
        {(() => {
          if (!picks || !games || games.length === 0) return null;
          const orphans = picks.filter(p => !games.some(g => pickMatchesGame(p, g)));
          if (orphans.length === 0) return null;
          return (
            <section className="mb-6">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-base font-bold text-zinc-100">Other Picks</h2>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">No matched game on slate</span>
              </div>
              <div className="space-y-2">
                {orphans.map((p, i) => (
                  <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500">{p.sport}</span>
                      <span className="text-[10px] font-mono text-zinc-600 truncate ml-2">{p.startsAt}</span>
                    </div>
                    <div className="text-sm font-semibold text-zinc-100">{p.pick}</div>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                      {p.game} · <span className="text-zinc-400">{p.expert}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        <p className="text-center text-[10px] font-mono text-zinc-700 mt-6 leading-relaxed">
          Lines via The Odds API · expert picks scraped from Covers.com<br/>
          Track your bets, not your hopes.
        </p>
      </div>
    </main>
  );
}
