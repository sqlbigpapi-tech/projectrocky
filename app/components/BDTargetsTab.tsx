'use client';
import { useState, useEffect, useRef } from 'react';

type Status = 'None' | 'Prospect' | 'Outreach' | 'Meeting' | 'Proposal' | 'Client';

type Company = {
  id: string;
  name: string;
  city: string;
  industry: string;
  revenue: string;
  employees: string;
};

type TargetData = {
  notes: string;
  status: Status;
};

const STATUS_STYLES: Record<Status, string> = {
  None:     'bg-zinc-800 text-zinc-400 border-zinc-700',
  Prospect: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Outreach: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  Meeting:  'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Proposal: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Client:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const STATUSES: Status[] = ['None', 'Prospect', 'Outreach', 'Meeting', 'Proposal', 'Client'];

const INDUSTRIES = ['All', 'Financial Services', 'Real Estate', 'Healthcare', 'Technology', 'Energy', 'Retail', 'Hospitality', 'Manufacturing'] as const;
type IndustryFilter = typeof INDUSTRIES[number];

const COMPANIES: Company[] = [
  { id: 'nextera',     name: 'NextEra Energy',           city: 'Juno Beach',       industry: 'Energy',             revenue: '$20.6B',  employees: '15,000+' },
  { id: 'publix',      name: 'Publix Super Markets',     city: 'Lakeland',         industry: 'Retail',             revenue: '$58.5B',  employees: '240,000+' },
  { id: 'lennar',      name: 'Lennar Corporation',       city: 'Miami',            industry: 'Real Estate',        revenue: '$34.2B',  employees: '12,000+' },
  { id: 'jabil',       name: 'Jabil',                    city: 'St. Petersburg',   industry: 'Manufacturing',      revenue: '$34.7B',  employees: '260,000+' },
  { id: 'autonation',  name: 'AutoNation',               city: 'Fort Lauderdale',  industry: 'Retail',             revenue: '$26.1B',  employees: '25,000+' },
  { id: 'carnival',    name: 'Carnival Corporation',     city: 'Miami',            industry: 'Hospitality',        revenue: '$21.6B',  employees: '160,000+' },
  { id: 'raymondjames',name: 'Raymond James Financial',  city: 'St. Petersburg',   industry: 'Financial Services', revenue: '$12.0B',  employees: '15,000+' },
  { id: 'darden',      name: 'Darden Restaurants',       city: 'Orlando',          industry: 'Hospitality',        revenue: '$11.4B',  employees: '195,000+' },
  { id: 'fidelitynat', name: 'Fidelity National Info.',  city: 'Jacksonville',     industry: 'Financial Services', revenue: '$14.1B',  employees: '55,000+' },
  { id: 'fnf',         name: 'Fidelity National Fin.',   city: 'Jacksonville',     industry: 'Financial Services', revenue: '$10.7B',  employees: '23,000+' },
  { id: 'hca',         name: 'HCA Healthcare (FL Div.)', city: 'Tampa',            industry: 'Healthcare',         revenue: '$9.2B',   employees: '50,000+' },
  { id: 'roper',       name: 'Roper Technologies',       city: 'Sarasota',         industry: 'Technology',         revenue: '$5.8B',   employees: '27,000+' },
  { id: 'adt',         name: 'ADT',                      city: 'Boca Raton',       industry: 'Technology',         revenue: '$4.9B',   employees: '20,000+' },
  { id: 'healthfirst', name: 'Florida Blue',             city: 'Jacksonville',     industry: 'Healthcare',         revenue: '$11.0B',  employees: '13,000+' },
  { id: 'citrix',      name: 'Cloud Software Group',     city: 'Fort Lauderdale',  industry: 'Technology',         revenue: '$3.5B',   employees: '10,000+' },
  { id: 'wellcare',    name: 'WellCare Health Plans',    city: 'Tampa',            industry: 'Healthcare',         revenue: '$8.0B',   employees: '12,000+' },
  { id: 'bankoffl',    name: 'BankUnited',               city: 'Miami Lakes',      industry: 'Financial Services', revenue: '$1.2B',   employees: '1,700+' },
  { id: 'synnex',      name: 'TD SYNNEX',                city: 'Clearwater',       industry: 'Technology',         revenue: '$57.6B',  employees: '23,000+' },
  { id: 'hertz',       name: 'Hertz Global Holdings',    city: 'Estero',           industry: 'Retail',             revenue: '$9.7B',   employees: '30,000+' },
  { id: 'watsco',      name: 'Watsco',                   city: 'Miami',            industry: 'Manufacturing',      revenue: '$6.9B',   employees: '6,200+' },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function CompanyCard({
  company,
  data,
  onUpdate,
}: {
  company: Company;
  data: TargetData;
  onUpdate: (id: string, patch: Partial<TargetData>) => void;
}) {
  const [notes, setNotes] = useState(data.notes);
  const debouncedNotes = useDebounce(notes, 800);
  const initialized = useRef(false);

  useEffect(() => {
    setNotes(data.notes);
  }, [data.notes]);

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return; }
    onUpdate(company.id, { notes: debouncedNotes });
  }, [debouncedNotes]);

  const status = data.status;

  return (
    <div className={`bg-zinc-950 rounded-xl border p-5 flex flex-col gap-3 transition-colors ${
      status === 'Client' ? 'border-emerald-500/30' :
      status === 'Meeting' || status === 'Proposal' ? 'border-amber-500/30' :
      'border-zinc-800 hover:border-zinc-700'
    }`}>
      {/* Company name + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-snug">{company.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{company.city}, FL</p>
        </div>
        <select
          value={status}
          onChange={e => onUpdate(company.id, { status: e.target.value as Status })}
          className={`text-xs font-bold border rounded-lg px-2 py-1 cursor-pointer focus:outline-none shrink-0 ${STATUS_STYLES[status]}`}
          style={{ background: 'transparent' }}
        >
          {STATUSES.map(s => (
            <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>
          ))}
        </select>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md font-mono">
          {company.industry}
        </span>
        <span className="text-xs text-amber-400 font-bold font-mono">{company.revenue}</span>
        <span className="text-xs text-zinc-600 font-mono">{company.employees} emp.</span>
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="SEI relationship notes…"
        rows={2}
        className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-700 resize-none focus:outline-none transition-colors"
      />
    </div>
  );
}

export default function BDTargetsTab() {
  const [targetMap, setTargetMap] = useState<Record<string, TargetData>>({});
  const [industryFilter, setIndustryFilter] = useState<IndustryFilter>('All');
  const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const loaded = useRef(false);

  useEffect(() => {
    fetch('/api/bd-targets')
      .then(r => r.json())
      .then(({ targets }) => {
        const map: Record<string, TargetData> = {};
        (targets ?? []).forEach((t: { company_id: string; notes: string; status: Status }) => {
          map[t.company_id] = { notes: t.notes ?? '', status: t.status ?? 'None' };
        });
        setTargetMap(map);
        loaded.current = true;
      })
      .catch(() => { loaded.current = true; });
  }, []);

  function getData(id: string): TargetData {
    return targetMap[id] ?? { notes: '', status: 'None' };
  }

  async function handleUpdate(id: string, patch: Partial<TargetData>) {
    const current = getData(id);
    const updated = { ...current, ...patch };
    setTargetMap(prev => ({ ...prev, [id]: updated }));
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      await fetch('/api/bd-targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: id, notes: updated.notes, status: updated.status }),
      });
    } finally {
      setSaving(prev => ({ ...prev, [id]: false }));
    }
  }

  const filtered = COMPANIES.filter(c => {
    if (industryFilter !== 'All' && c.industry !== industryFilter) return false;
    if (statusFilter !== 'All' && getData(c.id).status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = COMPANIES.filter(c => getData(c.id).status === s && s !== 'None').length;
    return acc;
  }, {} as Record<Status, number>);

  const activePipeline = COMPANIES.filter(c => !['None', 'Prospect'].includes(getData(c.id).status));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">BD Targets</h2>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono">Florida top companies · SEI relationship tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(saving).some(([, v]) => v) && (
            <span className="text-xs text-zinc-600 font-mono animate-pulse">saving…</span>
          )}
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {STATUSES.filter(s => s !== 'None').map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(prev => prev === s ? 'All' : s)}
            className={`rounded-xl border p-3 text-left transition cursor-pointer ${
              statusFilter === s ? STATUS_STYLES[s] : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-1">{s}</p>
            <p className={`text-2xl font-bold tabular-nums ${statusFilter === s ? '' : 'text-white'}`}>
              {statusCounts[s]}
            </p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search companies…"
          className="bg-zinc-950 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition w-48"
        />
        <div className="flex gap-1.5 flex-wrap">
          {INDUSTRIES.map(ind => (
            <button
              key={ind}
              onClick={() => setIndustryFilter(ind)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                industryFilter === ind
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-white hover:border-zinc-600'
              }`}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* Active pipeline callout */}
      {activePipeline.length > 0 && statusFilter === 'All' && industryFilter === 'All' && !search && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-5 py-3 mb-6 flex items-center gap-3">
          <span className="text-amber-400 text-xs font-bold font-mono uppercase tracking-widest">Active Pipeline</span>
          <div className="flex flex-wrap gap-2">
            {activePipeline.map(c => (
              <span key={c.id} className={`text-xs border rounded-md px-2 py-0.5 ${STATUS_STYLES[getData(c.id).status]}`}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500 text-sm">
          No companies match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CompanyCard
              key={c.id}
              company={c}
              data={getData(c.id)}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-700 font-mono mt-6 text-center">{COMPANIES.length} companies · notes auto-save</p>
    </div>
  );
}
