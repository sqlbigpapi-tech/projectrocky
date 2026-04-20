import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type SurveyRow = {
  survey_period: string;
  demographic_type: string;
  demographic_value: string;
  respondent_count: number;
  factor: string;
  question: string | null;
  score: number;
};

function parseHeatmap(filePath: string, surveyPeriod: string, demoType: string): SurveyRow[] {
  if (!fs.existsSync(filePath)) { console.log(`  ⚠ Skipping missing: ${filePath}`); return []; }
  console.log(`  Parsing: ${filePath.split('/').pop()}`);

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: SurveyRow[] = [];

  // Find the header row (contains "Overall" in column B area)
  let headerRow = -1;
  let nRow = -1;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]?.v;
      if (typeof cell === 'string' && (cell.includes('Overall') || cell.includes('spread by'))) {
        headerRow = r;
        break;
      }
    }
    const aCell = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (typeof aCell === 'string' && aCell.includes('N (no')) nRow = r;
  }
  if (headerRow === -1) { console.log('    Could not find header row'); return []; }

  // Extract demographic column names
  const demoColumns: { col: number; name: string }[] = [];
  for (let c = 1; c < 50; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })]?.v;
    if (!cell) break;
    const name = String(cell)
      .replace(/^SEI - /, '').replace(/ LLC$/, '')
      .replace('Overall SEI', 'Overall')
      .trim();
    demoColumns.push({ col: c, name });
  }

  // N counts
  const nCounts: Record<string, number> = {};
  if (nRow >= 0) {
    for (const dc of demoColumns) {
      const cell = ws[XLSX.utils.encode_cell({ r: nRow, c: dc.col })]?.v;
      if (typeof cell === 'number') nCounts[dc.name] = cell;
    }
  }

  console.log(`    Cols: ${demoColumns.length} (${demoColumns.slice(0, 5).map(d => d.name).join(', ')}...)`);

  // Find where factor scores start
  let startRow = -1;
  for (let r = 0; r < 15; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (cell === 'Factors') { startRow = r + 1; break; }
  }
  if (startRow === -1) startRow = nRow + 2;

  // First pass: collect factor-level scores (rows with short names and numeric B column)
  const factorNames = new Set<string>();
  let firstRepeatRow = -1;

  for (let r = startRow; r < 200; r++) {
    const aCell = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    const bCell = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
    if (!aCell) continue;
    const text = String(aCell).trim();
    if (!text) continue;

    // If we see a repeated factor name without a score, we're in the question section
    if (factorNames.has(text) && typeof bCell !== 'number') {
      firstRepeatRow = r;
      break;
    }

    if (typeof bCell === 'number' && text.length < 60 && !text.includes('?')) {
      factorNames.add(text);
      for (const dc of demoColumns) {
        const score = ws[XLSX.utils.encode_cell({ r, c: dc.col })]?.v;
        if (typeof score === 'number') {
          rows.push({
            survey_period: surveyPeriod, demographic_type: demoType,
            demographic_value: dc.name, respondent_count: nCounts[dc.name] ?? 0,
            factor: text, question: null, score,
          });
        }
      }
    }
  }

  // Second pass: question-level scores
  if (firstRepeatRow > 0) {
    let currentFactor = '';
    for (let r = firstRepeatRow; r < 300; r++) {
      const aCell = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      const bCell = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
      if (!aCell) continue;
      const text = String(aCell).trim();
      if (!text) continue;

      // Factor section header (no score in B)
      if (factorNames.has(text) && typeof bCell !== 'number') {
        currentFactor = text;
        continue;
      }

      // Question row
      if (typeof bCell === 'number' && currentFactor) {
        for (const dc of demoColumns) {
          const score = ws[XLSX.utils.encode_cell({ r, c: dc.col })]?.v;
          if (typeof score === 'number') {
            rows.push({
              survey_period: surveyPeriod, demographic_type: demoType,
              demographic_value: dc.name, respondent_count: nCounts[dc.name] ?? 0,
              factor: currentFactor, question: text, score,
            });
          }
        }
      }
    }
  }

  console.log(`    -> ${rows.length} records (${factorNames.size} factors: ${[...factorNames].slice(0, 4).join(', ')}...)`);
  return rows;
}

