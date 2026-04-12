import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as path from 'path';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Simple xlsx parser using Node's built-in zip support
async function parseWorksheet(filePath: string) {
  // Use dynamic import for the unzip
  const { execSync } = await import('child_process');

  // Extract shared strings and MIA sheet using Python (most reliable)
  const script = `
import zipfile, re, json

path = "${filePath}"
with zipfile.ZipFile(path) as z:
    with z.open('xl/sharedStrings.xml') as f:
        ss = f.read().decode()
    strings = re.findall(r'<t[^>]*>([^<]*)</t>', ss)

    with z.open('xl/workbook.xml') as f:
        wb = f.read().decode()
    with z.open('xl/_rels/workbook.xml.rels') as f:
        rels_xml = f.read().decode()
    rel_map = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels_xml))
    sheet_entries = re.findall(r'<sheet name="([^"]+)"[^>]*r:id="([^"]+)"', wb)
    name_to_file = {name: 'xl/' + rel_map[rid] for name, rid in sheet_entries if rid in rel_map}

    if 'MIA' not in name_to_file:
        print(json.dumps({"error": "No MIA sheet"}))
        exit()

    with z.open(name_to_file['MIA']) as f:
        xml = f.read().decode()
    data = {}
    for m in re.finditer(r'<c r="([^"]+)"([^>]*)>(.*?)</c>', xml, re.DOTALL):
        ref, attrs, inner = m.groups()
        t_match = re.search(r't="([^"]+)"', attrs)
        t = t_match.group(1) if t_match else ''
        v_match = re.search(r'<v>([^<]*)</v>', inner)
        if v_match:
            v = v_match.group(1)
            if t == 's':
                idx = int(v)
                data[ref] = strings[idx] if idx < len(strings) else v
            else:
                data[ref] = v
    print(json.dumps(data))
`;

  const result = execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf-8' });
  return JSON.parse(result);
}

// Column map: C=month1, D=month2, E=month3, etc
const MONTH_COLS = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
// Key P&L rows in MIA worksheet
const ROW_MAP = {
  revenue: 23,      // Total Revenue
  sga: 29,          // Total SGA
  cons_labor: 38,   // Total Cons Labor
  net_income: 42,   // Net Income
};

async function sync() {
  const files = [
    { path: '/Users/davidortiz/Downloads/2026-01_Worksheet (1).xlsx', startMonth: 1, monthCount: 1 },
    { path: '/Users/davidortiz/Downloads/2026-02_Worksheet.xlsx', startMonth: 1, monthCount: 2 },
    { path: '/Users/davidortiz/Downloads/2026-03_Worksheet.xlsx', startMonth: 1, monthCount: 3 },
  ];

  // Use the latest (most months) worksheet
  const latest = files[files.length - 1];
  console.log(`Parsing ${latest.path}...`);

  const data = await parseWorksheet(latest.path);
  if (data.error) { console.error(data.error); return; }

  for (let i = 0; i < latest.monthCount; i++) {
    const col = MONTH_COLS[i];
    const month = latest.startMonth + i;

    const revenue = parseFloat(data[`${col}${ROW_MAP.revenue}`] || '0');
    const sga = parseFloat(data[`${col}${ROW_MAP.sga}`] || '0');
    const consLabor = parseFloat(data[`${col}${ROW_MAP.cons_labor}`] || '0');
    const netIncome = parseFloat(data[`${col}${ROW_MAP.net_income}`] || '0');

    if (revenue === 0 && netIncome === 0) {
      console.log(`Month ${month}: skipped (no data)`);
      continue;
    }

    const { error } = await db
      .from('pl_monthly')
      .update({
        revenue: Math.round(revenue),
        sga: Math.round(sga),
        cons_labor: Math.round(consLabor),
        net_income: Math.round(netIncome),
        is_forecast: false,
        updated_at: new Date().toISOString(),
      })
      .eq('year', 2026)
      .eq('month', month)
      .eq('market', 'MIA');

    if (error) {
      console.error(`Month ${month} error:`, error);
    } else {
      console.log(`Month ${month}: Rev=$${Math.round(revenue).toLocaleString()} | SGA=$${Math.round(sga).toLocaleString()} | CL=$${Math.round(consLabor).toLocaleString()} | NI=$${Math.round(netIncome).toLocaleString()}`);
    }
  }

  console.log('Sync complete.');
}

sync();
