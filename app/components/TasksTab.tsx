'use client';
import { useState, useEffect } from 'react';
import { useToast } from '../page';

type Priority = 'High' | 'Medium' | 'Low';
type Category = 'Business' | 'Personal';

type Task = {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  due_date: string | null;
  category: Category;
  completed: boolean;
  recurrence: string | null;
  is_bill: boolean;
  bill_amount: number | null;
  created_at: string;
};

const PRIORITY_STYLES: Record<Priority, string> = {
  High:   'bg-red-500/10 text-red-400 border-red-500/30',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Low:    'bg-zinc-800 text-zinc-400 border-zinc-700',
};

const CATEGORY_STYLES: Record<Category, string> = {
  Business: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Personal: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
};

function dueDateLabel(due: string | null): { text: string; color: string } | null {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-400' };
  if (diff === 0) return { text: 'Due today', color: 'text-yellow-400' };
  if (diff === 1) return { text: 'Due tomorrow', color: 'text-yellow-400' };
  if (diff <= 7) return { text: `Due in ${diff}d`, color: 'text-zinc-400' };
  return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-zinc-600' };
}

function AddTaskForm({ onAdd }: { onAdd: (task: Task) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [category, setCategory] = useState<Category>('Personal');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [isBill, setIsBill] = useState(false);
  const [billAmount, setBillAmount] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const amt = isBill && billAmount ? parseFloat(billAmount) : null;
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), notes, priority, category, due_date: dueDate || null, recurrence, is_bill: isBill, bill_amount: amt }),
    });
    const { task } = await res.json();
    onAdd(task);
    setTitle(''); setNotes(''); setPriority('Medium'); setCategory('Personal'); setDueDate(''); setRecurrence(null); setIsBill(false); setBillAmount('');
    setOpen(false);
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-zinc-600 hover:text-amber-400 hover:bg-[var(--card)]/40 transition-all duration-150"
      >
        <span className="w-[18px] h-[18px] rounded-md border-2 border-dashed border-zinc-700 flex items-center justify-center text-xs">+</span>
        <span className="text-[13px]">Add task</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-[var(--card)] border border-amber-500/30 rounded-xl p-5 space-y-3">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title…"
        className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
      />
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-700 resize-none focus:outline-none transition"
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1 text-xs text-zinc-300 focus:outline-none transition"
          />
        </div>
        {/* Recurrence */}
        <div className="flex flex-col gap-1 justify-end">
          <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Repeat</label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setRecurrence(r => r === 'daily' ? null : 'daily')}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${recurrence === 'daily' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}
            >↻ Daily</button>
            <button
              type="button"
              onClick={() => setRecurrence(r => r === 'monthly' ? null : 'monthly')}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${recurrence === 'monthly' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}
            >↻ Monthly</button>
          </div>
        </div>
        {/* Bill toggle */}
        <div className="flex flex-col gap-1 justify-end">
          <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Type</label>
          <button
            type="button"
            onClick={() => setIsBill(b => !b)}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${isBill ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}
          >$ Bill</button>
        </div>
        {isBill && (
          <div className="flex flex-col gap-1 justify-end">
            <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Amount</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={billAmount}
                onChange={e => setBillAmount(e.target.value)}
                placeholder="0.00"
                className="w-28 pl-6 pr-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-emerald-500/40 text-xs text-white font-mono tabular-nums placeholder-zinc-700 focus:outline-none transition"
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit" disabled={saving || !title.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs px-4 py-2 rounded-lg transition"
        >{saving ? 'Saving…' : 'Add Task'}</button>
        <button
          type="button" onClick={() => setOpen(false)}
          className="text-zinc-500 hover:text-white text-xs px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 transition"
        >Cancel</button>
      </div>
    </form>
  );
}