function parseComments(filePath: string): any[] {
  if (!fs.existsSync(filePath)) { console.log(`  ⚠ Skipping: ${filePath}`); return []; }
  console.log(`  Parsing comments...`);
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // Row 0 is a title row, actual headers are in row 1, data starts row 2
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const results: any[] = [];
  for (let r = 2; r <= range.e.r; r++) {
    const q = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    const comment = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
    if (!comment) continue;
    results.push({
      question: String(q ?? ''),
      comment: String(comment ?? ''),
      rating: String(ws[XLSX.utils.encode_cell({ r, c: 2 })]?.v ?? ''),
      topics: String(ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v ?? ''),
      sentiment: String(ws[XLSX.utils.encode_cell({ r, c: 4 })]?.v ?? ''),
      office_location: String(ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v ?? '').replace(/^SEI - /, '').replace(/ LLC$/, ''),
      survey_month: String(ws[XLSX.utils.encode_cell({ r, c: 6 })]?.v ?? ''),
    });
  }
  return results;
}

async function batchInsert(table: string, rows: any[]) {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await db.from(table).insert(batch);
    if (error) { console.log(`    ERROR at row ${i}: ${error.message}`); return; }
  }
}

async function main() {
  console.log('=== DEIB Data Loader v2 ===\n');

  console.log('Clearing...');
  await db.from('deib_surveys').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('deib_comments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const all: SurveyRow[] = [];

  console.log('\nFall 2025:');
  for (const [file, demo] of [
    ['Age_Heatmap_Fall2025.xlsx', 'age'],
    ['Gender_Heatmap_Fall 2025.xlsx', 'gender'],
    ['Race_Heatmap_Fall 2025.xlsx', 'race'],
    ['Tenure_Heatmap_Fall2025.xlsx', 'tenure'],
    ['Office_Location_Heatmap_Fall 2025.xlsx', 'office'],
    ['Job_Title_Heatmap_Fall 2025.xlsx', 'job_title'],
  ]) {
    all.push(...parseHeatmap(`/Users/davidortiz/Downloads/${file}`, 'Fall 2025', demo));
  }

  console.log('\nOct 2024:');
  for (const [file, demo] of [
    ['Age_Heatmap DEI.xlsx', 'age'],
    ['Gender_Heatmap DEI.xlsx', 'gender'],
    ['Race_Ethnicity_Heatmap DEI.xlsx', 'race'],
    ['Tenure_Heatmap DEI.xlsx', 'tenure'],
    ['Office_Location_Heatmap DEI.xlsx', 'office'],
    ['Job_Title_Heatmap DEI.xlsx', 'job_title'],
  ]) {
    all.push(...parseHeatmap(`/Users/davidortiz/Downloads/${file}`, 'Oct 2024', demo));
  }

  console.log(`\nInserting ${all.length} survey records...`);
  await batchInsert('deib_surveys', all);

  const comments = parseComments('/Users/davidortiz/Downloads/SEI_Engagement_Survey_Oct_2024_All_Results_comments DEI Questions.xlsx');
  console.log(`Inserting ${comments.length} comments...`);
  await batchInsert('deib_comments', comments);

  // Verify
  const { count } = await db.from('deib_surveys').select('id', { count: 'exact', head: true });
  const { count: cc } = await db.from('deib_comments').select('id', { count: 'exact', head: true });
  console.log(`\n✓ ${count} survey records, ${cc} comments in DB`);

  // Sample check
  const { data: sample } = await db.from('deib_surveys')
    .select('demographic_value, factor, question, score')
    .eq('demographic_type', 'office')
    .eq('survey_period', 'Fall 2025')
    .eq('factor', 'Diversity & Inclusion')
    .is('question', null)
    .order('score', { ascending: false })
    .limit(5);
  console.log('\nSample D&I by office:');
  for (const s of sample ?? []) console.log(`  ${s.demographic_value}: ${Math.round(s.score * 100)}%`);
}

main().catch(console.error);
