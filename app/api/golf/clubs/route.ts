import { getSupabase } from '@/lib/supabase';
import { DAVID_CLUBS } from '@/lib/golf/clubs';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db
    .from('golf_clubs')
    .select('*')
    .order('position', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-seed default bag on first hit
  if (!data || data.length === 0) {
    const seed = DAVID_CLUBS.map(c => ({
      position: c.position,
      club: c.club,
      loft: c.loft,
      carry: c.carry,
      total: c.total,
      model: c.model,
    }));
    const ins = await db.from('golf_clubs').insert(seed).select().order('position', { ascending: true });
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    return NextResponse.json({ clubs: ins.data ?? [] });
  }

  return NextResponse.json({ clubs: data });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const body = await request.json();
  const { club, loft, carry, total, model, position } = body ?? {};
  if (!club || !loft || carry == null || total == null) {
    return NextResponse.json({ error: 'club, loft, carry, total required' }, { status: 400 });
  }
  // If no position given, append
  let pos = position;
  if (pos == null) {
    const max = await db.from('golf_clubs').select('position').order('position', { ascending: false }).limit(1).single();
    pos = (max.data?.position ?? -1) + 1;
  }
  const { data, error } = await db
    .from('golf_clubs')
    .insert({ club, loft, carry: Math.round(carry), total: Math.round(total), model: model ?? '', position: pos })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ club: data });
}

export async function PATCH(request: Request) {
  const db = getSupabase();
  const { id, ...patch } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ['club', 'loft', 'model', 'image', 'position'] as const) {
    if (k in patch) update[k] = patch[k];
  }
  for (const k of ['carry', 'total'] as const) {
    if (k in patch) update[k] = Math.round(Number(patch[k]));
  }
  const { data, error } = await db
    .from('golf_clubs')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ club: data });
}

export async function DELETE(request: Request) {
  const db = getSupabase();
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await db.from('golf_clubs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
