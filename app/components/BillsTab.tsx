'use client';
import { useState, useEffect } from 'react';

type Bill = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  frequency: 'once' | 'weekly' | 'monthly' | 'annually';
  category: string;
  source: 'manual' | 'plaid';
  reminder_days_before: number;
  last_paid_date: string | null;
  is_active: boolean;
};

type Transaction = { transaction_id: string; name: string; date: string; amount: number; category?: string[] };
type PlaidBill = { name: string; amount: number; nextDate: string; daysUntil: number; frequency: string };
type DetectedBill = { name: string; amount: number; due_date: string; frequency: string; category: string; selected: boolean };

const CATEGORIES = ['Housing', 'Utilities', 'Subscriptions', 'Insurance', 'Loans', 'Food', 'Transport', 'Health', 'Entertainment', 'Other'];
const FREQ_LABELS: Record<string, string> = { once: 'One-time', weekly: 'Weekly', monthly: 'Monthly', annually: 'Annually' };
const PLAID_FREQ_MAP: Record<string, string> = {
  monthly: 'monthly', weekly: 'weekly', annually: 'annually',
  biweekly: 'weekly', semi_monthly: 'monthly', unknown: 'monthly',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function getOccurrenceDays(bill: Bill, year: number, month: number): number[] {
  const base = new Date(bill.due_date + 'T12:00:00');
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  switch (bill.frequency) {
    case 'monthly': return base.getDate() <= daysInMonth ? [base.getDate()] : [];
    case 'weekly': {
      const dow = base.getDay();
      return Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => new Date(year, month, d).getDay() === dow);
    }
    case 'annually': return base.getMonth() === month && base.getDate() <= daysInMonth ? [base.getDate()] : [];
    default: return base.getFullYear() === year && base.getMonth() === month ? [base.getDate()] : [];
  }
}

function getNextOccurrence(bill: Bill): { date: string; daysUntil: number } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const base = new Date(bill.due_date + 'T12:00:00');
  if (bill.frequency === 'once') {
    return { date: bill.due_date, daysUntil: Math.ceil((base.getTime() - today.getTime()) / 86400000) };
  }
  let next = new Date(base);
  while (next < today) {
    if (bill.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else if (bill.frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (bill.frequency === 'annually') next.setFullYear(next.getFullYear() + 1);
  }
  return { date: next.toISOString().split('T')[0], daysUntil: Math.ceil((next.getTime() - today.getTime()) / 86400000) };
}

function isPaidThisPeriod(bill: Bill): boolean {
  if (!bill.last_paid_date) return false;
  const paid = new Date(bill.last_paid_date + 'T12:00:00');
  const { date } = getNextOccurrence(bill);
  const due = new Date(date + 'T12:00:00');
  switch (bill.frequency) {
    case 'monthly': return paid.getMonth() === due.getMonth() && paid.getFullYear() === due.getFullYear();
    case 'weekly': return Math.abs(due.getTime() - paid.getTime()) / 86400000 <= 7;
    case 'annually': return paid.getFullYear() === due.getFullYear();
    default: return true;
  }
}

function detectRecurring(transactions: Transaction[]): Omit<DetectedBill, 'selected'>[] {
  const byMerchant: Record<string, Transaction[]> = {};
  for (const t of transactions.filter(t => t.amount > 0)) {
    const key = t.name.toLowerCase().trim();
    if (!byMerchant[key]) byMerchant[key] = [];
    byMerchant[key].push(t);
  }
  const results: Omit<DetectedBill, 'selected'>[] = [];
  for (const txns of Object.values(byMerchant)) {
    if (txns.length < 2) continue;
    const sorted = [...txns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000);
    }
    const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length;
    const amounts = txns.map(t => t.amount);
    const avgAmount = amounts.reduce((s, x) => s + x, 0) / amounts.length;
    if ((Math.max(...amounts) - Math.min(...amounts)) / avgAmount > 0.3) continue;

    let frequency: string | null = null;
    if (avgInterval >= 25 && avgInterval <= 35) frequency = 'monthly';
    else if (avgInterval >= 6 && avgInterval <= 8) frequency = 'weekly';
    else if (avgInterval >= 350 && avgInterval <= 380) frequency = 'annually';
    if (!frequency) continue;

    const last = new Date(sorted[sorted.length - 1].date + 'T12:00:00');
    if (frequency === 'monthly') last.setMonth(last.getMonth() + 1);
    else if (frequency === 'weekly') last.setDate(last.getDate() + 7);
    else last.setFullYear(last.getFullYear() + 1);

    results.push({
      name: txns[0].name,
      amount: parseFloat(avgAmount.toFixed(2)),
      due_date: last.toISOString().split('T')[0],
      frequency,
      category: txns[0].category?.[0] || 'Other',
    });
  }
  return results.sort((a, b) => b.amount - a.amount).slice(0, 20);
}

