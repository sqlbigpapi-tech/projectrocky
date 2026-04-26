'use client';

const GAMES = [
  {
    href: '/driving-range',
    title: 'Driving Range',
    tagline: 'Pick a club, time the swing, hit the targets',
    accent: 'from-emerald-500/25 to-emerald-700/5',
    border: 'border-emerald-500/30',
    pill: 'text-emerald-400',
  },
  {
    href: '/connections',
    title: 'Connections',
    tagline: "Today's NYT puzzle, same as Erica's playing",
    accent: 'from-purple-500/25 via-blue-500/15 to-purple-700/5',
    border: 'border-purple-500/30',
    pill: 'text-purple-400',
  },
];

export default function GamesTab() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Games</h1>
        <p className="text-xs font-mono text-zinc-500 mt-0.5">Mindless time, on the house</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GAMES.map(g => (
          <a
            key={g.href}
            href={g.href}
            className={`group relative overflow-hidden block p-6 rounded-2xl bg-gradient-to-br ${g.accent} border ${g.border} hover:scale-[1.01] active:scale-[0.99] transition-transform duration-150`}
          >
            <div className={`text-[10px] font-mono uppercase tracking-widest ${g.pill} mb-2`}>Play</div>
            <h2 className="text-2xl font-bold text-white mb-1">{g.title}</h2>
            <p className="text-sm text-zinc-400">{g.tagline}</p>
            <div className="mt-5 flex items-center gap-1 text-[11px] font-mono tracking-widest text-zinc-500 group-hover:text-zinc-200 transition-colors">
              OPEN
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h6M7 3l3 3-3 3" />
              </svg>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
