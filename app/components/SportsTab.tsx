'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { StandingsData, Standing } from '../api/standings/route';
import type { Highlight } from '../api/highlights/route';

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

function GameCard({ game }: { game: Game }) {
  const { homeTeam: home, awayTeam: away } = game;
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const homeWins = isFinal && parseInt(home.score) > parseInt(away.score);
  const awayWins = isFinal && parseInt(away.score) > parseInt(home.score);
  const favoriteInGame = isFavorite(home, game.league) || isFavorite(away, game.league);

  return (
    <div className={`rounded-xl border p-4 transition hover:border-zinc-600 ${
      favoriteInGame
        ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/10'
        : isLive ? 'bg-zinc-950 border-green-500/40'
        : 'bg-zinc-950 border-zinc-800'
    }`}>
      {/* League + status */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold ${LEAGUE_COLORS[game.league]}`}>{game.league}</span>
          {favoriteInGame && <span className="text-amber-400 text-xs">★</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          <span className={`text-xs font-medium ${
            isLive ? 'text-green-400' : isFinal ? 'text-zinc-400' : 'text-zinc-500'
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
          <span className={`text-sm ${isFavorite(away, game.league) ? 'font-bold text-amber-300' : awayWins ? 'font-bold text-white' : 'text-zinc-300'}`}>{away.abbr}</span>
        </div>
        <span className={`text-lg tabular-nums ${awayWins ? 'font-bold text-white' : 'font-semibold text-zinc-300'}`}>
          {game.status !== 'scheduled' ? away.score : '–'}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800 my-1" />

      {/* Home team */}
      <div className={`flex items-center justify-between py-1.5 ${homeWins ? 'opacity-100' : isFinal ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2.5">
          {home.logo && (
            <div className="w-7 h-7 relative shrink-0">
              <Image src={home.logo} alt={home.abbr} fill className="object-contain" unoptimized />
            </div>
          )}
          <span className={`text-sm ${isFavorite(home, game.league) ? 'font-bold text-amber-300' : homeWins ? 'font-bold text-white' : 'text-zinc-300'}`}>{home.abbr}</span>
        </div>
        <span className={`text-lg tabular-nums ${homeWins ? 'font-bold text-white' : 'font-semibold text-zinc-300'}`}>
          {game.status !== 'scheduled' ? home.score : '–'}
        </span>
      </div>
    </div>
  );
}

const STANDINGS_LEAGUES = ['NFL', 'NBA', 'MLB'] as const;
type StandingsLeague = typeof STANDINGS_LEAGUES[number];

function StandingsSection() {
  const [data, setData] = useState<StandingsData | null>(null);
  const [league, setLeague] = useState<StandingsLeague>('NBA');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/standings').then(r => r.json()).then(d => {
      if (!d.error) setData(d);
    }).catch(() => {});
  }, []);

  const rows: Standing[] = data ? data[league.toLowerCase() as keyof StandingsData] : [];
  const conferences = [...new Set(rows.map(r => r.conference))];

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 mb-6 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-zinc-900/40 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="text-xs font-bold text-amber-400 font-mono tracking-widest">STANDINGS</span>
        <div className="flex items-center gap-3">
          {!collapsed && STANDINGS_LEAGUES.map(l => (
            <button
              key={l}
              onClick={e => { e.stopPropagation(); setLeague(l); }}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                league === l ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
          <span className="text-zinc-600 text-xs">{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-zinc-800">
          {!data ? (
            <div className="p-4 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 bg-zinc-900 rounded mb-1" />
              ))}
            </div>
          ) : (
            conferences.map(conf => (
              <div key={conf}>
                <div className="px-5 py-2 bg-zinc-900/40 border-b border-zinc-800">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-mono">{conf}</span>
                </div>
                {/* Column headers */}
                <div className="grid px-5 py-1.5 text-xs font-bold text-zinc-600 font-mono tracking-widest border-b border-zinc-800/50"
                  style={{ gridTemplateColumns: '2rem 1.5rem 1fr 3rem 3rem 3.5rem 3rem 4rem' }}>
                  <span>#</span><span /><span>TEAM</span>
                  <span className="text-right">W</span>
                  <span className="text-right">L</span>
                  <span className="text-right">PCT</span>
                  <span className="text-right">GB</span>
                  <span className="text-right">STRK</span>
                </div>
                <div className="divide-y divide-zinc-800/40">
                  {rows.filter(r => r.conference === conf).map((row, i) => (
                    <div key={row.abbr}
                      className="grid items-center px-5 py-2 hover:bg-zinc-900/20 transition-colors"
                      style={{ gridTemplateColumns: '2rem 1.5rem 1fr 3rem 3rem 3.5rem 3rem 4rem' }}>
                      <span className={`text-xs font-bold font-mono ${i === 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{row.rank}</span>
                      {row.logo ? (
                        <div className="w-5 h-5 relative">
                          <Image src={row.logo} alt={row.abbr} fill className="object-contain" unoptimized />
                        </div>
                      ) : <span />}
                      <span className={`text-sm truncate pr-2 ${i < 3 ? 'font-semibold text-white' : 'text-zinc-400'}`}>{row.team}</span>
                      <span className="text-sm tabular-nums text-right text-zinc-300">{row.wins}</span>
                      <span className="text-sm tabular-nums text-right text-zinc-500">{row.losses}</span>
                      <span className="text-sm tabular-nums text-right text-zinc-300 font-mono">{row.pct}</span>
                      <span className="text-xs tabular-nums text-right text-zinc-500 font-mono">{row.gb === '0' ? '—' : row.gb}</span>
                      <span className={`text-xs tabular-nums text-right font-mono ${
                        row.streak?.startsWith('W') ? 'text-emerald-400' : row.streak?.startsWith('L') ? 'text-red-400' : 'text-zinc-500'
                      }`}>{row.streak || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const HIGHLIGHT_LEAGUES = ['NFL', 'NBA', 'MLB'] as const;
type HighlightLeague = typeof HIGHLIGHT_LEAGUES[number];

function timeAgo(published: string) {
  const diff = Date.now() - new Date(published).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function HighlightsSection() {
  const [data, setData] = useState<Record<HighlightLeague, Highlight[]> | null>(null);
  const [league, setLeague] = useState<HighlightLeague>('NBA');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch('/api/highlights').then(r => r.json()).then(d => {
      if (!d.error) setData(d);
    }).catch(() => {});
  }, []);

  const items: Highlight[] = data ? data[league.toLowerCase() as HighlightLeague] ?? [] : [];

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 mb-6 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-zinc-900/40 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="text-xs font-bold text-amber-400 font-mono tracking-widest">HIGHLIGHTS & NEWS</span>
        <div className="flex items-center gap-3">
          {!collapsed && HIGHLIGHT_LEAGUES.map(l => (
            <button
              key={l}
              onClick={e => { e.stopPropagation(); setLeague(l); }}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                league === l ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
          <span className="text-zinc-600 text-xs">{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-zinc-800 divide-y divide-zinc-800/60">
          {!data ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 animate-pulse">
                <div className="w-24 h-16 bg-zinc-900 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-900 rounded w-3/4" />
                  <div className="h-3 bg-zinc-900 rounded w-1/2" />
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <p className="text-zinc-600 text-sm p-5">No highlights available.</p>
          ) : (
            items.map(item => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-4 p-4 hover:bg-zinc-900/40 transition-colors group"
              >
                {item.image && (
                  <div className="w-24 h-16 relative rounded-lg overflow-hidden shrink-0 bg-zinc-900">
                    <Image src={item.image} alt="" fill className="object-cover" unoptimized />
                    {item.type === 'Media' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-white text-lg">▶</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 group-hover:text-amber-400 transition-colors leading-snug line-clamp-2">
                    {item.headline}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded font-mono ${
                      item.type === 'Media' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      item.type === 'Recap' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      'bg-zinc-800 text-zinc-500 border border-zinc-700'
                    }`}>
                      {item.type === 'Media' ? '▶ VIDEO' : item.type === 'Recap' ? 'RECAP' : 'NEWS'}
                    </span>
                    <span className="text-xs text-zinc-600">{timeAgo(item.published)}</span>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
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
            <span className="text-xs text-zinc-600">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={load} className="text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition">
            Refresh
          </button>
        </div>
      </div>

      {/* Standings */}
      <StandingsSection />

      {/* Highlights & News */}
      <HighlightsSection />

      {/* League filter */}
      <div className="flex gap-2 mb-6">
        {LEAGUES.map(l => (
          <button key={l} onClick={() => setFilter(l)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === l
                ? l === 'All' ? 'bg-zinc-700 text-white border border-zinc-600'
                  : `${LEAGUE_BG[l]} border ${LEAGUE_COLORS[l]}`
                : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:text-white hover:border-zinc-600'
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
            <div key={i} className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 animate-pulse h-36" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-12 text-center text-zinc-500">
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
