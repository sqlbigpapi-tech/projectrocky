import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();

  const [consultants, clients] = await Promise.all([
    db.from('consultants').select('id, first_name, last_name, level').eq('active', true).order('last_name'),
    db.from('clients').select('id, name').order('name'),
  ]);

  return NextResponse.json({
    consultants: consultants.data ?? [],
    clients: clients.data ?? [],
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
    const { name, credit_rating } = body;
    const { data, error } = await db
      .from('clients')
      .insert({ name, credit_rating })
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
  const { id, ...fields } = await request.json();

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

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
