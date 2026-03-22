'use client';
import { useState, useEffect } from 'react';

type BillItem = { name: string; amount: number; nextDate: string; daysUntil: number; frequency: string };
type Game = {
  id: string;
  league: string;
  homeTeam: { name: string; abbr: string; score: string };
  awayTeam: { name: string; abbr: string; score: string };
  status: 'live' | 'final' | 'scheduled';
  statusDetail: string;
};
type WeatherCurrent = { temp: number; feelsLike: number; condition: string; code: number; windSpeed: number; windDir: string; humidity: number };

type Props = {
  bills: BillItem[];
  cashFlow: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  netWorth: number;
  hasAccounts: boolean;
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
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

export default function BriefingTab({ bills, cashFlow, monthlyIncome, monthlyExpenses, netWorth, hasAccounts }: Props) {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [scores, setScores] = useState<{ nfl: Game[]; nba: Game[]; mlb: Game[] } | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    fetch('/api/weather').then(r => r.json()).then(d => setWeather(d.current)).catch(() => {});
    fetch('/api/sports').then(r => r.json()).then(d => setScores(d)).catch(() => {});
  }, []);

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const billsDueThisWeek = bills.filter(b => b.daysUntil >= 0 && b.daysUntil <= 7);

  const allGames = scores ? [...scores.nfl, ...scores.nba, ...scores.mlb] : [];
  const finalGames = allGames.filter(g => g.status === 'final');
  const liveGames = allGames.filter(g => g.status === 'live');
  const favGames = finalGames.filter(g =>
    isFavorite(g.homeTeam, g.league) || isFavorite(g.awayTeam, g.league)
  );
  const notableGames = favGames.length > 0 ? favGames : finalGames.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Date/time header */}
      <div className="bg-zinc-950 rounded-xl border border-amber-600/25 p-6 bg-gradient-to-br from-amber-950/20 to-zinc-950">
        <p className="text-xs text-amber-400 uppercase tracking-[0.3em] font-mono mb-1">Daily Briefing</p>
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-white">{dateStr}</h2>
            <p className="text-zinc-400 mt-0.5 text-sm">
              Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}, David
            </p>
          </div>
          <p className="text-3xl font-mono font-bold text-amber-400 tabular-nums">{timeStr}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Weather snapshot */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">Weather · Parkland, FL</p>
          {weather ? (
            <div className="flex items-center gap-4">
              <span className="text-4xl">{weatherIcon(weather.code)}</span>
              <div>
                <p className="text-3xl font-bold text-white tabular-nums">{weather.temp}°F</p>
                <p className="text-sm text-zinc-400">{weather.condition}</p>
                <p className="text-xs text-zinc-600 mt-0.5">Feels like {weather.feelsLike}° · {weather.windSpeed}mph {weather.windDir}</p>
              </div>
            </div>
          ) : (
            <div className="h-16 bg-zinc-900 rounded-lg animate-pulse" />
          )}
        </div>

        {/* Cash flow status */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">Cash Flow</p>
          {hasAccounts ? (
            <div>
              <p className={`text-3xl font-bold tabular-nums ${cashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {cashFlow >= 0 ? '+' : ''}{fmt(cashFlow)}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {fmt(monthlyIncome)} in · {fmt(monthlyExpenses)} out
              </p>
              <p className={`text-xs mt-2 font-medium ${cashFlow >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {cashFlow >= 0 ? '▲ Positive this month' : '▼ Running a deficit'}
              </p>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">No accounts connected</p>
          )}
        </div>

        {/* Net worth */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">Net Worth</p>
          {hasAccounts ? (
            <div>
              <p className="text-3xl font-bold text-amber-400 tabular-nums">{fmt(netWorth)}</p>
              <p className="text-xs text-zinc-600 mt-1">All accounts + SEI</p>
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">No accounts connected</p>
          )}
        </div>
      </div>

      {/* Bills due this week */}
      <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-3">
          Bills This Week
          {billsDueThisWeek.length > 0 && (
            <span className="ml-2 bg-yellow-500/15 text-yellow-400 text-xs px-2 py-0.5 rounded-full border border-yellow-500/25">
              {billsDueThisWeek.length} due
            </span>
          )}
        </p>
        {billsDueThisWeek.length === 0 ? (
          <p className="text-zinc-600 text-sm">No bills due in the next 7 days.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {billsDueThisWeek.map((bill, i) => (
              <div key={i} className={`flex justify-between items-center px-3 py-2 rounded-lg border ${
                bill.daysUntil === 0
                  ? 'bg-red-500/10 border-red-500/30'
                  : bill.daysUntil <= 3
                  ? 'bg-yellow-500/10 border-yellow-500/20'
                  : 'bg-zinc-900/60 border-zinc-700'
              }`}>
                <div>
                  <p className="text-sm font-medium text-white">{bill.name}</p>
                  <p className="text-xs text-zinc-500">
                    {bill.daysUntil === 0 ? 'DUE TODAY' : `in ${bill.daysUntil}d`} · {bill.nextDate}
                  </p>
                </div>
                <p className="text-sm font-bold text-red-400 tabular-nums">{fmt(bill.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sports snapshot */}
      <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5">
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">
            Sports
            {liveGames.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 bg-green-500/10 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                {liveGames.length} live
              </span>
            )}
          </p>
          {favGames.length > 0 && (
            <span className="text-xs text-amber-400">★ Your teams</span>
          )}
        </div>
        {!scores ? (
          <div className="h-16 bg-zinc-900 rounded-lg animate-pulse" />
        ) : notableGames.length === 0 ? (
          <p className="text-zinc-600 text-sm">No recent results available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {notableGames.map(game => {
              const homeWins = parseInt(game.homeTeam.score) > parseInt(game.awayTeam.score);
              const awayWins = !homeWins;
              return (
                <div key={game.id} className="bg-zinc-900/60 rounded-lg border border-zinc-800 px-3 py-2.5">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-bold text-zinc-500">{game.league}</span>
                    <span className="text-xs text-zinc-600">{game.statusDetail}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className={awayWins ? 'font-bold text-white' : 'text-zinc-500'}>{game.awayTeam.abbr}</span>
                    <span className={`tabular-nums font-bold ${awayWins ? 'text-white' : 'text-zinc-500'}`}>{game.awayTeam.score}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-0.5">
                    <span className={homeWins ? 'font-bold text-white' : 'text-zinc-500'}>{game.homeTeam.abbr}</span>
                    <span className={`tabular-nums font-bold ${homeWins ? 'text-white' : 'text-zinc-500'}`}>{game.homeTeam.score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
