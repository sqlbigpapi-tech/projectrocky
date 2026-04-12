import { getSupabase } from '@/lib/supabase';
import { getMergedPL } from '@/lib/pl';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const db = getSupabase();
  const { searchParams } = await new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? '2026');
  const market = searchParams.get('market') ?? 'MIA';

  const [currentMonths, priorYear, priorYear2, settings] = await Promise.all([
    getMergedPL(year, market),
    db.from('pl_monthly').select('*').eq('year', year - 1).eq('market', market).order('month'),
    db.from('pl_monthly').select('*').eq('year', year - 2).eq('market', market).order('month'),
    db.from('settings').select('key, value').in('key', ['equity_shares', 'equity_retained']),
  ]);

  const priorMonths = priorYear.data ?? [];
  const priorMonths2 = priorYear2.data ?? [];
  const allMonths = [...priorMonths2, ...priorMonths, ...currentMonths];

  const settingsMap: Record<string, string> = {};
  (settings.data ?? []).forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value; });

  const totalShares = parseFloat(settingsMap['equity_shares'] || '12900');
  const retainedEarnings = parseFloat(settingsMap['equity_retained'] || '576280');

  const months = currentMonths.map((m) => {
    const nisp = m.net_income + (m.stock_purchases ?? 0);

    // Trailing 12 months: sum net_income only (stock purchases go into retained separately)
    const t12Months = allMonths.filter(pm => {
      const pmDate = pm.year * 12 + pm.month;
      const thisDate = m.year * 12 + m.month;
      return pmDate > thisDate - 12 && pmDate <= thisDate;
    });
    const trailing12 = t12Months.reduce(
      (s: number, pm: { net_income: number }) => s + pm.net_income,
      0
    );

    // Valuation = 5x T12 + Retained Earnings Balance
    const valuation = (5 * trailing12) + retainedEarnings;
    const sharePrice = totalShares > 0 ? valuation / totalShares : 0;
    const distributable = nisp > 0 ? nisp * 0.8 : 0;
    const eps = totalShares > 0 ? nisp / totalShares : 0;
    const dividendPerShare = totalShares > 0 ? distributable / totalShares : 0;

    return {
      month: m.month,
      netIncome: m.net_income,
      stockPurchases: m.stock_purchases ?? 0,
      nisp,
      isForecast: m.is_forecast,
      trailing12,
      valuation,
      sharePrice,
      eps,
      dividendPerShare,
      retainedEarnings,
    };
  });

  const latestActual = [...months].reverse().find(m => !m.isForecast) ?? months[months.length - 1];

  return NextResponse.json({
    months,
    totalShares,
    retainedEarnings,
    latest: latestActual,
  });
}
