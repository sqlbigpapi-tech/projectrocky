'use client';
import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useToast } from '../page';

type Category = 'business' | 'depository' | 'retirement' | 'credit_card' | 'auto_loan' | 'personal_loan';
const LIABILITY_CATS: Category[] = ['credit_card', 'auto_loan', 'personal_loan'];

type Account = {
  id: string;
  name: string;
  category: Category;
  balance: number;
  priority?: boolean;
};

type Snapshot = {
  id: string;
  date: string;
  accounts: Account[];
};

const DEFAULT_ACCOUNTS: Account[] = [
  // Business Equity
  { id: 'sei_shares',       name: 'SEI-Miami LLC Shares',             category: 'business',      balance: 888797.00 },
  // Depository
  { id: 'cd',               name: 'Certificate of Deposit',           category: 'depository',    balance: 259296.65 },
  { id: 'no_penalty_cd',    name: 'No-Penalty CD',                    category: 'depository',    balance: 20000.00  },
  { id: 'money_market',     name: 'Premiere Money Market',            category: 'depository',    balance: 36479.68  },
  { id: 'spend',            name: 'Spend Account',                    category: 'depository',    balance: 13862.20  },
  { id: 'hysa',             name: 'High Yield Savings Account',       category: 'depository',    balance: 136.84    },
  // Retirement & Investments
  { id: 'ira',              name: 'IRA',                              category: 'retirement',    balance: 215201.82 },
  { id: 'sei_401k',         name: 'SEI 401(k) Plan',                  category: 'retirement',    balance: 61771.14  },
  { id: 'joint',            name: 'Joint Account',                    category: 'retirement',    balance: 3955.69   },
  { id: 'hsa',              name: 'Health Savings Account',           category: 'retirement',    balance: 344.21    },
  { id: 'allegiant_401k',   name: 'Allegiant 401(k) Plan',            category: 'retirement',    balance: 0         },
  // Credit Cards
  { id: 'sw_cc',            name: 'Southwest Rapid Rewards',          category: 'credit_card',   balance: 0 },
  { id: 'amex_plat',        name: 'Amex Platinum',                    category: 'credit_card',   balance: 6599.27   },
  { id: 'chase_4985',       name: 'Chase Ultimate Rewards (4985)',    category: 'credit_card',   balance: 4601.14   },
  { id: 'chase_prime',      name: 'Chase Prime Visa',                 category: 'credit_card',   balance: 6142.38   },
  { id: 'amex_blue',        name: 'Amex Blue Cash Preferred',         category: 'credit_card',   balance: 3553.68   },
  { id: 'delta_skymiles',   name: 'Delta SkyMiles Reserve',           category: 'credit_card',   balance: 1212.79   },
  { id: 'citi_simplicity',  name: 'Citi Simplicity',                  category: 'credit_card',   balance: 203.09    },
  { id: 'chase_9970',       name: 'Chase Ultimate Rewards (9970)',    category: 'credit_card',   balance: 138.45    },
  // Auto Loans
  { id: 'mercedes',         name: '2020 Mercedes-Benz (Ally)',        category: 'auto_loan',     balance: 25468.68  },
  { id: 'bmw',              name: '2018 BMW X1 (Ally)',               category: 'auto_loan',     balance: 19390.41  },
  // Personal Loans
  { id: 'pl_3084',          name: 'PL Loan Card (3084)',              category: 'personal_loan', balance: 36981.00  },
  { id: 'pl_1869',          name: 'PL Loan Card (1869)',              category: 'personal_loan', balance: 16858.60  },
  { id: 'pl_0419',          name: 'PL Loan Card (0419)',              category: 'personal_loan', balance: 0         },
];


const CAT_LABELS: Record<Category, string> = {
  business:      'Business Equity',
  depository:    'Depository',
  retirement:    'Retirement & Investments',
  credit_card:   'Credit Cards',
  auto_loan:     'Auto Loans',
  personal_loan: 'Personal Loans',
};

