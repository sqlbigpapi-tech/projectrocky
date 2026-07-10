import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const FILE = '/Users/davidortiz/Downloads/2026-06_Worksheet.xlsx';
const YEAR = 2026;
const MARKETS = ['ATL', 'BOS', 'CIN', 'CLT', 'CHI', 'DAL', 'MIA', 'NSH', 'NYC', 'PHL', 'PHX', 'SEA', 'WDC'];

// Office sheets use col B for labels (col A is empty), cols C-N for Jan-Dec.
const LABEL_COL = 1;
const MONTH_COL_START = 2;

function findRow(ws: any, label: string, after = 0, before = Infinity): number {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const max = Math.min(range.e.r, before);
  for (let r = after; r <= max; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: LABEL_COL })]?.v;
    if (typeof cell === 'string' && cell.trim() === label) return r;
  }
  return -1;
}

function getMonthly(ws: any, row: number): number[] {
  if (row < 0) return new Array(12).fill(0);
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    const v = ws[XLSX.utils.encode_cell({ r: row, c: MONTH_COL_START + m })]?.v;
    out.push(typeof v === 'number' ? v : 0);
  }
  return out;
}

type Section = {
  totalRevenue: number[]; billings: number[]; unitPurchases: number[];
  localAdmin: number[]; sharedServices: number[]; mgmtSalaries: number[]; totalSGA: number[];
  principal: number[]; senior: number[]; consultant: number[];
  subcontractorFees: number[]; profitSharing: number[]; benefitsTaxes: number[];
  totalConsLabor: number[]; netIncome: number[];
};

