import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const db = getSupabase();
  let q = db.from('books').select('*');
  if (status) q = q.eq('status', status);
  const { data, error } = await q.order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ books: data ?? [] });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const body = await request.json();
  const {
    title, author, cover_url, isbn, length_minutes,
    status, rating, started_at, finished_at, listened_minutes, notes, rec_reason,
  } = body;
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const { data, error } = await db
    .from('books')
    .insert({
      title,
      author: author ?? null,
      cover_url: cover_url ?? null,
      isbn: isbn ?? null,
      length_minutes: length_minutes ?? null,
      status: status ?? 'wishlist',
      rating: rating ?? null,
      started_at: started_at ?? null,
      finished_at: finished_at ?? null,
      listened_minutes: listened_minutes ?? 0,
      notes: notes ?? null,
      rec_reason: rec_reason ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ book: data });
}

export async function PATCH(request: Request) {
  const db = getSupabase();
  const { id, ...patch } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { data, error } = await db
    .from('books')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ book: data });
}

export async function DELETE(request: Request) {
  const db = getSupabase();
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await db.from('books').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
