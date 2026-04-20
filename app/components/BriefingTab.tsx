'use client';
import { useState, useEffect } from 'react';
import { BriefingSkeleton } from './Skeletons';

type FollowedTeam = { sport: string; league: string; teamId: string };
type GameInfo = { id: string; date: string; opponent: string; opponentAbbr: string; homeAway: string; teamScore: string; opponentScore: string; result: 'W' | 'L' | null; statusDetail: string };
type Standings = { record: string; streak: string; divisionGB: string; playoffSeed: number } | null;
type TeamFeed = { team: { id: string; name: string; abbr: string; league: string; record: string | null }; liveGame: GameInfo | null; lastGame: GameInfo | null; nextGame: GameInfo | null; standings: Standings };

const DEFAULT_TEAMS: FollowedTeam[] = [
  { sport: 'baseball',   league: 'mlb', teamId: '21' },
  { sport: 'basketball', league: 'nba', teamId: '18' },
  { sport: 'football',   league: 'nfl', teamId: '19' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LEAGUE_COLORS: Record<string, string> = {
  NFL: 'text-red-400', NBA: 'text-orange-400', MLB: 'text-blue-400', NCAAF: 'text-green-400',
};

type WeatherCurrent = { temp: number; feelsLike: number; condition: string; code: number; windSpeed: number; windDir: string; humidity: number };
type Task = { id: string; title: string; priority: string; due_date: string | null; category: string; completed: boolean; recurrence: string | null; is_bill?: boolean; bill_amount?: number | null };
type NewsItem = { title: string; link: string; source: string; pubDate: string; category: string };
type IncomeMonth = { month: number; plan: number; actual: number | null; is_forecast: boolean };


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

type NavTab = 'briefing' | 'sports' | 'bd' | 'tasks' | 'income' | 'health' | 'networth' | 'finmodel' | 'headcount' | 'equity';
type EquitySummary = { sharePrice: number; valuation: number; trailing12: number; month: number; isForecast: boolean };
type EndingSoonItem = { consultantName: string; client: string; sowEnd: string; annualTotal: number };
type CalEvent = { summary: string; start: string; end: string; location: string; isAllDay: boolean };
type TimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening' | 'late';

export default function BriefingTab({ onNavigate }: { onNavigate?: (tab: NavTab) => void }) {
  const [briefing, setBriefing] = useState<{ summary: string; timeOfDay: TimeOfDay } | null>(null);
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [followedTeams, setFollowedTeams] = useState<FollowedTeam[]>(DEFAULT_TEAMS);
  const [teamFeeds, setTeamFeeds] = useState<TeamFeed[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [incomeMonths, setIncomeMonths] = useState<IncomeMonth[]>([]);
  const [netWorthSnaps, setNetWorthSnaps] = useState<{ id: string; date: string; accounts: { category: string; balance: number }[] }[]>([]);
  const [equitySummary, setEquitySummary] = useState<EquitySummary | null>(null);
  const [endingSoon, setEndingSoon] = useState<EndingSoonItem[]>([]);
  const [forecastRevenue, setForecastRevenue] = useState<{ month: number; revenue: number }[]>([]);
  const [now, setNow] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  async function completeTask(task: Task) {
    if (task.recurrence === 'daily') {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      const due_date = next.toISOString().split('T')[0];
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, due_date } : t));
      await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, completed: false, due_date }) });
    } else if (task.recurrence === 'monthly') {
      const base = task.due_date ? new Date(task.due_date + 'T00:00:00') : new Date();
      base.setMonth(base.getMonth() + 1);
      const due_date = base.toISOString().split('T')[0];
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, due_date } : t));
      await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, completed: false, due_date }) });
    } else if (task.recurrence === 'yearly') {
      const base = task.due_date ? new Date(task.due_date + 'T00:00:00') : new Date();
      base.setFullYear(base.getFullYear() + 1);
      const due_date = base.toISOString().split('T')[0];
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
    try {
      const stored = localStorage.getItem('followed_teams_v1');
      if (stored) setFollowedTeams(JSON.parse(stored));
    } catch {}

    // Fire all API calls independently — each updates state as it resolves
    const safe = (p: Promise<Response>) => p.then(r => r.json()).catch(() => null);

    // These three feed the Rocky greeting — collect their results
    const weatherP = safe(fetch('/api/weather')).then(d => { if (d?.current) setWeather(d.current); return d; });
    const tasksP = safe(fetch('/api/tasks')).then(d => { if (d?.tasks) setTasks(d.tasks); return d; });
    const calP = safe(fetch('/api/calendar')).then(d => { if (d?.events) setCalEvents(d.events); return d; });

    safe(fetch('/api/news')).then(d => { if (d?.articles) setNews(d.articles); });
    safe(fetch('/api/net-worth')).then(d => { if (d?.snapshots) setNetWorthSnaps(d.snapshots); });
    safe(fetch('/api/briefing')).then(d => { if (d?.summary && d?.timeOfDay) setBriefing({ summary: d.summary, timeOfDay: d.timeOfDay }); });

    // Fetch team feeds for smart greeting context
    for (const t of followedTeams) {
      safe(fetch(`/api/team-feed?sport=${t.sport}&league=${t.league}&teamId=${t.teamId}`))
        .then(d => { if (d && !d.error) setTeamFeeds(prev => [...prev.filter(f => f.team.id !== d.team.id), d]); });
    }
    safe(fetch('/api/income')).then(d => { if (d?.months) setIncomeMonths(d.months); });
    safe(fetch('/api/equity?year=2026')).then(d => { if (d?.latest) setEquitySummary(d.latest); });
    safe(fetch('/api/billing?year=2026')).then(d => {
      if (d?.forecast) {
        const today = new Date();
        const sixtyOut = new Date(today); sixtyOut.setDate(sixtyOut.getDate() + 60);
        setEndingSoon(d.forecast.filter((f: any) => {
          const end = new Date(f.sowEnd);
          return end >= today && end <= sixtyOut;
        }).map((f: any) => ({ consultantName: f.consultantName, client: f.client, sowEnd: f.sowEnd, annualTotal: f.annualTotal })));
      }
    });
    safe(fetch('/api/pl?year=2026')).then(d => {
      if (d?.months) {
        const currentMonth = new Date().getMonth() + 1;
        const upcoming = d.months.filter((m: any) => m.month >= currentMonth && m.month <= currentMonth + 2);
        setForecastRevenue(upcoming.map((m: any) => ({ month: m.month, revenue: m.revenue })));
      }
    });
    // Rocky greeting removed — no data sent to AI on page load
  }, []);

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';



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
  const runRate = lockedMonths.length > 0 ? ytd / lockedMonths.length : 0;
  const currentMonth = new Date().getMonth() + 1;
  const monthsLeft = 12 - currentMonth;
  const projectedTotal = ytd + runRate * monthsLeft;

  const nwCurrent = netWorthSnaps.length > 0 ? netWorthSnaps[netWorthSnaps.length - 1] : null;
  const nwPrev    = netWorthSnaps.length > 1 ? netWorthSnaps[netWorthSnaps.length - 2] : null;
  const LIABILITY_CATS = ['liability', 'credit_card', 'auto_loan', 'personal_loan'];
  function nwTotal(snap: typeof nwCurrent) {
    if (!snap) return 0;
    const assets = snap.accounts.filter(a => !LIABILITY_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
    const liabs  = snap.accounts.filter(a =>  LIABILITY_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
    return assets - liabs;
  }
  const nwValue  = nwTotal(nwCurrent);
  const nwChange = nwPrev != null ? nwValue - nwTotal(nwPrev) : null;

  // Smart greeting context — priority: overdue > calendar > live game > tonight > last result > pace
  const overdueTasks = upcomingTasks.filter(t => t.due_date && new Date(t.due_date + 'T00:00:00') < today);
  const nonAllDayEvents = calEvents.filter(e => !e.isAllDay);
  const nextMeeting = nonAllDayEvents.find(e => new Date(e.start) > now);

  let smartContext: string | null = null;
  if (overdueTasks.length > 0) {
    smartContext = `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}.`;
  } else if (nonAllDayEvents.length > 0 && nextMeeting) {
    const t = new Date(nextMeeting.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    smartContext = `${nonAllDayEvents.length} meeting${nonAllDayEvents.length > 1 ? 's' : ''} today. Next: ${nextMeeting.summary} at ${t}.`;
  } else if (nonAllDayEvents.length > 0) {
    smartContext = `${nonAllDayEvents.length} meeting${nonAllDayEvents.length > 1 ? 's' : ''} today.`;
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


  // Oura today

  if (!mounted) return <BriefingSkeleton />;

  // Helpers for compact KPI formatting
  function kpiFmt(n: number) {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
    if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000).toLocaleString()}K`;
    return `$${Math.round(n).toLocaleString()}`;
  }

  function ouraScoreColor(s: number) {
    if (s >= 85) return 'text-emerald-400';
    if (s >= 70) return 'text-amber-400';
    return 'text-red-400';
  }

  return (
    <div className="space-y-3">

      {/* ── Tier 1: Compact Hero ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]/60">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            {greeting}, {typeof document !== 'undefined' ? (document.cookie.match(/(?:^|; )user_name=([^;]*)/)?.[1] ?? 'David') : 'David'}.
          </h2>
          {briefing ? (
            <p className="text-sm text-zinc-300 mt-1 leading-relaxed">{briefing.summary}</p>
          ) : (
            smartContext && <p className="text-sm text-zinc-400 mt-0.5">{smartContext}</p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {weather && (
            <div className="flex items-center gap-2">
              <span className="text-lg">{weatherIcon(weather.code)}</span>
              <span className="text-sm font-bold text-white tabular-nums">{weather.temp}°F</span>
              <span className="text-xs text-zinc-600 font-mono">{weather.condition}</span>
            </div>
          )}
          <span className="text-xs text-zinc-700 font-mono hidden md:block">{dateStr}</span>
        </div>
      </div>

      {/* ── News Ticker ── */}
      {news.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]/40 bg-[var(--card)]/30">
          <div className="flex items-center">
            <span className="text-[9px] font-bold font-mono text-amber-400 bg-zinc-900 px-2.5 py-1.5 shrink-0 border-r border-[var(--border)]/40">NEWS</span>
            <div className="overflow-hidden flex-1">
              <div className="ticker-track flex items-center gap-6 px-4 py-1.5 whitespace-nowrap" style={{ width: 'max-content' }}>
                {[...news.slice(0, 12), ...news.slice(0, 12)].map((item, i) => {
                  const color = CATEGORY_COLORS[item.category] ?? 'text-zinc-500';
                  return (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 hover:text-white transition-colors">
                      <span className={`text-[9px] font-bold font-mono ${color}`}>{item.category.slice(0, 5).toUpperCase()}</span>
                      <span className="text-[11px] text-zinc-400 hover:text-white">{item.title}</span>
                      <span className="text-[9px] text-zinc-700 font-mono">{timeAgo(item.pubDate)}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Three-Column Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Col 1: Calendar + Tasks */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">

          {/* Calendar */}
          {calEvents.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Today's Schedule</p>
                <p className="text-[10px] text-zinc-600 font-mono">{nonAllDayEvents.length} meeting{nonAllDayEvents.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="space-y-0.5 mb-4">
                {calEvents.map((e, i) => {
                  const startTime = e.isAllDay ? null : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
                  const isPast = !e.isAllDay && new Date(e.end) < now;
                  const isCurrent = !e.isAllDay && new Date(e.start) <= now && new Date(e.end) > now;
                  return (
                    <div key={i} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all ${
                      isCurrent ? 'bg-amber-500/10 border border-amber-500/20' :
                      isPast ? 'opacity-40' :
                      'hover:bg-zinc-800/50'
                    }`}>
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />}
                      {!isCurrent && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPast ? 'bg-zinc-700' : 'bg-zinc-600'}`} />}
                      <span className="text-[10px] text-zinc-500 font-mono tabular-nums w-16 shrink-0">
                        {e.isAllDay ? 'All day' : startTime}
                      </span>
                      <p className={`text-[11px] flex-1 truncate ${isCurrent ? 'text-amber-400 font-medium' : 'text-zinc-300'}`}>{e.summary}</p>
                      {e.location && !e.isAllDay && (
                        <span className="text-[9px] text-zinc-700 font-mono shrink-0 truncate max-w-[60px]">{e.location.includes('Teams') ? 'Teams' : e.location.slice(0, 10)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-[var(--border)]/60 pt-3 mb-1" />
            </>
          )}

          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
              {briefing?.timeOfDay === 'evening' || briefing?.timeOfDay === 'late' ? 'Next Up' : 'Tasks'}
            </p>
            <button onClick={() => onNavigate?.('tasks')} className="text-[10px] text-zinc-600 font-mono hover:text-amber-400 transition-colors">{openTasks.length} open →</button>
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5">
              <span className="text-lg text-zinc-700">✓</span>
              <p className="text-[10px] text-zinc-600 font-mono">All clear</p>
            </div>
          ) : (
            <div className="space-y-1">
              {upcomingTasks.slice(0, 7).map(task => {
                const label = task.due_date ? taskDueLabel(task.due_date) : { text: 'Today', color: 'text-cyan-400' };
                const isOverdue = label.text === 'Overdue';
                const isToday = label.text === 'Today';
                return (
                  <div key={task.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                    isOverdue ? 'bg-red-500/5' : isToday ? 'bg-amber-500/5' : 'hover:bg-zinc-800/50'
                  }`}>
                    <button onClick={() => completeTask(task)} className="w-3.5 h-3.5 rounded border border-zinc-700 hover:border-emerald-400 shrink-0 transition-colors" />
                    <p onClick={() => onNavigate?.('tasks')} className="text-[11px] text-zinc-300 flex-1 truncate cursor-pointer hover:text-white transition-colors">{task.title}</p>
                    <span className={`text-[9px] font-mono shrink-0 ${label.color}`}>{label.text}</span>
                  </div>
                );
              })}
              {upcomingTasks.length > 7 && (
                <button onClick={() => onNavigate?.('tasks')} className="text-[10px] text-zinc-600 font-mono hover:text-zinc-400 transition-colors pl-2 pt-1">
                  +{upcomingTasks.length - 7} more
                </button>
              )}
            </div>
          )}
        </div>

        {/* Col 2: Business */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Business</p>
            <div className="flex gap-2">
              <button onClick={() => onNavigate?.('equity')} className="text-[10px] text-zinc-600 font-mono hover:text-amber-400 transition-colors">equity →</button>
              <button onClick={() => onNavigate?.('finmodel')} className="text-[10px] text-zinc-600 font-mono hover:text-amber-400 transition-colors">model →</button>
            </div>
          </div>

          {equitySummary && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
              <div>
                <p className="text-[10px] text-zinc-600 font-mono mb-0.5">Valuation</p>
                <p className="text-sm font-bold text-white tabular-nums">{kpiFmt(equitySummary.valuation)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 font-mono mb-0.5">T12 Net Income</p>
                <p className={`text-sm font-bold tabular-nums ${equitySummary.trailing12 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{kpiFmt(equitySummary.trailing12)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 font-mono mb-0.5">Next 3 Mo Rev</p>
                <p className="text-sm font-bold text-zinc-300 tabular-nums">
                  {forecastRevenue.length > 0 ? kpiFmt(forecastRevenue.reduce((s, m) => s + m.revenue, 0)) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 font-mono mb-0.5">Run Rate</p>
                <p className="text-sm font-bold text-zinc-300 tabular-nums">{kpiFmt(runRate)}/mo</p>
              </div>
            </div>
          )}

          {/* Engagements ending soon */}
          {endingSoon.length > 0 && (
            <div className="pt-3 border-t border-[var(--border)]/60">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-red-400/70 uppercase tracking-widest font-mono font-bold">Ending Soon</p>
                <button onClick={() => onNavigate?.('headcount')} className="text-[10px] text-zinc-600 font-mono hover:text-amber-400 transition-colors">→</button>
              </div>
              <div className="space-y-1">
                {endingSoon.map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-red-500/5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] text-white font-bold font-mono truncate">{e.consultantName}</span>
                      <span className="text-[9px] text-zinc-600 font-mono truncate">@ {e.client}</span>
                    </div>
                    <span className="text-[9px] text-red-400 font-mono shrink-0 ml-2">
                      {new Date(e.sowEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Col 3: Finance Snapshot */}
        <div className="rounded-xl border border-zinc-800 bg-[var(--card)]/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Finance</p>
            <button onClick={() => onNavigate?.('networth')} className="text-[10px] text-zinc-600 font-mono hover:text-violet-400 transition-colors">net worth →</button>
          </div>

          {/* Net Worth */}
          <div className="mb-4">
            <p className="text-[10px] text-zinc-600 font-mono mb-0.5">Net Worth</p>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xl font-bold text-violet-400 tabular-nums">{kpiFmt(nwValue)}</p>
                {nwChange !== null && (
                  <p className={`text-[10px] font-mono tabular-nums ${nwChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {nwChange >= 0 ? '+' : ''}{kpiFmt(nwChange)} since last snapshot
                  </p>
                )}
              </div>
              {(() => {
                const history = netWorthSnaps.slice(-12).map(nwTotal).filter(v => v > 0);
                if (history.length < 2) return null;
                const min = Math.min(...history);
                const max = Math.max(...history);
                const range = max - min || 1;
                const W = 80, H = 28;
                const points = history.map((v, i) => {
                  const x = (i / (history.length - 1)) * W;
                  const y = H - ((v - min) / range) * H;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' ');
                const up = history[history.length - 1] >= history[0];
                const stroke = up ? '#34d399' : '#f87171';
                const fill = up ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)';
                return (
                  <svg width={W} height={H} className="shrink-0" viewBox={`0 0 ${W} ${H}`}>
                    <polygon points={`0,${H} ${points} ${W},${H}`} fill={fill} />
                    <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                );
              })()}
            </div>
          </div>

          {/* Income YTD */}
          {incomeMonths.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] text-zinc-600 font-mono mb-0.5">YTD Income</p>
              <p className="text-sm font-bold text-emerald-400 tabular-nums">{kpiFmt(ytd)}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[9px] text-emerald-400 font-mono">{pct.toFixed(0)}%</span>
              </div>
              <p className="text-[9px] text-zinc-700 font-mono mt-0.5">of $1M goal · {kpiFmt(projectedTotal)} projected</p>
            </div>
          )}

          {/* Bills */}
          {(() => {
            const openBills = openTasks.filter(t => t.is_bill);
            if (openBills.length === 0) return null;
            const monthEndISO = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
            const thisMonthBills = openBills.filter(b => b.due_date && b.due_date <= monthEndISO);
            const thisMonthTotal = thisMonthBills.reduce((s, b) => s + (b.bill_amount ?? 0), 0);
            const nextBills = openBills
              .filter(b => b.due_date)
              .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1))
              .slice(0, 3);
            return (
              <div className="mb-4 pt-3 border-t border-[var(--border)]/60">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-zinc-600 font-mono">Bills This Month</p>
                  <p className="text-sm font-bold text-emerald-400 tabular-nums">{kpiFmt(thisMonthTotal)}</p>
                </div>
                <p className="text-[9px] text-zinc-700 font-mono mb-1.5">{thisMonthBills.length} of {openBills.length} due by month-end</p>
                <div className="space-y-0.5">
                  {nextBills.map(b => {
                    const label = b.due_date ? taskDueLabel(b.due_date) : null;
                    return (
                      <div key={b.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-zinc-800/50 transition-colors">
                        <span className="text-[10px] font-bold text-emerald-400 shrink-0">$</span>
                        <p className="text-[11px] text-zinc-300 flex-1 truncate">{b.title}</p>
                        {b.bill_amount != null && (
                          <span className="text-[10px] text-emerald-400/70 font-mono tabular-nums shrink-0">
                            ${b.bill_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                        )}
                        {label && <span className={`text-[9px] font-mono shrink-0 ${label.color}`}>{label.text}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Liabilities */}
          <div className="pt-3 border-t border-[var(--border)]/60">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-zinc-600 font-mono">Total Liabilities</p>
              <p className="text-sm font-bold text-red-400 tabular-nums">{kpiFmt(nwCurrent ? nwCurrent.accounts.filter((a: {category: string}) => LIABILITY_CATS.includes(a.category)).reduce((s: number, a: {balance: number}) => s + a.balance, 0) : 0)}</p>
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-zinc-600 font-mono">Credit Cards</p>
              <p className="text-sm font-bold text-zinc-400 tabular-nums">{kpiFmt(nwCurrent ? nwCurrent.accounts.filter((a: {category: string}) => a.category === 'credit_card').reduce((s: number, a: {balance: number}) => s + a.balance, 0) : 0)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-zinc-600 font-mono">Loans</p>
              <p className="text-sm font-bold text-zinc-400 tabular-nums">{kpiFmt(nwCurrent ? nwCurrent.accounts.filter((a: {category: string}) => ['auto_loan', 'personal_loan'].includes(a.category)).reduce((s: number, a: {balance: number}) => s + a.balance, 0) : 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sports Ticker ── */}
      {teamFeeds.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]/40 bg-[var(--card)]/30">
          <div className="flex items-center">
            <span className="text-[9px] font-bold font-mono text-emerald-400 bg-zinc-900 px-2.5 py-1.5 shrink-0 border-r border-[var(--border)]/40">SCORES</span>
            <div className="overflow-hidden flex-1">
              <div className="ticker-track flex items-center gap-8 px-4 py-1.5 whitespace-nowrap" style={{ width: 'max-content', animationDuration: '40s' }}>
                {[...teamFeeds, ...teamFeeds].map((feed, i) => {
                  const { team, liveGame, lastGame, nextGame, standings } = feed;
                  const game = liveGame ?? lastGame ?? nextGame;
                  const isLive = !!liveGame;
                  const leagueColor = LEAGUE_COLORS[team.league] ?? 'text-zinc-500';
                  const espnUrl = game?.id ? `https://www.espn.com/${feed.team.league.toLowerCase()}/game/_/gameId/${game.id}` : null;
                  const streakColor = standings?.streak?.startsWith('W') ? 'text-emerald-400' : standings?.streak?.startsWith('L') ? 'text-red-400' : 'text-zinc-500';

                  if (!game) return (
                    <span key={`${team.id}-${i}`} className="inline-flex items-center gap-2">
                      <span className={`text-[9px] font-bold font-mono ${leagueColor}`}>{team.league}</span>
                      <span className="text-[11px] text-zinc-500">{team.abbr}</span>
                      {standings && <span className="text-[10px] text-zinc-500 font-mono">{standings.record}</span>}
                      {standings?.streak && <span className={`text-[10px] font-mono font-bold ${streakColor}`}>{standings.streak}</span>}
                    </span>
                  );

                  const isNext = !liveGame && !lastGame && !!nextGame;
                  const Wrapper = espnUrl ? 'a' : 'span';
                  const wrapperProps = espnUrl ? { href: espnUrl, target: '_blank' as const, rel: 'noopener noreferrer' } : {};

                  return (
                    <Wrapper key={`${team.id}-${i}`} {...wrapperProps} className="inline-flex items-center gap-2 hover:text-white transition-colors">
                      <span className={`text-[9px] font-bold font-mono ${leagueColor}`}>{team.league}</span>
                      <span className="text-[11px] text-white font-bold">{team.abbr}</span>
                      {standings && <span className="text-[10px] text-zinc-600 font-mono">({standings.record})</span>}
                      {isLive && (
                        <>
                          <span className="text-[11px] text-zinc-500">{game.homeAway === 'home' ? 'vs' : '@'} {game.opponentAbbr}</span>
                          <span className="text-[11px] text-green-400 font-bold font-mono tabular-nums">{game.teamScore || '0'}–{game.opponentScore || '0'}</span>
                          <span className="flex items-center gap-1 text-[9px] text-green-400"><span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />LIVE</span>
                        </>
                      )}
                      {!isLive && !isNext && game.result && (
                        <>
                          <span className={`text-[10px] font-bold font-mono ${game.result === 'W' ? 'text-emerald-400' : 'text-red-400'}`}>{game.result}</span>
                          <span className="text-[11px] text-zinc-400 font-mono tabular-nums">{game.teamScore}–{game.opponentScore}</span>
                          <span className="text-[10px] text-zinc-600">{game.homeAway === 'home' ? 'vs' : '@'} {game.opponentAbbr}</span>
                        </>
                      )}
                      {isNext && (
                        <>
                          <span className="text-[10px] text-zinc-500">vs {game.opponentAbbr}</span>
                          <span className="text-[10px] text-zinc-600 font-mono">{new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </>
                      )}
                      {standings?.streak && <span className={`text-[9px] font-mono font-bold ${streakColor}`}>{standings.streak}</span>}
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
