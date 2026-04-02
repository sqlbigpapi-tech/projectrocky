import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');
  const league = searchParams.get('league');

  if (!sport || !league) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams?limit=200`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    const teams = (data.sports?.[0]?.leagues?.[0]?.teams ?? []).map((t: any) => ({
      id: t.team.id,
      name: t.team.displayName,
      abbr: t.team.abbreviation,
      logo: t.team.logos?.[0]?.href ?? '',
    }));
    return NextResponse.json({ teams });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
