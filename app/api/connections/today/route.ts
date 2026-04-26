import { NextResponse } from 'next/server';

type NytCard = { content: string; position: number };
type NytCategory = { title: string; cards: NytCard[] };
type NytPayload = { id?: number; print_date?: string; categories?: NytCategory[] };

function todayET(): string {
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = (url.searchParams.get('date') ?? todayET()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }

  const upstream = `https://www.nytimes.com/svc/connections/v2/${date}.json`;
  try {
    const r = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; rocky-connections/1.0)',
        'Accept': 'application/json',
      },
      next: { revalidate: 86400 },
    });
    if (!r.ok) {
      return NextResponse.json({ error: `nyt status ${r.status}` }, { status: 502 });
    }
    const data: NytPayload = await r.json();
    if (!data.categories || data.categories.length !== 4) {
      return NextResponse.json({ error: 'unexpected nyt payload' }, { status: 502 });
    }
    // NYT returns categories ordered easiest → hardest (yellow, green, blue, purple).
    const categories = data.categories.map((cat, i) => ({
      name: cat.title,
      difficulty: i as 0 | 1 | 2 | 3,
      words: cat.cards.map(c => c.content.toUpperCase()),
    }));
    return NextResponse.json({
      source: 'nyt',
      date,
      puzzleId: data.id ?? null,
      categories,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
