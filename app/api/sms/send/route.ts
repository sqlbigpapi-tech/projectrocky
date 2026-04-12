import { sendSMS } from '@/lib/sms';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { body } = await request.json();
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 });
  try {
    const result = await sendSMS(body);
    return NextResponse.json({ ok: true, twilio: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
