import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const category = searchParams.get('category');
  const merchant = searchParams.get('merchant');
  const limit = Math.min(500, parseInt(searchParams.get('limit') ?? '200'));

  const db = getSupabase();
  let q = db.from('transactions')
    .select('date, name, amount, category, type, account')
    .neq('type', 'internal transfer')
    .neq('status', 'pending');

  if (year) {
    const y = parseInt(year);
    if (month) {
      const m = parseInt(month);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDate = new Date(y, m, 0);
      const end = `${y}-${String(m).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      q = q.gte('date', start).lte('date', end);
    } else {
      q = q.gte('date', `${y}-01-01`).lte('date', `${y}-12-31`);
    }
  }

  if (category) q = q.eq('category', category);
  if (merchant) q = q.ilike('name', `%${merchant}%`);

  q = q.order('date', { ascending: false }).limit(limit);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + Math.abs(Number(r.amount)), 0);

  return NextResponse.json({
    transactions: rows,
    count: rows.length,
    total: Math.round(total * 100) / 100,
  });
}
