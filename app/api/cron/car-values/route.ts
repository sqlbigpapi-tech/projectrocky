import { verifyCronSecret } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const base = new URL(request.url).origin;
  const res = await fetch(`${base}/api/car-value?refresh=true`);
  const data = await res.json();

  return NextResponse.json({ refreshed: true, vehicles: data.vehicles?.length ?? 0 });
}
