import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db.from('bills').select('*').eq('is_active', true).order('due_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bills: data });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const body = await request.json();
  const { data, error } = await db.from('bills').upsert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bill: data });
}

export async function PATCH(request: Request) {
  const db = getSupabase();
  const { id, ...updates } = await request.json();
  const { data, error } = await db.from('bills').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bill: data });
}

export async function DELETE(request: Request) {
  const db = getSupabase();
  const { id } = await request.json();
  const { error } = await db.from('bills').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
