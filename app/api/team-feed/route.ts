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

    const futureGames = events.filter(e => e.competitions?.[0]?.status?.type?.state === 'pre');
    const nextEvent = futureGames[0] ?? null;

    function parseGame(event: any) {
      if (!event) return null;
      const comp = event.competitions[0];
      const ourComp = comp.competitors.find((c: any) => c.team.id === teamId);
      const oppComp = comp.competitors.find((c: any) => c.team.id !== teamId);
      const probables: any[] = comp.probables ?? [];
      const ourProbable = probables.find((p: any) => p.homeAway === ourComp?.homeAway);
      const oppProbable = probables.find((p: any) => p.homeAway !== ourComp?.homeAway);

      return {
        date: event.date,
        opponent: oppComp?.team?.displayName ?? '',
        opponentAbbr: oppComp?.team?.abbreviation ?? '',
        opponentLogo: oppComp?.team?.logo ?? '',
        homeAway: ourComp?.homeAway ?? 'home',
        teamScore: ourComp?.score ?? '',
        opponentScore: oppComp?.score ?? '',
        result: ourComp?.winner ? 'W' : oppComp?.winner ? 'L' : null,
        statusDetail: comp.status?.type?.shortDetail ?? '',
        venue: comp.venue?.fullName ?? '',
        probablePitchers: probables.length > 0 ? {
          ours: ourProbable?.athlete?.displayName ?? null,
          theirs: oppProbable?.athlete?.displayName ?? null,
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
        id: team.id,
        name: team.displayName,
        abbr: team.abbreviation,
        logo: team.logo ?? team.logos?.[0]?.href ?? '',
        league: leagueLabel(sport, league),
      },
      lastGame: parseGame(lastEvent),
      nextGame: parseGame(nextEvent),
      news,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 });
  }
}
