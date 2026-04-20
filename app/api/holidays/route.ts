import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') ?? '2026';
  const db = getSupabase();

  const { data: holidays, error } = await db
    .from('holidays')
    .select('id, date, consultant_id, consultants(first_name, last_name)')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Separate public holidays (consultant_id is null) from PTO
  const publicHolidays = (holidays ?? []).filter(h => !h.consultant_id);
  const pto = (holidays ?? []).filter(h => h.consultant_id);

  return NextResponse.json({ publicHolidays, pto });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const { date, consultant_id } = await request.json();

  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });

  const { data, error } = await db
    .from('holidays')
    .insert({ date, consultant_id: consultant_id || null })
    .select('id, date, consultant_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holiday: data });
}

export async function DELETE(request: Request) {
  const db = getSupabase();
  const { id } = await request.json();

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await db.from('holidays').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
