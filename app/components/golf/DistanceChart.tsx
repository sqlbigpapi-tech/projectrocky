'use client';

import { useState, useCallback } from 'react';
import { Club, parseLoft } from '@/lib/golf/clubs';
import { estimateCarry, estimateTotal } from '@/lib/golf/estimate';
import ClubIcon, { categoryFor } from './ClubIcon';

function Thumb({ club, size = 'md' }: { club: Club; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-16 h-16' : 'w-20 h-20';
  const inner = size === 'sm' ? 'w-12 h-12' : 'w-14 h-14';
  const wrap = `shrink-0 ${sz} rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden p-1.5`;
  if (club.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <div className={wrap}>
        <img src={club.image} alt={club.club} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }
  return (
    <div className={wrap}>
      <ClubIcon category={categoryFor(club.club)} className={inner} />
    </div>
  );
}

type Field = 'club' | 'loft' | 'carry' | 'total' | 'model';

async function patchClub(id: string, patch: Partial<Club>): Promise<Club | null> {
  const r = await fetch('/api/golf/clubs', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...patch }),
  });
  if (!r.ok) return null;
  const { club } = await r.json();
  return club ?? null;
}

async function deleteClub(id: string): Promise<boolean> {
  const r = await fetch('/api/golf/clubs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  return r.ok;
}

async function addClub(c: Omit<Club, 'id'>): Promise<Club | null> {
  const r = await fetch('/api/golf/clubs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  });
  if (!r.ok) return null;
  const { club } = await r.json();
  return club ?? null;
}

/**
 * Inline editable cell. Click to edit, blur or Enter commits, Esc cancels.
 * Numeric fields use type=number; everything else is type=text.
 */
function Cell({
  value,
  field,
  onCommit,
  align = 'left',
  className = '',
}: {
  value: string | number;
  field: Field;
  onCommit: (next: string | number) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  const [editing, setEditing] = useState(false);

  const isNumeric = field === 'carry' || field === 'total';

  const commit = () => {
    const next = isNumeric ? Number(draft) : draft.trim();
    setEditing(false);
    if ((isNumeric ? next === Number(value) : next === String(value))) return;
    onCommit(next);
  };
  const cancel = () => { setDraft(String(value)); setEditing(false); };

  if (editing) {
    return (
      <input
        autoFocus
        type={isNumeric ? 'number' : 'text'}
        inputMode={isNumeric ? 'numeric' : undefined}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') cancel(); }}
        className={`w-full bg-zinc-900 border border-amber-500/40 rounded px-1.5 py-0.5 text-sm font-mono tabular-nums text-zinc-100 outline-none ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className={`w-full px-1.5 py-0.5 rounded text-sm font-mono tabular-nums hover:bg-zinc-800/60 transition ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      title="Click to edit"
    >
      {String(value)}
    </button>
  );
}

function AddClubForm({ bag, onSubmit, onCancel }: { bag: Club[]; onSubmit: (c: Omit<Club, 'id'>) => void; onCancel: () => void }) {
  const [club, setClub] = useState('');
  const [loft, setLoft] = useState('');
  const [carry, setCarry] = useState('');
  const [total, setTotal] = useState('');
  const [model, setModel] = useState('');

  const onLoftBlur = () => {
    const deg = parseLoft(loft);
    if (!Number.isFinite(deg)) return;
    if (!carry) {
      const c = estimateCarry(deg, bag);
      setCarry(String(c));
      if (!total) setTotal(String(estimateTotal(deg, c, bag)));
    }
  };

  const submit = () => {
    if (!club || !loft) return;
    const carryN = Number(carry) || estimateCarry(parseLoft(loft), bag);
    const totalN = Number(total) || estimateTotal(parseLoft(loft), carryN, bag);
    const nextPos = (bag.reduce((m, b) => Math.max(m, b.position), -1)) + 1;
    onSubmit({
      position: nextPos,
      club,
      loft: loft.endsWith('°') ? loft : `${loft}°`,
      carry: carryN,
      total: totalN,
      model,
    });
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mt-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-2">Add Club</div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <input
          autoFocus
          placeholder="Club name"
          value={club}
          onChange={e => setClub(e.target.value)}
          className="col-span-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm font-mono text-zinc-100 outline-none focus:border-amber-500/60"
        />
        <input
          placeholder="Loft"
          value={loft}
          onChange={e => setLoft(e.target.value)}
          onBlur={onLoftBlur}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm font-mono text-zinc-100 outline-none focus:border-amber-500/60"
        />
        <input
          placeholder="Carry"
          type="number"
          inputMode="numeric"
          value={carry}
          onChange={e => setCarry(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm font-mono text-zinc-100 tabular-nums outline-none focus:border-amber-500/60"
        />
        <input
          placeholder="Total"
          type="number"
          inputMode="numeric"
          value={total}
          onChange={e => setTotal(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm font-mono text-zinc-100 tabular-nums outline-none focus:border-amber-500/60"
        />
        <input
          placeholder="Model (optional)"
          value={model}
          onChange={e => setModel(e.target.value)}
          className="col-span-2 md:col-span-6 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm font-mono text-zinc-100 outline-none focus:border-amber-500/60"
        />
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={submit}
          disabled={!club || !loft}
          className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-[11px] font-mono font-bold tracking-widest hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          ADD
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-[11px] font-mono font-bold tracking-widest hover:bg-zinc-700 transition"
        >
          CANCEL
        </button>
        {loft && !carry && (
          <span className="text-[10px] font-mono text-zinc-500 self-center">
            Distance auto-fills on loft blur
          </span>
        )}
      </div>
    </div>
  );
}

export default function DistanceChart({ clubs, onChanged }: { clubs: Club[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const markPending = (id: string, on: boolean) => {
    setPending(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handlePatch = useCallback(async (c: Club, field: Field, value: string | number) => {
    if (!c.id) return;
    markPending(c.id, true);
    await patchClub(c.id, { [field]: value });
    markPending(c.id, false);
    onChanged();
  }, [onChanged]);

  const handleDelete = useCallback(async (c: Club) => {
    if (!c.id) return;
    if (!confirm(`Remove ${c.club} from the bag?`)) return;
    markPending(c.id, true);
    await deleteClub(c.id);
    markPending(c.id, false);
    onChanged();
  }, [onChanged]);

  const handleAdd = useCallback(async (next: Omit<Club, 'id'>) => {
    await addClub(next);
    setAdding(false);
    onChanged();
  }, [onChanged]);

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm font-mono">
          <thead className="bg-zinc-900/60">
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
              <th className="text-left px-3 py-2.5 font-semibold">Club</th>
              <th className="text-right px-3 py-2.5 font-semibold w-20">Loft</th>
              <th className="text-right px-3 py-2.5 font-semibold w-20">Carry</th>
              <th className="text-right px-3 py-2.5 font-semibold w-20">Total</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((c, i) => (
              <tr
                key={c.id ?? c.position}
                className={`border-t border-zinc-800/60 ${i % 2 === 0 ? 'bg-zinc-950/40' : ''} ${c.id && pending.has(c.id) ? 'opacity-60' : ''}`}
              >
                <td className="px-2 py-2 align-top w-[44%]">
                  <div className="flex items-start gap-2.5">
                    <Thumb club={c} size="sm" />
                    <div className="flex-1 min-w-0">
                      <Cell value={c.club} field="club" onCommit={v => handlePatch(c, 'club', v)} className="text-zinc-200" />
                      <div className="px-1.5">
                        <Cell
                          value={c.model}
                          field="model"
                          onCommit={v => handlePatch(c, 'model', v)}
                          className="text-[11px] text-zinc-500 leading-snug"
                        />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 align-top">
                  <Cell value={c.loft} field="loft" onCommit={v => handlePatch(c, 'loft', v)} align="right" className="text-zinc-400" />
                </td>
                <td className="px-2 py-2 align-top">
                  <Cell value={c.carry} field="carry" onCommit={v => handlePatch(c, 'carry', v)} align="right" className="text-zinc-100" />
                </td>
                <td className="px-2 py-2 align-top">
                  <Cell value={c.total} field="total" onCommit={v => handlePatch(c, 'total', v)} align="right" className="text-zinc-400" />
                </td>
                <td className="px-1 py-2 align-top text-right">
                  <button
                    onClick={() => handleDelete(c)}
                    title="Remove club"
                    className="text-zinc-700 hover:text-red-400 px-1.5 py-1 rounded transition"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {clubs.map(c => (
          <div
            key={c.id ?? c.position}
            className={`rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 ${c.id && pending.has(c.id) ? 'opacity-60' : ''}`}
          >
            {/* Top: photo + name + model + delete */}
            <div className="flex items-start gap-3">
              <Thumb club={c} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Cell
                      value={c.club}
                      field="club"
                      onCommit={v => handlePatch(c, 'club', v)}
                      className="text-base font-semibold text-zinc-100"
                    />
                  </div>
                  <button
                    onClick={() => handleDelete(c)}
                    className="text-zinc-700 hover:text-red-400 px-2 py-0.5 -mt-0.5 -mr-1 text-lg leading-none transition shrink-0"
                    title="Remove club"
                  >
                    ×
                  </button>
                </div>
                <Cell
                  value={c.model}
                  field="model"
                  onCommit={v => handlePatch(c, 'model', v)}
                  className="text-[11px] text-zinc-500 leading-snug"
                />
              </div>
            </div>

            {/* Bottom: stats row */}
            <div className="mt-3 pt-3 border-t border-zinc-800/60 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Loft</div>
                <Cell
                  value={c.loft}
                  field="loft"
                  onCommit={v => handlePatch(c, 'loft', v)}
                  align="left"
                  className="text-sm text-zinc-300 text-center"
                />
              </div>
              <div className="text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Carry</div>
                <Cell
                  value={c.carry}
                  field="carry"
                  onCommit={v => handlePatch(c, 'carry', v)}
                  align="left"
                  className="text-sm font-semibold text-zinc-100 tabular-nums text-center"
                />
              </div>
              <div className="text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Total</div>
                <Cell
                  value={c.total}
                  field="total"
                  onCommit={v => handlePatch(c, 'total', v)}
                  align="left"
                  className="text-sm text-zinc-400 tabular-nums text-center"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Club */}
      {adding ? (
        <AddClubForm bag={clubs} onSubmit={handleAdd} onCancel={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-xs font-mono font-bold tracking-widest text-zinc-500 hover:text-amber-400 hover:border-amber-500/40 transition"
        >
          + ADD CLUB
        </button>
      )}

      <p className="mt-2 text-[10px] font-mono text-zinc-600 px-1">
        Click any cell to edit · changes save to Supabase on blur
      </p>
    </div>
  );
}
