import { NextRequest, NextResponse } from 'next/server';

const PIN_ROLES: Record<string, string> = {
  '3436': 'owner',
  '1234': 'team',
};

export async function POST(req: NextRequest) {
  const { pin } = await req.json();

  const role = PIN_ROLES[pin?.trim()];
  if (!role) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set('session', process.env.SESSION_SECRET!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set('role', role, {
    httpOnly: false, // client needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
