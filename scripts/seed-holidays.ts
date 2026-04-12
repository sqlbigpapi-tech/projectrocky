import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function seed() {
  // Clear existing 2026 holidays
  console.log('Clearing existing 2026 holidays...');
  await db.from('holidays').delete().gte('date', '2026-01-01').lte('date', '2026-12-31');

  // Public holidays from the Excel (Generic Public Holidays 2026 sheet)
  const publicHolidays = [
    { date: '2026-01-01', label: "New Year's Day" },
    { date: '2026-01-19', label: 'Martin Luther King Jr Day' },
    { date: '2026-02-01', label: 'Day After New Years (Company)' },
    { date: '2026-02-16', label: "Presidents' Day" },
    { date: '2026-05-25', label: 'Memorial Day' },
    { date: '2026-06-19', label: 'Juneteenth' },
    { date: '2026-07-03', label: 'Independence Day (observed)' },
    { date: '2026-09-07', label: 'Labor Day' },
    { date: '2026-10-12', label: 'Columbus Day' },
    { date: '2026-11-11', label: 'Veterans Day' },
    { date: '2026-11-26', label: 'Thanksgiving' },
    { date: '2026-11-27', label: 'Day after Thanksgiving' },
    { date: '2026-12-25', label: 'Christmas Day' },
    { date: '2026-12-26', label: 'Day after Christmas' },
  ];

  console.log(`Inserting ${publicHolidays.length} public holidays...`);
  const { error: phErr } = await db
    .from('holidays')
    .insert(publicHolidays.map(h => ({ ...h, consultant_id: null, type: 'public_holiday' })));
  if (phErr) { console.error('Public holiday error:', phErr); return; }

  // Get consultant IDs
  const { data: consultants } = await db
    .from('consultants')
    .select('id, first_name, last_name');

  const cMap: Record<string, string> = {};
  (consultants ?? []).forEach(c => { cMap[`${c.first_name} ${c.last_name}`] = c.id; });

  // Individual PTO from Excel holiday sheets (weekdays only)
  const ptoDays: { consultant: string; dates: string[] }[] = [
    {
      consultant: 'Jean-Sebastien Roger',
      dates: ['2026-03-26', '2026-03-27'],
    },
    {
      consultant: 'Natalie Maldonado',
      dates: [
        '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27',
        '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27',
      ],
    },
    {
      consultant: 'Simon Brandon',
      // Filter to weekdays only (his sheet includes weekends)
      dates: [
        '2026-02-19', '2026-02-20',
        '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06',
        '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13',
        '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20',
        '2026-03-23', '2026-03-24',
      ],
    },
  ];

  for (const { consultant, dates } of ptoDays) {
    const cId = cMap[consultant];
    if (!cId) {
      console.error(`Consultant not found: ${consultant}`);
      continue;
    }

    const rows = dates.map(d => ({
      consultant_id: cId,
      date: d,
      label: 'PTO',
      type: 'pto',
    }));

    const { error } = await db.from('holidays').insert(rows);
    if (error) {
      console.error(`${consultant} PTO error:`, error);
    } else {
      console.log(`${consultant}: ${dates.length} PTO days`);
    }
  }

  console.log('Holiday seed complete.');
}

seed();
