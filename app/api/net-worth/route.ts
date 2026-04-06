import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db
    .from('net_worth_snapshots')
    .select('*')
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshots: data ?? [] });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const body = await request.json();
  const { accounts } = body;

  if (!accounts || !Array.isArray(accounts)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Check for an existing snapshot today — update it instead of inserting
  const { data: existing } = await db
    .from('net_worth_snapshots')
    .select('id')
    .gte('date', todayStart.toISOString())
    .lte('date', todayEnd.toISOString())
    .maybeSingle();

  let data, error;
  if (existing) {
    ({ data, error } = await db
      .from('net_worth_snapshots')
      .update({ accounts, date: now.toISOString() })
      .eq('id', existing.id)
      .select()
      .single());
  } else {
    ({ data, error } = await db
      .from('net_worth_snapshots')
      .insert({ accounts, date: now.toISOString() })
      .select()
      .single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ snapshot: data });
}
