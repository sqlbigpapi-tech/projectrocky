import { NextResponse } from 'next/server';

export type Standing = {
  rank: number;
  team: string;
  abbr: string;
  logo: string;
  wins: number;
  losses: number;
  pct: string;
  gb: string;
  streak: string;
  conference: string;
};

export type StandingsData = {
  nfl: Standing[];
  nba: Standing[];
  mlb: Standing[];
};

type ESPNEntry = {
  team: {
    displayName: string;
    abbreviation: string;
    logos?: { href: string }[];
  };
  stats: { name: string; value: number; displayValue: string }[];
};

type ESPNChild = {
  name: string;
  standings: { entries: ESPNEntry[] };
};

function stat(entry: ESPNEntry, name: string) {
  return entry.stats.find(s => s.name === name);
}

function parseEntries(entries: ESPNEntry[], conference: string): Standing[] {
  return entries.map((e, i) => ({
    rank: i + 1,
    team: e.team.displayName,
    abbr: e.team.abbreviation,
    logo: e.team.logos?.[0]?.href ?? '',
    wins: stat(e, 'wins')?.value ?? 0,
    losses: stat(e, 'losses')?.value ?? 0,
    pct: stat(e, 'winPercent')?.displayValue ?? '.000',
    gb: stat(e, 'gamesBehind')?.displayValue ?? '-',
    streak: stat(e, 'streak')?.displayValue ?? '',
    conference,
  }));
}

async function fetchStandings(sport: string, league: string): Promise<Standing[]> {
  const res = await fetch(
    `https://site.api.espn.com/apis/v2/sports/${sport}/${league}/standings`,
    { next: { revalidate: 3600 } }
  );
  const data = await res.json() as { children: ESPNChild[] };
  return (data.children ?? []).flatMap(conf =>
    parseEntries(conf.standings?.entries ?? [], conf.name)
  );
}

export async function GET() {
  try {
    const [nfl, nba, mlb] = await Promise.all([
      fetchStandings('football', 'nfl'),
      fetchStandings('basketball', 'nba'),
      fetchStandings('baseball', 'mlb'),
    ]);
    return NextResponse.json({ nfl, nba, mlb });
  } catch {
    return NextResponse.json({ error: 'Standings unavailable' }, { status: 500 });
  }
}
