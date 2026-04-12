import { getSupabase } from '@/lib/supabase';
import { getMergedPL } from '@/lib/pl';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = await new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '2026');
  const market = searchParams.get('market') ?? 'MIA';

  try {
    const merged = await getMergedPL(year, market);
    return NextResponse.json({ months: merged });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const db = getSupabase();
  const body = await request.json();
  const { year, month, market = 'MIA', ...fields } = body;

  const { data, error } = await db
    .from('pl_monthly')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('year', year)
    .eq('month', month)
    .eq('market', market)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ month: data });
}
