import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

type Vehicle = {
  id: string;
  vin: string;
  label: string;
  miles: number;
};

const VEHICLES: Vehicle[] = [
  { id: 'mercedes', vin: 'WDD5J4GB8LN021757', label: '2020 Mercedes-Benz', miles: 20000 },
  { id: 'bmw',      vin: 'WBXHU7C39J5H40064', label: '2018 BMW X1',        miles: 60000 },
];

async function fetchPrice(vin: string, miles: number): Promise<{ price: number; msrp: number } | null> {
  const key = process.env.MARKETCHECK_API_KEY;
  if (!key) return null;

  const url = `https://api.marketcheck.com/v2/predict/car/us/marketcheck_price?api_key=${key}&vin=${vin}&miles=${miles}&dealer_type=franchise&zip=33076`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.marketcheck_price) return null;
  return { price: data.marketcheck_price, msrp: data.msrp ?? 0 };
}

// GET: return latest stored values + optionally refresh
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get('refresh') === 'true';
  const db = getSupabase();

  if (refresh) {
    // Fetch fresh prices from MarketCheck
    const results = [];
    for (const v of VEHICLES) {
      const val = await fetchPrice(v.vin, v.miles);
      if (val) {
        await db.from('settings').upsert(
          { key: `car_value_${v.id}`, value: JSON.stringify({ ...val, miles: v.miles, updatedAt: new Date().toISOString() }) },
          { onConflict: 'key' }
        );
        results.push({ ...v, ...val });
      }
    }
    return NextResponse.json({ vehicles: results, refreshed: true });
  }

  // Return stored values
  const vehicles = [];
  for (const v of VEHICLES) {
    const { data } = await db.from('settings').select('value').eq('key', `car_value_${v.id}`).single();
    const stored = data?.value ? JSON.parse(data.value) : null;
    vehicles.push({
      ...v,
      price: stored?.price ?? null,
      msrp: stored?.msrp ?? null,
      updatedAt: stored?.updatedAt ?? null,
    });
  }
  return NextResponse.json({ vehicles });
}

// POST: update mileage for a vehicle
export async function POST(request: Request) {
  const { id, miles } = await request.json();
  const vehicle = VEHICLES.find(v => v.id === id);
  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

  // Update mileage in memory for this request and fetch new price
  const val = await fetchPrice(vehicle.vin, miles);
  if (!val) return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });

  const db = getSupabase();
  await db.from('settings').upsert(
    { key: `car_value_${id}`, value: JSON.stringify({ ...val, miles, updatedAt: new Date().toISOString() }) },
    { onConflict: 'key' }
  );

  return NextResponse.json({ ...vehicle, miles, ...val });
}
