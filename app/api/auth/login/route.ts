import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const PIN_USERS: Record<string, { role: string; name: string }> = {
  '3436': { role: 'owner', name: 'David' },
  '7722': { role: 'manager', name: 'Simon' },
  '5511': { role: 'manager', name: 'Sarah' },
  '1234': { role: 'team', name: 'Team' },
};

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 10;
const LOCKOUT_MINUTES = 15;

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const db = getSupabase();

  // Count recent failed attempts from this IP
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count: failures } = await db
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('success', false)
    .gte('attempted_at', windowStart);

  if ((failures ?? 0) >= MAX_FAILURES) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.` },
      { status: 429, headers: { 'Retry-After': String(LOCKOUT_MINUTES * 60) } },
    );
  }

  const { pin } = await req.json();
  const user = PIN_USERS[pin?.trim()];

  // Always log the attempt
  await db.from('login_attempts').insert({ ip, success: !!user });

  if (!user) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role: user.role, name: user.name });
  res.cookies.set('session', process.env.SESSION_SECRET!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set('role', user.role, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set('user_name', user.name, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
