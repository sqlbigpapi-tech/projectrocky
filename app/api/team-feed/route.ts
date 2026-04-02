import { NextResponse } from 'next/server';

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
      nextGame: parseGame(nextEvent),
      news,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 });
  }
}
