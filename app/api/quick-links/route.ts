import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('quick_links')
    .select('*')
    .order('position', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  const { label, url, position } = await request.json();
  const { data, error } = await supabase
    .from('quick_links')
    .insert({ label, url, position })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

export async function PATCH(request: Request) {
  const supabase = getSupabase();
  const { id, label, url } = await request.json();
  const { error } = await supabase
    .from('quick_links')
    .update({ label, url })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = getSupabase();
  const { id } = await request.json();
  const { error } = await supabase
    .from('quick_links')
    .delete()
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
