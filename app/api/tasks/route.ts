import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: Request) {
  const db = getSupabase();
  const { title, notes, priority, due_date, category, recurrence, is_bill, bill_amount } = await request.json();
  const { data, error } = await db
    .from('tasks')
    .insert({ title, notes: notes ?? '', priority: priority ?? 'Medium', due_date: due_date ?? null, category: category ?? 'Personal', recurrence: recurrence ?? null, is_bill: is_bill ?? false, bill_amount: bill_amount ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function PATCH(request: Request) {
  const db = getSupabase();
  const { id, ...patch } = await request.json();
  const { data, error } = await db
    .from('tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(request: Request) {
  const db = getSupabase();
  const { id } = await request.json();
  const { error } = await db.from('tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
