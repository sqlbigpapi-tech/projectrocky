import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const db = getSupabase();
  const key = new URL(request.url).searchParams.get('key') ?? 'sei_value';
  const { data, error } = await db.from('settings').select('value').eq('key', key).single();
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ value: data?.value ?? '' });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const { key = 'sei_value', value } = await request.json();
  const { error } = await db.from('settings').upsert({ key, value });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
