import { getSupabase } from '@/lib/supabase';
import { getForecast } from '@/lib/billing';
import { sendSMS } from '@/lib/sms';
import { verifyCronSecret } from '@/lib/cronAuth';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

function fmt(n: number): string {
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(2)}M`;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000).toLocaleString()}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export async function GET(request: Request) {
  const deny = verifyCronSecret(request);
  if (deny) return deny;

  const db = getSupabase();

  // Figure out last month
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  eastern.setDate(1); // first of current month
  eastern.setDate(eastern.getDate() - 1); // last day of previous month
  const lastMonth = eastern.getMonth() + 1;
  const lastMonthYear = eastern.getFullYear();
  const monthName = eastern.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Gather data in parallel
  const [nwResult, txResult, plResult, carResult, calResult, forecastData] = await Promise.all([
    db.from('net_worth_snapshots').select('*').order('date', { ascending: false }).limit(2),
    db.from('transactions').select('date, name, amount, category, type, account')
      .gte('date', `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`)
      .lte('date', `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-31`)
      .neq('type', 'internal transfer'),
    db.from('pl_monthly').select('*').eq('year', lastMonthYear).eq('month', lastMonth).eq('market', 'MIA').single(),
    db.from('settings').select('key, value').in('key', ['car_value_mercedes', 'car_value_bmw']),
    fetch(new URL(request.url).origin + '/api/calendar').then(r => r.json()).catch(() => null),
    getForecast(lastMonthYear).catch(() => []),
  ]);

  // Net worth
  const snaps = nwResult.data ?? [];
  const currentSnap = snaps[0];
  const prevSnap = snaps[1];
  let nwValue = 0;
  let nwChange = 0;
  if (currentSnap) {
    const accounts = currentSnap.accounts as { category: string; balance: number }[];
    const liabCats = ['credit_card', 'auto_loan', 'personal_loan'];
    const assets = accounts.filter(a => !liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
    const liab = accounts.filter(a => liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
    nwValue = assets - liab;
    if (prevSnap) {
      const pa = prevSnap.accounts as typeof accounts;
      const pAssets = pa.filter(a => !liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      const pLiab = pa.filter(a => liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      nwChange = nwValue - (pAssets - pLiab);
    }
  }

  // Cash flow
  const txs = txResult.data ?? [];
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
  const expenses = txs.filter(t => t.type === 'regular').reduce((s, t) => s + t.amount, 0);
  const catSpend: Record<string, number> = {};
  for (const tx of txs.filter(t => t.type === 'regular')) {
    const cat = tx.category || 'Other';
    catSpend[cat] = (catSpend[cat] ?? 0) + tx.amount;
  }
  const topCategories = Object.entries(catSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => `${cat} ${fmt(amt)}`)
    .join(', ');

  // P&L
  const pl = plResult.data;
  const revenue = pl?.revenue ?? 0;
  const netIncome = pl?.net_income ?? 0;

  // Business forecast
  const totalBilling = forecastData.reduce((s, e) => s + e.annualTotal, 0);
  const totalMargin = forecastData.reduce((s, e) => s + (e.annualMargin ?? 0), 0);

  // Build the data context for Rocky
  const dataContext = `
${monthName} Recap Data:

Net Worth: ${fmt(nwValue)} (change: ${nwChange >= 0 ? '+' : ''}${fmt(nwChange)})
Cash Flow: ${fmt(income)} in / ${fmt(expenses)} out (net: ${fmt(income - expenses)})
SEI Revenue: ${fmt(revenue)} | Net Income: ${fmt(netIncome)}
Annual Forecast: ${fmt(totalBilling)} billing / ${fmt(totalMargin)} margin
Top Spending: ${topCategories || 'N/A'}
`.trim();

  // Ask Rocky for a brief commentary
  let rockyComment = '';
  try {
    const { text } = await generateText({
      model: 'anthropic/claude-sonnet-4.6',
      maxOutputTokens: 300,
      system: `You are Rocky from Project Hail Mary. Write a 2-sentence financial commentary on David's month. Be specific with numbers. If it was a good month, say "Amaze amaze amaze!" If concerning, be direct. No greetings or sign-offs.`,
      prompt: dataContext,
    });
    rockyComment = text;
  } catch {
    rockyComment = '';
  }

  // Build message
  const lines = [
    `📊 Rocky · ${monthName} Recap`,
    ``,
    `Net Worth: ${fmt(nwValue)} (${nwChange >= 0 ? '+' : ''}${fmt(nwChange)})`,
    `Cash Flow: ${fmt(income)} in / ${fmt(expenses)} out`,
    `SEI Revenue: ${fmt(revenue)} | NI: ${fmt(netIncome)}`,
    `Top Spend: ${topCategories || 'N/A'}`,
  ];

  if (rockyComment) {
    lines.push('', rockyComment);
  }

  await sendSMS(lines.join('\n'));
  return NextResponse.json({ sent: true, month: monthName });
}