const defaultForm = { name: '', amount: '', due_date: '', frequency: 'monthly', category: 'Other', reminder_days_before: '7' };

export default function BillsTab({
  plaidBills,
  transactions,
  onDueCount,
}: {
  plaidBills: PlaidBill[];
  transactions: Transaction[];
  onDueCount: (n: number) => void;
}) {
  const todayDate = new Date();
  const [bills, setBills] = useState<Bill[]>([]);
  const [month, setMonth] = useState(todayDate.getMonth());
  const [year, setYear] = useState(todayDate.getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [syncing, setSyncing] = useState(false);
  const [showDetect, setShowDetect] = useState(false);
  const [detected, setDetected] = useState<DetectedBill[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetch('/api/bills').then(r => r.json()).then(({ bills }) => setBills(bills || []));
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  useEffect(() => {
    const due = bills.filter(b => {
      const { daysUntil } = getNextOccurrence(b);
      return daysUntil >= 0 && daysUntil <= 7 && !isPaidThisPeriod(b);
    });
    onDueCount(due.length);
    if (Notification.permission === 'granted') {
      due.forEach(b => {
        const { daysUntil } = getNextOccurrence(b);
        new Notification(`Bill Due: ${b.name}`, {
          body: `${fmt(b.amount)} due ${daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}`,
        });
      });
    }
  }, [bills, onDueCount]);

  const patchBill = async (id: string, updates: Partial<Bill>) => {
    const res = await fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    const { bill } = await res.json();
    setBills(prev => prev.map(b => b.id === bill.id ? bill : b));
  };

  const saveBill = async () => {
    const payload = {
      ...(editBill ? { id: editBill.id } : {}),
      name: form.name,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      frequency: form.frequency,
      category: form.category,
      reminder_days_before: parseInt(form.reminder_days_before),
      source: 'manual',
    };
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const { bill } = await res.json();
    setBills(prev => editBill ? prev.map(b => b.id === bill.id ? bill : b) : [...prev, bill]);
    closeModal();
  };

  const deleteBill = async (id: string) => {
    await fetch('/api/bills', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setBills(prev => prev.filter(b => b.id !== id));
  };

  const togglePaid = (bill: Bill) => {
    const today = new Date().toISOString().split('T')[0];
    patchBill(bill.id, { last_paid_date: isPaidThisPeriod(bill) ? null : today } as Partial<Bill>);
  };

  const syncPlaid = async () => {
    setSyncing(true);
    const existing = new Set(bills.filter(b => b.source === 'plaid').map(b => b.name));
    for (const pb of plaidBills.filter(pb => !existing.has(pb.name))) {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pb.name, amount: pb.amount, due_date: pb.nextDate,
          frequency: PLAID_FREQ_MAP[pb.frequency?.toLowerCase().replace(' ', '_')] || 'monthly',
          category: 'Other', reminder_days_before: 7, source: 'plaid',
        }),
      });
      const { bill } = await res.json();
      setBills(prev => [...prev, bill]);
    }
    setSyncing(false);
  };

  const openDetect = () => {
    const existing = new Set(bills.map(b => b.name.toLowerCase()));
    const found = detectRecurring(transactions)
      .filter(d => !existing.has(d.name.toLowerCase()))
      .map(d => ({ ...d, selected: true }));
    setDetected(found);
    setShowDetect(true);
  };

  const importDetected = async () => {
    setImporting(true);
    for (const d of detected.filter(d => d.selected)) {
      const { selected: _, ...payload } = d;
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, reminder_days_before: 7, source: 'manual' }),
      });
      const { bill } = await res.json();
      setBills(prev => [...prev, bill]);
    }
    setImporting(false);
    setShowDetect(false);
  };

  const openAdd = () => {
    setEditBill(null);
    setForm({ ...defaultForm, due_date: todayDate.toISOString().split('T')[0] });
    setShowModal(true);
  };

  const openEdit = (bill: Bill) => {
    setEditBill(bill);
    setForm({
      name: bill.name, amount: String(bill.amount), due_date: bill.due_date,
      frequency: bill.frequency, category: bill.category || 'Other',
      reminder_days_before: String(bill.reminder_days_before),
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditBill(null); };

  // Calendar
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
  const dayBillsMap: Record<number, Bill[]> = {};
  for (const bill of bills) {
    for (const d of getOccurrenceDays(bill, year, month)) {
      if (!dayBillsMap[d]) dayBillsMap[d] = [];
      dayBillsMap[d].push(bill);
    }
  }
  const prevMonth = () => month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1);
  const nextMonth = () => month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1);

  // List
  const upcoming = bills
    .map(b => ({ ...b, ...getNextOccurrence(b), paid: isPaidThisPeriod(b) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const reminders = upcoming.filter(b => b.daysUntil >= 0 && b.daysUntil <= 7 && !b.paid);

  return (
    <div>
      {/* Reminder banners */}
      {reminders.length > 0 && (
        <div className="mb-6 space-y-2">
          {reminders.map(b => (
            <div key={b.id} className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-yellow-400 text-lg">⚠</span>
                <p className="text-yellow-300 text-sm">
                  <span className="font-bold">{b.name}</span> — {fmt(b.amount)} due{' '}
                  {b.daysUntil === 0 ? 'today' : `in ${b.daysUntil} day${b.daysUntil !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button onClick={() => togglePaid(b)}
                className="text-xs text-yellow-400 border border-yellow-400/30 px-3 py-1 rounded-lg hover:bg-yellow-400/10 transition shrink-0">
                Mark Paid
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Bills</h2>
        <div className="flex gap-2 flex-wrap">
          {transactions.length > 0 && (
            <button onClick={openDetect}
              className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition">
              Auto-detect
            </button>
          )}
          {plaidBills.length > 0 && (
            <button onClick={syncPlaid} disabled={syncing}
              className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition disabled:opacity-50">
              {syncing ? 'Syncing…' : 'Sync Plaid'}
            </button>
          )}
          <button onClick={openAdd}
            className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition">
            + Add Bill
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <div className="flex justify-between items-center mb-5">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">←</button>
          <h3 className="font-semibold">{monthName} {year}</h3>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDow }).map((_, i) => <div key={`pad${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear();
            const dayBills = dayBillsMap[day] || [];
            const total = dayBills.reduce((s, b) => s + b.amount, 0);
            const allPaid = dayBills.length > 0 && dayBills.every(isPaidThisPeriod);
            return (
              <div key={day} className={`min-h-[72px] rounded-lg p-1.5 border transition ${
                isToday ? 'border-indigo-500/60 bg-indigo-950/40'
                  : allPaid ? 'border-green-800/40 bg-green-950/20'
                  : dayBills.length ? 'border-gray-700 bg-gray-800/40'
                  : 'border-gray-800/40 bg-gray-800/10'
              }`}>
                <p className={`text-xs font-semibold mb-1 ${isToday ? 'text-indigo-400' : 'text-gray-500'}`}>{day}</p>
                {dayBills.length > 0 && (
                  <>
                    <button onClick={() => openEdit(dayBills[0])}
                      className={`w-full text-left text-xs rounded px-1 py-0.5 mb-0.5 truncate transition ${
                        isPaidThisPeriod(dayBills[0])
                          ? 'bg-green-500/20 text-green-400 line-through'
                          : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                      }`}>
                      {dayBills[0].name.length > 9 ? dayBills[0].name.slice(0, 9) + '…' : dayBills[0].name}
                    </button>
                    <p className={`text-xs font-medium ${allPaid ? 'text-green-500' : 'text-red-400'}`}>
                      {dayBills.length > 1 ? `+${dayBills.length - 1} · ` : ''}{fmt(total)}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bill list */}
      {upcoming.length > 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold mb-4">All Bills</h3>
          <div className="space-y-3">
            {upcoming.map((bill, idx) => (
              <div key={`${bill.id}-${idx}`}
                className={`flex justify-between items-center border-b border-gray-800 pb-3 last:border-0 last:pb-0 transition ${bill.paid ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => togglePaid(bill)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                      bill.paid ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-green-400'
                    }`}>
                    {bill.paid && <span className="text-white text-xs leading-none">✓</span>}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium text-sm ${bill.paid ? 'line-through text-gray-500' : ''}`}>{bill.name}</p>
                      <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{bill.category || 'Other'}</span>
                      {bill.source === 'plaid' && (
                        <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">Plaid</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {FREQ_LABELS[bill.frequency]} · due {bill.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <div className="text-right">
                    <p className={`font-bold text-sm ${bill.paid ? 'text-green-500' : 'text-red-400'}`}>{fmt(bill.amount)}</p>
                    {!bill.paid && (
                      <p className={`text-xs ${bill.daysUntil <= 7 ? 'text-yellow-400' : 'text-gray-600'}`}>
                        {bill.daysUntil < 0 ? 'overdue' : bill.daysUntil === 0 ? 'today' : `in ${bill.daysUntil}d`}
                      </p>
                    )}
                  </div>
                  <button onClick={() => openEdit(bill)} className="text-gray-600 hover:text-gray-300 text-xs transition">edit</button>
                  <button onClick={() => deleteBill(bill.id)} className="text-red-900 hover:text-red-400 transition">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center text-gray-500">
          No bills yet — add one manually, sync from Plaid, or use Auto-detect.
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-5">{editBill ? 'Edit Bill' : 'Add Bill'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Netflix, Rent, etc."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    <option value="once">One-time</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Remind me <span className="text-white font-semibold">{form.reminder_days_before} day{form.reminder_days_before !== '1' ? 's' : ''}</span> before
                </label>
                <input type="range" min="0" max="14" value={form.reminder_days_before}
                  onChange={e => setForm(f => ({ ...f, reminder_days_before: e.target.value }))}
                  className="w-full accent-indigo-500" />
                <div className="flex justify-between text-xs text-gray-600 mt-1"><span>0</span><span>14</span></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition text-sm">Cancel</button>
              <button onClick={saveBill} disabled={!form.name || !form.amount || !form.due_date}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition text-sm disabled:opacity-40">
                {editBill ? 'Save' : 'Add Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-detect Modal */}
      {showDetect && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowDetect(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Auto-detected Bills</h3>
            <p className="text-sm text-gray-400 mb-4">Recurring patterns found in your transaction history. Select which to import.</p>
            {detected.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No new recurring patterns detected.</p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
                {detected.map((d, i) => (
                  <label key={i} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    d.selected ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-gray-800 bg-gray-800/20'
                  }`}>
                    <input type="checkbox" checked={d.selected}
                      onChange={e => setDetected(prev => prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                      className="accent-indigo-500 w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{d.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{d.frequency} · next due {d.due_date} · {d.category}</p>
                    </div>
                    <p className="font-bold text-red-400 text-sm shrink-0">{fmt(d.amount)}</p>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-auto">
              <button onClick={() => setShowDetect(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition text-sm">Cancel</button>
              {detected.length > 0 && (
                <button onClick={importDetected} disabled={importing || !detected.some(d => d.selected)}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition text-sm disabled:opacity-40">
                  {importing ? 'Importing…' : `Import ${detected.filter(d => d.selected).length}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
