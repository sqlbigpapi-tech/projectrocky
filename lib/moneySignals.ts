import { getSupabase } from './supabase';

export type Tx = {
  date: string;
  name: string;
  amount: number;
  category: string | null;
  account: string | null;
};

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\d+/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function easternDateStr(offsetDays = 0): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchTransactions(startDate: string, endDate: string): Promise<Tx[]> {
  const db = getSupabase();
  const rows: Tx[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await db
      .from('transactions')
      .select('date, name, amount, category, account')
      .eq('type', 'regular')
      .neq('status', 'pending')
      .gt('amount', 0)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as Tx[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

export type DailyMoneySignals = {
  yesterday: string;
  largeCharges: Tx[];
  newMerchants: Tx[];
  possibleDupes: { tx: Tx; partner: Tx }[];
  categoryAlerts: { category: string; weekSpend: number; avg: number; ratio: number }[];
};

const LARGE_THRESHOLD = 500;
const HISTORY_DAYS = 180;
const CATEGORY_HOT_RATIO = 1.5;

export async function getDailyMoneySignals(): Promise<DailyMoneySignals> {
  const yesterday = easternDateStr(-1);
  const historyStart = easternDateStr(-HISTORY_DAYS);

  const rows = await fetchTransactions(historyStart, yesterday);
  const yesterdayTxs = rows.filter(t => t.date === yesterday);
  const historyTxs = rows.filter(t => t.date < yesterday);

  // Build merchant history set (normalized names seen before yesterday)
  const seenMerchants = new Set<string>();
  for (const t of historyTxs) {
    const key = normalizeName(t.name);
    if (key) seenMerchants.add(key);
  }

  // Large charges
  const largeCharges = yesterdayTxs
    .filter(t => Number(t.amount) >= LARGE_THRESHOLD)
    .sort((a, b) => Number(b.amount) - Number(a.amount));

  // New merchants — never seen before today
  const newMerchants: Tx[] = [];
  const yesterdayMerchantsSeen = new Set<string>();
  for (const t of yesterdayTxs) {
    const key = normalizeName(t.name);
    if (!key) continue;
    if (seenMerchants.has(key)) continue;
    if (yesterdayMerchantsSeen.has(key)) continue; // only flag once per merchant
    yesterdayMerchantsSeen.add(key);
    newMerchants.push(t);
  }

  // Possible duplicates: same merchant + amount within 5% + same day
  const possibleDupes: { tx: Tx; partner: Tx }[] = [];
  const dupeSeen = new Set<string>();
  for (let i = 0; i < yesterdayTxs.length; i++) {
    for (let j = i + 1; j < yesterdayTxs.length; j++) {
      const a = yesterdayTxs[i];
      const b = yesterdayTxs[j];
      if (normalizeName(a.name) !== normalizeName(b.name)) continue;
      const ratio = Math.abs(Number(a.amount) - Number(b.amount)) / Math.max(Number(a.amount), Number(b.amount));
      if (ratio > 0.05) continue;
      const key = `${normalizeName(a.name)}-${a.amount}`;
      if (dupeSeen.has(key)) continue;
      dupeSeen.add(key);
      possibleDupes.push({ tx: a, partner: b });
    }
  }

  // Category trending hot: rolling 7-day vs. 90-day daily average
  const sevenDayStart = easternDateStr(-7);
  const ninetyDayStart = easternDateStr(-90);
  const last7 = rows.filter(t => t.date >= sevenDayStart && t.date <= yesterday);
  const last90 = rows.filter(t => t.date >= ninetyDayStart && t.date <= yesterday);

  const byCategory7: Record<string, number> = {};
  for (const t of last7) {
    if (!t.category) continue;
    byCategory7[t.category] = (byCategory7[t.category] ?? 0) + Number(t.amount);
  }
  const byCategory90: Record<string, number> = {};
  for (const t of last90) {
    if (!t.category) continue;
    byCategory90[t.category] = (byCategory90[t.category] ?? 0) + Number(t.amount);
  }

  const categoryAlerts: DailyMoneySignals['categoryAlerts'] = [];
  for (const [cat, weekSpend] of Object.entries(byCategory7)) {
    if (weekSpend < 100) continue; // ignore trivial categories
    const dailyAvg90 = (byCategory90[cat] ?? 0) / 90;
    const weeklyAvg90 = dailyAvg90 * 7;
    if (weeklyAvg90 < 50) continue;
    const ratio = weekSpend / weeklyAvg90;
    if (ratio >= CATEGORY_HOT_RATIO) {
      categoryAlerts.push({
        category: cat,
        weekSpend: Math.round(weekSpend),
        avg: Math.round(weeklyAvg90),
        ratio: Math.round(ratio * 10) / 10,
      });
    }
  }
  categoryAlerts.sort((a, b) => b.ratio - a.ratio);

  return { yesterday, largeCharges, newMerchants, possibleDupes, categoryAlerts };
}

export function formatDailyMoneyBlock(signals: DailyMoneySignals): string[] {
  const { largeCharges, newMerchants, possibleDupes, categoryAlerts } = signals;
  if (!largeCharges.length && !newMerchants.length && !possibleDupes.length && !categoryAlerts.length) {
    return [];
  }
  const out: string[] = ['\n💳 Yesterday\'s money'];
  for (const t of largeCharges.slice(0, 3)) {
    out.push(`• Large: $${Math.round(Number(t.amount))} at ${t.name}`);
  }
  for (const t of newMerchants.slice(0, 3)) {
    out.push(`• New merchant: $${Math.round(Number(t.amount))} at ${t.name} — recognize this?`);
  }
  for (const { tx } of possibleDupes.slice(0, 2)) {
    out.push(`• Possible dup: ${tx.name} $${Math.round(Number(tx.amount))} twice`);
  }
  for (const a of categoryAlerts.slice(0, 2)) {
    out.push(`• ${a.category} hot: $${a.weekSpend} this week (${a.ratio}× avg)`);
  }
  return out;
}

export type WeeklyMoneySignals = {
  weekStart: string;
  weekEnd: string;
  totalSpend: number;
  prevWeekSpend: number;
  topCategories: { category: string; amount: number }[];
  topMerchants: { name: string; amount: number; count: number }[];
  biggestCharge: Tx | null;
  newSubscriptions: { merchant: string; amount: number; cadence: string; firstSeen: string }[];
  activeSubscriptionsCount: number;
  activeSubscriptionsMonthly: number;
};

export async function getWeeklyMoneySignals(baseUrl: string): Promise<WeeklyMoneySignals> {
  const weekEnd = easternDateStr(-1);    // yesterday (Sunday cron runs Sun morning = fresh Sun eve data not yet in)
  const weekStart = easternDateStr(-7);
  const prevWeekStart = easternDateStr(-14);
  const prevWeekEnd = easternDateStr(-8);

  const [thisWeek, prevWeek] = await Promise.all([
    fetchTransactions(weekStart, weekEnd),
    fetchTransactions(prevWeekStart, prevWeekEnd),
  ]);

  const totalSpend = Math.round(thisWeek.reduce((s, t) => s + Number(t.amount), 0));
  const prevWeekSpend = Math.round(prevWeek.reduce((s, t) => s + Number(t.amount), 0));

  const byCategory: Record<string, number> = {};
  for (const t of thisWeek) {
    if (!t.category) continue;
    byCategory[t.category] = (byCategory[t.category] ?? 0) + Number(t.amount);
  }
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount: Math.round(amount) }));

  const byMerchant: Record<string, { amount: number; count: number; name: string }> = {};
  for (const t of thisWeek) {
    const key = normalizeName(t.name);
    if (!key) continue;
    if (!byMerchant[key]) byMerchant[key] = { amount: 0, count: 0, name: t.name };
    byMerchant[key].amount += Number(t.amount);
    byMerchant[key].count += 1;
  }
  const topMerchants = Object.values(byMerchant)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(m => ({ name: m.name, amount: Math.round(m.amount), count: m.count }));

  const biggestCharge = thisWeek.length > 0
    ? thisWeek.reduce((max, t) => Number(t.amount) > Number(max.amount) ? t : max)
    : null;

  // Subscription signals — reuse the existing /api/subscriptions endpoint
  let newSubscriptions: WeeklyMoneySignals['newSubscriptions'] = [];
  let activeSubscriptionsCount = 0;
  let activeSubscriptionsMonthly = 0;
  try {
    const res = await fetch(`${baseUrl}/api/subscriptions`, { cache: 'no-store' });
    if (res.ok) {
      type SubResponse = {
        subscriptions: { merchant: string; cadence: string; amount: number; firstSeen: string; active: boolean }[];
        summary: { active_count: number; active_monthly_total: number };
      };
      const j = (await res.json()) as SubResponse;
      const subs = j.subscriptions ?? [];
      const thirtyAgo = easternDateStr(-30);
      newSubscriptions = subs
        .filter(s => s.active && s.firstSeen >= thirtyAgo)
        .map(s => ({ merchant: s.merchant, amount: s.amount, cadence: s.cadence, firstSeen: s.firstSeen }));
      activeSubscriptionsCount = j.summary?.active_count ?? 0;
      activeSubscriptionsMonthly = j.summary?.active_monthly_total ?? 0;
    }
  } catch { /* non-critical */ }

  return {
    weekStart, weekEnd,
    totalSpend, prevWeekSpend,
    topCategories, topMerchants, biggestCharge,
    newSubscriptions, activeSubscriptionsCount, activeSubscriptionsMonthly,
  };
}

