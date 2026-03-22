'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { GolfData } from '../api/golf/route';

type Team = { name: string; abbr: string; score: string; logo: string };
type Game = {
  id: string;
  league: string;
  date: string;
  homeTeam: Team;
  awayTeam: Team;
  status: 'live' | 'final' | 'scheduled';
  statusDetail: string;
};

type Scores = { nfl: Game[]; nba: Game[]; mlb: Game[] };

const LEAGUES = ['All', 'NFL', 'NBA', 'MLB'] as const;
type LeagueFilter = typeof LEAGUES[number];

type FavoriteRule = { name: string; league?: string };
const FAVORITES: FavoriteRule[] = [
  { name: 'Mets' },
  { name: 'Giants', league: 'NFL' },
  { name: 'Knicks' },
];

function isFavorite(team: Team, league: string) {
  return FAVORITES.some(f =>
    (team.name.includes(f.name) || team.abbr.includes(f.name.toUpperCase())) &&
    (!f.league || f.league === league)
  );
}

const LEAGUE_COLORS: Record<string, string> = {
  NFL: 'text-red-400',
  NBA: 'text-orange-400',
  MLB: 'text-blue-400',
};

const LEAGUE_BG: Record<string, string> = {
  NFL: 'bg-red-500/10 border-red-500/20',
  NBA: 'bg-orange-500/10 border-orange-500/20',
  MLB: 'bg-blue-500/10 border-blue-500/20',
};

function scoreColor(score: string): string {
  if (!score || score === '-' || score === 'E') return 'text-gray-300';
  if (score.startsWith('-')) return 'text-green-400';
  if (score.startsWith('+')) return 'text-red-400';
  return 'text-gray-300';
}

