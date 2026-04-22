import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,cover_i,isbn,first_publish_year,number_of_pages_median`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: `Open Library ${res.status}` }, { status: 502 });
    const data = await res.json();

    type Doc = {
      key?: string;
      title?: string;
      author_name?: string[];
      cover_i?: number;
      isbn?: string[];
      first_publish_year?: number;
      number_of_pages_median?: number;
    };
    const docs: Doc[] = data?.docs ?? [];

    const results = docs.map(d => ({
      title: d.title ?? '',
      author: d.author_name?.[0] ?? '',
      cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      isbn: d.isbn?.[0] ?? null,
      year: d.first_publish_year ?? null,
      pages: d.number_of_pages_median ?? null,
      // Rough audiobook length estimate from page count; user can override.
      estimated_minutes: d.number_of_pages_median
        ? Math.round(d.number_of_pages_median * 2.2)
        : null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 },
    );
  }
}
