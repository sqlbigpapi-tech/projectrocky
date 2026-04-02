'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';

type FollowedTeam = { sport: string; league: string; teamId: string };

type GameInfo = {
  date: string;
  opponent: string;
  opponentAbbr: string;
  opponentLogo: string;
  homeAway: string;
  teamScore: string;
  opponentScore: string;
  result: 'W' | 'L' | null;
  statusDetail: string;
  venue: string;
  probablePitchers: { ours: string | null; theirs: string | null } | null;
};

type NewsItem = { id: string; type: string; headline: string; image: string; link: string; published: string };

type TeamFeed = {
  team: { id: string; name: string; abbr: string; logo: string; league: string };
  lastGame: GameInfo | null;
  nextGame: GameInfo | null;
  news: NewsItem[];
};

const LEAGUE_OPTIONS = [
  { sport: 'football', league: 'nfl', label: 'NFL' },
  { sport: 'basketball', league: 'nba', label: 'NBA' },
  { sport: 'baseball', league: 'mlb', label: 'MLB' },
  { sport: 'football', league: 'college-football', label: 'NCAAF' },
];

const LEAGUE_COLORS: Record<string, string> = {
  NFL:   'text-red-400 bg-red-500/10 border-red-500/25',
  NBA:   'text-orange-400 bg-orange-500/10 border-orange-500/25',
  MLB:   'text-blue-400 bg-blue-500/10 border-blue-500/25',
  NCAAF: 'text-green-400 bg-green-500/10 border-green-500/25',
};

const DEFAULT_TEAMS: FollowedTeam[] = [
  { sport: 'baseball',    league: 'mlb',              teamId: '21'   },
  { sport: 'basketball',  league: 'nba',               teamId: '18'   },
  { sport: 'football',    league: 'nfl',               teamId: '19'   },
  { sport: 'football',    league: 'college-football',  teamId: '2390' },
];

const STORAGE_KEY = 'followed_teams_v1';

