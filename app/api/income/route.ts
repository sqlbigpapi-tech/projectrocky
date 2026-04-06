import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db
    .from('income_tracker')
    .select('*')
    .eq('year', 2026)
    .order('month');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ months: data ?? [] });
}

export async function PATCH(request: Request) {
  const db = getSupabase();
  const { month, actual, is_forecast } = await request.json();
  const { data, error } = await db
    .from('income_tracker')
    .update({ actual, is_forecast, updated_at: new Date().toISOString() })
    .eq('year', 2026)
    .eq('month', month)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ month: data });
}
