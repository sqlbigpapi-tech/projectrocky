import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Claude, an AI assistant embedded in the Ortiz Command Center — a personal finance and lifestyle dashboard built with Next.js 16 App Router.

The dashboard includes:
- Briefing tab: daily overview with clock, weather (Parkland, FL), cash flow, bills due, and sports
- Finance tab: net worth, monthly income/expenses, spending charts, bank account totals
- Accounts tab: connected bank accounts via Plaid (production environment), transactions list
- Bills tab: recurring bills tracker with Supabase persistence
- Sports tab: PGA Tour leaderboard + NFL/NBA/MLB team scores
- Weather tab: Parkland, FL weather via Open-Meteo API
- News tab: RSS feeds (Mets, Giants, Knicks, business, AI/tech, South Florida)

Tech stack: Next.js 16.2.1, TypeScript, Tailwind CSS v4, Supabase, Plaid API (production), Recharts, pure black + amber gold color scheme.

API routes live in app/api/. Components live in app/components/. Main page is app/page.tsx.

Help the user understand, debug, or improve their dashboard. Be concise and practical.`;

export async function POST(request: Request) {
  const { messages } = await request.json();

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