function extractSection(ws: any, after: number, before: number): Section {
  const revStart = findRow(ws, 'Revenue:', after, before);
  const sgaStart = findRow(ws, 'SGA:', after, before);
  const clStart = findRow(ws, 'Consultant Labor:', after, before);
  const revEnd = sgaStart > 0 ? sgaStart : before;
  const sgaEnd = clStart > 0 ? clStart : before;
  return {
    totalRevenue:      getMonthly(ws, findRow(ws, 'Total Revenue', revStart, revEnd)),
    billings:          getMonthly(ws, findRow(ws, 'Billings', revStart, revEnd)),
    unitPurchases:     getMonthly(ws, findRow(ws, 'Unit Purchases', revStart, revEnd)),
    localAdmin:        getMonthly(ws, findRow(ws, 'Local Admin', sgaStart, sgaEnd)),
    sharedServices:    getMonthly(ws, findRow(ws, 'Shared Services', sgaStart, sgaEnd)),
    mgmtSalaries:      getMonthly(ws, findRow(ws, 'Mgmt. Salaries', sgaStart, sgaEnd)),
    totalSGA:          getMonthly(ws, findRow(ws, 'Total SGA', sgaStart, sgaEnd)),
    principal:         getMonthly(ws, findRow(ws, 'Principal', clStart, before)),
    senior:            getMonthly(ws, findRow(ws, 'Senior', clStart, before)),
    consultant:        getMonthly(ws, findRow(ws, 'Consultant', clStart, before)),
    subcontractorFees: getMonthly(ws, findRow(ws, 'Subcontractor Fees', clStart, before)),
    profitSharing:     getMonthly(ws, findRow(ws, 'Profit Sharing', clStart, before)),
    benefitsTaxes:     getMonthly(ws, findRow(ws, 'Benefits & Taxes', clStart, before)),
    totalConsLabor:    getMonthly(ws, findRow(ws, 'Total Cons Labor', clStart, before)),
    netIncome:         getMonthly(ws, findRow(ws, 'Net Income', clStart, before)),
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== June 2026 Worksheet Import ${dryRun ? '(DRY RUN)' : ''} ===\n`);

  const wb = XLSX.readFile(FILE);
  const plRows: any[] = [];
  const itRows: any[] = [];

  for (const market of MARKETS) {
    const ws = wb.Sheets[market];
    if (!ws) { console.log(`✗ ${market}: no sheet`); continue; }
    // Some sheets have a typo ("2026Plan" with no space) — match either.
    let planStart = findRow(ws, '2026 Plan');
    if (planStart < 0) planStart = findRow(ws, '2026Plan');
    if (planStart < 0) { console.log(`✗ ${market}: no 2026 Plan section`); continue; }
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

    const actual = extractSection(ws, 0, planStart);
    const plan   = extractSection(ws, planStart, range.e.r);

    let actualMonths = 0;
    for (let m = 1; m <= 12; m++) {
      const i = m - 1;
      const hasActual = actual.totalRevenue[i] > 0;
      if (hasActual) actualMonths++;
      const src = hasActual ? actual : plan;

      plRows.push({
        year: YEAR, month: m, market,
        revenue:            Math.round(src.totalRevenue[i]),
        sga:                Math.round(src.totalSGA[i]),
        cons_labor:         Math.round(src.totalConsLabor[i]),
        local_admin:        Math.round(src.localAdmin[i]),
        shared_services:    Math.round(src.sharedServices[i]),
        mgmt_salaries:      Math.round(src.mgmtSalaries[i]),
        principal_wages:    Math.round(src.principal[i]),
        senior_wages:       Math.round(src.senior[i]),
        consultant_wages:   Math.round(src.consultant[i]),
        subcontractor_fees: Math.round(src.subcontractorFees[i]),
        profit_share:       Math.round(src.profitSharing[i]),
        benefits_taxes:     Math.round(src.benefitsTaxes[i]),
        net_income:         Math.round(src.netIncome[i]),
        stock_purchases:    Math.round(src.unitPurchases[i]),
        is_forecast:        !hasActual,
        notes: '',
        updated_at: new Date().toISOString(),
      });

      itRows.push({
        year: YEAR, month: m, market,
        plan:    Math.round(plan.netIncome[i]),
        actual:  hasActual ? Math.round(actual.netIncome[i]) : null,
        revenue: hasActual ? Math.round(actual.totalRevenue[i]) : Math.round(plan.totalRevenue[i]),
        is_forecast: !hasActual,
        updated_at: new Date().toISOString(),
      });
    }

    const jun = 5;
    console.log(
      `${market}: ${actualMonths}mo actuals | Jun rev $${(actual.totalRevenue[jun]/1000).toFixed(0)}K plan $${(plan.totalRevenue[jun]/1000).toFixed(0)}K | ` +
      `Jun NI $${(actual.netIncome[jun]/1000).toFixed(1)}K plan $${(plan.netIncome[jun]/1000).toFixed(1)}K | ` +
      `FY plan NI $${(plan.netIncome.reduce((a,b)=>a+b,0)/1000).toFixed(0)}K`
    );
  }

  console.log(`\nPrepared ${plRows.length} pl_monthly rows + ${itRows.length} income_tracker rows`);

  if (dryRun) { console.log('\n--dry-run, exiting'); return; }

  console.log('\nDeleting existing 2026 rows for these markets...');
  for (const market of MARKETS) {
    const d1 = await db.from('pl_monthly').delete().eq('year', YEAR).eq('market', market);
    const d2 = await db.from('income_tracker').delete().eq('year', YEAR).eq('market', market);
    if (d1.error) console.error(`  ${market} pl delete:`, d1.error.message);
    if (d2.error) console.error(`  ${market} it delete:`, d2.error.message);
  }

  console.log('Inserting pl_monthly...');
  const r1 = await db.from('pl_monthly').insert(plRows);
  if (r1.error) { console.error('pl_monthly insert:', r1.error); process.exit(1); }

  console.log('Inserting income_tracker...');
  const r2 = await db.from('income_tracker').insert(itRows);
  if (r2.error) { console.error('income_tracker insert:', r2.error); process.exit(1); }

  const { count: plCount } = await db.from('pl_monthly').select('id', { count: 'exact', head: true }).eq('year', YEAR);
  const { count: itCount } = await db.from('income_tracker').select('id', { count: 'exact', head: true }).eq('year', YEAR);
  console.log(`\n✓ pl_monthly: ${plCount} rows (2026)`);
  console.log(`✓ income_tracker: ${itCount} rows (2026)`);

  const { data: miaJun } = await db.from('pl_monthly')
    .select('revenue, sga, cons_labor, net_income, is_forecast')
    .eq('year', YEAR).eq('month', 6).eq('market', 'MIA').single();
  console.log('\nMIA June 2026 sample:', miaJun);
}

main().catch(e => { console.error(e); process.exit(1); });