const CAT_COLORS: Record<Category, string> = {
  business:      '#f59e0b',
  depository:    '#34d399',
  retirement:    '#818cf8',
  credit_card:   '#f87171',
  auto_loan:     '#fb923c',
  personal_loan: '#f43f5e',
};

function fmt(n: number, compact = false): string {
  if (compact) {
    if (Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
    if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(0) + 'K';
    return '$' + n.toFixed(0);
  }
  return '$' + Math.round(n).toLocaleString('en-US');
}

function calcTotals(accounts: Account[]) {
  const assets = accounts.filter(a => !LIABILITY_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
  const liabilities = accounts.filter(a => LIABILITY_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
  return { assets, liabilities, netWorth: assets - liabilities };
}

function catTotal(accounts: Account[], cat: Category) {
  return accounts.filter(a => a.category === cat).reduce((s, a) => s + a.balance, 0);
}

type ExtractResult = {
  results: {
    extracted: { name: string; balance: number; last4: string | null; section: string | null };
    match: { id: string; name: string; category: Category; balance: number } | null;
    score: number;
    suggested_category: Category;
  }[];
  missing: { id: string; name: string; category: Category; current_balance: number }[];
  totals: {
    current: { assets: number; liab: number; net: number };
    proposed: { assets: number; liab: number; net: number; accounts: Account[] };
  };
};

function fmtMoney(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function ExtractModal({ onApply, onClose }: {
  onApply: (accounts: Account[]) => Promise<void>;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Per-row user decision: include or skip. Default include.
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<Record<number, Category>>({});

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...arr]);
  }

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  }

  async function extract() {
    if (files.length === 0) return;
    setExtracting(true);
    setErr(null);
    try {
      const form = new FormData();
      for (const f of files) form.append('images', f);
      const res = await fetch('/api/net-worth/extract', { method: 'POST', body: form });
      const d = await res.json();
      if (d.error) { setErr(d.error); return; }
      setResult(d);
      const inc: Record<number, boolean> = {};
      (d.results as ExtractResult['results']).forEach((_, i) => { inc[i] = true; });
      setIncluded(inc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  async function apply() {
    if (!result) return;
    setApplying(true);
    try {
      // Build final accounts: start with missing (untouched), layer in included updates & new.
      const final: Account[] = result.missing.map(m => ({
        id: m.id, name: m.name, category: m.category, balance: m.current_balance,
      }));

      result.results.forEach((r, i) => {
        if (!included[i]) return;
        if (r.match) {
          // Replace or add a matched account with the new balance
          const existing = final.find(a => a.id === r.match!.id);
          if (existing) existing.balance = r.extracted.balance;
          else final.push({
            id: r.match.id, name: r.match.name, category: r.match.category, balance: r.extracted.balance,
          });
        } else {
          // New account
          const id = r.extracted.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || `new_${i}`;
          final.push({
            id,
            name: r.extracted.name,
            category: categoryOverrides[i] ?? r.suggested_category,
            balance: r.extracted.balance,
          });
        }
      });

      await onApply(final);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-0 md:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[var(--card)] border border-zinc-800 w-full md:max-w-3xl md:rounded-xl min-h-screen md:min-h-0 md:my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-[var(--card)] z-10">
          <p className="text-sm font-bold text-white">Update Balances from Screenshots</p>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition">✕</button>
        </div>

        {!result && (
          <div className="px-5 py-5 space-y-4">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Drop screenshots from your external tracker (Copilot, Monarch, Kubera, etc).
              Rocky will read the balances, match them to your existing accounts, and show you
              a preview before saving. Add multiple images for a full view.
            </p>

            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              className="border-2 border-dashed border-zinc-700 hover:border-amber-500/50 hover:bg-amber-500/5 rounded-xl p-8 text-center cursor-pointer transition"
            >
              <p className="text-sm text-zinc-400 mb-1">Drop images here or click to browse</p>
              <p className="text-[11px] text-zinc-600 font-mono">PNG, JPG, WebP · up to ~10 images</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
                    <p className="text-xs font-mono text-zinc-300 truncate flex-1">{f.name}</p>
                    <p className="text-[10px] font-mono text-zinc-500 mx-3">{Math.round(f.size / 1024)} KB</p>
                    <button onClick={() => removeFile(i)} className="text-zinc-600 hover:text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}

            {err && <p className="text-xs text-red-400">{err}</p>}

            <div className="flex gap-2">
              <button
                onClick={extract}
                disabled={extracting || files.length === 0}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs py-2 rounded-lg transition"
              >
                {extracting ? 'Reading…' : `Extract balances (${files.length})`}
              </button>
              <button onClick={onClose} className="text-zinc-500 hover:text-white text-xs px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="px-5 py-5 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-zinc-800 p-3">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Current NW</p>
                <p className="text-lg font-bold font-mono tabular-nums text-zinc-400">{fmtMoney(result.totals.current.net)}</p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest mb-1">Proposed NW</p>
                <p className="text-lg font-bold font-mono tabular-nums text-amber-400">{fmtMoney(result.totals.proposed.net)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 p-3">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Δ</p>
                <p className={`text-lg font-bold font-mono tabular-nums ${result.totals.proposed.net >= result.totals.current.net ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.totals.proposed.net >= result.totals.current.net ? '+' : ''}{fmtMoney(result.totals.proposed.net - result.totals.current.net)}
                </p>
              </div>
            </div>

            {/* Row list */}
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              {result.results.map((r, i) => {
                const isNew = !r.match;
                const oldBal = r.match?.balance ?? 0;
                const delta = r.extracted.balance - oldBal;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition ${
                      !included[i] ? 'opacity-40 border-zinc-800' :
                      isNew ? 'border-cyan-500/30 bg-cyan-500/5' :
                      'border-zinc-800 bg-[var(--card)]/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={included[i] ?? true}
                      onChange={e => setIncluded(prev => ({ ...prev, [i]: e.target.checked }))}
                      className="accent-amber-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-white font-medium truncate">{r.extracted.name}</p>
                        {r.extracted.last4 && (
                          <span className="text-[10px] font-mono text-zinc-500">·{r.extracted.last4}</span>
                        )}
                        {isNew && (
                          <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded px-1.5">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-zinc-500 truncate">
                        {r.match ? `Matched "${r.match.name}"` : `Section: ${r.extracted.section ?? 'unknown'}`}
                      </p>
                    </div>
                    {isNew && (
                      <select
                        value={categoryOverrides[i] ?? r.suggested_category}
                        onChange={e => setCategoryOverrides(prev => ({ ...prev, [i]: e.target.value as Category }))}
                        className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono focus:outline-none"
                      >
                        <option value="business">Business</option>
                        <option value="depository">Depository</option>
                        <option value="retirement">Retirement</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="auto_loan">Auto Loan</option>
                        <option value="personal_loan">Personal Loan</option>
                      </select>
                    )}
                    <div className="text-right shrink-0 min-w-[120px]">
                      <p className="text-sm font-mono font-bold tabular-nums text-white">{fmtMoney(r.extracted.balance)}</p>
                      {r.match && delta !== 0 && (
                        <p className={`text-[10px] font-mono tabular-nums ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          was {fmtMoney(oldBal)} · {delta >= 0 ? '+' : ''}{fmtMoney(delta)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {result.missing.length > 0 && (
              <details className="text-xs">
                <summary className="text-zinc-500 cursor-pointer hover:text-zinc-300">
                  {result.missing.length} existing account{result.missing.length === 1 ? '' : 's'} not in the screenshots — balances will stay as-is ▾
                </summary>
                <div className="mt-2 pl-3 space-y-1 border-l border-zinc-800">
                  {result.missing.map(m => (
                    <div key={m.id} className="flex justify-between text-[11px] font-mono">
                      <span className="text-zinc-500">{m.name}</span>
                      <span className="text-zinc-600">{fmtMoney(m.current_balance)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {err && <p className="text-xs text-red-400">{err}</p>}

            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={apply}
                disabled={applying}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs py-2 rounded-lg transition"
              >
                {applying ? 'Saving…' : 'Save Snapshot'}
              </button>
              <button
                onClick={() => { setResult(null); setFiles([]); }}
                className="text-zinc-500 hover:text-white text-xs px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 transition"
              >
                Re-upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NetWorthTab() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [editing, setEditing] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAccount, setNewAccount] = useState<{ name: string; category: Category; balance: string }>({ name: '', category: 'depository' as Category, balance: '' });
  const [mounted, setMounted] = useState(false);
  const [recs, setRecs] = useState<{ category: string; priority: string; recommendation: string }[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [recsGeneratedAt, setRecsGeneratedAt] = useState<string | null>(null);

  type Assumptions = { age: string; salary: string; role: string; notes: string };
  const DEFAULT_ASSUMPTIONS: Assumptions = { age: '46', salary: '300000', role: 'Managing Director, part owner of SEI-Miami LLC', notes: 'SEI-Miami ownership stake is 100% vested and liquid. Southwest Rapid Rewards is highest priority debt.' };
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [assumptionsSaving, setAssumptionsSaving] = useState(false);

  const [myShares, setMyShares] = useState(2100.01);
  const [seiSharePrice, setSeiSharePrice] = useState<number | null>(null);
  const [showExtract, setShowExtract] = useState(false);
  const { toast } = useToast();

  function applySharePrice(accounts: Account[], price: number, shares?: number): Account[] {
    const s = shares ?? myShares;
    return accounts.map(a =>
      a.id === 'sei_shares' ? { ...a, balance: Math.round(s * price * 100) / 100 } : a
    );
  }

  useEffect(() => {
    setMounted(true);

    Promise.all([
      fetch('/api/net-worth').then(r => r.json()),
      fetch('/api/equity?year=2026').then(r => r.json()).catch(() => null),
      fetch('/api/settings?key=my_sei_shares').then(r => r.json()).catch(() => null),
    ]).then(([nwData, eqData, sharesData]) => {
      const sharePrice = eqData?.latest?.sharePrice ?? null;
      const savedShares = sharesData?.value ? parseFloat(sharesData.value) : 2100.01;
      setMyShares(savedShares);
      if (sharePrice) setSeiSharePrice(sharePrice);

      const snaps: Snapshot[] = (nwData.snapshots ?? []).map((s: any) => ({
        id: s.id,
        date: s.date,
        accounts: s.accounts as Account[],
      }));
      setSnapshots(snaps);

      // SEI shares balance comes from the saved snapshot (updated via Screenshot
      // import or the Update Balances form) — we no longer recompute it on load
      // from shares × price, so the last saved value is the source of truth.
      const accts = snaps.length > 0 ? snaps[snaps.length - 1].accounts : DEFAULT_ACCOUNTS;
      setEditing(accts);
    }).catch(() => setEditing(DEFAULT_ACCOUNTS));

    fetch('/api/settings?key=nw_assumptions')
      .then(r => r.json())
      .then(d => { if (d.value) setAssumptions(JSON.parse(d.value)); })
      .catch(() => {});
  }, []);

  async function saveAssumptions() {
    setAssumptionsSaving(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'nw_assumptions', value: JSON.stringify(assumptions) }),
    }).catch(() => {});
    setAssumptionsSaving(false);
    setShowAssumptions(false);
  }

  if (!mounted) return null;

  // Use editing (which has live share price applied) as the current view
  const current = editing;

  const { assets, liabilities, netWorth } = calcTotals(current);

  const prev = snapshots.length > 1
    ? calcTotals(snapshots[snapshots.length - 2].accounts).netWorth
    : null;
  const weekChange = prev != null ? netWorth - prev : null;

  // Trajectory chart data
  const trajectoryData = snapshots.map(s => {
    const { netWorth } = calcTotals(s.accounts);
    return {
      date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      netWorth,
    };
  });
  // If no snapshots yet, show a single point with defaults
  if (trajectoryData.length === 0) {
    trajectoryData.push({ date: 'Today', netWorth: calcTotals(DEFAULT_ACCOUNTS).netWorth });
  }

  async function saveSnapshot() {
    setSaving(true);
    try {
      const res = await fetch('/api/net-worth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: editing }),
      });
      const d = await res.json();
      if (d.snapshot) {
        const snap: Snapshot = { id: d.snapshot.id, date: d.snapshot.date, accounts: d.snapshot.accounts };
        setSnapshots(prev => {
          const exists = prev.some(s => s.id === snap.id);
          return exists ? prev.map(s => s.id === snap.id ? snap : s) : [...prev, snap];
        });
      }
      setShowForm(false);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  async function applyExtractedAccounts(accounts: Account[]) {
    const res = await fetch('/api/net-worth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts }),
    });
    const d = await res.json();
    if (d.snapshot) {
      const snap: Snapshot = { id: d.snapshot.id, date: d.snapshot.date, accounts: d.snapshot.accounts };
      setSnapshots(prev => {
        const exists = prev.some(s => s.id === snap.id);
        return exists ? prev.map(s => s.id === snap.id ? snap : s) : [...prev, snap];
      });
      setEditing(snap.accounts);
      toast('Snapshot saved from screenshots', 'success');
    } else if (d.error) {
      toast(`Save failed: ${d.error}`, 'error');
    }
  }

  function updateBalance(id: string, val: string) {
    const num = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
    setEditing(prev => prev.map(a => a.id === id ? { ...a, balance: num } : a));
  }

  function updateName(id: string, name: string) {
    setEditing(prev => prev.map(a => a.id === id ? { ...a, name } : a));
  }

  function removeAccount(id: string) {
    setEditing(prev => prev.filter(a => a.id !== id));
  }

  function addAccount() {
    if (!newAccount.name.trim()) return;
    const account: Account = {
      id: Date.now().toString(),
      name: newAccount.name.trim(),
      category: newAccount.category,
      balance: parseFloat(newAccount.balance.replace(/[^0-9.]/g, '')) || 0,
    };
    setEditing(prev => [...prev, account]);
    setNewAccount({ name: '', category: 'depository' as Category, balance: '' });
  }

  async function getRecommendations() {
    setRecsLoading(true);
    setRecsError(null);
    try {
      const res = await fetch('/api/net-worth/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: current, assumptions }),
      });
      const d = await res.json();
      if (d.error) { setRecsError(d.error); return; }
      setRecs(d.recommendations ?? []);
      setRecsGeneratedAt(d.generatedAt ?? new Date().toISOString());
    } catch {
      setRecsError('Failed to fetch recommendations.');
    } finally {
      setRecsLoading(false);
    }
  }

  const categories: Category[] = ['business', 'depository', 'retirement', 'credit_card', 'auto_loan', 'personal_loan'];

  return (
    <div className="space-y-4">

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Assets',      value: assets,      color: 'text-emerald-400', border: 'border-emerald-600/20', bg: 'from-emerald-950/20' },
          { label: 'Total Liabilities', value: liabilities, color: 'text-red-400',     border: 'border-red-600/20',     bg: 'from-red-950/20'     },
          { label: 'Net Worth',         value: netWorth,    color: 'text-amber-400',   border: 'border-amber-600/20',   bg: 'from-amber-950/20'   },
          { label: 'Debt-to-Asset',     value: null,        color: 'text-zinc-300',    border: 'border-zinc-700',       bg: 'from-zinc-900'       },
        ].map((card, i) => (
          <div key={i} className={`rounded-2xl border ${card.border} bg-gradient-to-br ${card.bg} via-zinc-950 to-zinc-950 p-4`}>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-2">{card.label}</p>
            {card.value !== null ? (
              <>
                <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{fmt(card.value)}</p>
                {card.label === 'Net Worth' && weekChange !== null && (
                  <p className={`text-xs font-mono mt-1 ${weekChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {weekChange >= 0 ? '+' : ''}{fmt(weekChange)} WoW
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums text-zinc-300">
                  {assets > 0 ? ((liabilities / assets) * 100).toFixed(1) : '0.0'}%
                </p>
                <p className="text-xs text-zinc-600 font-mono mt-1">liabilities / assets</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Net Worth Trajectory (full width) ── */}
      <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-4">Net Worth Trajectory</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trajectoryData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt(v, true)} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={60} />
            <Tooltip
              contentStyle={{ background: '#09090b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#a1a1aa' }}
              formatter={(v: unknown) => [fmt(Number(v)), 'Net Worth']}
            />
            <Line type="monotone" dataKey="netWorth" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── AI Recommendations (moved up) ── */}
      <div className="bg-[var(--card)] rounded-xl border border-violet-500/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-violet-400 font-mono uppercase tracking-widest">✦ AI Recommendations</p>
            {recsGeneratedAt && (
              <p className="text-xs text-zinc-700 font-mono mt-0.5">
                Last generated {new Date(recsGeneratedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssumptions(v => !v)}
              className="px-3 py-2 rounded-xl text-xs font-mono text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              {showAssumptions ? 'Hide' : 'Assumptions'}
            </button>
            <button
              onClick={getRecommendations}
              disabled={recsLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {recsLoading ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>{recs.length > 0 ? 'Refresh' : 'Get Recommendations'}</>
              )}
            </button>
          </div>
        </div>

        {showAssumptions && (
          <div className="mb-5 p-4 rounded-xl border border-zinc-700 bg-[var(--card)]/50 space-y-3">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-1">Context sent to AI</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 font-mono mb-1 block">Age</label>
                <input
                  type="number"
                  value={assumptions.age}
                  onChange={e => setAssumptions(p => ({ ...p, age: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--card)] border border-zinc-700 text-sm text-white font-mono focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-mono mb-1 block">Base Salary</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                  <input
                    type="number"
                    value={assumptions.salary}
                    onChange={e => setAssumptions(p => ({ ...p, salary: e.target.value }))}
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[var(--card)] border border-zinc-700 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-mono mb-1 block">Role / Title</label>
              <input
                type="text"
                value={assumptions.role}
                onChange={e => setAssumptions(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--card)] border border-zinc-700 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-mono mb-1 block">Additional Context</label>
              <textarea
                rows={3}
                value={assumptions.notes}
                onChange={e => setAssumptions(p => ({ ...p, notes: e.target.value }))}
                placeholder="E.g. planning to sell SEI stake in 3 years, spouse also employed, targeting early retirement at 55..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-zinc-700 text-sm text-white resize-none placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={saveAssumptions}
                disabled={assumptionsSaving}
                className="px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
              >
                {assumptionsSaving ? 'Saving…' : 'Save Assumptions'}
              </button>
            </div>
          </div>
        )}

        {recsError && <p className="text-sm text-red-400 font-mono">{recsError}</p>}

        {recs.length === 0 && !recsLoading && !recsError && (
          <p className="text-sm text-zinc-600 font-mono">Hit the button for a fresh read on your numbers.</p>
        )}

        {recs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recs.map((r, i) => {
              const priorityStyles = {
                high:   { border: 'border-red-500/30',   bg: 'bg-red-500/5',   badge: 'bg-red-500/20 text-red-400',   dot: 'bg-red-400'   },
                medium: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-400' },
                low:    { border: 'border-green-500/30', bg: 'bg-green-500/5', badge: 'bg-green-500/20 text-green-400', dot: 'bg-green-400' },
              };
              const s = priorityStyles[r.priority as keyof typeof priorityStyles] ?? priorityStyles.low;
              return (
                <div key={i} className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-400">{r.category}</p>
                    <span className={`flex items-center gap-1.5 text-xs font-bold font-mono px-2 py-0.5 rounded-full ${s.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {r.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">{r.recommendation}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Account Breakdown ── */}
      <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Accounts</p>
          <div className="flex items-center gap-2">
            {snapshots.length > 0 && (
              <p className="text-xs text-zinc-600 font-mono">
                Last updated {new Date(snapshots[snapshots.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
            <button
              onClick={() => setShowExtract(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
            >
              📷 From Screenshot
            </button>
            <button
              onClick={() => {
                const defaultById = Object.fromEntries(DEFAULT_ACCOUNTS.map(a => [a.id, a]));
                // Remap old 'liability' accounts to new sub-categories and refresh balances from defaults
                const validCats = ['business','depository','retirement','credit_card','auto_loan','personal_loan'];
                const base = current.map(a => {
                  if (!validCats.includes(a.category)) {
                    const def = defaultById[a.id];
                    return { ...a, category: def?.category ?? 'credit_card' as Category, balance: def?.balance ?? a.balance };
                  }
                  return { ...a };
                });
                const existingIds = new Set(base.map(a => a.id));
                const merged = [...base, ...DEFAULT_ACCOUNTS.filter(a => !existingIds.has(a.id))];
                setEditing(merged);
                setShowForm(!showForm);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              {showForm ? 'Cancel' : 'Update Balances'}
            </button>
          </div>
        </div>

        {(() => {
          // Previous snapshot for delta calculations
          const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
          const prevById = new Map<string, number>();
          if (prev) for (const a of prev.accounts) prevById.set(a.id, a.balance);

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map(cat => {
                const accounts = current
                  .filter(a => a.category === cat)
                  .sort((a, b) => b.balance - a.balance);
                const total = accounts.reduce((s, a) => s + a.balance, 0);
                const isLiability = LIABILITY_CATS.includes(cat);
                const catColor = CAT_COLORS[cat];
                const maxBal = Math.max(...accounts.map(a => a.balance), 1);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold font-mono uppercase tracking-widest" style={{ color: catColor }}>
                        {CAT_LABELS[cat]}
                      </p>
                      <p className={`text-sm font-bold tabular-nums ${isLiability ? 'text-red-400' : 'text-zinc-300'}`}>{fmt(total)}</p>
                    </div>
                    <div className="space-y-1">
                      {accounts.map(a => {
                        const prevBal = prevById.get(a.id);
                        const delta = prevBal != null ? a.balance - prevBal : null;
                        const zeroLiability = isLiability && a.balance === 0;
                        const widthPct = total > 0 ? Math.max(2, (a.balance / maxBal) * 100) : 0;
                        return (
                          <div
                            key={a.id}
                            className={`relative px-3 py-2 rounded-lg bg-[var(--card)]/50 border border-zinc-800 overflow-hidden ${zeroLiability ? 'opacity-40' : ''}`}
                          >
                            {/* Weight bar — subtle color fill */}
                            {a.balance > 0 && (
                              <div
                                className="absolute inset-y-0 left-0 opacity-[0.08] pointer-events-none"
                                style={{ width: `${widthPct}%`, background: catColor }}
                              />
                            )}
                            <div className="relative flex items-center justify-between gap-3">
                              <p className="text-sm text-zinc-300 truncate flex-1">{a.name}</p>
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-mono tabular-nums font-medium ${isLiability ? 'text-red-400/80' : 'text-zinc-200'}`}>
                                  {fmt(a.balance)}
                                </p>
                                {delta != null && delta !== 0 && (
                                  <p className={`text-[10px] font-mono tabular-nums ${
                                    (isLiability ? delta < 0 : delta > 0) ? 'text-emerald-400' : 'text-red-400'
                                  }`}>
                                    {delta > 0 ? '+' : ''}{fmt(delta, true)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── Update Form ── */}
      {showForm && (
        <div className="bg-[var(--card)] rounded-xl border border-amber-500/20 p-5">
          <p className="text-xs text-amber-400/70 font-mono uppercase tracking-widest mb-5">Update Balances · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {categories.map(cat => (
              <div key={cat}>
                <p className="text-xs font-bold font-mono uppercase tracking-widest mb-3" style={{ color: CAT_COLORS[cat] }}>
                  {CAT_LABELS[cat]}
                </p>
                <div className="space-y-2">
                  {editing.filter(a => a.category === cat).map(a => (
                    <div key={a.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={a.name}
                        onChange={e => updateName(a.id, e.target.value)}
                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                      {a.id === 'sei_shares' && seiSharePrice ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            step="0.01"
                            value={myShares}
                            onChange={e => {
                              const s = parseFloat(e.target.value) || 0;
                              setMyShares(s);
                              setEditing(prev => applySharePrice(prev, seiSharePrice, s));
                            }}
                            onBlur={() => {
                              fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'my_sei_shares', value: String(myShares) }) });
                            }}
                            className="w-24 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-amber-400 font-mono tabular-nums focus:outline-none focus:border-amber-500/50 transition-colors"
                            title="Shares owned"
                          />
                          <span className="text-xs text-zinc-600 font-mono">shares</span>
                          <span className="text-xs text-zinc-600 font-mono">@ ${seiSharePrice.toFixed(2)}</span>
                          <span className="text-sm text-white font-mono font-bold w-28 text-right">${Math.round(a.balance).toLocaleString()}</span>
                        </div>
                      ) : (
                        <div className="relative shrink-0">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={a.balance}
                            onChange={e => updateBalance(a.id, e.target.value)}
                            className="w-32 pl-7 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-amber-500/50 transition-colors"
                          />
                        </div>
                      )}
                      <button onClick={() => removeAccount(a.id)} className="text-zinc-700 hover:text-red-400 transition-colors text-lg leading-none shrink-0" title="Remove">×</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Add new account */}
          <div className="border-t border-zinc-800 pt-5 mb-5">
            <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-3">Add Account</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Account name"
                value={newAccount.name}
                onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))}
                className="flex-1 min-w-40 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <select
                value={newAccount.category}
                onChange={e => setNewAccount(p => ({ ...p, category: e.target.value as Category }))}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50 transition-colors"
              >
                {categories.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={newAccount.balance}
                  onChange={e => setNewAccount(p => ({ ...p, balance: e.target.value }))}
                  className="w-32 pl-7 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-white font-mono tabular-nums placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <button
                onClick={addAccount}
                disabled={!newAccount.name.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                + Add
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500 font-mono">New net worth</p>
              <p className="text-xl font-bold text-amber-400 tabular-nums">{fmt(calcTotals(editing).netWorth)}</p>
            </div>
            <button
              onClick={saveSnapshot}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold font-mono tracking-widest bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-colors shadow-lg shadow-amber-500/20"
            >
              {saving ? 'Saving…' : 'Save Snapshot'}
            </button>
          </div>
        </div>
      )}

      {/* ── Snapshot History ── */}
      {snapshots.length > 1 && (
        <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-4">Snapshot History</p>
          <div className="space-y-1.5">
            {[...snapshots].reverse().map((s, i) => {
              const { netWorth, assets, liabilities } = calcTotals(s.accounts);
              const prevSnap = [...snapshots].reverse()[i + 1];
              const change = prevSnap ? netWorth - calcTotals(prevSnap.accounts).netWorth : null;
              return (
                <div key={s.id} className="flex items-center gap-4 px-3 py-2.5 rounded-lg bg-[var(--card)]/50 border border-zinc-800">
                  <p className="text-xs text-zinc-500 font-mono w-24 shrink-0">
                    {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </p>
                  <p className="text-sm font-bold text-amber-400 tabular-nums font-mono flex-1">{fmt(netWorth)}</p>
                  <p className="text-xs text-zinc-600 font-mono hidden md:block">Assets {fmt(assets, true)} · Liabilities {fmt(liabilities, true)}</p>
                  {change !== null && (
                    <p className={`text-xs font-mono tabular-nums w-20 text-right ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {change >= 0 ? '+' : ''}{fmt(change, true)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showExtract && (
        <ExtractModal
          onApply={applyExtractedAccounts}
          onClose={() => setShowExtract(false)}
        />
      )}

    </div>
  );
}