function TaskCard({ task, onUpdate, onDelete }: {
  task: Task;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNotes, setEditNotes] = useState(task.notes);
  const [editPriority, setEditPriority] = useState<Priority>(task.priority);
  const [editCategory, setEditCategory] = useState<Category>(task.category);
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? '');
  const [editRecurrence, setEditRecurrence] = useState<string | null>(task.recurrence);
  const [editIsBill, setEditIsBill] = useState(task.is_bill);
  const [editBillAmount, setEditBillAmount] = useState(task.bill_amount != null ? String(task.bill_amount) : '');
  const [saving, setSaving] = useState(false);
  const due = dueDateLabel(task.due_date);

  function startEdit() {
    setEditTitle(task.title);
    setEditNotes(task.notes);
    setEditPriority(task.priority);
    setEditCategory(task.category);
    setEditDueDate(task.due_date ?? '');
    setEditRecurrence(task.recurrence);
    setEditIsBill(task.is_bill);
    setEditBillAmount(task.bill_amount != null ? String(task.bill_amount) : '');
    setEditing(true);
    setExpanded(false);
  }

  async function saveEdit() {
    if (!editTitle.trim()) return;
    setSaving(true);
    const patch = {
      title: editTitle.trim(),
      notes: editNotes,
      priority: editPriority,
      category: editCategory,
      due_date: editDueDate || null,
      recurrence: editRecurrence,
      is_bill: editIsBill,
      bill_amount: editIsBill && editBillAmount ? parseFloat(editBillAmount) : null,
    };
    await onUpdate(task.id, patch);
    setEditing(false);
    setSaving(false);
  }

  if (editing) {
    return (
      <div className="bg-[var(--card)] border border-amber-500/30 rounded-xl p-5 space-y-3">
        <input
          autoFocus
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
        />
        <textarea
          value={editNotes}
          onChange={e => setEditNotes(e.target.value)}
          placeholder="Notes (optional)…"
          rows={2}
          className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-700 resize-none focus:outline-none transition"
        />
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Priority</label>
            <div className="flex gap-1.5">
              {(['High', 'Medium', 'Low'] as Priority[]).map(p => (
                <button key={p} type="button" onClick={() => setEditPriority(p)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${editPriority === p ? PRIORITY_STYLES[p] : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Category</label>
            <div className="flex gap-1.5">
              {(['Business', 'Personal'] as Category[]).map(c => (
                <button key={c} type="button" onClick={() => setEditCategory(c)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${editCategory === c ? CATEGORY_STYLES[c] : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Due Date</label>
            <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1 text-xs text-zinc-300 focus:outline-none transition" />
          </div>
          <div className="flex flex-col gap-1 justify-end">
            <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Repeat</label>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setEditRecurrence(r => r === 'daily' ? null : 'daily')}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${editRecurrence === 'daily' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}>
                ↻ Daily
              </button>
              <button type="button" onClick={() => setEditRecurrence(r => r === 'monthly' ? null : 'monthly')}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${editRecurrence === 'monthly' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}>
                ↻ Monthly
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1 justify-end">
            <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Type</label>
            <button type="button" onClick={() => setEditIsBill(b => !b)}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${editIsBill ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}>
              $ Bill
            </button>
          </div>
          {editIsBill && (
            <div className="flex flex-col gap-1 justify-end">
              <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Amount</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                <input type="number" min="0" step="0.01" value={editBillAmount} onChange={e => setEditBillAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-28 pl-6 pr-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-emerald-500/40 text-xs text-white font-mono tabular-nums placeholder-zinc-700 focus:outline-none transition" />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={saveEdit} disabled={saving || !editTitle.trim()}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs px-4 py-2 rounded-lg transition">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)}
            className="text-zinc-500 hover:text-white text-xs px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 transition">
            Cancel
          </button>
          <button onClick={() => { setEditing(false); onDelete(task.id); }}
            className="ml-auto text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 px-3 py-2 rounded-lg transition">
            Delete
          </button>
        </div>
      </div>
    );
  }

  const priorityBorder = task.priority === 'High' ? 'border-l-red-400' : task.priority === 'Medium' ? 'border-l-amber-400' : 'border-l-zinc-700';

  return (
    <div
      id={`task-${task.id}`}
      className={`group relative flex items-center gap-3 pl-3 pr-3.5 py-2.5 rounded-lg border-l-2 transition-all duration-150 ${priorityBorder} ${
        task.completed ? 'opacity-35' :
        task.is_bill ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]' :
        due?.text.includes('overdue') ? 'bg-red-500/5 hover:bg-red-500/8' :
        due?.text === 'Due today' ? 'bg-amber-500/5 hover:bg-amber-500/8' :
        'hover:bg-[var(--card)]/60'
      }`}
    >
      <button
        onClick={() => onUpdate(task.id, { completed: !task.completed })}
        className={`w-[18px] h-[18px] rounded-md border-2 shrink-0 flex items-center justify-center transition-all duration-150 ${
          task.completed ? 'bg-emerald-500 border-emerald-500' :
          due?.text.includes('overdue') ? 'border-red-400/40 hover:border-red-400 hover:bg-red-500/10' :
          'border-zinc-700 hover:border-amber-400 hover:bg-amber-500/10'
        }`}
      >
        {task.completed && (
          <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug ${task.completed ? 'line-through text-zinc-600' : 'text-zinc-200'}`}>{task.title}</p>
        {task.notes && !task.completed && <p className="text-[10px] text-zinc-600 truncate mt-0.5">{task.notes}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {task.is_bill && task.bill_amount != null && (
          <span className={`text-[12px] font-mono font-bold tabular-nums ${task.completed ? 'text-zinc-600' : 'text-emerald-400'}`}>
            ${task.bill_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        )}
        {(task.recurrence || due) && !task.completed && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            due?.text.includes('overdue') ? 'text-red-400 bg-red-500/10' :
            due?.text === 'Due today' ? 'text-yellow-400 bg-yellow-500/10' :
            task.recurrence ? 'text-cyan-400/80 bg-cyan-500/5' :
            'text-zinc-500 bg-zinc-900'
          }`}>
            {task.recurrence && '↻ '}{due?.text ?? task.recurrence}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button onClick={startEdit} className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Edit">
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2l3 3-7 7H0V9z" /></svg>
        </button>
        <button onClick={() => onDelete(task.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h8M4 3V2h4v1M3 3v7a1 1 0 001 1h4a1 1 0 001-1V3" /></svg>
        </button>
      </div>
    </div>
  );
}

const PRIORITY_DOT: Record<Priority, string> = {
  High:   'bg-red-400',
  Medium: 'bg-amber-400',
  Low:    'bg-zinc-500',
};

function BillsStrip({ bills }: { bills: Task[] }) {
  const [expanded, setExpanded] = useState(false);
  if (bills.length === 0) return null;
  const total = bills.reduce((s, b) => s + (b.bill_amount ?? 0), 0);
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-500/[0.08] transition">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-emerald-400">Bills · Next 7 days</span>
          <span className="text-sm font-bold font-mono text-white tabular-nums">${Math.round(total).toLocaleString()}</span>
          <span className="text-[11px] text-zinc-500 font-mono">across {bills.length}</span>
        </div>
        <span className={`text-zinc-500 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {expanded && (
        <div className="border-t border-emerald-500/10 divide-y divide-emerald-500/5">
          {bills.map(b => {
            const due = dueDateLabel(b.due_date);
            return (
              <div key={b.id} className="flex items-center justify-between px-4 py-2">
                <p className="text-xs text-zinc-300 truncate">{b.title}</p>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-mono text-zinc-500">{due?.text ?? ''}</span>
                  {b.bill_amount != null && (
                    <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                      ${b.bill_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CalendarView({ tasks, onUpdate }: { tasks: Task[]; onUpdate: (id: string, patch: Partial<Task>) => void }) {
  const today = new Date();
  const [calDate, setCalDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tasksByDate: Record<string, Task[]> = {};
  for (const t of tasks) {
    if (t.due_date) {
      if (!tasksByDate[t.due_date]) tasksByDate[t.due_date] = [];
      tasksByDate[t.due_date].push(t);
    }
  }

  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayISO = today.toISOString().split('T')[0];

  return (
    <div className="bg-[var(--card)] rounded-xl border border-zinc-800 overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
        <button onClick={() => setCalDate(new Date(year, month - 1, 1))} className="text-zinc-500 hover:text-white transition px-2 py-1 text-sm">‹</button>
        <p className="text-sm font-semibold text-white font-mono">
          {calDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
        <button onClick={() => setCalDate(new Date(year, month + 1, 1))} className="text-zinc-500 hover:text-white transition px-2 py-1 text-sm">›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="py-2 text-center text-xs text-zinc-600 font-mono uppercase tracking-widest">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const iso = day ? `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
          const dayTasks = iso ? (tasksByDate[iso] ?? []) : [];
          const isToday = iso === todayISO;
          return (
            <div key={i} className={`min-h-[72px] border-b border-r border-[var(--border)]/60 p-1.5 ${!day ? 'bg-zinc-900/20' : ''}`}>
              {day && (
                <>
                  <p className={`text-xs font-mono mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-amber-500 text-black font-bold' : 'text-zinc-500'}`}>
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(t => (
                      <button
                        key={t.id}
                        onClick={() => onUpdate(t.id, { completed: !t.completed })}
                        className={`w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-xs leading-tight transition hover:opacity-70 ${t.completed ? 'opacity-40' : ''}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority]}`} />
                        {t.is_bill && <span className="shrink-0 text-[10px] font-bold text-emerald-400 leading-none" title="Bill">$</span>}
                        <span className={`truncate ${t.completed ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>{t.title}</span>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-xs text-zinc-600 font-mono px-1">+{dayTasks.length - 3} more</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-5 py-3 border-t border-zinc-800">
        {(['High','Medium','Low'] as Priority[]).map(p => (
          <span key={p} className="flex items-center gap-1.5 text-xs text-zinc-600 font-mono">
            <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[p]}`} />
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'All'>('All');
  const [showCompleted, setShowCompleted] = useState(false);
  const [query, setQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(({ tasks }) => setTasks(tasks ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpdate(id: string, patch: Partial<Task>) {
    const task = tasks.find(t => t.id === id);
    if (patch.completed === true && task?.recurrence === 'daily') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const due_date = tomorrow.toISOString().split('T')[0];
      const recurPatch = { completed: false, due_date };
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...recurPatch } : t));
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...recurPatch }),
      });
      toast(`↻ ${task.title} — rolled to tomorrow`, 'success');
      return;
    }
    if (patch.completed === true && task?.recurrence === 'monthly') {
      const base = task.due_date ? new Date(task.due_date + 'T00:00:00') : new Date();
      base.setMonth(base.getMonth() + 1);
      const due_date = base.toISOString().split('T')[0];
      const recurPatch = { completed: false, due_date };
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...recurPatch } : t));
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...recurPatch }),
      });
      const nextLabel = new Date(due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      toast(`↻ ${task.title} — next on ${nextLabel}`, 'success');
      return;
    }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    if (patch.completed === true && task) toast(`Completed: ${task.title}`, 'success');
  }

  async function handleDelete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  const q = query.trim().toLowerCase();
  const filtered = tasks.filter(t => {
    if (!showCompleted && t.completed) return false;
    if (q && !`${t.title} ${t.notes ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return 0;
  });

  const open = tasks.filter(t => !t.completed);
  const overdue = open.filter(t => {
    if (!t.due_date) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(t.due_date + 'T00:00:00') < today;
  });

  // Group tasks by time bucket
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().split('T')[0];
  const weekEnd = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

  type Bucket = { key: string; label: string; color: string; icon: string; tasks: typeof filtered };
  const buckets: Bucket[] = [];

  const overdueItems = filtered.filter(t => !t.completed && t.due_date && t.due_date < todayISO);
  const todayItems = filtered.filter(t => !t.completed && t.due_date === todayISO);
  const weekItems = filtered.filter(t => !t.completed && t.due_date && t.due_date > todayISO && t.due_date <= weekEnd);
  const laterItems = filtered.filter(t => !t.completed && t.due_date && t.due_date > weekEnd);
  const noDueItems = filtered.filter(t => !t.completed && !t.due_date);
  const completedItems = filtered.filter(t => t.completed);

  if (overdueItems.length > 0) buckets.push({ key: 'overdue', label: 'Overdue', color: 'text-red-400', icon: '!', tasks: overdueItems });
  if (weekItems.length > 0) buckets.push({ key: 'week', label: 'This Week', color: 'text-blue-400', icon: '→', tasks: weekItems });
  if (laterItems.length > 0) buckets.push({ key: 'later', label: 'Upcoming', color: 'text-zinc-400', icon: '◦', tasks: laterItems });
  if (noDueItems.length > 0) buckets.push({ key: 'nodate', label: 'No Due Date', color: 'text-zinc-600', icon: '—', tasks: noDueItems });
  if (completedItems.length > 0) buckets.push({ key: 'done', label: 'Completed', color: 'text-emerald-400/50', icon: '✓', tasks: completedItems });

  // Bills due in the next 7 days (for the bills strip)
  const upcomingBills = tasks.filter(t => !t.completed && t.is_bill && t.due_date && t.due_date >= todayISO && t.due_date <= weekEnd)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));

  // Today hero — completed + total based on same-day tasks (including recurring that got rolled)
  const allTodayScoped = tasks.filter(t =>
    (t.due_date === todayISO) ||
    (t.completed && t.due_date === todayISO)
  );
  const todayTotal = allTodayScoped.length + todayItems.filter(t => t.recurrence && !allTodayScoped.includes(t)).length;
  const todayDone = allTodayScoped.filter(t => t.completed).length;
  const todayPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <p className="text-sm font-medium text-white">{open.length} <span className="text-zinc-500">open</span></p>
          {overdue.length > 0 && <p className="text-sm font-medium text-red-400">{overdue.length} <span className="text-red-400/60">overdue</span></p>}
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end min-w-[220px]">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M12.5 12.5L17 17" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white text-xs">✕</button>
            )}
          </div>
          <button
            onClick={() => setShowCompleted(s => !s)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono border transition ${
              showCompleted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'text-zinc-600 border-zinc-800 hover:text-white'
            }`}>
            {showCompleted ? 'Done ✓' : 'Done'}
          </button>
          <div className="flex gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button onClick={() => setView('list')}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-md transition ${view === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}>List</button>
            <button onClick={() => setView('calendar')}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-md transition ${view === 'calendar' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}>Cal</button>
          </div>
        </div>
      </div>

      {view === 'calendar' && (
        <CalendarView tasks={tasks} onUpdate={handleUpdate} />
      )}

      {view === 'list' && <>

      {/* Bills strip — only if bills due in next 7 days */}
      {upcomingBills.length > 0 && (
        <div className="mb-4">
          <BillsStrip bills={upcomingBills} />
        </div>
      )}

      {/* Add task */}
      <div className="mb-5">
        <AddTaskForm onAdd={task => setTasks(prev => [task, ...prev])} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-11 w-full rounded-xl" />
          ))}
        </div>
      ) : buckets.length === 0 && todayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <span className="text-xl text-zinc-600">{query ? '⌀' : '✓'}</span>
          </div>
          <p className="text-sm text-zinc-600">{query ? `No tasks match "${query}"` : 'All clear. Nice work.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today hero */}
          {(todayItems.length > 0 || todayDone > 0) && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-[11px] font-bold font-mono uppercase tracking-widest text-amber-400">Today</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-white">
                    {todayDone}<span className="text-zinc-600 text-base font-normal"> / {todayTotal}</span>
                    <span className="text-sm text-zinc-500 font-normal ml-2">done</span>
                  </p>
                </div>
                <p className="text-xs font-mono text-amber-400/80 tabular-nums">{todayPct}%</p>
              </div>
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${todayPct}%` }} />
              </div>
              {todayItems.length > 0 ? (
                <div className="space-y-0.5">
                  {todayItems.map(task => (
                    <TaskCard key={task.id} task={task} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">All today's tasks are done. Enjoy it.</p>
              )}
            </div>
          )}

          {/* Other buckets — quieter */}
          {buckets.map(bucket => (
            <div key={bucket.key}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`text-[10px] font-bold font-mono uppercase tracking-widest ${bucket.color}`}>{bucket.label}</span>
                <span className="text-[10px] text-zinc-700 font-mono">{bucket.tasks.length}</span>
                <div className="flex-1 h-px bg-zinc-800/60 ml-1" />
              </div>
              <div className="space-y-0.5">
                {bucket.tasks.map(task => (
                  <TaskCard key={task.id} task={task} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      </>}
    </div>
  );
}
