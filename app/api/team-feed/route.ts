import { NextResponse } from 'next/server';

// MLB Stats API team IDs (keyed by ESPN abbreviation)
const MLB_TEAM_IDS: Record<string, number> = {
  NYM: 121, NYY: 147, BOS: 111, LAD: 119, SF: 137, CHC: 112, STL: 138,
  ATL: 144, HOU: 117, OAK: 133, SEA: 136, MIA: 146, PHI: 143, SD: 135,
  COL: 115, ARI: 109, MIL: 158, PIT: 134, CIN: 113, WSH: 120, BAL: 110,
  TB: 139, TOR: 141, MIN: 142, CLE: 114, DET: 116, CWS: 145, KC: 118,
  TEX: 140, LAA: 108,
};

function leagueLabel(sport: string, league: string): string {
  if (league === 'nfl') return 'NFL';
  if (league === 'nba') return 'NBA';
  if (league === 'mlb') return 'MLB';
  if (league === 'college-football') return 'NCAAF';
  return league.toUpperCase();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');
  const league = searchParams.get('league');
  const teamId = searchParams.get('teamId');

  if (!sport || !league || !teamId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    const [scheduleRes, newsRes] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`, { next: { revalidate: 300 } }),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/news?team=${teamId}&limit=6`, { next: { revalidate: 300 } }),
    ]);

    const scheduleData = await scheduleRes.json();
    const newsData = await newsRes.json();

    const team = scheduleData.team;
    const events: any[] = scheduleData.events ?? [];

    const pastGames = events.filter(e => e.competitions?.[0]?.status?.type?.state === 'post');
    const lastEvent = pastGames[pastGames.length - 1] ?? null;

    const liveGames = events.filter(e => e.competitions?.[0]?.status?.type?.state === 'in');
    const liveEvent = liveGames[0] ?? null;

    const futureGames = events.filter(e => e.competitions?.[0]?.status?.type?.state === 'pre');
    const nextEvent = futureGames[0] ?? null;

    function str(val: any): string {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return String(val);
      if (val.displayValue) return val.displayValue;
      if (val.value) return String(val.value);
      return '';
    }

    function parseGame(event: any) {
      if (!event) return null;
      const comp = event.competitions[0];
      const ourComp = comp.competitors.find((c: any) => c.team.id === teamId);
      const oppComp = comp.competitors.find((c: any) => c.team.id !== teamId);
      const probables: any[] = comp.probables ?? [];
      const ourProbable = probables.find((p: any) => p.homeAway === ourComp?.homeAway);
      const oppProbable = probables.find((p: any) => p.homeAway !== ourComp?.homeAway);

      return {
        date: str(event.date),
        opponent: str(oppComp?.team?.displayName),
        opponentAbbr: str(oppComp?.team?.abbreviation),
        opponentLogo: str(oppComp?.team?.logo),
        homeAway: str(ourComp?.homeAway) || 'home',
        teamScore: str(ourComp?.score),
        opponentScore: str(oppComp?.score),
        result: ourComp?.winner ? 'W' : oppComp?.winner ? 'L' : null,
        statusDetail: str(comp.status?.type?.shortDetail),
        venue: str(comp.venue?.fullName),
        probablePitchers: probables.length > 0 ? {
          ours: str(ourProbable?.athlete?.displayName) || null,
          theirs: str(oppProbable?.athlete?.displayName) || null,
        } : null,
      };
    }

    // For MLB, fetch probable pitchers from MLB Stats API
    let mlbProbables: { ours: string | null; theirs: string | null } | null = null;
    if (league === 'mlb') {
      try {
        const abbr = str(team.abbreviation).toUpperCase();
        const mlbTeamId = MLB_TEAM_IDS[abbr];
        if (mlbTeamId) {
          const today = new Date().toISOString().split('T')[0];
          const futureDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
          const mlbRes = await fetch(
            `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${mlbTeamId}&startDate=${today}&endDate=${futureDate}&hydrate=probablePitcher`,
            { next: { revalidate: 1800 } }
          );
          const mlbData = await mlbRes.json();
          const nextMLBGame = mlbData.dates?.[0]?.games?.[0];
          if (nextMLBGame) {
            const home = nextMLBGame.teams.home;
            const away = nextMLBGame.teams.away;
            const ourSide = home.team.id === mlbTeamId ? home : away;
            const oppSide = home.team.id === mlbTeamId ? away : home;
            mlbProbables = {
              ours: ourSide.probablePitcher?.fullName ?? null,
              theirs: oppSide.probablePitcher?.fullName ?? null,
            };
          }
        }
      } catch { /* not critical */ }
    }

    const nextGame = parseGame(nextEvent);
    if (nextGame && mlbProbables) nextGame.probablePitchers = mlbProbables;

    const news = (newsData.articles ?? [])
      .filter((a: any) => ['Media', 'Recap', 'Story'].includes(a.type))
      .slice(0, 4)
      .map((a: any) => ({
        id: String(a.id),
        type: a.type,
        headline: a.headline,
        image: a.images?.[0]?.url ?? '',
        link: a.links?.web?.href ?? '',
        published: a.published,
      }));

    return NextResponse.json({
      team: {
        id: str(team.id),
        name: str(team.displayName),
        abbr: str(team.abbreviation),
        logo: str(team.logo ?? team.logos?.[0]?.href),
        league: leagueLabel(sport, league),
      },
      liveGame: parseGame(liveEvent),
      lastGame: parseGame(lastEvent),
      nextGame,
      news,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 });
  }
}
