'use client';
import { useState, useEffect, useRef } from 'react';

interface MonthBilling { workingDays: number; billing: number; cost: number; margin: number }
interface ForecastRow {
  consultantId: string;
  consultantName: string;
  level: string;
  client: string;
  dealName: string;
  rate: number;
  status: string;
  probability: number;
  sowEnd: string;
  months: Record<number, MonthBilling>;
  annualTotal: number;
  annualCost: number;
  annualMargin: number;
  engagementId: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtK = (n: number) => n === 0 ? '—' : Math.abs(n) >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;
const fmtFull = (n: number) => n === 0 ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function InlineEdit({ value, onSave, type = 'text' }: { value: string; onSave: (v: string) => void; type?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing && ref.current) {
      if (type === 'date') {
        try { ref.current.showPicker(); } catch { ref.current.focus(); }
      } else {
        ref.current.select();
      }
    }
  }, [editing]);
  const commit = () => { if (draft !== value) onSave(draft); setEditing(false); };
  if (editing) return (
    <input ref={ref} type={type} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className="bg-zinc-800 border border-amber-500 text-white text-xs font-mono px-1.5 py-0.5 rounded outline-none w-full" />
  );
  return <span onClick={() => { setDraft(value); setEditing(true); }} className="cursor-pointer hover:text-amber-400 transition">{value}</span>;
}

interface ConsultantOption { id: string; first_name: string; last_name: string; level: string }
interface ClientOption { id: string; name: string }

