import { NextResponse } from 'next/server';

type Competitor = {
  team: { displayName: string; abbreviation: string; logo?: string };
  score: string;
  homeAway: string;
};

type ESPNEvent = {
  id: string;
  date: string;
  competitions: {
    competitors: Competitor[];
    status: { type: { name: string; shortDetail: string; state: string } };
  }[];
};

async function fetchLeague(sport: string, league: string) {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.events ?? []).map((e: ESPNEvent) => {
    const comp = e.competitions[0];
    const home = comp.competitors.find((c: Competitor) => c.homeAway === 'home')!;
    const away = comp.competitors.find((c: Competitor) => c.homeAway === 'away')!;
    const statusType = comp.status.type;
    const state = statusType.state; // 'pre' | 'in' | 'post'
    return {
      id: e.id,
      league: league.toUpperCase(),
      date: e.date,
      homeTeam: { name: home.team.displayName, abbr: home.team.abbreviation, score: home.score, logo: home.team.logo ?? '' },
      awayTeam: { name: away.team.displayName, abbr: away.team.abbreviation, score: away.score, logo: away.team.logo ?? '' },
      status: state === 'in' ? 'live' : state === 'post' ? 'final' : 'scheduled',
      statusDetail: statusType.shortDetail,
    };
  });
}

export async function GET() {
  const [nfl, nba, mlb] = await Promise.all([
    fetchLeague('football', 'nfl'),
    fetchLeague('basketball', 'nba'),
    fetchLeague('baseball', 'mlb'),
  ]);
  return NextResponse.json({ nfl, nba, mlb });
}