export function formatWeeklyMoneyBlock(signals: WeeklyMoneySignals): string[] {
  const {
    totalSpend, prevWeekSpend, topCategories, topMerchants, biggestCharge,
    newSubscriptions, activeSubscriptionsCount, activeSubscriptionsMonthly,
  } = signals;

  const out: string[] = ['💰 Rocky · Weekly Money Recap'];

  const delta = prevWeekSpend > 0
    ? Math.round(((totalSpend - prevWeekSpend) / prevWeekSpend) * 100)
    : 0;
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  out.push(`\nSpent $${totalSpend.toLocaleString()} this week ${arrow}${Math.abs(delta)}% vs. last`);

  if (topCategories.length > 0) {
    out.push(`\nTop categories:`);
    topCategories.forEach(c => out.push(`• ${c.category} — $${c.amount.toLocaleString()}`));
  }

  if (topMerchants.length > 0) {
    out.push(`\nTop merchants:`);
    topMerchants.forEach(m => out.push(`• ${m.name} — $${m.amount.toLocaleString()} (${m.count}×)`));
  }

  if (biggestCharge) {
    out.push(`\nBiggest single charge: $${Math.round(Number(biggestCharge.amount))} at ${biggestCharge.name}`);
  }

  if (activeSubscriptionsCount > 0) {
    out.push(`\n${activeSubscriptionsCount} active subs · $${Math.round(activeSubscriptionsMonthly).toLocaleString()}/mo`);
  }
  if (newSubscriptions.length > 0) {
    out.push(`\nNew recurring (last 30d):`);
    newSubscriptions.slice(0, 5).forEach(s => out.push(`• ${s.merchant} — $${s.amount}/${s.cadence}, since ${s.firstSeen}`));
  }

  return out;
}
