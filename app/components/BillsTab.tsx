'use client';
import { useState, useEffect } from 'react';

type Bill = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  frequency: 'once' | 'weekly' | 'monthly' | 'annually';
  source: 'manual' | 'plaid';
  reminder_days_before: number;
};

type PlaidBill = { name: string; amount: number; nextDate: string; daysUntil: number; frequency: string };

const FREQ_LABELS: Record<string, string> = {
  once: 'One-time', weekly: 'Weekly', monthly: 'Monthly', annually: 'Annually',
};

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
    case 'monthly':
      return base.getDate() <= daysInMonth ? [base.getDate()] : [];
    case 'weekly': {
      const dow = base.getDay();
      const days: number[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(year, month, d).getDay() === dow) days.push(d);
      }
      return days;
    }
    case 'annually':
      return base.getMonth() === month && base.getDate() <= daysInMonth ? [base.getDate()] : [];
    default:
      return base.getFullYear() === year && base.getMonth() === month ? [base.getDate()] : [];
  }
}

function getNextOccurrence(bill: Bill): { date: string; daysUntil: number } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const base = new Date(bill.due_date + 'T12:00:00');
  if (bill.frequency === 'once') {
    const days = Math.ceil((base.getTime() - today.getTime()) / 86400000);
    return { date: bill.due_date, daysUntil: days };
  }
  let next = new Date(base);
  while (next < today) {
    if (bill.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else if (bill.frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (bill.frequency === 'annually') next.setFullYear(next.getFullYear() + 1);
  }
  const days = Math.ceil((next.getTime() - today.getTime()) / 86400000);
  return { date: next.toISOString().split('T')[0], daysUntil: days };
}

const defaultForm = { name: '', amount: '', due_date: '', frequency: 'monthly', reminder_days_before: '3' };

export default function BillsTab({ plaidBills }: { plaidBills: PlaidBill[] }) {
  const todayDate = new Date();
  const [bills, setBills] = useState<Bill[]>([]);
  const [month, setMonth] = useState(todayDate.getMonth());
  const [year, setYear] = useState(todayDate.getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch('/api/bills').then(r => r.json()).then(({ bills }) => setBills(bills || []));
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Trigger browser notifications for bills due soon
  useEffect(() => {
    if (!bills.length || Notification.permission !== 'granted') return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    bills.forEach(bill => {
      const { daysUntil } = getNextOccurrence(bill);
      if (daysUntil >= 0 && daysUntil <= bill.reminder_days_before) {
        new Notification(`Bill Due: ${bill.name}`, {
          body: `${fmt(bill.amount)} due ${daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}`,
        });
      }
    });
  }, [bills]);

  const saveBill = async () => {
    const payload = {
      ...(editBill ? { id: editBill.id } : {}),
      name: form.name,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      frequency: form.frequency,
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
    await fetch('/api/bills', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setBills(prev => prev.filter(b => b.id !== id));
  };

  const syncPlaid = async () => {
    setSyncing(true);
    const existingNames = new Set(bills.filter(b => b.source === 'plaid').map(b => b.name));
    const toSync = plaidBills.filter(pb => !existingNames.has(pb.name));
    for (const pb of toSync) {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pb.name,
          amount: pb.amount,
          due_date: pb.nextDate,
          frequency: PLAID_FREQ_MAP[pb.frequency?.toLowerCase().replace(' ', '_')] || 'monthly',
          reminder_days_before: 3,
          source: 'plaid',
        }),
      });
      const { bill } = await res.json();
      setBills(prev => [...prev, bill]);
    }
    setSyncing(false);
  };

  const openAdd = () => {
    setEditBill(null);
    setForm({ ...defaultForm, due_date: todayDate.toISOString().split('T')[0] });
    setShowModal(true);
  };

  const openEdit = (bill: Bill) => {
    setEditBill(bill);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      due_date: bill.due_date,
      frequency: bill.frequency,
      reminder_days_before: String(bill.reminder_days_before),
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditBill(null); };

  // Calendar setup
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

  // Sorted upcoming list
  const upcoming = bills
    .map(b => ({ ...b, ...getNextOccurrence(b) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // Due-soon reminders for banner
  const reminders = upcoming.filter(b => b.daysUntil >= 0 && b.daysUntil <= b.reminder_days_before);

  return (
    <div>
      {/* Reminder banners */}
      {reminders.length > 0 && (
        <div className="mb-6 space-y-2">
          {reminders.map(b => (
            <div key={b.id} className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
              <span className="text-yellow-400 text-lg">⚠</span>
              <p className="text-yellow-300 text-sm">
                <span className="font-bold">{b.name}</span> — {fmt(b.amount)} due{' '}
                {b.daysUntil === 0 ? 'today' : `in ${b.daysUntil} day${b.daysUntil !== 1 ? 's' : ''}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Bills</h2>
        <div className="flex gap-2">
          {plaidBills.length > 0 && (
            <button onClick={syncPlaid} disabled={syncing}
              className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition disabled:opacity-50">
              {syncing ? 'Syncing...' : 'Sync from Plaid'}
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
          <h3 className="font-semibold text-base">{monthName} {year}</h3>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs text-gray-500 font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === todayDate.getDate() && month === todayDate.getMonth() && year === todayDate.getFullYear();
            const dayBills = dayBillsMap[day] || [];
            const total = dayBills.reduce((s, b) => s + b.amount, 0);
            return (
              <div key={day}
                className={`min-h-[68px] rounded-lg p-1.5 border transition ${
                  isToday ? 'border-indigo-500/60 bg-indigo-950/40' : 'border-gray-800 bg-gray-800/20 hover:bg-gray-800/50'
                }`}>
                <p className={`text-xs font-semibold mb-1 ${isToday ? 'text-indigo-400' : 'text-gray-400'}`}>{day}</p>
                {dayBills.length > 0 && (
                  <>
                    {dayBills.slice(0, 1).map((b, j) => (
                      <button key={j} onClick={() => openEdit(b)}
                        className="w-full text-left text-xs bg-red-500/20 text-red-300 rounded px-1 py-0.5 mb-0.5 truncate hover:bg-red-500/30 transition">
                        {b.name.length > 8 ? b.name.slice(0, 8) + '…' : b.name}
                      </button>
                    ))}
                    <p className="text-xs text-red-400 font-medium">
                      {dayBills.length > 1 ? `+${dayBills.length - 1} · ` : ''}{fmt(total)}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      {upcoming.length > 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="font-semibold mb-4">All Bills</h3>
          <div className="space-y-3">
            {upcoming.map((bill, i) => (
              <div key={`${bill.id}-${i}`} className="flex justify-between items-center border-b border-gray-800 pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{bill.name}</p>
                    {bill.source === 'plaid' && (
                      <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">Plaid</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">
                    {FREQ_LABELS[bill.frequency]} · due {bill.date} · remind {bill.reminder_days_before}d before
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-red-400 text-sm">{fmt(bill.amount)}</p>
                    <p className={`text-xs ${bill.daysUntil <= 7 ? 'text-yellow-400' : 'text-gray-600'}`}>
                      {bill.daysUntil === 0 ? 'today' : `in ${bill.daysUntil}d`}
                    </p>
                  </div>
                  <button onClick={() => openEdit(bill)} className="text-gray-600 hover:text-gray-300 text-xs transition px-1">edit</button>
                  <button onClick={() => deleteBill(bill.id)} className="text-red-900 hover:text-red-400 text-sm transition px-1">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center text-gray-500">
          No bills yet — add one manually or sync from Plaid.
        </div>
      )}

      {/* Modal */}
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
              <div>
                <label className="text-xs text-gray-400 block mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
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
              <button onClick={closeModal}
                className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition text-sm">
                Cancel
              </button>
              <button onClick={saveBill} disabled={!form.name || !form.amount || !form.due_date}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition text-sm disabled:opacity-40">
                {editBill ? 'Save' : 'Add Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
