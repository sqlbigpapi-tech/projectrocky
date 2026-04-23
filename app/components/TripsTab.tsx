'use client';
import { useState, useEffect } from 'react';
import { useToast } from '../page';

type Status = 'dream' | 'booked' | 'past';
type Who = 'family' | 'couple' | 'solo' | 'david' | 'erica' | 'kids';

type Trip = {
  id: string;
  title: string;
  destination: string | null;
  country: string | null;
  status: Status;
  start_date: string | null;
  end_date: string | null;
  budget_estimate: number | null;
  actual_cost: number | null;
  who: Who;
  vibe: string | null;
  rating: number | null;
  notes: string | null;
  why: string | null;
  is_pr_scouting: boolean;
  cover_url: string | null;
  added_by: string;
  created_at: string;
  updated_at: string;
};

type Idea = {
  title: string;
  destination: string;
  country: string;
  why: string;
  best_season: string;
  budget_estimate_usd: number;
  vibe_tags: string[];
};

function formatMoney(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `$${n}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', opts);
  if (!end || end === start) return s;
  const e = new Date(end + 'T00:00:00').toLocaleDateString('en-US', opts);
  return `${s} – ${e}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T00:00:00').getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function StarRating({ value, onChange, size = 14 }: { value: number | null; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => {
        const filled = value != null && n <= value;
        const readonly = !onChange;
        return (
          <button
            key={n}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(n)}
            className={readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition'}
            style={{ width: size, height: size }}
          >
            <svg viewBox="0 0 24 24" fill={filled ? '#facc15' : 'none'} stroke={filled ? '#facc15' : '#52525b'} strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function AddTripModal({ initial, onSave, onClose }: {
  initial?: Partial<Trip>;
  onSave: (trip: Partial<Trip>) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [status, setStatus] = useState<Status>(initial?.status ?? 'dream');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [budget, setBudget] = useState(initial?.budget_estimate ? String(initial.budget_estimate) : '');
  const [who, setWho] = useState<Who>(initial?.who ?? 'family');
  const [vibe, setVibe] = useState(initial?.vibe ?? '');
  const [why, setWhy] = useState(initial?.why ?? '');
  const [isPr, setIsPr] = useState(initial?.is_pr_scouting ?? false);

  async function submit() {
    if (!title.trim()) return;
    await onSave({
      title: title.trim(),
      destination: destination.trim() || null,
      country: country.trim() || null,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      budget_estimate: budget ? parseInt(budget) : null,
      who,
      vibe: vibe.trim() || null,
      why: why.trim() || null,
      is_pr_scouting: isPr,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-0 md:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[var(--card)] border border-zinc-800 w-full md:max-w-lg md:rounded-xl min-h-screen md:min-h-0 md:my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-[var(--card)] z-10">
          <p className="text-sm font-bold text-white">{initial?.id ? 'Edit Trip' : 'New Trip'}</p>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Trip title (e.g. Italy with the family)"
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="Destination (Rome + Tuscany)"
              className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
            />
            <input
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="Country (Italy)"
              className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Status</label>
            <div className="flex gap-1.5">
              {(['dream', 'booked', 'past'] as Status[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 text-xs font-bold font-mono px-3 py-1.5 rounded-lg border transition ${
                    status === s ? 'bg-amber-500 text-black border-amber-500' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'
                  }`}
                >
                  {s === 'dream' ? 'Dream' : s === 'booked' ? 'Booked' : 'Past'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Start</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">End</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Budget ($)</label>
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="8000"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-700 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Who</label>
              <select value={who} onChange={e => setWho(e.target.value as Who)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none">
                <option value="family">Family</option>
                <option value="couple">Couple</option>
                <option value="solo">Solo</option>
                <option value="kids">Kids</option>
              </select>
            </div>
          </div>

          <input
            value={vibe}
            onChange={e => setVibe(e.target.value)}
            placeholder="Vibe tags (warm, beach, relaxed)"
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
          />

          <textarea
            value={why}
            onChange={e => setWhy(e.target.value)}
            placeholder="Why this trip? (optional)"
            rows={2}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPr} onChange={e => setIsPr(e.target.checked)} />
            <span className="text-xs text-zinc-400">Puerto Rico scouting trip</span>
          </label>
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-zinc-800 sticky bottom-0 bg-[var(--card)]">
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs py-2 rounded-lg transition"
          >Save</button>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xs px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function NextTripHero({ trip }: { trip: Trip }) {
  const days = daysUntil(trip.start_date);
  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-amber-400 mb-1">Next Trip</p>
          <p className="text-xl font-bold text-white leading-tight">{trip.title}</p>
          <p className="text-sm text-zinc-400 mt-0.5">
            {trip.destination ?? trip.country ?? ''}
            {trip.destination && trip.country ? `, ${trip.country}` : ''}
          </p>
          <p className="text-[11px] text-zinc-500 font-mono mt-2">
            {formatDateRange(trip.start_date, trip.end_date)}
            {trip.budget_estimate && ` · ${formatMoney(trip.budget_estimate)}`}
            {` · ${trip.who}`}
          </p>
        </div>
        {days != null && days >= 0 && (
          <div className="text-right shrink-0">
            <p className="text-3xl md:text-4xl font-bold font-mono tabular-nums text-amber-400">{days}</p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">days out</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TripCard({ trip, onEdit, onDelete, onUpdate }: {
  trip: Trip;
  onEdit: (t: Trip) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Trip>) => void;
}) {
  const whoLabel = trip.who === 'family' ? 'Family' : trip.who === 'couple' ? 'Just us' : trip.who;
  return (
    <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-4 group relative">
      {trip.is_pr_scouting && (
        <span className="absolute top-3 right-3 text-[9px] font-bold font-mono uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded">PR</span>
      )}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{trip.title}</p>
          <p className="text-xs text-zinc-500 truncate">
            {trip.destination ?? trip.country ?? '—'}
            {trip.destination && trip.country ? `, ${trip.country}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {trip.start_date && (
              <span className="text-[10px] font-mono text-zinc-500">{formatDateRange(trip.start_date, trip.end_date)}</span>
            )}
            {trip.budget_estimate != null && (
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 rounded">{formatMoney(trip.budget_estimate)}</span>
            )}
            <span className="text-[10px] font-mono text-zinc-500 capitalize">{whoLabel}</span>
            {trip.rating != null && <StarRating value={trip.rating} size={11} />}
          </div>
          {trip.status === 'past' && trip.rating == null && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-600">Rate:</span>
              <StarRating value={null} size={14} onChange={v => onUpdate(trip.id, { rating: v })} />
            </div>
          )}
          {trip.why && <p className="text-[11px] text-zinc-500 italic mt-1.5 leading-snug line-clamp-2">{trip.why}</p>}
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
          <button onClick={() => onEdit(trip)} className="text-zinc-600 hover:text-amber-400 text-xs p-1" title="Edit">✎</button>
          <button onClick={() => onDelete(trip.id)} className="text-zinc-700 hover:text-red-400 text-xs p-1" title="Delete">✕</button>
        </div>
      </div>
    </div>
  );
}

function IdeasPanel({ onSave }: { onSave: (idea: Idea) => Promise<void> }) {
  const [window, setWindow] = useState<'weekend' | 'long-weekend' | 'week' | 'two-weeks' | 'flexible'>('week');
  const [budget, setBudget] = useState('');
  const [who, setWho] = useState<'family' | 'couple' | 'solo'>('family');
  const [vibe, setVibe] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/trip-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          window,
          budget: budget ? parseInt(budget) : undefined,
          who,
          vibe: vibe.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); setIdeas([]); }
      else setIdeas(data.ideas ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-bold font-mono uppercase tracking-widest text-amber-400">Rocky Suggests</span>
        <div className="flex-1 h-px bg-zinc-800/60" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <select value={window} onChange={e => setWindow(e.target.value as typeof window)}
          className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
          <option value="weekend">Weekend (2-3d)</option>
          <option value="long-weekend">Long weekend</option>
          <option value="week">Week</option>
          <option value="two-weeks">Two weeks</option>
          <option value="flexible">Flexible</option>
        </select>
        <select value={who} onChange={e => setWho(e.target.value as typeof who)}
          className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
          <option value="family">Family</option>
          <option value="couple">Just us</option>
          <option value="solo">Solo</option>
        </select>
        <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Max $ (optional)"
          className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none" />
        <input value={vibe} onChange={e => setVibe(e.target.value)} placeholder="Vibe (optional)"
          className="bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none" />
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs py-2 rounded-lg transition"
      >
        {loading ? 'Thinking…' : ideas.length ? 'Regenerate ideas' : 'Get ideas'}
      </button>

      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}

      {ideas.length > 0 && (
        <div className="mt-4 space-y-2">
          {ideas.map((idea, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{idea.title}</p>
                  <p className="text-xs text-zinc-500">{idea.destination} · {idea.country}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono font-bold text-amber-400">{formatMoney(idea.budget_estimate_usd)}</p>
                  <p className="text-[10px] font-mono text-zinc-600">{idea.best_season}</p>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 italic mt-1.5 leading-snug">{idea.why}</p>
              {idea.vibe_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {idea.vibe_tags.map(t => (
                    <span key={t} className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              )}
              <div className="mt-2">
                <button
                  onClick={() => onSave(idea)}
                  className="text-[11px] font-bold text-amber-400 border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5 px-2.5 py-1 rounded transition"
                >
                  + Add to Dream List
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TripsTab() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [lane, setLane] = useState<'dream' | 'booked' | 'past' | 'pr'>('dream');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/trips')
      .then(r => r.json())
      .then(({ trips }) => setTrips(trips ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function addTrip(trip: Partial<Trip>) {
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip),
    });
    const { trip: saved } = await res.json();
    if (saved) {
      setTrips(prev => [saved, ...prev]);
      toast(`Added: ${saved.title}`, 'success');
    }
    setShowAdd(false);
    setEditing(null);
  }

  async function updateTrip(id: string, patch: Partial<Trip>) {
    setTrips(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    await fetch('/api/trips', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
  }

  async function deleteTrip(id: string) {
    setTrips(prev => prev.filter(t => t.id !== id));
    await fetch('/api/trips', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async function saveIdea(idea: Idea) {
    await addTrip({
      title: idea.title,
      destination: idea.destination,
      country: idea.country,
      status: 'dream',
      budget_estimate: idea.budget_estimate_usd,
      vibe: idea.vibe_tags.join(', '),
      why: idea.why,
    });
  }

  const upcoming = trips
    .filter(t => t.status === 'booked' && t.start_date)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))[0];

  const dream = trips.filter(t => t.status === 'dream' && !t.is_pr_scouting);
  const booked = trips.filter(t => t.status === 'booked');
  const past = trips.filter(t => t.status === 'past')
    .sort((a, b) => (b.end_date ?? b.start_date ?? '').localeCompare(a.end_date ?? a.start_date ?? ''));
  const prLane = trips.filter(t => t.is_pr_scouting);

  const activeTrips = lane === 'dream' ? dream : lane === 'booked' ? booked : lane === 'past' ? past : prLane;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <p className="text-sm font-medium text-white">{booked.length + dream.length + past.length} <span className="text-zinc-500">trips</span></p>
          {past.length > 0 && <p className="text-sm text-zinc-500">{past.length} taken</p>}
          {prLane.length > 0 && <p className="text-sm text-cyan-400">{prLane.length} PR</p>}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2 rounded-lg transition"
        >+ New Trip</button>
      </div>

      {upcoming && <NextTripHero trip={upcoming} />}

      <div className="flex gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 w-fit">
        {([
          ['dream', 'Dream', dream.length],
          ['booked', 'Booked', booked.length],
          ['past', 'Past', past.length],
          ['pr', 'PR Scouting', prLane.length],
        ] as const).map(([k, label, count]) => (
          <button
            key={k}
            onClick={() => setLane(k)}
            className={`text-[11px] font-mono px-3 py-1.5 rounded-md transition ${
              lane === k ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'
            }`}
          >{label} ({count})</button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : activeTrips.length === 0 ? (
        <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-10 text-center text-zinc-500 text-sm">
          {lane === 'dream' && 'No dream trips yet. Add one or hit "Get ideas" below.'}
          {lane === 'booked' && 'Nothing on the calendar yet.'}
          {lane === 'past' && 'Memory lane is empty — mark a past trip as taken when you log it.'}
          {lane === 'pr' && (
            <>
              The Puerto Rico dream lane is empty.{' '}
              <button onClick={() => setShowAdd(true)} className="text-cyan-400 hover:text-cyan-300 underline">Add a scouting idea.</button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {activeTrips.map(t => (
            <TripCard key={t.id} trip={t} onEdit={setEditing} onDelete={deleteTrip} onUpdate={updateTrip} />
          ))}
        </div>
      )}

      <IdeasPanel onSave={saveIdea} />

      {showAdd && <AddTripModal onSave={addTrip} onClose={() => setShowAdd(false)} />}
      {editing && (
        <AddTripModal
          initial={editing}
          onSave={async patch => { await updateTrip(editing.id, patch); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
