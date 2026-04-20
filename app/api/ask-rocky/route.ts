import { streamText, stepCountIs } from 'ai';
import { NextResponse } from 'next/server';
import { makeRockyTools, ROCKY_PERSONALITY } from '@/lib/rocky-tools';

export async function POST(request: Request) {
  const { question } = await request.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: 'No question provided' }, { status: 400 });
  }

  const base = new URL(request.url).origin;
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;

  const result = streamText({
    model: 'anthropic/claude-sonnet-4.6',
    maxOutputTokens: 1024,
    tools: makeRockyTools(base),
    stopWhen: stepCountIs(5),
    system: `${ROCKY_PERSONALITY}\n\nContext: Today is ${todayStr} (America/New_York). You are responding in the web command center.`,
    prompt: question,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
