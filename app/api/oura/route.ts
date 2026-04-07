import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const BASE = 'https://api.ouraring.com/v2/usercollection';

async function ouraFetch(path: string, token: string, startDate: string, endDate: string) {
  const url = `${BASE}/${path}?start_date=${startDate}&end_date=${endDate}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Oura ${path} ${res.status}`);
  return res.json();
}

export async function GET() {
  const db = getSupabase();

  const { data: setting } = await db
    .from('settings')
    .select('value')
    .eq('key', 'oura_token')
    .maybeSingle();

  const token = setting?.value;
  if (!token) {
    return NextResponse.json({ error: 'no_token' }, { status: 200 });
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 14);
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  try {
    const [readiness, sleep, activity] = await Promise.all([
      ouraFetch('daily_readiness', token, startDate, endDate),
      ouraFetch('daily_sleep', token, startDate, endDate),
      ouraFetch('daily_activity', token, startDate, endDate),
    ]);

    return NextResponse.json({
      readiness: readiness.data ?? [],
      sleep: sleep.data ?? [],
      activity: activity.data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
