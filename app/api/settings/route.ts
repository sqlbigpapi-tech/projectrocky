import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db.from('settings').select('value').eq('key', 'sei_value').single();
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ value: data?.value ?? '' });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const { value } = await request.json();
  const { error } = await db.from('settings').upsert({ key: 'sei_value', value });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
