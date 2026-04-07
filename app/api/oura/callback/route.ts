import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/?oura=error`);
  }

  const clientId     = process.env.OURA_CLIENT_ID!;
  const clientSecret = process.env.OURA_CLIENT_SECRET!;
  const redirectUri  = `${appUrl}/api/oura/callback`;

  const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${appUrl}/?oura=error`);
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json();
  const expiresAt = Date.now() + (expires_in ?? 86400) * 1000;

  const db = getSupabase();
  await Promise.all([
    db.from('settings').upsert({ key: 'oura_access_token',  value: access_token },  { onConflict: 'key' }),
    db.from('settings').upsert({ key: 'oura_refresh_token', value: refresh_token }, { onConflict: 'key' }),
    db.from('settings').upsert({ key: 'oura_expires_at',    value: String(expiresAt) }, { onConflict: 'key' }),
  ]);

  return NextResponse.redirect(`${appUrl}/?oura=connected`);
}
