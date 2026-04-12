import { getSupabase } from './supabase';

export interface EngagementRow {
  id: string;
  consultant_id: string;
  client_id: string | null;
  deal_name: string | null;
  rate: number;
  sow_start: string;
  sow_end: string;
  extended_end: string | null;
  extension_probability: number | null;
  status: string;
  consultants: { first_name: string; last_name: string; level: string } | null;
  clients: { name: string } | null;
}

export interface MonthlyBilling {
  consultantId: string;
  consultantName: string;
  level: string;
  client: string;
  dealName: string;
  rate: number;
  status: string;
  probability: number;
  sowEnd: string;
  months: Record<number, { workingDays: number; billing: number }>;
  annualTotal: number;
  engagementId: string;
}

function workingDaysInRange(
  start: Date,
  end: Date,
  holidaySet: Set<string>
): number {
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    const dateStr = cursor.toISOString().split('T')[0];
    if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// In-memory cache: avoids redundant DB queries + computation within same request cycle
const forecastCache: Record<string, { data: MonthlyBilling[]; ts: number }> = {};
const CACHE_TTL = 60_000; // 60 seconds

export async function getForecast(year: number, includeAll = false): Promise<MonthlyBilling[]> {
  const cacheKey = `${year}-${includeAll}`;
  const cached = forecastCache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  const db = getSupabase();

  let engQuery = db
    .from('engagements')
    .select(`
      id, consultant_id, client_id, deal_name, rate,
      sow_start, sow_end, extended_end, extension_probability, status,
      consultants (first_name, last_name, level),
      clients (name)
    `);
  if (!includeAll) engQuery = engQuery.neq('status', 'closed');

  const [engResult, holResult] = await Promise.all([
    engQuery,
    db
      .from('holidays')
      .select('date, consultant_id')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`),
  ]);

  const engagements = (engResult.data ?? []) as unknown as EngagementRow[];
  const holidays = holResult.data ?? [];

  // Build per-consultant holiday sets (public holidays have consultant_id = null)
  const publicHolidays = new Set(
    holidays.filter(h => !h.consultant_id).map(h => h.date)
  );
  const consultantHolidays: Record<string, Set<string>> = {};
  for (const h of holidays.filter(h => h.consultant_id)) {
    if (!consultantHolidays[h.consultant_id!]) {
      consultantHolidays[h.consultant_id!] = new Set();
    }
    consultantHolidays[h.consultant_id!].add(h.date);
  }

  const results = engagements.map(eng => {
    const consultant = eng.consultants as unknown as { first_name: string; last_name: string; level: string };
    const client = eng.clients as unknown as { name: string } | null;
    const probability = eng.status === 'extension' ? (eng.extension_probability ?? 1) : 1;
    const effectiveEnd = eng.status === 'extension' && eng.extended_end ? eng.extended_end : eng.sow_end;

    // Build combined holiday set for this consultant
    const personalHols = consultantHolidays[eng.consultant_id] ?? new Set<string>();
    const allHolidays = new Set([...publicHolidays, ...personalHols]);

    const months: Record<number, { workingDays: number; billing: number }> = {};
    let annualTotal = 0;

    for (let m = 1; m <= 12; m++) {
      const monthStart = new Date(year, m - 1, 1);
      const monthEnd = new Date(year, m, 0);
      const sowStart = new Date(eng.sow_start);
      const sowEnd = new Date(effectiveEnd);

      // Engagement must overlap this month
      if (sowStart > monthEnd || sowEnd < monthStart) {
        months[m] = { workingDays: 0, billing: 0 };
        continue;
      }

      const rangeStart = sowStart > monthStart ? sowStart : monthStart;
      const rangeEnd = sowEnd < monthEnd ? sowEnd : monthEnd;
      const workingDays = workingDaysInRange(rangeStart, rangeEnd, allHolidays);
      const billing = Math.round(workingDays * 8 * eng.rate * probability);

      months[m] = { workingDays, billing };
      annualTotal += billing;
    }

    return {
      consultantId: eng.consultant_id,
      consultantName: `${consultant.first_name} ${consultant.last_name}`,
      level: consultant?.level ?? '',
      client: client?.name ?? '',
      dealName: eng.deal_name ?? '',
      rate: eng.rate,
      status: eng.status,
      probability,
      sowEnd: effectiveEnd,
      months,
      annualTotal,
      engagementId: eng.id,
    };
  });

  forecastCache[cacheKey] = { data: results, ts: Date.now() };
  return results;
}
