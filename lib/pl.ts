import { getSupabase } from './supabase';
import { getForecast } from './billing';

const plCache: Record<string, { data: any[]; ts: number }> = {};
const PL_CACHE_TTL = 60_000;

export async function getMergedPL(year: number, market: string) {
  const cacheKey = `${year}-${market}`;
  const cached = plCache[cacheKey];
  if (cached && Date.now() - cached.ts < PL_CACHE_TTL) return cached.data;
  const db = getSupabase();

  const [plResult, incomeResult, billingForecast] = await Promise.all([
    db.from('pl_monthly').select('*').eq('year', year).eq('market', market).order('month'),
    db.from('income_tracker').select('month, actual, revenue, is_forecast').eq('year', year).eq('market', market),
    getForecast(year).catch(() => []),
  ]);

  const plRows = plResult.data ?? [];
  const incomeRows = incomeResult.data ?? [];

  const incomeByMonth: Record<number, { actual: number | null; revenue: number | null; is_forecast: boolean }> = {};
  for (const r of incomeRows) {
    incomeByMonth[r.month] = r;
  }

  const billingByMonth: Record<number, number> = {};
  for (const eng of billingForecast) {
    for (let m = 1; m <= 12; m++) {
      billingByMonth[m] = (billingByMonth[m] ?? 0) + (eng.months[m]?.billing ?? 0);
    }
  }

  const merged = plRows.map(pl => {
    const income = incomeByMonth[pl.month];
    const hasActual = income?.actual != null;

    if (hasActual) {
      return {
        ...pl,
        revenue: income.revenue != null ? Math.round(income.revenue) : pl.revenue,
        net_income: Math.round(income.actual!),
        is_forecast: false,
        _source: 'actual' as const,
      };
    }

    const projectedRevenue = billingByMonth[pl.month] ?? 0;
    const revenue = projectedRevenue > 0 ? projectedRevenue : pl.revenue;
    const prePS = revenue - pl.sga - pl.cons_labor;
    const profitShare = Math.round(prePS * 0.1);
    const netIncome = prePS - profitShare;

    return {
      ...pl,
      revenue,
      profit_share: profitShare,
      net_income: netIncome,
      is_forecast: true,
      _source: 'forecast' as const,
    };
  });

  plCache[cacheKey] = { data: merged, ts: Date.now() };
  return merged;
}
