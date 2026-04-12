import { getForecast } from '@/lib/billing';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = await new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '2026');
  const includeAll = searchParams.get('all') === '1';

  try {
    const data = await getForecast(year, includeAll);
    return NextResponse.json({ forecast: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
