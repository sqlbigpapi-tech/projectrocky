import { getSupabase } from '@/lib/supabase';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const ParsedSchema = z.object({
  books: z.array(z.object({
    title: z.string(),
    author: z.string().nullable().describe('Author name if identifiable, else null'),
  })).max(200),
});

type SearchHit = {
  title: string;
  author: string;
  cover_url: string | null;
  isbn: string | null;
  estimated_minutes: number | null;
};

async function searchOpenLibrary(title: string, author: string | null): Promise<SearchHit | null> {
  try {
    const q = author ? `${title} ${author}` : title;
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=1&fields=title,author_name,cover_i,isbn,number_of_pages_median`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    type Doc = {
      title?: string;
      author_name?: string[];
      cover_i?: number;
      isbn?: string[];
      number_of_pages_median?: number;
    };
    const doc: Doc | undefined = data?.docs?.[0];
    if (!doc) return null;
    return {
      title: doc.title ?? title,
      author: doc.author_name?.[0] ?? author ?? '',
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
      isbn: doc.isbn?.[0] ?? null,
      estimated_minutes: doc.number_of_pages_median ? Math.round(doc.number_of_pages_median * 2.2) : null,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const { text, defaultStatus }: { text?: string; defaultStatus?: 'finished' | 'wishlist' } = await request.json().catch(() => ({}));
  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }
  const status = defaultStatus ?? 'finished';

  // Step 1: parse freeform text into structured books via Claude
  let parsed: { books: { title: string; author: string | null }[] };
  try {
    const { object } = await generateObject({
      model: 'anthropic/claude-sonnet-4.6',
      schema: ParsedSchema,
      prompt: `Parse this user-pasted list of audiobooks into structured rows. The text can be any format — bullet points, numbered, one-per-line, commas, ratings, whatever. Extract title and author for each. Ignore ratings, commentary, dates, and formatting. If an author is missing or unclear, set it to null. Skip obvious non-book entries (section headers, empty lines, "my library", etc.).

Input:
${text}`,
    });
    parsed = object;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Parse failed' },
      { status: 500 },
    );
  }

  if (parsed.books.length === 0) {
    return NextResponse.json({ error: 'Could not extract any books from that input.' }, { status: 400 });
  }

  // Step 2: dedupe against existing library
  const db = getSupabase();
  const { data: existing } = await db.from('books').select('title, author');
  const existingSet = new Set(
    (existing ?? []).map(b => `${(b.title ?? '').toLowerCase().trim()}|${(b.author ?? '').toLowerCase().trim()}`),
  );

  const fresh = parsed.books.filter(b => {
    const key = `${b.title.toLowerCase().trim()}|${(b.author ?? '').toLowerCase().trim()}`;
    return !existingSet.has(key);
  });

  // Step 3: enrich each fresh book via Open Library (parallel, with concurrency cap)
  const CONCURRENCY = 6;
  const enriched: (SearchHit & { parsed_author: string | null })[] = [];
  for (let i = 0; i < fresh.length; i += CONCURRENCY) {
    const batch = fresh.slice(i, i + CONCURRENCY);
    const hits = await Promise.all(
      batch.map(async b => {
        const hit = await searchOpenLibrary(b.title, b.author);
        return { hit, parsed: b };
      }),
    );
    for (const { hit, parsed: p } of hits) {
      if (hit) {
        enriched.push({ ...hit, parsed_author: p.author });
      } else {
        enriched.push({
          title: p.title,
          author: p.author ?? '',
          cover_url: null,
          isbn: null,
          estimated_minutes: null,
          parsed_author: p.author,
        });
      }
    }
  }

  // Step 4: bulk insert
  const today = new Date().toISOString().split('T')[0];
  const rows = enriched.map(e => ({
    title: e.title,
    author: e.author || e.parsed_author || null,
    cover_url: e.cover_url,
    isbn: e.isbn,
    length_minutes: e.estimated_minutes,
    status,
    finished_at: status === 'finished' ? today : null,
    started_at: null,
    listened_minutes: 0,
  }));

  if (rows.length === 0) {
    return NextResponse.json({
      parsed: parsed.books.length,
      added: 0,
      skipped: parsed.books.length,
      message: 'All of those books are already in your library.',
    });
  }

  const { data: inserted, error: insertErr } = await db.from('books').insert(rows).select('id, title');
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({
    parsed: parsed.books.length,
    added: inserted?.length ?? 0,
    skipped: parsed.books.length - (inserted?.length ?? 0),
    books: inserted ?? [],
  });
}
