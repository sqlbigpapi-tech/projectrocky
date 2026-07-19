import { getDailyMoneySignals } from '@/lib/moneySignals';
import { NextResponse } from 'next/server';

let cached: { at: number; data: Awaited<ReturnType<typeof getDailyMoneySignals>> } | null = null;
const CACHE_MS = 15 * 60 * 1000;

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ ...cached.data, cached: true });
  }
  try {
    const data = await getDailyMoneySignals();
    cached = { at: Date.now(), data };
    return NextResponse.json({ ...data, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Money signals failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
