import { NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = process.env.TELEGRAM_OWNER_ID;

export async function POST() {
  if (!BOT_TOKEN || !OWNER_ID) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 });
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: OWNER_ID,
        text: '👋 Rocky is online. Telegram alerts are working.',
        parse_mode: 'Markdown',
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `Telegram API ${res.status}: ${detail.slice(0, 200)}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
