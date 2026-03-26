import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db.from('bd_targets').select('*');
  if (error) return NextResponse.json({ targets: [] });
  return NextResponse.json({ targets: data ?? [] });
}

export async function PATCH(request: Request) {
  const db = getSupabase();
  const { company_id, notes, status } = await request.json();
  const { data, error } = await db
    .from('bd_targets')
    .upsert({ company_id, notes, status, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ target: data });
}
