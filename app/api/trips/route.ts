import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const isPrScouting = searchParams.get('pr') === 'true';
  const db = getSupabase();
  let q = db.from('trips').select('*');
  if (status) q = q.eq('status', status);
  if (isPrScouting) q = q.eq('is_pr_scouting', true);
  const { data, error } = await q.order('start_date', { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trips: data ?? [] });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const body = await request.json();
  const {
    title, destination, country, status, start_date, end_date,
    budget_estimate, actual_cost, who, vibe, rating, notes, why,
    is_pr_scouting, cover_url, added_by,
  } = body;
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const { data, error } = await db
    .from('trips')
    .insert({
      title,
      destination: destination ?? null,
      country: country ?? null,
      status: status ?? 'dream',
      start_date: start_date ?? null,
      end_date: end_date ?? null,
      budget_estimate: budget_estimate ?? null,
      actual_cost: actual_cost ?? null,
      who: who ?? 'family',
      vibe: vibe ?? null,
      rating: rating ?? null,
      notes: notes ?? null,
      why: why ?? null,
      is_pr_scouting: is_pr_scouting ?? false,
      cover_url: cover_url ?? null,
      added_by: added_by ?? 'david',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip: data });
}

export async function PATCH(request: Request) {
  const db = getSupabase();
  const { id, ...patch } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { data, error } = await db
    .from('trips')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip: data });
}

export async function DELETE(request: Request) {
  const db = getSupabase();
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await db.from('trips').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
