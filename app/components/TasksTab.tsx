'use client';
import { useState, useEffect } from 'react';

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
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), notes, priority, category, due_date: dueDate || null, recurrence }),
    });
    const { task } = await res.json();
    onAdd(task);
    setTitle(''); setNotes(''); setPriority('Medium'); setCategory('Personal'); setDueDate(''); setRecurrence(null);
    setOpen(false);
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-zinc-950 border border-dashed border-zinc-700 hover:border-amber-500/50 rounded-xl px-5 py-4 text-zinc-500 hover:text-amber-400 text-sm font-medium transition text-left"
      >
        + Add task
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-zinc-950 border border-amber-500/30 rounded-xl p-5 space-y-3">
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
      <div className="flex flex-wrap gap-3">
        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Priority</label>
          <div className="flex gap-1.5">
            {(['High', 'Medium', 'Low'] as Priority[]).map(p => (
              <button
                key={p} type="button"
                onClick={() => setPriority(p)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${priority === p ? PRIORITY_STYLES[p] : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}
              >{p}</button>
            ))}
          </div>
        </div>
        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-600 font-mono uppercase tracking-widest">Category</label>
          <div className="flex gap-1.5">
            {(['Business', 'Personal'] as Category[]).map(c => (
              <button
                key={c} type="button"
                onClick={() => setCategory(c)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${category === c ? CATEGORY_STYLES[c] : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}
              >{c}</button>
            ))}
          </div>
        </div>
        {/* Due date */}
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
          <button
            type="button"
            onClick={() => setRecurrence(r => r === 'daily' ? null : 'daily')}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${recurrence === 'daily' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'}`}
          >↻ Daily</button>
        </div>
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
  const due = dueDateLabel(task.due_date);

  return (
    <div className={`bg-zinc-950 rounded-xl border transition-colors ${
      task.completed ? 'border-zinc-800 opacity-50' :
      task.priority === 'High' ? 'border-red-500/20' :
      task.priority === 'Medium' ? 'border-amber-500/20' :
      'border-zinc-800'
    }`}>
      <div className="flex items-start gap-3 p-4">
        {/* Checkbox */}
        <button
          onClick={() => onUpdate(task.id, { completed: !task.completed })}
          className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition ${
            task.completed ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-amber-400'
          }`}
        >
          {task.completed && <span className="text-black text-xs font-bold">✓</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${task.completed ? 'line-through text-zinc-600' : 'text-white'}`}>
            {task.title}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border font-mono ${PRIORITY_STYLES[task.priority]}`}>
              {task.priority}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border font-mono ${CATEGORY_STYLES[task.category]}`}>
              {task.category}
            </span>
            {due && <span className={`text-xs font-mono ${due.color}`}>{due.text}</span>}
            {task.recurrence === 'daily' && <span className="text-xs font-bold px-2 py-0.5 rounded-md border bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-mono">↻ daily</span>}
          </div>
          {task.notes && !expanded && (
            <p className="text-xs text-zinc-600 mt-1.5 truncate">{task.notes}</p>
          )}
          {expanded && (
            <div className="mt-3 space-y-2">
              {task.notes && <p className="text-xs text-zinc-400">{task.notes}</p>}
              <div className="flex gap-2 flex-wrap">
                {(['High', 'Medium', 'Low'] as Priority[]).map(p => (
                  <button key={p} onClick={() => onUpdate(task.id, { priority: p })}
                    className={`text-xs font-bold px-2 py-0.5 rounded-md border transition ${task.priority === p ? PRIORITY_STYLES[p] : 'bg-zinc-900 text-zinc-600 border-zinc-800 hover:text-white'}`}>
                    {p}
                  </button>
                ))}
                {(['Business', 'Personal'] as Category[]).map(c => (
                  <button key={c} onClick={() => onUpdate(task.id, { category: c })}
                    className={`text-xs font-bold px-2 py-0.5 rounded-md border transition ${task.category === c ? CATEGORY_STYLES[c] : 'bg-zinc-900 text-zinc-600 border-zinc-800 hover:text-white'}`}>
                    {c}
                  </button>
                ))}
              </div>
              <button onClick={() => onDelete(task.id)}
                className="text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 px-3 py-1 rounded-lg transition">
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(e => !e)} className="text-zinc-600 hover:text-zinc-400 text-xs shrink-0 transition">
          {expanded ? '▴' : '▾'}
        </button>
      </div>
    </div>
  );
}

export default function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'All'>('All');
  const [showCompleted, setShowCompleted] = useState(false);

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
      return;
    }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async function handleDelete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  const filtered = tasks.filter(t => {
    if (!showCompleted && t.completed) return false;
    if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
    if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
    return true;
  });

  const open = tasks.filter(t => !t.completed);
  const overdue = open.filter(t => {
    if (!t.due_date) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(t.due_date + 'T00:00:00') < today;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Tasks</h2>
          <p className="text-xs text-zinc-500 mt-0.5 font-mono">
            {open.length} open{overdue.length > 0 ? ` · ${overdue.length} overdue` : ''}
          </p>
        </div>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {([['All', null], ['Business', 'Business'], ['Personal', 'Personal']] as [string, Category | null][]).map(([label, val]) => (
          <button key={label}
            onClick={() => setCategoryFilter(val ?? 'All')}
            className={`rounded-xl border p-3 text-left transition ${categoryFilter === (val ?? 'All') ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-1">{label}</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {label === 'All' ? open.length : tasks.filter(t => !t.completed && t.category === val).length}
            </p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['All', 'High', 'Medium', 'Low'] as (Priority | 'All')[]).map(p => (
          <button key={p} onClick={() => setPriorityFilter(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition ${
              priorityFilter === p
                ? p === 'All' ? 'bg-zinc-700 text-white border-zinc-600' : PRIORITY_STYLES[p as Priority]
                : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-white hover:border-zinc-600'
            }`}>{p}</button>
        ))}
        <button
          onClick={() => setShowCompleted(s => !s)}
          className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition ${
            showCompleted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-white'
          }`}>
          {showCompleted ? 'Hide Completed' : 'Show Completed'}
        </button>
      </div>

      {/* Add task */}
      <div className="mb-4">
        <AddTaskForm onAdd={task => setTasks(prev => [task, ...prev])} />
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500 text-sm">
          {tasks.length === 0 ? 'No tasks yet. Add one above.' : 'No tasks match your filters.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <TaskCard key={task.id} task={task} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
