import {
  generateText,
  stepCountIs,
  experimental_transcribe as transcribe,
  type ModelMessage,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { makeRockyTools, ROCKY_PERSONALITY } from '@/lib/rocky-tools';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const OWNER_ID = process.env.TELEGRAM_OWNER_ID!;
const HISTORY_LIMIT = 20; // messages to keep in context per chat
const HISTORY_TTL_HOURS = 24; // discard anything older than this

async function sendTelegram(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function downloadTelegramFile(fileId: string): Promise<Uint8Array | null> {
  const metaRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  if (!metaRes.ok) return null;
  const meta = await metaRes.json() as { ok: boolean; result?: { file_path?: string } };
  const path = meta.result?.file_path;
  if (!path) return null;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`);
  if (!fileRes.ok) return null;
  return new Uint8Array(await fileRes.arrayBuffer());
}

async function transcribeVoice(audio: Uint8Array): Promise<string | null> {
  try {
    const result = await transcribe({
      model: openai.transcription('whisper-1'),
      audio,
    });
    return result.text?.trim() || null;
  } catch (err) {
    console.error('Transcription failed:', err);
    return null;
  }
}

async function loadHistory(chatId: string): Promise<ModelMessage[]> {
  const db = getSupabase();
  const cutoff = new Date(Date.now() - HISTORY_TTL_HOURS * 3600 * 1000).toISOString();
  const { data } = await db.from('rocky_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (!data) return [];
  return data.reverse().map(r => ({ role: r.role, content: r.content } as ModelMessage));
}

async function saveMessages(chatId: string, messages: ModelMessage[]) {
  if (messages.length === 0) return;
  const db = getSupabase();
  await db.from('rocky_messages').insert(
    messages.map(m => ({ chat_id: chatId, role: m.role, content: m.content })),
  );
}

async function clearHistory(chatId: string) {
  const db = getSupabase();
  await db.from('rocky_messages').delete().eq('chat_id', chatId);
}

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.replace(/^["']|["']$/g, '').trim();
  const actual = request.headers.get('x-telegram-bot-api-secret-token');
  if (!expected || actual !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const update = await request.json();
  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const userId = String(message.from.id);

  if (userId !== OWNER_ID) {
    await sendTelegram(chatId, 'Unknown user.');
    return NextResponse.json({ ok: true });
  }

  let body = message.text?.trim();
  let viaVoice = false;

  if (!body && (message.voice || message.audio)) {
    const fileId = (message.voice ?? message.audio).file_id;
    const audio = await downloadTelegramFile(fileId);
    if (!audio) {
      await sendTelegram(chatId, 'Couldn\'t fetch that voice message. Try again or type it.');
      return NextResponse.json({ ok: true });
    }
    const transcript = await transcribeVoice(audio);
    if (!transcript) {
      await sendTelegram(chatId, 'Couldn\'t transcribe that voice message.');
      return NextResponse.json({ ok: true });
    }
    body = transcript;
    viaVoice = true;
  }

  if (!body) return NextResponse.json({ ok: true });

  if (body === '/start') {
    await sendTelegram(chatId, '🥊 *Project Rocky* is online.\n\nTalk to me naturally — text or voice:\n• "Add a task to call Charlie by Friday"\n• "What did I spend on dining in March?"\n• "How did I sleep last night?"\n• "What\'s my net worth?"\n• "What meetings do I have today?"\n\nI remember our recent conversation, so follow-ups like "mark the third one done" just work. Type /forget to reset.\n\nType /help for more.');
    return NextResponse.json({ ok: true });
  }

  if (body === '/help') {
    await sendTelegram(chatId, '*Rocky Commands:*\n\nText or voice, just talk naturally:\n• "Add a task to call Charlie by Friday"\n• "Mark the Cummins task as done"\n• "What did I spend on dining this month?"\n• "Show me every Amazon charge last week"\n• "How has my net worth changed this year?"\n• "How did I sleep last night?"\n• "What meetings do I have today?"\n• Any financial question\n\n/forget — wipe our conversation history');
    return NextResponse.json({ ok: true });
  }

  if (body === '/forget') {
    await clearHistory(chatId);
    await sendTelegram(chatId, 'Cleared. Starting fresh.');
    return NextResponse.json({ ok: true });
  }

  const base = new URL(request.url).origin;
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;

  try {
    const history = await loadHistory(chatId);
    const userMessage: ModelMessage = { role: 'user', content: body };
    const systemMessage: ModelMessage = {
      role: 'system',
      content: `${ROCKY_PERSONALITY}\n\nContext: Today is ${todayStr} (America/New_York). You are responding in a Telegram chat with David.${viaVoice ? ' This message came in as a voice memo that was transcribed — allow for transcription quirks and use conversational phrasing in the reply.' : ''}`,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    };
    const messages: ModelMessage[] = [systemMessage, ...history, userMessage];

    const result = await generateText({
      model: 'anthropic/claude-sonnet-4.6',
      maxOutputTokens: 800,
      tools: makeRockyTools(base),
      stopWhen: stepCountIs(5),
      messages,
    });

    await saveMessages(chatId, [userMessage, ...result.response.messages]);

    const reply = result.text.trim() || '…';
    await sendTelegram(chatId, reply.slice(0, 4000));
  } catch (err) {
    console.error('Rocky error:', err);
    await sendTelegram(chatId, 'Rocky is having trouble right now. Try again.');
  }

  return NextResponse.json({ ok: true });
}
