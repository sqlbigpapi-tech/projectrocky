import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log('Seeding consultants...');
  const { data: consultants, error: cError } = await supabase
    .from('consultants')
    .insert([
      { first_name: 'Jeff', last_name: 'Cubillos', level: 'Principal', start_date: '2019-10-28', active: true },
      { first_name: 'Eric', last_name: 'Carr', level: 'Consultant', start_date: '2022-08-22', active: true },
      { first_name: 'Diego', last_name: 'Soloaga', level: 'Consultant', start_date: '2026-01-01', active: true },
      { first_name: 'Sarah', last_name: 'Reilly', level: 'Managing Principal', start_date: '2016-11-30', active: true },
      { first_name: 'Jorge', last_name: 'Delgado', level: 'Consultant', start_date: '2022-04-25', active: true },
      { first_name: 'Jacqueline', last_name: 'Quirk', level: 'Consultant', start_date: '2023-02-06', active: true },
      { first_name: 'Joe', last_name: 'Milton', level: 'Consultant', start_date: '2022-04-11', active: true },
      { first_name: 'Michelle', last_name: 'Coca', level: 'Consultant', start_date: '2022-05-23', active: true },
      { first_name: 'Scott', last_name: 'Perrell', level: 'Consultant', start_date: '2022-01-17', active: true },
      { first_name: 'Jean-Sebastien', last_name: 'Roger', level: 'Consultant', start_date: '2022-10-24', active: true },
      { first_name: 'Natalie', last_name: 'Maldonado', level: 'Senior Consultant', start_date: '2021-10-29', active: true },
      { first_name: 'Orestes', last_name: 'Castaneda', level: 'Consultant', start_date: '2023-02-27', active: true },
      { first_name: 'Peter', last_name: 'Ranger', level: 'Consultant', start_date: '2023-01-01', active: true },
      { first_name: 'Simon', last_name: 'Brandon', level: 'Principal', start_date: '2015-07-13', active: true },
      { first_name: 'Eduardo', last_name: 'Mandarino', level: 'Principal', start_date: '2009-09-28', active: true },
      { first_name: 'Georgia', last_name: 'Compton', level: 'Consultant', start_date: '2023-01-01', active: true },
      { first_name: 'Justin', last_name: 'Bell', level: 'Consultant', start_date: '2023-04-17', active: true },
      { first_name: 'Gina', last_name: 'Colesanti', level: 'Consultant', start_date: '2023-01-01', active: true },
      { first_name: 'Mark', last_name: 'Haweny', level: 'Principal', start_date: '2023-01-01', active: true },
      { first_name: 'Kat', last_name: 'Spivey', level: 'Principal', start_date: '2023-01-01', active: true },
      { first_name: 'Aron', last_name: 'Wosniak', level: 'Consultant', start_date: '2025-10-01', active: true },
      { first_name: 'Steve', last_name: 'Woundy', level: 'Principal', start_date: '2023-01-01', active: true },
      { first_name: 'Craig', last_name: 'Morrow', level: 'Principal', start_date: '2024-08-01', active: true },
      { first_name: 'Sam', last_name: 'Ibarguen', level: 'Consultant', start_date: '2026-01-01', active: true },
      { first_name: 'Adam', last_name: 'Kriklewicz', level: 'Consultant', start_date: '2025-05-01', active: true },
      { first_name: 'Farah', last_name: 'Cadet', level: 'Consultant', start_date: '2026-01-01', active: true },
    ])
    .select();

  if (cError) { console.error('Consultant seed error:', cError); return; }
  console.log(`Inserted ${consultants!.length} consultants`);

  const consultantMap: Record<string, string> = {};
  consultants!.forEach(c => { consultantMap[`${c.first_name} ${c.last_name}`] = c.id; });

  console.log('Seeding clients...');
  const { data: clients, error: clError } = await supabase
    .from('clients')
    .insert([
      { name: 'PBSO', credit_rating: 'AAA' },
      { name: 'Christian Care Ministry', credit_rating: null },
      { name: 'Norwegian Cruise Line', credit_rating: 'B' },
      { name: 'Toyota', credit_rating: 'A+' },
      { name: 'Computacenter', credit_rating: null },
      { name: 'RCG International', credit_rating: null },
      { name: 'Harvard University', credit_rating: 'AAA' },
      { name: 'Oracle Fusion', credit_rating: null },
      { name: 'Cleerly', credit_rating: null },
      { name: 'Abiomed', credit_rating: 'AAA' },
      { name: 'Data Center Inventory', credit_rating: null },
      { name: 'CC Latham', credit_rating: null },
    ])
    .select();

  if (clError) { console.error('Client seed error:', clError); return; }
  console.log(`Inserted ${clients!.length} clients`);

  const clientMap: Record<string, string> = {};
  clients!.forEach(c => { clientMap[c.name] = c.id; });

  console.log('Seeding engagements...');
  const { error: eError } = await supabase
    .from('engagements')
    .insert([
      { consultant_id: consultantMap['Jeff Cubillos'], client_id: clientMap['PBSO'], deal_name: 'PBSO Project/Product/ITSM Manager', rate: 190, sow_start: '2024-10-01', sow_end: '2028-04-30', status: 'active' },
      { consultant_id: consultantMap['Eric Carr'], client_id: clientMap['CC Latham'], deal_name: 'CC Latham AI PODS Extension', rate: 185, sow_start: '2025-05-01', sow_end: '2026-01-30', status: 'active' },
      { consultant_id: consultantMap['Diego Soloaga'], client_id: clientMap['Norwegian Cruise Line'], deal_name: 'NCL', rate: 190, sow_start: '2026-01-01', sow_end: '2026-04-30', status: 'active' },
      { consultant_id: consultantMap['Jorge Delgado'], client_id: clientMap['Norwegian Cruise Line'], deal_name: 'NCL', rate: 190, sow_start: '2012-10-01', sow_end: '2026-06-30', status: 'active' },
      { consultant_id: consultantMap['Jacqueline Quirk'], client_id: clientMap['Data Center Inventory'], deal_name: 'Data Center Inventory Management', rate: 200, sow_start: '2026-01-01', sow_end: '2026-04-30', status: 'active' },
      { consultant_id: consultantMap['Joe Milton'], client_id: clientMap['Toyota'], deal_name: 'Toyota Fiscal 2024 Compliance', rate: 185, sow_start: '2023-04-01', sow_end: '2027-03-31', status: 'active' },
      { consultant_id: consultantMap['Michelle Coca'], client_id: clientMap['Christian Care Ministry'], deal_name: 'CCM Data Strategy FY26', rate: 205, sow_start: '2025-07-01', sow_end: '2026-06-30', status: 'active' },
      { consultant_id: consultantMap['Scott Perrell'], client_id: clientMap['PBSO'], deal_name: 'PBSO Project/Product/ITSM Manager (3)', rate: 190, sow_start: '2024-10-01', sow_end: '2028-04-30', status: 'active' },
      { consultant_id: consultantMap['Jean-Sebastien Roger'], client_id: clientMap['Christian Care Ministry'], deal_name: 'CCM Expansion HRP', rate: 205, sow_start: '2024-06-01', sow_end: '2026-06-30', status: 'active' },
      { consultant_id: consultantMap['Natalie Maldonado'], client_id: clientMap['Oracle Fusion'], deal_name: 'Oracle Fusion ERP PM Extension', rate: 200, sow_start: '2024-10-01', sow_end: '2026-09-30', status: 'active' },
      { consultant_id: consultantMap['Orestes Castaneda'], client_id: clientMap['Harvard University'], deal_name: 'Harvard GSAS Reporting Migration', rate: 184, sow_start: '2023-03-20', sow_end: '2026-04-30', status: 'active' },
      { consultant_id: consultantMap['Simon Brandon'], client_id: clientMap['CC Latham'], deal_name: 'CC ESC', rate: 200, sow_start: '2026-04-01', sow_end: '2026-08-30', status: 'active' },
      { consultant_id: consultantMap['Eduardo Mandarino'], client_id: clientMap['RCG International'], deal_name: 'RCG Marketing PMO', rate: 200, sow_start: '2025-09-01', sow_end: '2026-06-30', status: 'active' },
      { consultant_id: consultantMap['Mark Haweny'], client_id: clientMap['Computacenter'], deal_name: 'Computacenter Honeywell Program Mgr', rate: 200, sow_start: '2025-11-01', sow_end: '2026-04-30', status: 'active' },
      { consultant_id: consultantMap['Justin Bell'], client_id: clientMap['Christian Care Ministry'], deal_name: 'CCM Data Strategy FY26', rate: 205, sow_start: '2024-01-01', sow_end: '2026-06-30', status: 'active' },
      { consultant_id: consultantMap['Gina Colesanti'], client_id: clientMap['Abiomed'], deal_name: 'Abiomed/CC', rate: 200, sow_start: '2026-01-01', sow_end: '2026-04-30', status: 'active' },
      { consultant_id: consultantMap['Aron Wosniak'], client_id: clientMap['Christian Care Ministry'], deal_name: 'CCM Member Provider Search', rate: 205, sow_start: '2025-10-01', sow_end: '2026-04-30', status: 'active' },
      { consultant_id: consultantMap['Georgia Compton'], client_id: clientMap['Cleerly'], deal_name: 'Cleerly Marketing Ops', rate: 200, sow_start: '2025-03-01', sow_end: '2026-03-31', status: 'active' },
      { consultant_id: consultantMap['Peter Ranger'], client_id: clientMap['Computacenter'], deal_name: 'Computacenter', rate: 200, sow_start: '2024-08-01', sow_end: '2026-11-30', status: 'active' },
      { consultant_id: consultantMap['Steve Woundy'], client_id: clientMap['Christian Care Ministry'], deal_name: 'CCM', rate: 205, sow_start: '2024-10-01', sow_end: '2026-06-30', status: 'active' },
      { consultant_id: consultantMap['Craig Morrow'], client_id: clientMap['Norwegian Cruise Line'], deal_name: 'NCL', rate: 190, sow_start: '2024-08-01', sow_end: '2026-06-30', status: 'active' },
      { consultant_id: consultantMap['Sam Ibarguen'], client_id: clientMap['Norwegian Cruise Line'], deal_name: 'NCL', rate: 195, sow_start: '2026-01-01', sow_end: '2026-07-31', status: 'active' },
      { consultant_id: consultantMap['Adam Kriklewicz'], client_id: clientMap['Christian Care Ministry'], deal_name: 'CCM Data Strategy FY26', rate: 205, sow_start: '2025-05-01', sow_end: '2026-06-30', status: 'active' },
      { consultant_id: consultantMap['Kat Spivey'], client_id: clientMap['Christian Care Ministry'], deal_name: 'CCM', rate: 200, sow_start: '2024-02-01', sow_end: '2026-04-30', status: 'active' },
      { consultant_id: consultantMap['Farah Cadet'], client_id: clientMap['Christian Care Ministry'], deal_name: 'CCM Expansion HRP', rate: 205, sow_start: '2026-01-01', sow_end: '2026-06-30', status: 'active' },
    ]);

  if (eError) { console.error('Engagement seed error:', eError); return; }
  console.log('Inserted engagements');

  console.log('Seeding public holidays 2026...');
  const { error: hError } = await supabase
    .from('holidays')
    .insert([
      { consultant_id: null, date: '2026-01-01', label: "New Year's Day", type: 'public_holiday' },
      { consultant_id: null, date: '2026-01-19', label: 'Martin Luther King Jr Day', type: 'public_holiday' },
      { consultant_id: null, date: '2026-02-16', label: "Washington's Birthday", type: 'public_holiday' },
      { consultant_id: null, date: '2026-05-25', label: 'Memorial Day', type: 'public_holiday' },
      { consultant_id: null, date: '2026-06-19', label: 'Juneteenth', type: 'public_holiday' },
      { consultant_id: null, date: '2026-07-03', label: 'Independence Day (observed)', type: 'public_holiday' },
      { consultant_id: null, date: '2026-09-07', label: 'Labor Day', type: 'public_holiday' },
      { consultant_id: null, date: '2026-10-12', label: 'Columbus Day', type: 'public_holiday' },
      { consultant_id: null, date: '2026-11-11', label: 'Veterans Day', type: 'public_holiday' },
      { consultant_id: null, date: '2026-11-26', label: 'Thanksgiving', type: 'public_holiday' },
      { consultant_id: null, date: '2026-11-27', label: 'Day after Thanksgiving', type: 'public_holiday' },
      { consultant_id: null, date: '2026-12-25', label: 'Christmas Day', type: 'public_holiday' },
      { consultant_id: null, date: '2026-12-26', label: 'Day after Christmas', type: 'public_holiday' },
    ]);

  if (hError) { console.error('Holiday seed error:', hError); return; }

  console.log('Seed complete.');
}

seed();
