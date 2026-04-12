import { getSupabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { createInflateRaw } from 'zlib';

// Minimal xlsx parser — no dependencies
async function parseXlsx(buffer: ArrayBuffer) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  // Shared strings
  const ssXml = await zip.file('xl/sharedStrings.xml')?.async('string') ?? '';
  const strings = [...ssXml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(m => m[1]);

  // Find MIA sheet
  const wbXml = await zip.file('xl/workbook.xml')?.async('string') ?? '';
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string') ?? '';

  const relMap: Record<string, string> = {};
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relMap[m[1]] = m[2];
  }

  const sheetEntries = [...wbXml.matchAll(/<sheet name="([^"]+)"[^>]*r:id="([^"]+)"/g)];
  const nameToFile: Record<string, string> = {};
  for (const m of sheetEntries) {
    if (relMap[m[2]]) nameToFile[m[1]] = 'xl/' + relMap[m[2]];
  }

  const miaKey = Object.keys(nameToFile).find(n => n.toUpperCase().includes('MIA'));
  if (!miaKey) return { error: 'No MIA sheet found', sheets: Object.keys(nameToFile) };

  const sheetXml = await zip.file(nameToFile[miaKey])?.async('string') ?? '';

  // Parse cells
  const data: Record<string, string> = {};
  const cellRegex = /<c r="([^"]+)"([^>]*)>([\s\S]*?)<\/c>/g;
  for (const m of sheetXml.matchAll(cellRegex)) {
    const [, ref, attrs, inner] = m;
    const t = attrs.match(/t="([^"]+)"/)?.[1] ?? '';
    const v = inner.match(/<v>([^<]*)<\/v>/)?.[1];
    if (!v) continue;
    if (t === 's') {
      const idx = parseInt(v);
      data[ref] = idx < strings.length ? strings[idx] : v;
    } else {
      data[ref] = v;
    }
  }

  return { data, sheets: Object.keys(nameToFile) };
}

// Detect worksheet year from cell content
function detectYear(data: Record<string, string>): number {
  // Check common locations for year: B2 often has "2026 Actuals" etc.
  for (const ref of ['B2', 'A1', 'B1', 'A2']) {
    const v = data[ref] ?? '';
    const match = v.match(/(20\d{2})/);
    if (match) return parseInt(match[1]);
  }
  return new Date().getFullYear();
}

export async function POST(request: Request) {
  const db = getSupabase();

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const market = (formData.get('market') as string) ?? 'MIA';

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const result = await parseXlsx(buffer);

  if ('error' in result) {
    return NextResponse.json({ error: result.error, sheets: result.sheets }, { status: 400 });
  }

  const { data } = result;
  const year = detectYear(data);

  // Column mapping: C=month1(Jan), D=month2(Feb), ..., N=month12(Dec)
  const cols = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

  // Key rows in the MIA worksheet
  const ROW = { revenue: 23, sga: 29, cons_labor: 38, net_income: 42, stock_purchases: 21 };

  const updates: Array<{ month: number; revenue: number; sga: number; cons_labor: number; net_income: number; stock_purchases: number }> = [];

  for (let i = 0; i < 12; i++) {
    const col = cols[i];
    const month = i + 1;

    const revenue = parseFloat(data[`${col}${ROW.revenue}`] ?? '0');
    const sga = parseFloat(data[`${col}${ROW.sga}`] ?? '0');
    const consLabor = parseFloat(data[`${col}${ROW.cons_labor}`] ?? '0');
    const netIncome = parseFloat(data[`${col}${ROW.net_income}`] ?? '0');
    const stockPurchases = parseFloat(data[`${col}${ROW.stock_purchases}`] ?? '0');

    // Skip months with no data
    if (revenue === 0 && netIncome === 0) continue;

    updates.push({
      month,
      revenue: Math.round(revenue),
      sga: Math.round(sga),
      cons_labor: Math.round(consLabor),
      net_income: Math.round(netIncome),
      stock_purchases: Math.round(stockPurchases),
    });
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No data found in MIA sheet' }, { status: 400 });
  }

  // Update both pl_monthly and income_tracker
  const results: string[] = [];

  for (const u of updates) {
    const now = new Date().toISOString();

    // Update pl_monthly
    const { error: plErr } = await db
      .from('pl_monthly')
      .upsert({
        year,
        month: u.month,
        market,
        revenue: u.revenue,
        sga: u.sga,
        cons_labor: u.cons_labor,
        net_income: u.net_income,
        stock_purchases: u.stock_purchases,
        is_forecast: false,
        updated_at: now,
      }, { onConflict: 'year,month,market' });

    // Update income_tracker
    const { error: itErr } = await db
      .from('income_tracker')
      .update({
        actual: u.net_income,
        revenue: u.revenue,
        is_forecast: false,
        updated_at: now,
      })
      .eq('year', year)
      .eq('month', u.month)
      .eq('market', market);

    if (plErr || itErr) {
      results.push(`Month ${u.month}: error — ${plErr?.message ?? ''} ${itErr?.message ?? ''}`);
    } else {
      results.push(`Month ${u.month}: Rev $${u.revenue.toLocaleString()} | SGA $${u.sga.toLocaleString()} | CL $${u.cons_labor.toLocaleString()} | NI $${u.net_income.toLocaleString()}`);
    }
  }

  return NextResponse.json({
    year,
    market,
    monthsUpdated: updates.length,
    details: results,
  });
}
