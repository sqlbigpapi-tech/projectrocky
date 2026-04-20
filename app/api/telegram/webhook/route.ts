import { generateText, stepCountIs } from 'ai';
import { NextResponse } from 'next/server';
import { makeRockyTools, ROCKY_PERSONALITY } from '@/lib/rocky-tools';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const OWNER_ID = process.env.TELEGRAM_OWNER_ID!;

async function sendTelegram(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.replace(/^["']|["']$/g, '').trim();
  const actual = request.headers.get('x-telegram-bot-api-secret-token');
  if (!expected || actual !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const update = await request.json();
  const message = update.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const body = message.text.trim();

  if (userId !== OWNER_ID) {
    await sendTelegram(chatId, 'Unknown user.');
    return NextResponse.json({ ok: true });
  }

  if (body === '/start') {
    await sendTelegram(chatId, '🥊 *Project Rocky* is online.\n\nJust talk to me naturally:\n• "Add a task to call Charlie by Friday"\n• "What are my tasks this week?"\n• "What\'s my net worth?"\n• "What meetings do I have today?"\n• "How am I doing financially?"\n\nOr type /help for all commands.');
    return NextResponse.json({ ok: true });
  }

  if (body === '/help') {
    await sendTelegram(chatId, '*Rocky Commands:*\n\nJust talk naturally — I figure out what you need:\n• "Add a task to call Charlie by Friday"\n• "Mark the Cummins task as done"\n• "What are my tasks?"\n• "Update share price to 425"\n• "Update mercedes mileage to 21000"\n• "What\'s my net worth?"\n• "What meetings do I have today?"\n• Any financial question');
    return NextResponse.json({ ok: true });
  }

  const base = new URL(request.url).origin;
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;

  try {
    const { text } = await generateText({
      model: 'anthropic/claude-sonnet-4.6',
      maxOutputTokens: 800,
      tools: makeRockyTools(base),
      stopWhen: stepCountIs(5),
      system: `${ROCKY_PERSONALITY}\n\nContext: Today is ${todayStr} (America/New_York). You are responding in a Telegram chat with David.`,
      prompt: body,
    });

    const reply = text.trim() || '…';
    await sendTelegram(chatId, reply.slice(0, 4000));
  } catch (err) {
    console.error('Rocky error:', err);
    await sendTelegram(chatId, 'Rocky is having trouble right now. Try again.');
  }

  return NextResponse.json({ ok: true });
}
