import { NextResponse } from 'next/server';

type Competitor = {
  id: string;
  abbr: string;
  name: string;
  logo: string;
  score: string;
  homeAway: 'home' | 'away';
  color: string | null;
};

type ScoringPlay = {
  period: number;
  clock: string;
  teamAbbr: string;
  text: string;
  homeScore: string;
  awayScore: string;
};

type LeaderPlayer = {
  name: string;
  stat: string;
  teamAbbr: string;
};

type LeaderCategory = {
  category: string;
  players: LeaderPlayer[];
};

type WinProbPoint = {
  play: number;
  homePct: number;
};

function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object' && val !== null) {
    const o = val as { displayValue?: unknown; value?: unknown };
    if (o.displayValue !== undefined) return String(o.displayValue);
    if (o.value !== undefined) return String(o.value);
  }
  return '';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');
  const league = searchParams.get('league');
  const eventId = searchParams.get('eventId');

  if (!sport || !league || !eventId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      return NextResponse.json({ error: `ESPN ${res.status}` }, { status: 502 });
    }
    const data = await res.json();

    const header = data.header ?? {};
    const competition = header.competitions?.[0] ?? {};
    const status = competition.status?.type ?? {};
    const comps: any[] = competition.competitors ?? [];

    const parseCompetitor = (c: any): Competitor => ({
      id: str(c?.team?.id),
      abbr: str(c?.team?.abbreviation),
      name: str(c?.team?.displayName),
      logo: str(c?.team?.logos?.[0]?.href),
      score: str(c?.score),
      homeAway: c?.homeAway === 'home' ? 'home' : 'away',
      color: str(c?.team?.color) || null,
    });

    const home = comps.find((c: any) => c.homeAway === 'home');
    const away = comps.find((c: any) => c.homeAway === 'away');
    const homeTeam = home ? parseCompetitor(home) : null;
    const awayTeam = away ? parseCompetitor(away) : null;

    const scoringPlaysRaw: any[] = data.scoringPlays ?? [];
    const scoringPlays: ScoringPlay[] = scoringPlaysRaw.map(p => ({
      period: Number(p?.period?.number ?? 0),
      clock: str(p?.clock?.displayValue),
      teamAbbr: str(p?.team?.abbreviation),
      text: str(p?.text),
      homeScore: str(p?.homeScore),
      awayScore: str(p?.awayScore),
    }));

    // Leaders come in different shapes per sport; normalize to the team-grouped form
    const leaders: LeaderCategory[] = [];
    const leadersRaw: any[] = data.leaders ?? [];
    // shape: [ { team: {abbr}, leaders: [ { displayName: "Hits", leaders: [{ athlete:{displayName}, displayValue }] } ] } ]
    const byCategory: Record<string, LeaderPlayer[]> = {};
    for (const teamBlock of leadersRaw) {
      const abbr = str(teamBlock?.team?.abbreviation);
      for (const cat of (teamBlock?.leaders ?? [])) {
        const catName = str(cat?.displayName) || str(cat?.name);
        if (!catName) continue;
        const top = cat?.leaders?.[0];
        if (!top) continue;
        const player: LeaderPlayer = {
          name: str(top?.athlete?.displayName),
          stat: str(top?.displayValue),
          teamAbbr: abbr,
        };
        if (!byCategory[catName]) byCategory[catName] = [];
        byCategory[catName].push(player);
      }
    }
    for (const [category, players] of Object.entries(byCategory)) {
      leaders.push({ category, players });
    }

    // Win probability — available for NFL, NBA, MLB via data.winprobability
    const wpRaw: any[] = data.winprobability ?? [];
    const winProbability: WinProbPoint[] = wpRaw.map((p, i) => ({
      play: i,
      homePct: Number(p?.homeWinPercentage ?? 0),
    }));

    const venue = str(competition.venue?.fullName);
    const dateStr = str(competition.date ?? header.date);

    return NextResponse.json({
      eventId,
      state: str(status.state),          // pre | in | post
      statusDetail: str(status.shortDetail),
      statusFull: str(status.detail),
      period: Number(status.period ?? 0),
      clock: str(status.displayClock ?? competition.status?.displayClock),
      home: homeTeam,
      away: awayTeam,
      venue,
      date: dateStr,
      scoringPlays,
      leaders,
      winProbability,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch game summary' },
      { status: 500 },
    );
  }
}
