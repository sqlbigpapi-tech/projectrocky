import { getSupabase } from '@/lib/supabase';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

type TripRow = {
  title: string;
  destination: string | null;
  country: string | null;
  status: string;
  who: string;
  rating: number | null;
  notes: string | null;
  is_pr_scouting: boolean;
};

const IdeaSchema = z.object({
  ideas: z.array(z.object({
    title: z.string().describe('Short trip name, e.g. "Rome + Tuscany"'),
    destination: z.string().describe('Specific place(s), e.g. "Rome, Florence, Chianti"'),
    country: z.string().describe('Country or region, e.g. "Italy"'),
    why: z.string().describe('One or two sentences explaining the fit, referencing prior trips or expressed interests when relevant.'),
    best_season: z.string().describe('Best window to go, e.g. "May–June" or "Any time"'),
    budget_estimate_usd: z.number().int().describe('Rough total trip cost in USD for the specified group size.'),
    vibe_tags: z.array(z.string()).max(5),
  })).min(3).max(5),
});

type RequestBody = {
  window?: 'weekend' | 'long-weekend' | 'week' | 'two-weeks' | 'flexible';
  budget?: number;                  // max budget in USD, optional
  who?: 'family' | 'couple' | 'solo';
  vibe?: string;
  include_pr?: boolean;             // allow PR scouting recs
};

export async function POST(request: Request) {
  const body: RequestBody = await request.json().catch(() => ({}));
  const db = getSupabase();

  const { data: trips, error } = await db
    .from('trips')
    .select('title, destination, country, status, who, rating, notes, is_pr_scouting');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (trips ?? []) as TripRow[];

  const past = rows.filter(t => t.status === 'past');
  const dream = rows.filter(t => t.status === 'dream');
  const booked = rows.filter(t => t.status === 'booked');

  const pastLines = past
    .filter(t => t.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .map(t => `- "${t.title}" (${t.destination ?? t.country ?? 'unknown'}) — ${t.rating}/5${t.notes ? ` (${t.notes})` : ''}`)
    .join('\n');

  const dreamLines = dream
    .map(t => `- ${t.title}${t.destination ? ` (${t.destination})` : ''}`)
    .join('\n');

  const exclude = [...past, ...dream, ...booked]
    .map(t => `${t.title}${t.destination ? ` (${t.destination})` : ''}`)
    .join('; ');

  const window = body.window ?? 'flexible';
  const windowLabel = {
    'weekend': '2-3 days',
    'long-weekend': '3-4 days',
    'week': '5-7 days',
    'two-weeks': '10-14 days',
    'flexible': 'any length',
  }[window];

  const who = body.who ?? 'family';
  const whoLabel = {
    family: 'David + Erica + 3 kids (family of 5)',
    couple: 'just David + Erica',
    solo: 'David alone',
  }[who];

  const prompt = `David lives in Parkland, Florida with his wife Erica and three kids. He is a managing director at a consulting firm, analytical, likes specific and well-reasoned recommendations. Suggest 3-5 vacation ideas.

Trip parameters:
- Who's going: ${whoLabel}
- Length: ${windowLabel}
${body.budget ? `- Budget cap: $${body.budget.toLocaleString()} total` : '- Budget: open'}
${body.vibe ? `- Vibe / feel he asked for: ${body.vibe}` : ''}

His travel history (highly rated first — learn his taste from these):
${pastLines || '(no past trips rated yet)'}

Already on his dream list (do NOT suggest these again):
${dreamLines || '(empty)'}

Hard exclusions — already read / wishlisted / booked / been:
${exclude || '(none)'}

${body.include_pr === false ? 'Do NOT suggest Puerto Rico — he tracks that as a separate long-term dream.' : 'You may suggest Puerto Rico as a scouting-trip option if the parameters fit.'}

Rules:
- Recommend real, specific destinations with concrete regions (not "Europe" but "Rome + Tuscany").
- Budget estimates should be realistic for the group size and length, including flights, lodging, and activities.
- The "why" should name a prior trip or stated interest when it makes the recommendation stronger.
- Avoid tropical Caribbean unless the vibe specifically asks for it — David already lives in South Florida, he wants contrast.`;

  try {
    const { object } = await generateObject({
      model: 'anthropic/claude-sonnet-4.6',
      schema: IdeaSchema,
      prompt,
    });
    return NextResponse.json({ ideas: object.ideas });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Idea generation failed' },
      { status: 500 },
    );
  }
}
