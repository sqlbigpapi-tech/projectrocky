'use client';
import { useState, useEffect } from 'react';

type FollowedTeam = { sport: string; league: string; teamId: string };
type GameInfo = { id: string; date: string; opponent: string; opponentAbbr: string; homeAway: string; teamScore: string; opponentScore: string; result: 'W' | 'L' | null; statusDetail: string };
type TeamFeed = { team: { id: string; name: string; abbr: string; league: string; record: string | null }; liveGame: GameInfo | null; lastGame: GameInfo | null; nextGame: GameInfo | null };

const DEFAULT_TEAMS: FollowedTeam[] = [
  { sport: 'baseball',   league: 'mlb', teamId: '21' },
  { sport: 'basketball', league: 'nba', teamId: '18' },
  { sport: 'football',   league: 'nfl', teamId: '19' },
];

const LEAGUE_COLORS: Record<string, string> = {
  NFL: 'text-red-400', NBA: 'text-orange-400', MLB: 'text-blue-400', NCAAF: 'text-green-400',
};

function BriefingTeamRow({ followed, onFeed }: { followed: FollowedTeam; onFeed?: (feed: TeamFeed) => void }) {
  const [feed, setFeed] = useState<TeamFeed | null>(null);

  useEffect(() => {
    const load = () => {
      fetch(`/api/team-feed?sport=${followed.sport}&league=${followed.league}&teamId=${followed.teamId}`)
        .then(r => r.json())
        .then(d => { if (!d.error) { setFeed(d); onFeed?.(d); } })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [followed.teamId]);

  if (!feed) return <div className="h-10 bg-zinc-900 rounded-lg animate-pulse" />;

  const { team, liveGame, lastGame, nextGame } = feed;
  const game = liveGame ?? lastGame ?? nextGame;
  const isLive = !!liveGame;
  const isNext = !liveGame && !lastGame && !!nextGame;
  const leagueColor = LEAGUE_COLORS[team.league] ?? 'text-zinc-400';

  const espnUrl = game?.id ? `https://www.espn.com/${followed.league}/game/_/gameId/${game.id}` : null;
  const Wrapper = espnUrl ? 'a' : 'div';
  const wrapperProps = espnUrl ? { href: espnUrl, target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <Wrapper {...wrapperProps as any} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${isLive ? 'bg-green-500/5 border-green-500/20' : 'bg-zinc-900/50 border-zinc-800'} ${espnUrl ? 'hover:border-zinc-600 cursor-pointer' : ''}`}>
      <span className={`text-xs font-bold font-mono w-8 shrink-0 ${leagueColor}`}>{team.league}</span>
      <p className="text-sm font-medium text-white shrink-0">{team.abbr}</p>
      {game ? (
        <>
          <p className="text-xs text-zinc-500 font-mono flex-1 truncate">
            {isNext ? `vs ${game.opponentAbbr} · ${new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `${game.homeAway === 'home' ? 'vs' : '@'} ${game.opponentAbbr}`}
          </p>
          {!isNext && (
            <span className={`text-xs font-bold font-mono tabular-nums ${isLive ? 'text-green-400' : game.result === 'W' ? 'text-emerald-400' : game.result === 'L' ? 'text-red-400' : 'text-zinc-400'}`}>
              {game.result ? `${game.result} ` : ''}{game.teamScore || '0'}–{game.opponentScore || '0'}
            </span>
          )}
          {isNext && <span className="text-xs text-zinc-600 font-mono">{new Date(game.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
          {isLive && <span className="flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />LIVE</span>}
        </>
      ) : (
        <p className="text-xs text-zinc-600 font-mono flex-1">No games scheduled</p>
      )}
    </Wrapper>
  );
}
type WeatherCurrent = { temp: number; feelsLike: number; condition: string; code: number; windSpeed: number; windDir: string; humidity: number };
type Task = { id: string; title: string; priority: string; due_date: string | null; category: string; completed: boolean; recurrence: string | null };
type NewsItem = { title: string; link: string; source: string; pubDate: string; category: string };
type IncomeMonth = { month: number; plan: number; actual: number | null; is_forecast: boolean };
type HealthRow = { date: string; metric: string; qty: number | null; unit: string };

const FL_COMPANIES = [
  { name: 'Publix Super Markets',   city: 'Lakeland',        revenue: '$58.5B', linkedin: 'https://www.linkedin.com/company/publix-super-markets' },
  { name: 'TD SYNNEX',              city: 'Clearwater',      revenue: '$57.6B', linkedin: 'https://www.linkedin.com/company/td-synnex' },
  { name: 'Jabil',                  city: 'St. Petersburg',  revenue: '$34.7B', linkedin: 'https://www.linkedin.com/company/jabil' },
  { name: 'Lennar Corporation',     city: 'Miami',           revenue: '$34.2B', linkedin: 'https://www.linkedin.com/company/lennar' },
  { name: 'AutoNation',             city: 'Fort Lauderdale', revenue: '$26.1B', linkedin: 'https://www.linkedin.com/company/autonation' },
];

function weatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const PRIORITY_DOT: Record<string, string> = {
  High: 'bg-red-400',
  Medium: 'bg-amber-400',
  Low: 'bg-zinc-500',
};

const CATEGORY_COLORS: Record<string, string> = {
  Mets:            'text-blue-400',
  Giants:          'text-red-400',
  Knicks:          'text-orange-400',
  Business:        'text-amber-400',
  'Tech & AI':     'text-cyan-400',
  'South Florida': 'text-teal-400',
};

export default function BriefingTab({ onNavigate }: { onNavigate?: (tab: 'briefing' | 'sports' | 'bd' | 'tasks' | 'income' | 'health' | 'networth') => void }) {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [followedTeams, setFollowedTeams] = useState<FollowedTeam[]>(DEFAULT_TEAMS);
  const [teamFeeds, setTeamFeeds] = useState<TeamFeed[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [incomeMonths, setIncomeMonths] = useState<IncomeMonth[]>([]);
  const [bigIncomeGoal, setBigIncomeGoal] = useState(1700000);
  const [healthRows, setHealthRows] = useState<HealthRow[]>([]);
  const [netWorthSnaps, setNetWorthSnaps] = useState<{ id: string; date: string; accounts: { category: string; balance: number }[] }[]>([]);
  const [now, setNow] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  async function completeTask(task: Task) {
    if (task.recurrence === 'daily') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const due_date = tomorrow.toISOString().split('T')[0];
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, due_date } : t));
      await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, completed: false, due_date }) });
    } else {
      setTasks(prev => prev.filter(t => t.id !== task.id));
      await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, completed: true }) });
    }
  }

  useEffect(() => {
    setMounted(true);
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    fetch('/api/weather').then(r => r.json()).then(d => setWeather(d.current)).catch(() => {});
    fetch('/api/tasks').then(r => r.json()).then(d => setTasks(d.tasks ?? [])).catch(() => {});
    try {
      const stored = localStorage.getItem('followed_teams_v1');
      if (stored) setFollowedTeams(JSON.parse(stored));
    } catch {}

    fetch('/api/news').then(r => r.json()).then(d => setNews(d.articles ?? [])).catch(() => {});
    fetch('/api/health').then(r => r.json()).then(d => setHealthRows(d.metrics ?? [])).catch(() => {});
    fetch('/api/net-worth').then(r => r.json()).then(d => setNetWorthSnaps(d.snapshots ?? [])).catch(() => {});
    fetch('/api/income').then(r => r.json()).then(d => setIncomeMonths(d.months ?? [])).catch(() => {});
    fetch('/api/settings?key=big_uip_goal').then(r => r.json()).then(d => { if (d.value) setBigIncomeGoal(Number(d.value)); }).catch(() => {});
  }, []);

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  function handleTeamFeed(feed: TeamFeed) {
    setTeamFeeds(prev => [...prev.filter(f => f.team.id !== feed.team.id), feed]);
  }


  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(today.getTime() + 7 * 86400000);
  const openTasks = tasks.filter(t => !t.completed);
  const upcomingTasks = openTasks
    .filter(t => t.recurrence === 'daily' || (t.due_date && new Date(t.due_date + 'T00:00:00') <= weekFromNow))
    .sort((a, b) => {
      const aDate = a.due_date ? new Date(a.due_date + 'T00:00:00').getTime() : today.getTime();
      const bDate = b.due_date ? new Date(b.due_date + 'T00:00:00').getTime() : today.getTime();
      return aDate - bDate;
    });

  function taskDueLabel(due: string): { text: string; color: string } {
    const d = new Date(due + 'T00:00:00');
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { text: 'Overdue', color: 'text-red-400' };
    if (diff === 0) return { text: 'Today', color: 'text-yellow-400' };
    if (diff === 1) return { text: 'Tomorrow', color: 'text-amber-400' };
    return { text: `In ${diff}d`, color: 'text-zinc-500' };
  }

  const topNews = news.slice(0, 4);

  const INCOME_GOAL = 1001000;
  const lockedMonths = incomeMonths.filter(m => m.actual !== null && !m.is_forecast);
  const ytd = lockedMonths.reduce((s, m) => s + (m.actual ?? 0), 0);
  const pct = Math.min((ytd / INCOME_GOAL) * 100, 100);
  const bigPct = Math.min((ytd / bigIncomeGoal) * 100, 100);
  const runRate = lockedMonths.length > 0 ? ytd / lockedMonths.length : 0;
  const currentMonth = new Date().getMonth() + 1;
  const monthsLeft = 12 - currentMonth;
  const projectedTotal = ytd + runRate * monthsLeft;

  const nwCurrent = netWorthSnaps.length > 0 ? netWorthSnaps[netWorthSnaps.length - 1] : null;
  const nwPrev    = netWorthSnaps.length > 1 ? netWorthSnaps[netWorthSnaps.length - 2] : null;
  function nwTotal(snap: typeof nwCurrent) {
    if (!snap) return 0;
    const assets = snap.accounts.filter(a => a.category !== 'liability').reduce((s, a) => s + a.balance, 0);
    const liabs  = snap.accounts.filter(a => a.category === 'liability').reduce((s, a) => s + a.balance, 0);
    return assets - liabs;
  }
  const nwValue  = nwTotal(nwCurrent);
  const nwChange = nwPrev != null ? nwValue - nwTotal(nwPrev) : null;

  // Smart greeting context — priority: overdue > live game > tonight > last result > pace
  const overdueTasks = upcomingTasks.filter(t => t.due_date && new Date(t.due_date + 'T00:00:00') < today);
  let smartContext: string | null = null;
  if (overdueTasks.length > 0) {
    smartContext = `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}.`;
  } else {
    const liveF = teamFeeds.find(f => f.liveGame);
    if (liveF) {
      const g = liveF.liveGame!;
      smartContext = `${liveF.team.abbr} are live ${g.homeAway === 'home' ? 'vs' : '@'} ${g.opponentAbbr} — ${g.teamScore || '0'}–${g.opponentScore || '0'}.`;
    } else {
      const todayISO = now.toISOString().split('T')[0];
      const tonightF = teamFeeds.find(f => f.nextGame && f.nextGame.date.startsWith(todayISO));
      if (tonightF) {
        const g = tonightF.nextGame!;
        const t = new Date(g.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        smartContext = `${tonightF.team.abbr} play ${g.homeAway === 'home' ? 'vs' : '@'} ${g.opponentAbbr} tonight at ${t}.`;
      } else {
        const yesterdayISO = new Date(today.getTime() - 86400000).toISOString().split('T')[0];
        const lastF = teamFeeds.find(f => f.lastGame && f.lastGame.date.startsWith(yesterdayISO));
        if (lastF) {
          const g = lastF.lastGame!;
          const verb = g.result === 'W' ? 'won' : g.result === 'L' ? 'lost' : 'played';
          smartContext = `${lastF.team.abbr} ${verb} ${g.homeAway === 'home' ? 'vs' : '@'} ${g.opponentAbbr} ${g.teamScore}–${g.opponentScore} last night.`;
        } else if (projectedTotal > 0) {
          const fmt = projectedTotal >= 1000000 ? `$${(projectedTotal / 1000000).toFixed(1)}M` : `$${Math.round(projectedTotal / 1000).toLocaleString()}K`;
          smartContext = `You're on pace for ${fmt} this year.`;
        }
      }
    }
  }

  function latestHealth(metric: string) {
    return [...healthRows].filter(r => r.metric === metric && r.qty != null).sort((a, b) => b.date.localeCompare(a.date))[0]?.qty ?? null;
  }
  const todaySteps    = latestHealth('step_count');
  const todayHRV      = latestHealth('heart_rate_variability');
  const todayCalories = latestHealth('active_energy');
  const todayExercise = latestHealth('apple_exercise_time');

  if (!mounted) return null;

  return (
    <div className="space-y-4">

      {/* ── Hero: Date + Weather ── */}
      <div className="rounded-2xl border border-amber-600/20 overflow-hidden bg-gradient-to-br from-amber-950/30 via-zinc-950 to-zinc-950">
        <div className="p-6 md:p-8">
          <p className="text-xs text-amber-400/70 uppercase tracking-[0.3em] font-mono mb-4">Project Rocky · Daily Briefing</p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            {/* Date + greeting */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">{dateStr}</h2>
              <p className="text-zinc-400 mt-1">
                {greeting}, David.{smartContext ? <span className="text-zinc-300"> {smartContext}</span> : null}
              </p>
            </div>
            {/* Time + weather inline */}
            <div className="flex items-center gap-6 shrink-0">
              {weather && (
                <div className="flex items-center gap-3 border-r border-zinc-800 pr-6">
                  <span className="text-3xl">{weatherIcon(weather.code)}</span>
                  <div>
                    <p className="text-2xl font-bold text-white tabular-nums">{weather.temp}°F</p>
                    <p className="text-xs text-zinc-500">Feels {weather.feelsLike}° · {weather.windSpeed}mph</p>
                  </div>
                </div>
              )}
              <p className="text-5xl font-mono font-bold text-amber-400 tabular-nums tracking-tight">{timeStr}</p>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="border-t border-zinc-800/60 px-6 md:px-8 py-3 flex items-center gap-6 bg-zinc-900/30">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-xs text-zinc-500 font-mono">Parkland, FL</span>
          </div>
          {weather && (
            <span className="text-xs text-zinc-600 font-mono">{weather.condition} · {weather.humidity}% humidity</span>
          )}
        </div>
      </div>

      {/* ── Income Summary ── */}
      {incomeMonths.length > 0 && (
        <div className="rounded-2xl border border-emerald-600/20 overflow-hidden bg-gradient-to-br from-emerald-950/20 via-zinc-950 to-zinc-950">
          <div className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs text-emerald-400/70 uppercase tracking-[0.3em] font-mono">SEI Miami · 2026 Net Income</p>
              <div className="flex items-center gap-3">
                <button onClick={() => onNavigate?.('income')} className="text-xs text-zinc-600 font-mono hover:text-emerald-400 transition-colors">income →</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">YTD Locked</p>
                <p className="text-2xl font-bold text-emerald-400 tabular-nums">${ytd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">{lockedMonths.length} months actual</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Run Rate</p>
                <p className="text-2xl font-bold text-white tabular-nums">${Math.round(runRate).toLocaleString()}<span className="text-sm text-zinc-500">/mo</span></p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">on current pace</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">vs $1M Goal</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: pct >= 100 ? '#34d399' : '#f59e0b' }}>{pct.toFixed(1)}%</p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">${Math.round(projectedTotal).toLocaleString()} projected</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">vs ${(bigIncomeGoal / 1000000).toFixed(1)}M UIP</p>
                <p className="text-2xl font-bold text-violet-400 tabular-nums">{bigPct.toFixed(1)}%</p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">${Math.round(bigIncomeGoal - ytd).toLocaleString()} remaining</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs text-zinc-600 font-mono w-10">$1M</span>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-emerald-400 font-mono w-10 text-right">{pct.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-600 font-mono w-10">${(bigIncomeGoal / 1000000).toFixed(1)}M</span>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${bigPct}%`, background: 'linear-gradient(90deg,#7c3aed,#a78bfa)' }} />
              </div>
              <span className="text-xs text-violet-400 font-mono w-10 text-right">{bigPct.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Net Worth Snapshot ── */}
      {nwCurrent && (
        <div className="rounded-2xl border border-violet-600/20 bg-gradient-to-br from-violet-950/20 via-zinc-950 to-zinc-950 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-violet-400/70 uppercase tracking-[0.3em] font-mono">Net Worth · Latest Snapshot</p>
            <button onClick={() => onNavigate?.('networth')} className="text-xs text-zinc-600 font-mono hover:text-violet-400 transition-colors">net worth →</button>
          </div>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Net Worth</p>
              <p className="text-2xl font-bold text-violet-400 tabular-nums">${nwValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            {nwChange !== null && (
              <div>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">WoW Change</p>
                <p className={`text-2xl font-bold tabular-nums ${nwChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {nwChange >= 0 ? '+' : ''}${Math.abs(nwChange).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Last Updated</p>
              <p className="text-sm text-zinc-300 font-mono">{new Date(nwCurrent.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Health Snapshot ── */}
      {healthRows.length > 0 && (
        <div className="rounded-2xl border border-rose-600/20 bg-gradient-to-br from-rose-950/20 via-zinc-950 to-zinc-950 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-rose-400/70 uppercase tracking-[0.3em] font-mono">Apple Health · Today</p>
            <button onClick={() => onNavigate?.('health')} className="text-xs text-zinc-600 font-mono hover:text-rose-400 transition-colors">health →</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Steps', value: todaySteps != null ? Math.round(todaySteps).toLocaleString() : '—', icon: '👟', color: 'text-emerald-400' },
              { label: 'HRV', value: todayHRV != null ? `${Math.round(todayHRV)}ms` : '—', icon: '🫀', color: 'text-violet-400' },
              { label: 'Active Cal', value: todayCalories != null ? `${Math.round(todayCalories)}` : '—', icon: '🔥', color: 'text-amber-400' },
              { label: 'Exercise', value: todayExercise != null ? `${Math.round(todayExercise)}min` : '—', icon: '🏃', color: 'text-green-400' },
            ].map(m => (
              <div key={m.label} className="bg-zinc-950/60 rounded-xl border border-zinc-800 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{m.icon}</span>
                  <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest">{m.label}</p>
                </div>
                <p className={`text-lg font-bold tabular-nums ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row: Tasks + Sports ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Tasks */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Due This Week</p>
            <button onClick={() => onNavigate?.('tasks')} className="text-xs text-zinc-600 font-mono hover:text-amber-400 transition-colors">{openTasks.length} open total →</button>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <p className="text-2xl">✓</p>
              <p className="text-sm text-zinc-500">Nothing due this week.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map(task => {
                const label = task.due_date ? taskDueLabel(task.due_date) : { text: 'Today', color: 'text-cyan-400' };
                const isOverdue = label.text === 'Overdue';
                const isToday = label.text === 'Today';
                return (
                  <div key={task.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    isOverdue ? 'bg-red-500/5 border-red-500/20' :
                    isToday ? 'bg-yellow-500/5 border-yellow-500/20' :
                    'bg-zinc-900/50 border-zinc-800'
                  }`}>
                    <button onClick={() => completeTask(task)} className="w-4 h-4 rounded border border-zinc-600 hover:border-emerald-400 hover:bg-emerald-500/10 shrink-0 flex items-center justify-center transition-colors" title="Complete task" />
                    <p onClick={() => onNavigate?.('tasks')} className="text-sm text-zinc-200 flex-1 truncate cursor-pointer hover:text-white transition-colors">{task.title}</p>
                    <span className={`text-xs font-mono shrink-0 ${label.color}`}>{label.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sports */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Your Teams</p>
            <button onClick={() => onNavigate?.('sports')} className="text-xs text-zinc-600 font-mono hover:text-white transition-colors">manage →</button>
          </div>
          <div className="space-y-2">
            {followedTeams.map(t => (
              <BriefingTeamRow key={`${t.league}-${t.teamId}`} followed={t} onFeed={handleTeamFeed} />
            ))}
          </div>
        </div>
      </div>

      {/* ── BD Snapshot ── */}
      <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Top FL Companies · BD Targets</p>
          <button onClick={() => onNavigate?.('bd')} className="text-xs text-zinc-600 font-mono hover:text-amber-400 transition-colors">pipeline →</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {FL_COMPANIES.map((c, i) => (
            <a key={c.name} href={c.linkedin} target="_blank" rel="noopener noreferrer"
              className={`rounded-lg border p-3 hover:brightness-110 transition-all ${i === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/30'}`}>
              <p className={`text-xs font-bold font-mono mb-1 ${i === 0 ? 'text-amber-400' : 'text-zinc-600'}`}>#{i + 1}</p>
              <p className="text-sm font-semibold text-white leading-tight truncate">{c.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{c.city}</p>
              <p className={`text-sm font-bold tabular-nums mt-2 ${i === 0 ? 'text-amber-400' : 'text-zinc-300'}`}>{c.revenue}</p>
            </a>
          ))}
        </div>
      </div>

      {/* ── News headlines ── */}
      {topNews.length > 0 && (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-4">Top Stories</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topNews.map((item, i) => {
              const color = CATEGORY_COLORS[item.category] ?? 'text-zinc-400';
              return (
                <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                  className="group flex flex-col gap-1.5 p-3 rounded-lg border border-zinc-800 hover:border-zinc-600 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors">
                  <p className="text-sm font-medium text-zinc-200 group-hover:text-white leading-snug line-clamp-2 transition-colors">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-auto">
                    <span className={`text-xs font-bold font-mono ${color}`}>{item.category}</span>
                    <span className="text-xs text-zinc-700">·</span>
                    <span className="text-xs text-zinc-600">{timeAgo(item.pubDate)}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}


    </div>
  );
}
