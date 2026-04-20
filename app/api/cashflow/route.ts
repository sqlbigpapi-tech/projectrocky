import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Fetch all rows for a year in pages (supabase caps at 1000 per call).
async function fetchAllForYear(supabase: ReturnType<typeof getSupabase>, year: number) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const PAGE = 1000;
  const out: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .gte("date", yearStart)
      .lte("date", yearEnd)
      .neq("type", "internal transfer")
      .neq("status", "pending")
      .order("date", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    if (!yearParam) {
      return NextResponse.json({ error: "Query parameter 'year' is required." }, { status: 400 });
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      return NextResponse.json({ error: "Invalid year." }, { status: 400 });
    }

    let month: number | null = null;
    if (monthParam) {
      month = parseInt(monthParam, 10);
      if (isNaN(month) || month < 1 || month > 12) {
        return NextResponse.json({ error: "Invalid month. Must be 1-12." }, { status: 400 });
      }
    }

    const supabase = getSupabase();
    const rows = await fetchAllForYear(supabase, year);

    // Income convention note: Copilot exports income as NEGATIVE amounts.
    // Regular expenses are positive; refunds are negative regular amounts.
    // Internal transfers (bank↔bank, bank↔credit-card payments) are already excluded at the query level.

    // ---- Monthly Summary ----
    const monthlyMap = new Map<number, { income: number; expenses: number }>();
    for (let m = 1; m <= 12; m++) monthlyMap.set(m, { income: 0, expenses: 0 });

    for (const tx of rows) {
      const txMonth = new Date(String(tx.date)).getMonth() + 1;
      const entry = monthlyMap.get(txMonth)!;
      if (tx.type === "income") {
        entry.income += Math.abs(Number(tx.amount));
      } else {
        entry.expenses += Number(tx.amount);
      }
    }

    const monthly_summary = Array.from(monthlyMap.entries()).map(([m, { income, expenses }]) => {
      const net = income - expenses;
      const savings_rate = income > 0 ? Math.round((net / income) * 10000) / 100 : 0;
      return {
        month: m,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        net: Math.round(net * 100) / 100,
        savings_rate,
      };
    });

    // ---- Category Breakdown ----
    const categoryRows = month
      ? rows.filter(tx => new Date(String(tx.date)).getMonth() + 1 === month && tx.type === "regular")
      : rows.filter(tx => tx.type === "regular");

    const categoryMap = new Map<string, number>();
    for (const tx of categoryRows) {
      const cat = String(tx.category ?? "") || "Uncategorized";
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Number(tx.amount));
    }
    const category_breakdown = Array.from(categoryMap.entries())
      .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    // ---- Top Merchants ----
    const merchantMap = new Map<string, { total: number; count: number }>();
    for (const tx of categoryRows) {
      const name = String(tx.name ?? "") || "Unknown";
      const entry = merchantMap.get(name) ?? { total: 0, count: 0 };
      entry.total += Number(tx.amount);
      entry.count += 1;
      merchantMap.set(name, entry);
    }
    const top_merchants = Array.from(merchantMap.entries())
      .map(([name, { total, count }]) => ({ name, total: Math.round(total * 100) / 100, count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ---- Recent Transactions ----
    let recent: typeof rows | undefined;
    if (month) {
      const monthStr = String(month).padStart(2, "0");
      const lastDay = new Date(year, month, 0).getDate();
      const monthStart = `${year}-${monthStr}-01`;
      const monthEnd = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
      recent = rows.filter(tx => String(tx.date) >= monthStart && String(tx.date) <= monthEnd).slice(0, 20);
    }

    // ---- Totals ----
    const total_income = rows
      .filter(tx => tx.type === "income")
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

    const total_expenses = rows
      .filter(tx => tx.type === "regular")
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const net = total_income - total_expenses;

    // Average across elapsed months (not just months with activity).
    const now = new Date();
    const elapsedMonths = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const avg_monthly_expenses = elapsedMonths > 0
      ? Math.round((total_expenses / elapsedMonths) * 100) / 100
      : 0;

    // Data-quality warnings — positive-amount income suggests a clawback/reversal.
    const warnings: string[] = [];
    const clawbacks = rows.filter(tx => tx.type === "income" && Number(tx.amount) > 0);
    if (clawbacks.length > 0) {
      warnings.push(`${clawbacks.length} income row(s) have positive amounts (possible reversals)`);
    }

    const totals = {
      total_income: Math.round(total_income * 100) / 100,
      total_expenses: Math.round(total_expenses * 100) / 100,
      net: Math.round(net * 100) / 100,
      avg_monthly_expenses,
    };

    return NextResponse.json({
      monthly_summary,
      category_breakdown,
      top_merchants,
      ...(recent !== undefined ? { recent } : {}),
      totals,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to fetch cashflow data: ${message}` }, { status: 500 });
  }
}
