import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const BASE = 'https://api.ouraring.com/v2/usercollection';

async function getValidToken(db: ReturnType<typeof import('@/lib/supabase').getSupabase>): Promise<string | null> {
  const { data: rows } = await db
    .from('settings')
    .select('key, value')
    .in('key', ['oura_access_token', 'oura_refresh_token', 'oura_expires_at']);

  const byKey = Object.fromEntries((rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const accessToken  = byKey['oura_access_token'];
  const refreshToken = byKey['oura_refresh_token'];
  const expiresAt    = Number(byKey['oura_expires_at'] ?? 0);

  if (!accessToken) return null;
  if (Date.now() < expiresAt - 300_000) return accessToken;
  if (!refreshToken) return null;

  const res = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) return null;

  const { access_token, refresh_token: newRefresh, expires_in } = await res.json();
  const newExpiry = Date.now() + (expires_in ?? 86400) * 1000;

  await Promise.all([
    db.from('settings').upsert({ key: 'oura_access_token',  value: access_token },      { onConflict: 'key' }),
    db.from('settings').upsert({ key: 'oura_refresh_token', value: newRefresh },         { onConflict: 'key' }),
    db.from('settings').upsert({ key: 'oura_expires_at',    value: String(newExpiry) }, { onConflict: 'key' }),
  ]);

  return access_token;
}

async function ouraFetch(path: string, token: string, startDate: string, endDate: string) {
  const url = `${BASE}/${path}?start_date=${startDate}&end_date=${endDate}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Oura ${path} ${res.status}`);
  return res.json();
}

type CachedResponse = {
  readiness: unknown[];
  sleep: unknown[];
  activity: unknown[];
};

// Module-level cache. Oura data updates at most once a day; 15 min is plenty.
let cached: { at: number; endDate: string; data: CachedResponse } | null = null;
const CACHE_MS = 15 * 60 * 1000;

export async function GET() {
  const db = getSupabase();
  const token = await getValidToken(db);
  if (!token) return NextResponse.json({ error: 'no_token' }, { status: 200 });

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const startDate = start.toISOString().split('T')[0];
  const endDate   = end.toISOString().split('T')[0];

  if (cached && cached.endDate === endDate && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const [readiness, sleep, activity, sleepSessions] = await Promise.all([
      ouraFetch('daily_readiness', token, startDate, endDate),
      ouraFetch('daily_sleep',     token, startDate, endDate),
      ouraFetch('daily_activity',  token, startDate, endDate),
      ouraFetch('sleep',           token, startDate, endDate),
    ]);

    // daily_sleep has scores; sleep sessions have durations/HRV/HR — merge by day
    const sessionsByDay = new Map<string, Record<string, unknown>>();
    for (const s of (sleepSessions.data ?? [])) {
      if (s.type === 'long_sleep' || !sessionsByDay.has(s.day)) {
        sessionsByDay.set(s.day, s);
      }
    }
    const mergedSleep = (sleep.data ?? []).map((d: Record<string, unknown>) => ({
      ...sessionsByDay.get(d.day as string),
      ...d,
    }));

    const data: CachedResponse = {
      readiness: readiness.data ?? [],
      sleep:     mergedSleep,
      activity:  activity.data  ?? [],
    };
    cached = { at: Date.now(), endDate, data };

    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Oura fetch failed' }, { status: 500 });
  }
}
