'use client';
import { useState, useEffect } from 'react';

type Game = {
  id: string;
  league: string;
  homeTeam: { name: string; abbr: string; score: string };
  awayTeam: { name: string; abbr: string; score: string };
  status: 'live' | 'final' | 'scheduled';
  statusDetail: string;
};
type WeatherCurrent = { temp: number; feelsLike: number; condition: string; code: number; windSpeed: number; windDir: string; humidity: number };
type Task = { id: string; title: string; priority: string; due_date: string | null; category: string; completed: boolean };
type NewsItem = { title: string; link: string; source: string; pubDate: string; category: string };

const TOP_COMPANIES = [
  { name: 'Publix Super Markets',   city: 'Lakeland',        industry: 'Retail',             revenue: '$58.5B' },
  { name: 'TD SYNNEX',              city: 'Clearwater',      industry: 'Technology',         revenue: '$57.6B' },
  { name: 'Jabil',                  city: 'St. Petersburg',  industry: 'Manufacturing',      revenue: '$34.7B' },
  { name: 'Lennar Corporation',     city: 'Miami',           industry: 'Real Estate',        revenue: '$34.2B' },
  { name: 'AutoNation',             city: 'Fort Lauderdale', industry: 'Retail',             revenue: '$26.1B' },
];

const FAVORITES = [
  { name: 'Mets' },
  { name: 'Giants', league: 'NFL' },
  { name: 'Knicks' },
];

function isFavorite(team: { name: string; abbr: string }, league: string) {
  return FAVORITES.some(f =>
    (team.name.includes(f.name) || team.abbr.includes(f.name.toUpperCase())) &&
    (!('league' in f) || (f as { name: string; league: string }).league === league)
  );
}

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

export default function BriefingTab() {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [scores, setScores] = useState<{ nfl: Game[]; nba: Game[]; mlb: Game[] } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [now, setNow] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    fetch('/api/weather').then(r => r.json()).then(d => setWeather(d.current)).catch(() => {});
    fetch('/api/sports').then(r => r.json()).then(d => setScores(d)).catch(() => {});
    fetch('/api/tasks').then(r => r.json()).then(d => setTasks(d.tasks ?? [])).catch(() => {});
    fetch('/api/news').then(r => r.json()).then(d => setNews(d.articles ?? [])).catch(() => {});
  }, []);

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const allGames = scores ? [...scores.nfl, ...scores.nba, ...scores.mlb] : [];
  const liveGames = allGames.filter(g => g.status === 'live');
  const favGames = allGames.filter(g =>
    (isFavorite(g.homeTeam, g.league) || isFavorite(g.awayTeam, g.league)) &&
    g.status !== 'scheduled'
  );
  const displayGames = favGames.length > 0 ? favGames : allGames.filter(g => g.status === 'final').slice(0, 3);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(today.getTime() + 7 * 86400000);
  const openTasks = tasks.filter(t => !t.completed);
  const upcomingTasks = openTasks
    .filter(t => t.due_date && new Date(t.due_date + 'T00:00:00') <= weekFromNow)
    .sort((a, b) => new Date(a.due_date! + 'T00:00:00').getTime() - new Date(b.due_date! + 'T00:00:00').getTime());

  function taskDueLabel(due: string): { text: string; color: string } {
    const d = new Date(due + 'T00:00:00');
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { text: 'Overdue', color: 'text-red-400' };
    if (diff === 0) return { text: 'Today', color: 'text-yellow-400' };
    if (diff === 1) return { text: 'Tomorrow', color: 'text-amber-400' };
    return { text: `In ${diff}d`, color: 'text-zinc-500' };
  }

  const topNews = news.slice(0, 4);

  if (!mounted) return null;

  return (
    <div className="space-y-4">

      {/* ── Hero: Date + Weather ── */}
      <div className="rounded-2xl border border-amber-600/20 overflow-hidden bg-gradient-to-br from-amber-950/30 via-zinc-950 to-zinc-950">
        <div className="p-6 md:p-8">
          <p className="text-xs text-amber-400/70 uppercase tracking-[0.3em] font-mono mb-4">Home Base · Daily Briefing</p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            {/* Date + greeting */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">{dateStr}</h2>
              <p className="text-zinc-400 mt-1">{greeting}, David.</p>
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
          {liveGames.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-mono">{liveGames.length} game{liveGames.length > 1 ? 's' : ''} live</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Row: Tasks + Sports ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Tasks */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Due This Week</p>
            <span className="text-xs text-zinc-600 font-mono">{openTasks.length} open total</span>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <p className="text-2xl">✓</p>
              <p className="text-sm text-zinc-500">Nothing due this week.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map(task => {
                const label = taskDueLabel(task.due_date!);
                const isOverdue = label.text === 'Overdue';
                const isToday = label.text === 'Today';
                return (
                  <div key={task.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                    isOverdue ? 'bg-red-500/5 border-red-500/20' :
                    isToday ? 'bg-yellow-500/5 border-yellow-500/20' :
                    'bg-zinc-900/50 border-zinc-800'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-zinc-500'}`} />
                    <p className="text-sm text-zinc-200 flex-1 truncate">{task.title}</p>
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
            {favGames.length > 0 && <span className="text-xs text-amber-400 font-mono">★ results</span>}
          </div>

          {!scores ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-zinc-900 rounded-lg animate-pulse" />)}
            </div>
          ) : displayGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <p className="text-2xl">🏟️</p>
              <p className="text-sm text-zinc-500">No recent results.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayGames.map(game => {
                const homeWins = parseInt(game.homeTeam.score) > parseInt(game.awayTeam.score);
                const isLive = game.status === 'live';
                return (
                  <div key={game.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                    isLive ? 'bg-green-500/5 border-green-500/20' : 'bg-zinc-900/50 border-zinc-800'
                  }`}>
                    <span className={`text-xs font-bold font-mono w-8 shrink-0 ${
                      game.league === 'NFL' ? 'text-red-400' : game.league === 'NBA' ? 'text-orange-400' : 'text-blue-400'
                    }`}>{game.league}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs">
                        <span className={!homeWins ? 'text-zinc-400' : 'font-bold text-white'}>{game.awayTeam.abbr}</span>
                        <span className={`tabular-nums ${!homeWins ? 'text-zinc-400' : 'font-bold text-white'}`}>{game.awayTeam.score}</span>
                      </div>
                      <div className="flex justify-between text-xs mt-0.5">
                        <span className={homeWins ? 'font-bold text-white' : 'text-zinc-400'}>{game.homeTeam.abbr}</span>
                        <span className={`tabular-nums ${homeWins ? 'font-bold text-white' : 'text-zinc-400'}`}>{game.homeTeam.score}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {isLive
                        ? <span className="flex items-center gap-1 text-xs text-green-400"><span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />LIVE</span>
                        : <span className="text-xs text-zinc-600 font-mono">{game.statusDetail}</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

      {/* ── FL Companies ── */}
      <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-4">Top FL Companies · Revenue</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {TOP_COMPANIES.map((c, i) => (
            <div key={c.name} className={`rounded-lg border p-3 ${i === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/30'}`}>
              <p className={`text-xs font-bold font-mono mb-1 ${i === 0 ? 'text-amber-400' : 'text-zinc-600'}`}>#{i + 1}</p>
              <p className="text-sm font-semibold text-white leading-tight truncate">{c.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{c.city}</p>
              <p className={`text-sm font-bold tabular-nums mt-2 ${i === 0 ? 'text-amber-400' : 'text-zinc-300'}`}>{c.revenue}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
