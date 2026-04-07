import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.OURA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'OURA_CLIENT_ID not configured' }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oura/callback`;
  const scope = 'personal daily heartrate spo2 ring_configuration stress heart_health';

  const url = new URL('https://cloud.ouraring.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);

  return NextResponse.redirect(url.toString());
}
