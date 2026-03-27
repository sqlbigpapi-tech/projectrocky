import { NextResponse } from 'next/server';

export type Highlight = {
  id: string;
  type: string;
  headline: string;
  description: string;
  image: string;
  link: string;
  published: string;
  league: string;
};

type ESPNArticle = {
  id: string;
  type: string;
  headline: string;
  description?: string;
  published: string;
  images?: { url: string }[];
  links?: { web?: { href: string } };
};

async function fetchNews(sport: string, league: string, leagueLabel: string): Promise<Highlight[]> {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/news?limit=8`,
    { next: { revalidate: 300 } }
  );
  const data = await res.json() as { articles: ESPNArticle[] };
  return (data.articles ?? [])
    .filter(a => ['Media', 'Recap', 'Story'].includes(a.type))
    .slice(0, 5)
    .map(a => ({
      id: String(a.id),
      type: a.type,
      headline: a.headline,
      description: a.description ?? '',
      image: a.images?.[0]?.url ?? '',
      link: a.links?.web?.href ?? '',
      published: a.published,
      league: leagueLabel,
    }));
}

export async function GET() {
  try {
    const [nfl, nba, mlb] = await Promise.all([
      fetchNews('football', 'nfl', 'NFL'),
      fetchNews('basketball', 'nba', 'NBA'),
      fetchNews('baseball', 'mlb', 'MLB'),
    ]);
    return NextResponse.json({ nfl, nba, mlb });
  } catch {
    return NextResponse.json({ error: 'Highlights unavailable' }, { status: 500 });
  }
}
