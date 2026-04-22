import { getSupabase } from '@/lib/supabase';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

type BookRow = {
  title: string;
  author: string | null;
  rating: number | null;
  status: string;
  notes: string | null;
};

const RecSchema = z.object({
  recommendations: z.array(z.object({
    title: z.string(),
    author: z.string(),
    why: z.string().describe('One sentence explaining the fit, naming a prior book it reminds you of when possible.'),
  })).min(3).max(8),
});

export async function POST(request: Request) {
  const { vibe, count }: { vibe?: string; count?: number } = await request.json().catch(() => ({}));
  const db = getSupabase();

  // Pull everything David has engaged with: rated books (to learn taste),
  // plus wishlist and dismissed titles (so we don't re-recommend them).
  const { data: books, error } = await db
    .from('books')
    .select('title, author, rating, status, notes');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (books ?? []) as BookRow[];

  const rated = rows.filter(b => b.status === 'finished' && b.rating != null);
  const wishlist = rows.filter(b => b.status === 'wishlist');
  const dismissed = rows.filter(b => b.status === 'dismissed');
  const currentlyListening = rows.filter(b => b.status === 'listening');

  if (rated.length === 0 && currentlyListening.length === 0) {
    return NextResponse.json({
      error: 'Rate at least one finished book so I know what you like.',
    }, { status: 400 });
  }

  const library = rated
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .map(b => `- "${b.title}" by ${b.author ?? 'unknown'} — ${b.rating}/5${b.notes ? ` (${b.notes})` : ''}`)
    .join('\n');
  const exclude = [...wishlist, ...dismissed, ...rated]
    .map(b => `${b.title} by ${b.author ?? 'unknown'}`)
    .join('; ');
  const currentStr = currentlyListening.length > 0
    ? currentlyListening.map(b => `"${b.title}" by ${b.author ?? 'unknown'}`).join(', ')
    : 'none';

  const target = Math.max(3, Math.min(8, count ?? 5));

  const prompt = `David is a 40-year-old managing director at a consulting firm in South Florida. He listens to audiobooks. Recommend ${target} audiobooks he would love.

His rated library (his rating out of 5):
${library || '(none yet)'}

Currently listening: ${currentStr}
${vibe ? `\nDavid asked specifically for: ${vibe}\n` : ''}
Already read / wishlisted / dismissed — do NOT recommend these:
${exclude || '(none)'}

Rules:
- Lean toward patterns in what he rated 4+, away from what he rated low.
- Only recommend real, published books with correct authors.
- In the "why" field, reference a specific prior book of his when possible (e.g. "systems-problem spine like Project Hail Mary").
- Prefer books available on Audible.
- Variety is welcome — don't recommend 5 books from the same genre unless the vibe filter asks for it.`;

  try {
    const { object } = await generateObject({
      model: 'anthropic/claude-sonnet-4.6',
      schema: RecSchema,
      prompt,
    });
    return NextResponse.json({ recommendations: object.recommendations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Recommendation failed' },
      { status: 500 },
    );
  }
}