function AddEngagementForm({ onDone }: { onDone: () => void }) {
  const [consultants, setConsultants] = useState<ConsultantOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [consultantId, setConsultantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [dealName, setDealName] = useState('');
  const [rate, setRate] = useState('200');
  const [sowStart, setSowStart] = useState('');
  const [sowEnd, setSowEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNewConsultant, setShowNewConsultant] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newLevel, setNewLevel] = useState('Consultant');
  const [newClientName, setNewClientName] = useState('');

  useEffect(() => {
    fetch('/api/engagements').then(r => r.json()).then(d => {
      setConsultants(d.consultants ?? []);
      setClients(d.clients ?? []);
    });
  }, []);

  const inputCls = 'bg-zinc-800 border border-zinc-700 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 w-full';
  const btnCls = 'px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest transition';

  async function addConsultant() {
    if (!newFirst || !newLast) return;
    const r = await fetch('/api/engagements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'consultant', first_name: newFirst, last_name: newLast, level: newLevel }),
    });
    const d = await r.json();
    if (d.consultant) {
      setConsultants(prev => [...prev, d.consultant].sort((a, b) => a.last_name.localeCompare(b.last_name)));
      setConsultantId(d.consultant.id);
      setShowNewConsultant(false);
      setNewFirst(''); setNewLast('');
    }
  }

  async function addClient() {
    if (!newClientName) return;
    const r = await fetch('/api/engagements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'client', name: newClientName }),
    });
    const d = await r.json();
    if (d.client) {
      setClients(prev => [...prev, d.client].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(d.client.id);
      setShowNewClient(false);
      setNewClientName('');
    }
  }

  async function submit() {
    if (!consultantId || !clientId || !rate || !sowStart || !sowEnd) return;
    setSaving(true);
    await fetch('/api/engagements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consultant_id: consultantId, client_id: clientId, deal_name: dealName, rate: parseFloat(rate), sow_start: sowStart, sow_end: sowEnd }),
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-5 mb-6">
      <p className="text-xs text-amber-400 font-mono font-bold uppercase tracking-widest mb-4">New Engagement</p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Consultant</label>
          {showNewConsultant ? (
            <div className="flex gap-2">
              <input placeholder="First" value={newFirst} onChange={e => setNewFirst(e.target.value)} className={inputCls} />
              <input placeholder="Last" value={newLast} onChange={e => setNewLast(e.target.value)} className={inputCls} />
              <select value={newLevel} onChange={e => setNewLevel(e.target.value)} className={inputCls + ' w-auto'}>
                {['Consultant', 'Senior Consultant', 'Principal', 'Managing Principal'].map(l => <option key={l}>{l}</option>)}
              </select>
              <button onClick={addConsultant} className={`${btnCls} bg-emerald-500/20 text-emerald-400`}>Add</button>
              <button onClick={() => setShowNewConsultant(false)} className={`${btnCls} text-zinc-500`}>Cancel</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={consultantId} onChange={e => setConsultantId(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {consultants.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
              <button onClick={() => setShowNewConsultant(true)} className={`${btnCls} text-amber-400 border border-zinc-800 hover:border-amber-500 whitespace-nowrap`}>+ New</button>
            </div>
          )}
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Client</label>
          {showNewClient ? (
            <div className="flex gap-2">
              <input placeholder="Client name" value={newClientName} onChange={e => setNewClientName(e.target.value)} className={inputCls} />
              <button onClick={addClient} className={`${btnCls} bg-emerald-500/20 text-emerald-400`}>Add</button>
              <button onClick={() => setShowNewClient(false)} className={`${btnCls} text-zinc-500`}>Cancel</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => setShowNewClient(true)} className={`${btnCls} text-amber-400 border border-zinc-800 hover:border-amber-500 whitespace-nowrap`}>+ New</button>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Deal Name</label>
          <input value={dealName} onChange={e => setDealName(e.target.value)} placeholder="Deal name" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">Rate ($/hr)</label>
          <input value={rate} onChange={e => setRate(e.target.value)} type="number" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">SOW Start</label>
          <input value={sowStart} onChange={e => setSowStart(e.target.value)} type="date" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">SOW End</label>
          <input value={sowEnd} onChange={e => setSowEnd(e.target.value)} type="date" className={inputCls} />
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={submit} disabled={saving || !consultantId || !clientId || !sowStart || !sowEnd}
          className={`${btnCls} bg-amber-500 text-black disabled:opacity-40`}>
          {saving ? 'Saving…' : 'Add Engagement'}
        </button>
        <button onClick={onDone} className={`${btnCls} text-zinc-500 hover:text-white`}>Cancel</button>
      </div>
    </div>
  );
}

export default function HeadcountTab() {
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2026);
  const [view, setView] = useState<'roster' | 'forecast' | 'pto' | 'clients'>('roster');
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string; industry?: string | null; url?: string | null; credit_rating?: string | null; engagement_count?: number }[]>([]);
  const [consultantsList, setConsultantsList] = useState<{ id: string; first_name: string; last_name: string; level: string }[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<{ id: string; date: string }[]>([]);
  const [pto, setPto] = useState<{ id: string; date: string; consultant_id: string; consultants: { first_name: string; last_name: string } | null }[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newPtoDate, setNewPtoDate] = useState('');
  const [newPtoConsultant, setNewPtoConsultant] = useState('');

  useEffect(() => { load(); }, [year]);

  async function load() {
    setLoading(true);
    const [billingRes, engRes, holRes] = await Promise.all([
      fetch(`/api/billing?year=${year}&all=1`),
      fetch('/api/engagements'),
      fetch(`/api/holidays?year=${year}`),
    ]);
    const d = await billingRes.json();
    const e = await engRes.json();
    const h = await holRes.json();
    setForecast(d.forecast ?? []);
    setClients(e.clients ?? []);
    setConsultantsList(e.consultants ?? []);
    setPublicHolidays(h.publicHolidays ?? []);
    setPto(h.pto ?? []);
    setLoading(false);
  }

  async function addHoliday(date: string, consultantId?: string) {
    await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, consultant_id: consultantId || null }),
    });
    await load();
  }

  async function removeHoliday(id: string) {
    await fetch('/api/holidays', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function updateEngagement(engId: string, fields: Record<string, unknown>) {
    setSaving(true);
    await fetch('/api/engagements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: engId, ...fields }),
    });
    await load();
    setSaving(false);
  }

  const today = new Date();
  const sixtyDaysOut = new Date(today);
  sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);
  const endingSoon = forecast.filter(f => {
    const end = new Date(f.sowEnd);
    return end >= today && end <= sixtyDaysOut;
  });

  const monthTotals: number[] = [];
  for (let m = 1; m <= 12; m++) {
    monthTotals.push(forecast.reduce((s, f) => s + (f.months[m]?.billing ?? 0), 0));
  }
  const grandTotal = forecast.reduce((s, f) => s + f.annualTotal, 0);
  const grandCost = forecast.reduce((s, f) => s + (f.annualCost ?? 0), 0);
  const grandMargin = grandTotal - grandCost;

  const active = forecast.filter(f => f.status !== 'closed' && new Date(f.sowEnd) >= today);
  const inactive = forecast.filter(f => f.status === 'closed' || new Date(f.sowEnd) < today);
  const sortedActive = [...active].sort((a, b) => b.annualTotal - a.annualTotal);
  const sortedInactive = [...inactive].sort((a, b) => b.annualTotal - a.annualTotal);
  const sorted = [...active].sort((a, b) => b.annualTotal - a.annualTotal);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white font-mono tracking-widest">HEADCOUNT</h2>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {active.length} active{inactive.length > 0 ? ` · ${inactive.length} inactive` : ''} · {year} projected: {fmtFull(grandTotal)}
            {saving && <span className="text-amber-400 ml-2 animate-pulse">saving…</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(['roster', 'forecast', 'pto', 'clients'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest transition ${view === v ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-600 hover:text-white'}`}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-800 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowAdd(!showAdd)}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest transition ${showAdd ? 'bg-zinc-800 text-zinc-400' : 'bg-amber-500 text-black'}`}>
            {showAdd ? 'CLOSE' : '+ ADD'}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && <AddEngagementForm onDone={() => { setShowAdd(false); load(); }} />}

      {/* Ending Soon Alert */}
      {endingSoon.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-xs text-red-400 font-mono font-bold uppercase tracking-widest mb-2">Ending within 60 days</p>
          <div className="flex flex-wrap gap-3">
            {endingSoon.map(e => (
              <div key={e.engagementId} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-white font-bold">{e.consultantName}</span>
                <span className="text-zinc-500">@ {e.client}</span>
                <span className="text-red-400">ends {new Date(e.sowEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-600 font-mono text-xs">Loading…</p>
      ) : view === 'roster' ? (
        /* ROSTER VIEW */
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-zinc-600 uppercase tracking-widest border-b border-zinc-800">
                <th className="text-left pb-3 pr-3">Consultant</th>
                <th className="text-left pb-3 pr-3">Level</th>
                <th className="text-left pb-3 pr-3">Client</th>
                <th className="text-left pb-3 pr-3">Deal</th>
                <th className="text-right pb-3 pr-3">Rate</th>
                <th className="text-left pb-3 pr-3">SOW End</th>
                <th className="text-center pb-3 pr-3">Status</th>
                <th className="text-right pb-3 pr-3">Billing</th>
                <th className="text-right pb-3 pr-3">Cost</th>
                <th className="text-right pb-3">Margin</th>
              </tr>
            </thead>
            <tbody>
              {sortedActive.map(f => {
                const endDate = new Date(f.sowEnd);
                const isEndingSoon = endDate >= today && endDate <= sixtyDaysOut;
                return (
                  <tr key={f.engagementId} className="border-b border-zinc-900 hover:bg-[var(--card)]">
                    <td className="py-3 pr-3 text-white font-bold">{f.consultantName}</td>
                    <td className="py-3 pr-3 text-zinc-400">{f.level}</td>
                    <td className="py-3 pr-3 text-zinc-300">
                      <select
                        value={clients.find(c => c.name === f.client)?.id ?? ''}
                        onChange={e => updateEngagement(f.engagementId, { client_id: e.target.value })}
                        className="bg-transparent text-zinc-300 text-xs font-mono cursor-pointer hover:text-amber-400 transition outline-none border-0 appearance-none"
                      >
                        {clients.map(c => <option key={c.id} value={c.id} className="bg-zinc-900 text-white">{c.name}</option>)}
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-zinc-500 max-w-[180px] truncate">{f.dealName}</td>
                    <td className="py-3 pr-3 text-right text-zinc-300">
                      <InlineEdit value={String(f.rate)} type="number"
                        onSave={v => updateEngagement(f.engagementId, { rate: parseFloat(v) })} />
                      <span className="text-zinc-600">/hr</span>
                    </td>
                    <td className={`py-3 pr-3 ${isEndingSoon ? 'text-red-400 font-bold' : 'text-zinc-300'}`}>
                      <InlineEdit value={f.sowEnd} type="date"
                        onSave={v => updateEngagement(f.engagementId, { sow_end: v })} />
                    </td>
                    <td className="py-3 pr-3 text-center">
                      <select value={f.status}
                        onChange={e => updateEngagement(f.engagementId, { status: e.target.value })}
                        className={`text-xs font-bold font-mono rounded px-2 py-0.5 border-0 outline-none cursor-pointer ${
                          f.status === 'active' ? 'bg-emerald-500/10 text-emerald-400'
                          : f.status === 'extension' ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-zinc-800 text-zinc-500'
                        }`}>
                        <option value="active">ACTIVE</option>
                        <option value="extension">EXTENSION</option>
                        <option value="closed">CLOSED</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-right text-white font-bold">{fmtFull(f.annualTotal)}</td>
                    <td className="py-3 pr-3 text-right text-red-400/70">{fmtFull(f.annualCost ?? 0)}</td>
                    <td className="py-3 text-right text-emerald-400 font-bold">{fmtFull(f.annualMargin ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700">
                <td colSpan={7} className="pt-4 text-zinc-400 font-bold">ACTIVE TOTAL</td>
                <td className="pt-4 pr-3 text-right text-white font-bold">{fmtFull(grandTotal)}</td>
                <td className="pt-4 pr-3 text-right text-red-400/70 font-bold">{fmtFull(grandCost)}</td>
                <td className="pt-4 text-right text-emerald-400 font-bold">{fmtFull(grandMargin)}</td>
              </tr>
              <tr>
                <td colSpan={7} />
                <td />
                <td />
                <td className="pt-1 text-right text-[10px] text-zinc-600 font-mono">{grandTotal > 0 ? `${((grandMargin / grandTotal) * 100).toFixed(1)}% margin` : ''}</td>
              </tr>
            </tfoot>
          </table>

          {/* Inactive Section */}
          {sortedInactive.length > 0 && (
            <div className="mt-8">
              <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-3">Inactive / Ended ({sortedInactive.length})</p>
              <table className="w-full text-xs font-mono opacity-50">
                <thead>
                  <tr className="text-zinc-700 uppercase tracking-widest border-b border-zinc-800">
                    <th className="text-left pb-3 pr-3">Consultant</th>
                    <th className="text-left pb-3 pr-3">Level</th>
                    <th className="text-left pb-3 pr-3">Client</th>
                    <th className="text-left pb-3 pr-3">Deal</th>
                    <th className="text-right pb-3 pr-3">Rate</th>
                    <th className="text-left pb-3 pr-3">SOW End</th>
                    <th className="text-center pb-3 pr-3">Status</th>
                    <th className="text-right pb-3">Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInactive.map(f => (
                    <tr key={f.engagementId} className="border-b border-zinc-900">
                      <td className="py-2.5 pr-3 text-zinc-500">{f.consultantName}</td>
                      <td className="py-2.5 pr-3 text-zinc-600">{f.level}</td>
                      <td className="py-2.5 pr-3 text-zinc-600">{f.client}</td>
                      <td className="py-2.5 pr-3 text-zinc-700 max-w-[180px] truncate">{f.dealName}</td>
                      <td className="py-2.5 pr-3 text-right text-zinc-600">${f.rate}/hr</td>
                      <td className="py-2.5 pr-3 text-zinc-600">{f.sowEnd}</td>
                      <td className="py-2.5 pr-3 text-center">
                        <select value={f.status}
                          onChange={e => updateEngagement(f.engagementId, { status: e.target.value })}
                          className="text-xs font-bold font-mono rounded px-2 py-0.5 border-0 outline-none cursor-pointer bg-zinc-800 text-zinc-500">
                          <option value="active">ACTIVE</option>
                          <option value="extension">EXTENSION</option>
                          <option value="closed">CLOSED</option>
                        </select>
                      </td>
                      <td className="py-2.5 text-right text-zinc-600">{fmtFull(f.annualTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : view === 'forecast' ? (
        /* FORECAST VIEW — spreadsheet grid */
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-zinc-600 uppercase tracking-widest border-b border-zinc-800">
                <th className="text-left pb-3 pr-2 sticky left-0 bg-[var(--background)] z-10 min-w-[140px]">Consultant</th>
                {MONTHS.map((m, i) => (
                  <th key={m} className="text-right pb-3 px-1 min-w-[65px]">{m}</th>
                ))}
                <th className="text-right pb-3 pl-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(f => (
                <tr key={f.engagementId} className="border-b border-zinc-900 hover:bg-[var(--card)]">
                  <td className="py-2 pr-2 sticky left-0 bg-[var(--background)] z-10">
                    <div className="text-white font-bold">{f.consultantName}</div>
                    <div className="text-zinc-600 text-[10px]">{f.client} · ${f.rate}/hr</div>
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                    const cell = f.months[m];
                    const billing = cell?.billing ?? 0;
                    const endMonth = new Date(f.sowEnd).getMonth() + 1;
                    const endYear = new Date(f.sowEnd).getFullYear();
                    const isLastMonth = endYear === year && endMonth === m;
                    return (
                      <td key={m} className={`py-2 px-1 text-right ${
                        billing === 0 ? 'text-zinc-800'
                        : isLastMonth ? 'text-amber-400'
                        : 'text-zinc-300'
                      }`}>
                        {billing === 0 ? '·' : fmtK(billing)}
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 text-right text-white font-bold">{fmtK(f.annualTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700">
                <td className="pt-3 pr-2 text-zinc-400 font-bold sticky left-0 bg-[var(--background)] z-10">TOTAL</td>
                {monthTotals.map((t, i) => (
                  <td key={i} className="pt-3 px-1 text-right text-emerald-400 font-bold">{fmtK(t)}</td>
                ))}
                <td className="pt-3 pl-3 text-right text-white font-bold">{fmtK(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {/* PTO & HOLIDAYS VIEW */}
      {view === 'pto' && (
        <div className="space-y-6">

          {/* Public Holidays */}
          <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
            <p className="text-xs text-amber-400 font-mono font-bold uppercase tracking-widest mb-4">Public Holidays — {year}</p>
            <div className="space-y-1.5 mb-4">
              {publicHolidays.length === 0 ? (
                <p className="text-xs text-zinc-600 font-mono py-3 text-center">No public holidays set for {year}</p>
              ) : (
                publicHolidays.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <p className="text-sm text-zinc-300 font-mono">
                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <button onClick={() => removeHoliday(h.id)} className="text-zinc-700 hover:text-red-400 text-xs transition">✕</button>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none transition" />
              <button onClick={() => { if (newHolidayDate) { addHoliday(newHolidayDate); setNewHolidayDate(''); } }}
                disabled={!newHolidayDate}
                className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-30 transition">
                + Add Holiday
              </button>
            </div>
          </div>

          {/* Consultant PTO */}
          <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
            <p className="text-xs text-amber-400 font-mono font-bold uppercase tracking-widest mb-4">Consultant PTO — {year}</p>

            {/* Add PTO */}
            <div className="flex items-center gap-2 mb-4">
              <select value={newPtoConsultant} onChange={e => setNewPtoConsultant(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-amber-500/40 transition">
                <option value="">Select consultant…</option>
                {consultantsList.map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
              <input type="date" value={newPtoDate} onChange={e => setNewPtoDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none transition" />
              <button onClick={() => { if (newPtoConsultant && newPtoDate) { addHoliday(newPtoDate, newPtoConsultant); setNewPtoDate(''); } }}
                disabled={!newPtoConsultant || !newPtoDate}
                className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-30 transition">
                + Add PTO
              </button>
            </div>

            {/* PTO list grouped by consultant */}
            {pto.length === 0 ? (
              <p className="text-xs text-zinc-600 font-mono py-3 text-center">No PTO scheduled for {year}</p>
            ) : (
              <div className="space-y-3">
                {[...new Set(pto.map(p => p.consultant_id))].map(cId => {
                  const consultantPto = pto.filter(p => p.consultant_id === cId);
                  const name = consultantPto[0]?.consultants ? `${consultantPto[0].consultants.first_name} ${consultantPto[0].consultants.last_name}` : 'Unknown';
                  return (
                    <div key={cId}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-xs text-white font-bold">{name}</p>
                        <span className="text-[10px] text-zinc-600 font-mono">{consultantPto.length} day{consultantPto.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {consultantPto.sort((a, b) => a.date.localeCompare(b.date)).map(p => (
                          <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900/50 border border-zinc-800">
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <button onClick={() => removeHoliday(p.id)} className="text-zinc-700 hover:text-red-400 text-[10px] transition">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLIENTS MASTER VIEW */}
      {view === 'clients' && (
        <ClientsMaster clients={clients} onChange={load} />
      )}
    </div>
  );
}

function ClientsMaster({ clients, onChange }: { clients: { id: string; name: string; industry?: string | null; url?: string | null; credit_rating?: string | null; engagement_count?: number }[]; onChange: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  async function patch(id: string, patch: Record<string, string | null>) {
    await fetch('/api/engagements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'client', ...patch }),
    });
    onChange();
  }
  async function del(id: string) {
    const res = await fetch('/api/engagements', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'client' }),
    });
    const d = await res.json();
    if (!res.ok) { alert(d.error ?? 'Failed to delete'); return; }
    onChange();
  }
  async function addClient() {
    const name = newName.trim();
    if (!name) return;
    // Prevent dupes by case-insensitive match
    const existing = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) { alert(`Client "${existing.name}" already exists.`); return; }
    setAdding(true);
    const res = await fetch('/api/engagements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'client', name, industry: newIndustry.trim() || null, url: newUrl.trim() || null }),
    });
    const d = await res.json();
    setAdding(false);
    if (!res.ok) { alert(d.error ?? 'Failed to add'); return; }
    setNewName(''); setNewIndustry(''); setNewUrl('');
    setShowAdd(false);
    onChange();
  }

  const sorted = [...clients].sort((a, b) => (b.engagement_count ?? 0) - (a.engagement_count ?? 0) || a.name.localeCompare(b.name));
  return (
    <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-amber-400 font-mono font-bold uppercase tracking-widest">Clients Master — {clients.length} total</p>
        <button onClick={() => setShowAdd(s => !s)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition">
          {showAdd ? 'Cancel' : '+ New Client'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-4 rounded-lg border border-amber-500/20 bg-zinc-900/40 grid grid-cols-4 gap-3">
          <input autoFocus placeholder="Name *" value={newName} onChange={e => setNewName(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500" />
          <input placeholder="Industry" value={newIndustry} onChange={e => setNewIndustry(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500" />
          <input placeholder="URL" value={newUrl} onChange={e => setNewUrl(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500" />
          <button onClick={addClient} disabled={!newName.trim() || adding}
            className="px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest bg-amber-500 text-black disabled:opacity-40 transition">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}

      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-zinc-600 uppercase tracking-widest border-b border-zinc-800">
            <th className="text-left pb-3 pr-3">Name</th>
            <th className="text-left pb-3 pr-3">Industry</th>
            <th className="text-left pb-3 pr-3">URL</th>
            <th className="text-left pb-3 pr-3">Rating</th>
            <th className="text-right pb-3 pr-3">Engagements</th>
            <th className="text-right pb-3"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(c => (
            <tr key={c.id} className="border-b border-zinc-900 hover:bg-[var(--card)]">
              <td className="py-3 pr-3 text-white font-bold">
                <InlineEdit value={c.name} onSave={v => patch(c.id, { name: v })} />
              </td>
              <td className="py-3 pr-3 text-zinc-300">
                <InlineEdit value={c.industry ?? ''} onSave={v => patch(c.id, { industry: v || null })} />
              </td>
              <td className="py-3 pr-3 text-zinc-300">
                {c.url ? (
                  <div className="flex items-center gap-1.5">
                    <a href={c.url.startsWith('http') ? c.url : `https://${c.url}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 truncate max-w-[200px] inline-block">{c.url}</a>
                    <button onClick={() => patch(c.id, { url: null })} className="text-zinc-700 hover:text-red-400">✕</button>
                  </div>
                ) : (
                  <InlineEdit value="" onSave={v => patch(c.id, { url: v || null })} />
                )}
              </td>
              <td className="py-3 pr-3 text-zinc-400">
                <InlineEdit value={c.credit_rating ?? ''} onSave={v => patch(c.id, { credit_rating: v || null })} />
              </td>
              <td className="py-3 pr-3 text-right text-zinc-300 tabular-nums">{c.engagement_count ?? 0}</td>
              <td className="py-3 text-right">
                {(c.engagement_count ?? 0) === 0 && (
                  <button onClick={() => { if (confirm(`Delete ${c.name}?`)) del(c.id); }} className="text-zinc-600 hover:text-red-400 transition">Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-zinc-600 font-mono mt-3">Click any field to edit. Engagements use these as the source of truth — renames propagate everywhere.</p>
    </div>
  );
}