function timeAgo(published: string) {
  const diff = Date.now() - new Date(published).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatGameDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatGameTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function TeamCard({ followed, onRemove }: { followed: FollowedTeam; onRemove: () => void }) {
  const [feed, setFeed] = useState<TeamFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [newsExpanded, setNewsExpanded] = useState(false);

  useEffect(() => {
    const { sport, league, teamId } = followed;
    fetch(`/api/team-feed?sport=${sport}&league=${league}&teamId=${teamId}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setFeed(d); })
      .finally(() => setLoading(false));
  }, [followed.teamId]);

  if (loading) {
    return <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 animate-pulse h-64" />;
  }

  if (!feed) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-zinc-600 text-sm">
        Failed to load team data.
      </div>
    );
  }

  const { team, lastGame, nextGame, news } = feed;
  const leagueColor = LEAGUE_COLORS[team.league] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700';

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Team header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {team.logo && (
            <div className="w-9 h-9 relative shrink-0">
              <Image src={team.logo} alt={team.abbr} fill className="object-contain" unoptimized />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-white">{team.name}</p>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded border font-mono ${leagueColor}`}>
              {team.league}
            </span>
          </div>
        </div>
        <button onClick={onRemove} className="text-zinc-700 hover:text-red-400 text-xs transition">✕</button>
      </div>

      <div className="divide-y divide-zinc-800/60">
        {/* Last game */}
        {lastGame && (
          <div className="px-5 py-3">
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-mono mb-2">Last Game</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lastGame.opponentLogo && (
                  <div className="w-6 h-6 relative shrink-0">
                    <Image src={lastGame.opponentLogo} alt={lastGame.opponentAbbr} fill className="object-contain" unoptimized />
                  </div>
                )}
                <div>
                  <p className="text-sm text-zinc-300">
                    {lastGame.homeAway === 'home' ? 'vs' : '@'} {lastGame.opponentAbbr}
                  </p>
                  <p className="text-xs text-zinc-600">{formatGameDate(lastGame.date)} · {lastGame.statusDetail}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-white">
                  {lastGame.teamScore}–{lastGame.opponentScore}
                </p>
                {lastGame.result && (
                  <span className={`text-xs font-bold ${lastGame.result === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {lastGame.result}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Next game */}
        {nextGame && (
          <div className="px-5 py-3">
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-mono mb-2">Next Game</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {nextGame.opponentLogo && (
                  <div className="w-6 h-6 relative shrink-0">
                    <Image src={nextGame.opponentLogo} alt={nextGame.opponentAbbr} fill className="object-contain" unoptimized />
                  </div>
                )}
                <div>
                  <p className="text-sm text-zinc-300">
                    {nextGame.homeAway === 'home' ? 'vs' : '@'} {nextGame.opponentAbbr}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {formatGameDate(nextGame.date)} · {formatGameTime(nextGame.date)}
                    {nextGame.venue ? ` · ${nextGame.venue}` : ''}
                  </p>
                  {nextGame.probablePitchers && (nextGame.probablePitchers.ours || nextGame.probablePitchers.theirs) && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {nextGame.probablePitchers.ours && `⚾ ${nextGame.probablePitchers.ours}`}
                      {nextGame.probablePitchers.ours && nextGame.probablePitchers.theirs && ' vs '}
                      {nextGame.probablePitchers.theirs && nextGame.probablePitchers.theirs}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* News */}
        {news.length > 0 && (
          <div className="px-5 py-3">
            <button
              onClick={() => setNewsExpanded(e => !e)}
              className="flex items-center justify-between w-full mb-2"
            >
              <p className="text-xs text-zinc-600 uppercase tracking-widest font-mono">News & Highlights</p>
              <span className="text-zinc-600 text-xs">{newsExpanded ? '▴' : '▾'}</span>
            </button>
            {newsExpanded ? (
              <div className="space-y-2">
                {news.map(item => (
                  <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer"
                    className="flex gap-3 group hover:bg-zinc-900/40 rounded-lg p-1.5 transition -mx-1.5">
                    {item.image && (
                      <div className="w-16 h-10 relative rounded overflow-hidden shrink-0 bg-zinc-900">
                        <Image src={item.image} alt="" fill className="object-cover" unoptimized />
                        {item.type === 'Media' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <span className="text-white text-xs">▶</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-300 group-hover:text-white line-clamp-2 leading-snug transition">{item.headline}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{timeAgo(item.published)}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 line-clamp-1">{news[0]?.headline}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AddTeamPanel({ followed, onAdd, onClose }: {
  followed: FollowedTeam[];
  onAdd: (team: FollowedTeam) => void;
  onClose: () => void;
}) {
  const [selectedLeague, setSelectedLeague] = useState(LEAGUE_OPTIONS[0]);
  const [teams, setTeams] = useState<{ id: string; name: string; abbr: string; logo: string }[]>([]);
  const [search, setSearch] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(false);

  useEffect(() => {
    setLoadingTeams(true);
    setTeams([]);
    fetch(`/api/teams-list?sport=${selectedLeague.sport}&league=${selectedLeague.league}`)
      .then(r => r.json())
      .then(d => setTeams(d.teams ?? []))
      .finally(() => setLoadingTeams(false));
  }, [selectedLeague]);

  const isFollowed = (teamId: string) =>
    followed.some(f => f.teamId === teamId && f.league === selectedLeague.league);

  const filtered = teams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.abbr.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <p className="text-sm font-bold text-white">Follow a Team</p>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition">✕</button>
        </div>

        {/* League selector */}
        <div className="flex gap-1.5 p-4 border-b border-zinc-800">
          {LEAGUE_OPTIONS.map(l => (
            <button key={l.league} onClick={() => { setSelectedLeague(l); setSearch(''); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-mono border transition ${
                selectedLeague.league === l.league
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'
              }`}>{l.label}</button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search teams…"
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
          />
        </div>

        {/* Team list */}
        <div className="overflow-y-auto flex-1">
          {loadingTeams ? (
            <div className="p-6 text-center text-zinc-600 text-sm">Loading teams…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-zinc-600 text-sm">No teams found.</div>
          ) : (
            <div className="divide-y divide-zinc-800/40">
              {filtered.map(team => {
                const already = isFollowed(team.id);
                return (
                  <button
                    key={team.id}
                    disabled={already}
                    onClick={() => {
                      onAdd({ sport: selectedLeague.sport, league: selectedLeague.league, teamId: team.id });
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                      already ? 'opacity-40 cursor-default' : 'hover:bg-zinc-900/50'
                    }`}
                  >
                    {team.logo && (
                      <div className="w-7 h-7 relative shrink-0">
                        <Image src={team.logo} alt={team.abbr} fill className="object-contain" unoptimized />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{team.name}</p>
                      <p className="text-xs text-zinc-600 font-mono">{team.abbr}</p>
                    </div>
                    {already && <span className="text-xs text-zinc-600 font-mono">Following</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SportsTab() {
  const [followed, setFollowed] = useState<FollowedTeam[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setFollowed(stored ? JSON.parse(stored) : DEFAULT_TEAMS);
    setMounted(true);
  }, []);

  function save(teams: FollowedTeam[]) {
    setFollowed(teams);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  }

  function addTeam(team: FollowedTeam) {
    if (followed.some(f => f.teamId === team.teamId && f.league === team.league)) return;
    save([...followed, team]);
  }

  function removeTeam(teamId: string, league: string) {
    save(followed.filter(f => !(f.teamId === teamId && f.league === league)));
  }

  if (!mounted) return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 animate-pulse h-64" />
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">My Teams</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2 rounded-lg transition"
        >
          + Follow Team
        </button>
      </div>

      {followed.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500 text-sm">
          No teams followed yet. Hit "+ Follow Team" to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {followed.map(f => (
            <TeamCard
              key={`${f.league}-${f.teamId}`}
              followed={f}
              onRemove={() => removeTeam(f.teamId, f.league)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddTeamPanel
          followed={followed}
          onAdd={addTeam}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
