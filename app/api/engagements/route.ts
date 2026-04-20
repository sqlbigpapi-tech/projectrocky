import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();

  const [consultants, clients, engagements] = await Promise.all([
    db.from('consultants').select('id, first_name, last_name, level').eq('active', true).order('last_name'),
    db.from('clients').select('id, name, industry, url, credit_rating').order('name'),
    db.from('engagements').select('client_id'),
  ]);

  // Attach engagement counts to each client
  const counts = new Map<string, number>();
  for (const e of engagements.data ?? []) counts.set(e.client_id, (counts.get(e.client_id) ?? 0) + 1);
  const clientsWithCounts = (clients.data ?? []).map(c => ({ ...c, engagement_count: counts.get(c.id) ?? 0 }));

  return NextResponse.json({
    consultants: consultants.data ?? [],
    clients: clientsWithCounts,
  });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const body = await request.json();

  // If adding a new consultant
  if (body.type === 'consultant') {
    const { first_name, last_name, level } = body;
    const { data, error } = await db
      .from('consultants')
      .insert({ first_name, last_name, level, active: true })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ consultant: data });
  }

  // If adding a new client
  if (body.type === 'client') {
    const { name, credit_rating, industry, url } = body;
    const { data, error } = await db
      .from('clients')
      .insert({ name, credit_rating, industry, url })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ client: data });
  }

  // Default: add engagement
  const { consultant_id, client_id, deal_name, rate, sow_start, sow_end, status = 'active' } = body;
  const { data, error } = await db
    .from('engagements')
    .insert({ consultant_id, client_id, deal_name, rate, sow_start, sow_end, status })
    .select(`
      id, consultant_id, client_id, deal_name, rate,
      sow_start, sow_end, extended_end, extension_probability, status,
      consultants (first_name, last_name, level),
      clients (name)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ engagement: data });
}

export async function PATCH(request: Request) {
  const db = getSupabase();
  const { id, type, ...fields } = await request.json();

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Update a client master record
  if (type === 'client') {
    const { data, error } = await db.from('clients').update(fields).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ client: data });
  }

  const { data, error } = await db
    .from('engagements')
    .update(fields)
    .eq('id', id)
    .select(`
      id, consultant_id, client_id, deal_name, rate,
      sow_start, sow_end, extended_end, extension_probability, status,
      consultants (first_name, last_name, level),
      clients (name)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ engagement: data });
}

export async function DELETE(request: Request) {
  const db = getSupabase();
  const { id, type } = await request.json();
  if (!id || type !== 'client') return NextResponse.json({ error: 'id and type=client required' }, { status: 400 });

  // Safety: only allow deleting clients with zero engagements
  const { count, error: countErr } = await db.from('engagements').select('id', { count: 'exact', head: true }).eq('client_id', id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) > 0) return NextResponse.json({ error: `Client has ${count} engagement(s); cannot delete.` }, { status: 400 });

  const { error } = await db.from('clients').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
