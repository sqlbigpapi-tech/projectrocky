import { getSupabase } from './supabase';
import { getForecast, MonthlyBilling } from './billing';

const plCache: Record<string, { data: any[]; ts: number }> = {};
const PL_CACHE_TTL = 60_000;

// Cost assumptions for forecast months — CONSERVATIVE
// Prefer overestimating costs so actuals beat forecast
const BENEFITS_TAX_RATE = 0.17;       // 17% burden on all wages (actuals ~15%, padding for PTO/misc)
const MGMT_SALARY_MONTHLY = 65000;    // ~$780K/yr management salaries (actual avg $60K, pad up)
const PROFIT_SHARE_RATE = 0.015;      // 1.5% of revenue (actual ~1.3%, pad up)
const LOCAL_ADMIN_MONTHLY = 55000;    // avg from actuals ~$50K, pad up
const SHARED_SERVICES_MONTHLY = 56000; // avg from actuals ~$53K, pad up
const BENCH_COST_MONTHLY = 55000;     // salaried people not billing — avg from actuals

function calcForecastCosts(
  billingForecast: MonthlyBilling[],
  month: number,
  revenue: number,
) {
  // Sum wages by level from billing forecast
  let principalWages = 0;
  let seniorWages = 0;
  let consultantWages = 0;
  let subcontractorFees = 0;

  for (const eng of billingForecast) {
    const m = eng.months[month];
    if (!m || m.billing === 0) continue;

    const cost = m.cost;
    switch (eng.level) {
      case 'Principal':
      case 'Managing Principal':
        principalWages += cost;
        break;
      case 'Senior Consultant':
        seniorWages += cost;
        break;
      case 'Consultant':
        consultantWages += cost;
        break;
      case 'Associate':
        subcontractorFees += cost;
        break;
    }
  }

  const totalWages = principalWages + seniorWages + consultantWages;
  const benefitsTaxes = Math.round(totalWages * BENEFITS_TAX_RATE);
  const profitShare = Math.round(revenue * PROFIT_SHARE_RATE);
  const consLabor = principalWages + seniorWages + consultantWages + subcontractorFees + profitShare + benefitsTaxes + BENCH_COST_MONTHLY;
  const sga = LOCAL_ADMIN_MONTHLY + SHARED_SERVICES_MONTHLY + MGMT_SALARY_MONTHLY;

  return {
    principal_wages: principalWages,
    senior_wages: seniorWages,
    consultant_wages: consultantWages,
    subcontractor_fees: subcontractorFees,
    benefits_taxes: benefitsTaxes,
    profit_share: profitShare,
    mgmt_salaries: MGMT_SALARY_MONTHLY,
    local_admin: LOCAL_ADMIN_MONTHLY,
    shared_services: SHARED_SERVICES_MONTHLY,
    cons_labor: consLabor,
    sga,
  };
}

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
      // Actuals: use stored breakdown as-is, locked
      return {
        ...pl,
        revenue: income.revenue != null ? Math.round(income.revenue) : pl.revenue,
        net_income: Math.round(income.actual!),
        is_forecast: false,
        _source: 'actual' as const,
      };
    }

    // Forecast: calculate from billing forecast, but respect manual overrides
    const projectedRevenue = billingByMonth[pl.month] ?? 0;
    const calc = calcForecastCosts(billingForecast, pl.month, projectedRevenue || pl.revenue);

    // Use manual value if set (non-zero in DB), otherwise use calculated
    const revenue = pl.revenue > 0 ? pl.revenue : (projectedRevenue || 0);
    const consLabor = pl.cons_labor > 0 ? pl.cons_labor : calc.cons_labor;
    const sga = pl.sga > 0 ? pl.sga : calc.sga;
    const profitShare = pl.profit_share > 0 ? pl.profit_share : calc.profit_share;

    // Always recalculate net income from the final numbers
    const netIncome = revenue - consLabor - sga;

    // Fill in sub-fields from calc if not manually set
    return {
      ...pl,
      revenue,
      principal_wages: pl.principal_wages > 0 ? pl.principal_wages : calc.principal_wages,
      senior_wages: pl.senior_wages > 0 ? pl.senior_wages : calc.senior_wages,
      consultant_wages: pl.consultant_wages > 0 ? pl.consultant_wages : calc.consultant_wages,
      subcontractor_fees: pl.subcontractor_fees > 0 ? pl.subcontractor_fees : calc.subcontractor_fees,
      benefits_taxes: pl.benefits_taxes > 0 ? pl.benefits_taxes : calc.benefits_taxes,
      mgmt_salaries: pl.mgmt_salaries > 0 ? pl.mgmt_salaries : calc.mgmt_salaries,
      local_admin: pl.local_admin > 0 ? pl.local_admin : calc.local_admin,
      shared_services: pl.shared_services > 0 ? pl.shared_services : calc.shared_services,
      cons_labor: consLabor,
      sga,
      profit_share: profitShare,
      net_income: netIncome,
      is_forecast: true,
      _source: 'forecast' as const,
    };
  });

  plCache[cacheKey] = { data: merged, ts: Date.now() };
  return merged;
}
