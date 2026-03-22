import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db.from('plaid_items').select('access_token').order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data.map((r: { access_token: string }) => r.access_token) });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const { access_token } = await request.json();
  const { error } = await db.from('plaid_items').upsert({ access_token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const db = getSupabase();
  const { access_token } = await request.json();
  const { error } = await db.from('plaid_items').delete().eq('access_token', access_token);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
