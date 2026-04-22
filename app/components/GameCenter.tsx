'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';

type Competitor = {
  id: string;
  abbr: string;
  name: string;
  logo: string;
  score: string;
  homeAway: 'home' | 'away';
  color: string | null;
};
type ScoringPlay = {
  period: number;
  clock: string;
  teamAbbr: string;
  text: string;
  homeScore: string;
  awayScore: string;
};
type LeaderPlayer = { name: string; stat: string; teamAbbr: string };
type LeaderCategory = { category: string; players: LeaderPlayer[] };
type WinProbPoint = { play: number; homePct: number };

type Summary = {
  eventId: string;
  state: string;
  statusDetail: string;
  statusFull: string;
  period: number;
  clock: string;
  home: Competitor | null;
  away: Competitor | null;
  venue: string;
  date: string;
  scoringPlays: ScoringPlay[];
  leaders: LeaderCategory[];
  winProbability: WinProbPoint[];
};

function hexColor(c: string | null | undefined): string | null {
  if (!c) return null;
  const trimmed = c.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return `#${trimmed}`;
}

function periodLabel(league: string, period: number): string {
  if (!period) return '';
  if (league === 'mlb')  return `${ordinal(period)} Inning`;
  if (league === 'nba')  return `Q${period}`;
  if (league === 'nfl' || league === 'college-football') return `Q${period}`;
  return `Period ${period}`;
}
function ordinal(n: number): string {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function WinProbBar({ points }: { points: WinProbPoint[] }) {
  if (points.length < 2) return null;
  const width = 320, height = 60;
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - p.homePct * height}`).join(' ');
  const last = points[points.length - 1].homePct;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1.5">
        <span>Win Probability</span>
        <span className="text-zinc-300">Home {Math.round(last * 100)}%</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#27272a" strokeDasharray="2 3" />
        <path d={d} fill="none" stroke="#10b981" strokeWidth="2" />
      </svg>
    </div>
  );
}

export default function GameCenter({
  sport,
  league,
  eventId,
  onClose,
}: {
  sport: string;
  league: string;
  eventId: string;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/game-summary?sport=${sport}&league=${league}&eventId=${eventId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) setErr(data.error);
        else setSummary(data);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // Poll only while the game is in progress
    const poll = setInterval(() => {
      if (summary?.state === 'in' || !summary) load();
    }, 25_000);
    return () => { cancelled = true; clearInterval(poll); };
  }, [sport, league, eventId, summary?.state]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const home = summary?.home;
  const away = summary?.away;
  const homeColor = hexColor(home?.color);
  const awayColor = hexColor(away?.color);
  const isLive = summary?.state === 'in';
  const isFinal = summary?.state === 'post';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start md:items-center justify-center z-50 p-0 md:p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-zinc-800 w-full md:max-w-2xl md:rounded-2xl min-h-screen md:min-h-0 md:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with team-color gradient */}
        <div
          className="relative px-5 py-5 border-b border-zinc-800 flex-shrink-0"
          style={
            homeColor && awayColor
              ? { background: `linear-gradient(135deg, ${awayColor}33 0%, #111 50%, ${homeColor}33 100%)` }
              : undefined
          }
        >
          <button onClick={onClose} className="absolute top-3 right-4 text-zinc-500 hover:text-white text-lg leading-none">✕</button>
          <div className="flex items-center justify-between gap-4">
            {away && (
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                {away.logo && (
                  <div className="w-14 h-14 md:w-16 md:h-16 relative">
                    <Image src={away.logo} alt={away.abbr} fill className="object-contain" unoptimized />
                  </div>
                )}
                <p className="text-[11px] text-zinc-400 font-mono font-bold tracking-wider">{away.abbr}</p>
                <p className="text-3xl md:text-4xl font-bold tabular-nums text-white">{away.score || '—'}</p>
              </div>
            )}
            <div className="text-center shrink-0">
              {isLive && (
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] font-bold font-mono text-green-400 uppercase tracking-widest">Live</span>
                </div>
              )}
              {isFinal && (
                <p className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest mb-1">Final</p>
              )}
              <p className="text-xs text-zinc-300 font-mono">{summary?.statusDetail || '—'}</p>
              {summary?.venue && <p className="text-[10px] text-zinc-600 font-mono mt-1 max-w-[140px] truncate">{summary.venue}</p>}
            </div>
            {home && (
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                {home.logo && (
                  <div className="w-14 h-14 md:w-16 md:h-16 relative">
                    <Image src={home.logo} alt={home.abbr} fill className="object-contain" unoptimized />
                  </div>
                )}
                <p className="text-[11px] text-zinc-400 font-mono font-bold tracking-wider">{home.abbr}</p>
                <p className="text-3xl md:text-4xl font-bold tabular-nums text-white">{home.score || '—'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && !summary && (
            <div className="p-10 text-center text-zinc-600 text-sm">Loading game data…</div>
          )}
          {err && (
            <div className="p-10 text-center text-red-400 text-sm">{err}</div>
          )}

          {summary && (
            <div className="divide-y divide-zinc-800/60">
              {/* Win probability */}
              {summary.winProbability.length > 1 && (
                <div className="px-5 py-4">
                  <WinProbBar points={summary.winProbability} />
                </div>
              )}

              {/* Leaders */}
              {summary.leaders.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[11px] font-bold font-mono uppercase tracking-widest text-zinc-500 mb-2.5">Leaders</p>
                  <div className="space-y-1.5">
                    {summary.leaders.slice(0, 4).map(cat => (
                      <div key={cat.category} className="flex items-center gap-3 text-xs">
                        <span className="w-20 text-zinc-500 font-mono uppercase tracking-wider text-[10px] shrink-0">{cat.category}</span>
                        <div className="flex-1 flex flex-wrap gap-x-4 gap-y-0.5">
                          {cat.players.map((p, i) => (
                            <span key={i} className="text-zinc-300">
                              <span className="text-zinc-500 font-mono mr-1">{p.teamAbbr}</span>
                              {p.name} <span className="text-zinc-500 font-mono tabular-nums">{p.stat}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scoring plays */}
              {summary.scoringPlays.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[11px] font-bold font-mono uppercase tracking-widest text-zinc-500 mb-2.5">Scoring</p>
                  <div className="space-y-2">
                    {summary.scoringPlays.slice().reverse().map((p, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs">
                        <div className="shrink-0 w-14 font-mono text-zinc-500 text-[10px]">
                          <p>{periodLabel(league, p.period)}</p>
                          {p.clock && <p className="text-zinc-600">{p.clock}</p>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-zinc-300 leading-snug">
                            <span className="text-zinc-500 font-mono mr-1.5">{p.teamAbbr}</span>
                            {p.text}
                          </p>
                        </div>
                        <div className="shrink-0 text-right font-mono tabular-nums text-white text-[11px]">
                          {p.awayScore}–{p.homeScore}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.scoringPlays.length === 0 && summary.leaders.length === 0 && summary.state === 'pre' && (
                <div className="p-10 text-center text-zinc-600 text-sm">
                  Game hasn't started yet. Check back after first pitch.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