function GameCard({ game }: { game: Game }) {
  const { homeTeam: home, awayTeam: away } = game;
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const homeWins = isFinal && parseInt(home.score) > parseInt(away.score);
  const awayWins = isFinal && parseInt(away.score) > parseInt(home.score);
  const favoriteInGame = isFavorite(home, game.league) || isFavorite(away, game.league);

  return (
    <div className={`rounded-xl border p-4 transition hover:border-gray-600 ${
      favoriteInGame
        ? 'bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
        : isLive ? 'bg-gray-900 border-green-500/40'
        : 'bg-gray-900 border-gray-800'
    }`}>
      {/* League + status */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold ${LEAGUE_COLORS[game.league]}`}>{game.league}</span>
          {favoriteInGame && <span className="text-yellow-400 text-xs">★</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          <span className={`text-xs font-medium ${
            isLive ? 'text-green-400' : isFinal ? 'text-gray-400' : 'text-gray-500'
          }`}>{game.statusDetail}</span>
        </div>
      </div>

      {/* Away team */}
      <div className={`flex items-center justify-between py-1.5 ${awayWins ? 'opacity-100' : isFinal ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2.5">
          {away.logo && (
            <div className="w-7 h-7 relative shrink-0">
              <Image src={away.logo} alt={away.abbr} fill className="object-contain" unoptimized />
            </div>
          )}
          <span className={`text-sm ${isFavorite(away, game.league) ? 'font-bold text-indigo-300' : awayWins ? 'font-bold text-white' : 'text-gray-300'}`}>{away.abbr}</span>
        </div>
        <span className={`text-lg tabular-nums ${awayWins ? 'font-bold text-white' : 'font-semibold text-gray-300'}`}>
          {game.status !== 'scheduled' ? away.score : '–'}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800 my-1" />

      {/* Home team */}
      <div className={`flex items-center justify-between py-1.5 ${homeWins ? 'opacity-100' : isFinal ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2.5">
          {home.logo && (
            <div className="w-7 h-7 relative shrink-0">
              <Image src={home.logo} alt={home.abbr} fill className="object-contain" unoptimized />
            </div>
          )}
          <span className={`text-sm ${isFavorite(home, game.league) ? 'font-bold text-indigo-300' : homeWins ? 'font-bold text-white' : 'text-gray-300'}`}>{home.abbr}</span>
        </div>
        <span className={`text-lg tabular-nums ${homeWins ? 'font-bold text-white' : 'font-semibold text-gray-300'}`}>
          {game.status !== 'scheduled' ? home.score : '–'}
        </span>
      </div>
    </div>
  );
}

function GolfLeaderboard() {
  const [golf, setGolf] = useState<GolfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/golf')
      .then(r => r.json())
      .then(d => { if (!d.error) setGolf(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 animate-pulse h-48 mb-6" />
    );
  }

  if (!golf) return null;

  const isLive = golf.status === 'live';
  const isFinal = golf.status === 'final';

  // Show rounds as column headers (R1, R2, R3, R4) based on currentRound
  const roundCols = Array.from({ length: golf.currentRound }, (_, i) => `R${i + 1}`);

  return (
    <div className={`bg-gray-900 rounded-xl border mb-6 overflow-hidden ${
      isLive ? 'border-green-500/30' : 'border-gray-800'
    }`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none hover:bg-gray-800/40 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-bold text-yellow-400 font-mono tracking-widest shrink-0">PGA</span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white truncate">{golf.tournament}</span>
            {golf.shortName && golf.shortName !== golf.tournament && (
              <span className="text-xs text-gray-500 hidden sm:inline">·</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 ml-3">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          <span className={`text-xs font-medium font-mono ${
            isLive ? 'text-green-400' : isFinal ? 'text-gray-400' : 'text-gray-500'
          }`}>{golf.statusDetail}</span>
          <span className="text-gray-600 text-xs ml-1">{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Column headers */}
          <div className="grid gap-0 border-t border-gray-800">
            <div className="grid px-5 py-2 text-xs font-bold text-gray-600 font-mono tracking-widest uppercase"
              style={{ gridTemplateColumns: '3rem 1fr 3.5rem repeat(' + roundCols.length + ', 2.5rem)' }}>
              <span>POS</span>
              <span>PLAYER</span>
              <span className="text-right">TOTAL</span>
              {roundCols.map(r => (
                <span key={r} className="text-right">{r}</span>
              ))}
            </div>

            {/* Players */}
            <div className="divide-y divide-gray-800/60">
              {golf.players.map((player, i) => {
                const isTop3 = i < 3;
                return (
                  <div
                    key={i}
                    className={`grid items-center px-5 py-2.5 transition-colors hover:bg-gray-800/30 ${
                      isTop3 ? 'bg-gray-800/20' : ''
                    }`}
                    style={{ gridTemplateColumns: '3rem 1fr 3.5rem repeat(' + roundCols.length + ', 2.5rem)' }}
                  >
                    {/* Position */}
                    <span className={`text-xs font-bold font-mono tabular-nums ${
                      i === 0 ? 'text-yellow-400' : i < 3 ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {player.position}
                    </span>

                    {/* Player name */}
                    <span className={`text-sm truncate pr-2 ${isTop3 ? 'font-semibold text-white' : 'text-gray-300'}`}>
                      {player.name}
                    </span>

                    {/* Total score */}
                    <span className={`text-sm font-bold tabular-nums text-right ${scoreColor(player.score)}`}>
                      {player.score === 'E' || player.score === '0' ? 'E' : player.score}
                    </span>

                    {/* Round scores */}
                    {roundCols.map((_, ri) => {
                      const val = player.rounds[ri] ?? '-';
                      const isCurrent = ri === golf.currentRound - 1;
                      return (
                        <span
                          key={ri}
                          className={`text-xs tabular-nums text-right ${
                            val === '-' ? 'text-gray-700' :
                            isCurrent && isLive ? scoreColor(val) + ' font-semibold' :
                            scoreColor(val)
                          }`}
                        >
                          {val}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function SportsTab() {
  const [scores, setScores] = useState<Scores | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeagueFilter>('All');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    const res = await fetch('/api/sports');
    const data = await res.json();
    setScores(data);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const allGames: Game[] = scores ? [...scores.nfl, ...scores.nba, ...scores.mlb] : [];
  const filtered = filter === 'All' ? allGames : allGames.filter(g => g.league === filter);

  const sorted = [...filtered].sort((a, b) => {
    const favA = isFavorite(a.homeTeam, a.league) || isFavorite(a.awayTeam, a.league) ? 0 : 1;
    const favB = isFavorite(b.homeTeam, b.league) || isFavorite(b.awayTeam, b.league) ? 0 : 1;
    if (favA !== favB) return favA - favB;
    const order = { live: 0, scheduled: 1, final: 2 };
    return order[a.status] - order[b.status];
  });

  const liveCount = allGames.filter(g => g.status === 'live').length;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Scores</h2>
          {liveCount > 0 && (
            <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-medium">{liveCount} live</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-600">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={load} className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition">
            Refresh
          </button>
        </div>
      </div>

      {/* PGA Leaderboard */}
      <GolfLeaderboard />

      {/* League filter */}
      <div className="flex gap-2 mb-6">
        {LEAGUES.map(l => (
          <button key={l} onClick={() => setFilter(l)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === l
                ? l === 'All' ? 'bg-gray-700 text-white'
                  : `${LEAGUE_BG[l]} border ${LEAGUE_COLORS[l]}`
                : 'bg-gray-900 text-gray-500 border border-gray-800 hover:text-white hover:border-gray-600'
            }`}>
            {l}
            {l !== 'All' && scores && (
              <span className="ml-1.5 text-xs opacity-60">
                {scores[l.toLowerCase() as keyof Scores]?.length ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Games grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-4 animate-pulse h-36" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center text-gray-500">
          No games found for {filter === 'All' ? 'any league' : filter} right now.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map(game => <GameCard key={game.id} game={game} />)}
        </div>
      )}
    </div>
  );
}
