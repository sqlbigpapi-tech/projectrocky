import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// Health Auto Export webhook — receives batched metric data
export async function POST(request: Request) {
  const db = getSupabase();
  const body = await request.json();

  const metrics: { name: string; units: string; data: Record<string, unknown>[] }[] =
    body?.data?.metrics ?? [];

  const rows: {
    date: string;
    metric: string;
    qty: number | null;
    min_val: number | null;
    max_val: number | null;
    unit: string;
  }[] = [];

  for (const m of metrics) {
    for (const entry of m.data ?? []) {
      // Health Auto Export date: "2026-04-03 00:00:00 -0400"
      const rawDate = String(entry.date ?? '');
      const dateStr = rawDate.split(' ')[0];
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

      rows.push({
        date:    dateStr,
        metric:  m.name,
        qty:     (entry.qty ?? entry.Avg ?? entry.value ?? null) as number | null,
        min_val: (entry.Min ?? null) as number | null,
        max_val: (entry.Max ?? null) as number | null,
        unit:    m.units ?? '',
      });
    }
  }

  // Deduplicate: multiple readings per day → average qty, keep min/max extremes
  const dedupMap = new Map<string, typeof rows[number] & { _count: number }>();
  for (const row of rows) {
    const key = `${row.date}__${row.metric}`;
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, { ...row, _count: 1 });
    } else {
      existing.qty     = existing.qty != null && row.qty != null ? existing.qty + row.qty : existing.qty ?? row.qty;
      existing.min_val = existing.min_val != null && row.min_val != null ? Math.min(existing.min_val, row.min_val) : existing.min_val ?? row.min_val;
      existing.max_val = existing.max_val != null && row.max_val != null ? Math.max(existing.max_val, row.max_val) : existing.max_val ?? row.max_val;
      existing._count++;
    }
  }

  const deduped = Array.from(dedupMap.values()).map(({ _count, ...row }) => ({
    ...row,
    qty: row.qty != null ? row.qty / _count : null, // average
  }));

  if (deduped.length > 0) {
    const { error } = await db
      .from('health_metrics')
      .upsert(deduped, { onConflict: 'date,metric' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, processed: deduped.length, raw: rows.length });
}

// Fetch last 30 days for the dashboard
export async function GET() {
  const db = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await db
    .from('health_metrics')
    .select('*')
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ metrics: data ?? [] });
}
