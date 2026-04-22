'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useToast } from '../page';

type Status = 'listening' | 'finished' | 'wishlist' | 'dismissed';

type Book = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  isbn: string | null;
  length_minutes: number | null;
  rating: number | null;
  status: Status;
  started_at: string | null;
  finished_at: string | null;
  listened_minutes: number;
  notes: string | null;
  rec_reason: string | null;
  created_at: string;
  updated_at: string;
};

type SearchResult = {
  title: string;
  author: string;
  cover_url: string | null;
  isbn: string | null;
  year: number | null;
  pages: number | null;
  estimated_minutes: number | null;
};

type Recommendation = {
  title: string;
  author: string;
  why: string;
};

function formatHours(mins: number | null): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function StarRating({ value, onChange, size = 16 }: { value: number | null; onChange?: (v: number) => void; size?: number }) {
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
            className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition'}`}
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

function AddBookModal({ onAdd, onClose }: {
  onAdd: (book: Partial<Book>) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [manual, setManual] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [lengthHours, setLengthHours] = useState('');
  const [status, setStatus] = useState<Status>('listening');
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    const id = setTimeout(() => {
      setSearching(true);
      fetch(`/api/book-search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => setResults(d.results ?? []))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  async function save() {
    const base: Partial<Book> = {
      status,
      rating: status === 'finished' ? rating : null,
      finished_at: status === 'finished' ? new Date().toISOString().split('T')[0] : null,
      started_at: status === 'listening' ? new Date().toISOString().split('T')[0] : null,
    };
    if (selected) {
      await onAdd({
        ...base,
        title: selected.title,
        author: selected.author,
        cover_url: selected.cover_url,
        isbn: selected.isbn,
        length_minutes: lengthHours ? Math.round(parseFloat(lengthHours) * 60) : selected.estimated_minutes,
      });
    } else {
      await onAdd({
        ...base,
        title: title.trim(),
        author: author.trim() || null,
        length_minutes: lengthHours ? Math.round(parseFloat(lengthHours) * 60) : null,
      });
    }
  }

  const canSave = selected ? true : title.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-0 md:p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-zinc-800 w-full md:max-w-lg md:rounded-xl min-h-screen md:min-h-0 md:my-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-[var(--card)] z-10">
          <p className="text-sm font-bold text-white">Add a Book</p>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition">✕</button>
        </div>

        {!manual ? (
          <>
            <div className="px-4 py-3 border-b border-zinc-800">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null); }}
                placeholder="Search title or author…"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {searching && <div className="p-6 text-center text-zinc-600 text-sm">Searching…</div>}
              {!searching && query.length >= 2 && results.length === 0 && (
                <div className="p-6 text-center text-zinc-600 text-sm">
                  No results. <button onClick={() => setManual(true)} className="text-amber-400 hover:text-amber-300 underline">Add manually</button>.
                </div>
              )}
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(r)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-zinc-800/60 transition ${
                    selected === r ? 'bg-amber-500/10' : 'hover:bg-[var(--card)]/60'
                  }`}
                >
                  {r.cover_url ? (
                    <div className="w-10 h-14 relative shrink-0 bg-zinc-900 rounded overflow-hidden">
                      <Image src={r.cover_url} alt="" fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="w-10 h-14 shrink-0 bg-zinc-900 rounded flex items-center justify-center text-zinc-700 text-[10px]">no cover</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{r.title}</p>
                    <p className="text-xs text-zinc-500 truncate">{r.author}{r.year ? ` · ${r.year}` : ''}</p>
                    {r.estimated_minutes && <p className="text-[10px] text-zinc-600 font-mono">~{formatHours(r.estimated_minutes)} audiobook</p>}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="px-4 py-3 border-b border-zinc-800 space-y-2.5">
            <button onClick={() => setManual(false)} className="text-xs text-amber-400 hover:text-amber-300">← Back to search</button>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
            />
            <input
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Author"
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
            />
          </div>
        )}

        {(selected || manual) && (
          <div className="px-4 py-3 border-b border-zinc-800 space-y-2.5">
            <div className="flex gap-1.5">
              {(['listening', 'finished', 'wishlist'] as Status[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                    status === s ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-white'
                  }`}
                >
                  {s === 'listening' ? 'Listening' : s === 'finished' ? 'Finished' : 'Wishlist'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Length</label>
              <input
                type="number"
                step="0.5"
                value={lengthHours}
                onChange={e => setLengthHours(e.target.value)}
                placeholder={selected?.estimated_minutes ? `~${(selected.estimated_minutes / 60).toFixed(1)}` : 'hours'}
                className="w-24 bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none transition"
              />
              <span className="text-xs text-zinc-600">hrs</span>
            </div>
            {status === 'finished' && (
              <div className="flex items-center gap-3">
                <label className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Rating</label>
                <StarRating value={rating} onChange={setRating} />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 px-4 py-3">
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs py-2 rounded-lg transition"
          >
            Save
          </button>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xs px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkImportModal({ onDone, onClose }: { onDone: (added: number) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'finished' | 'wishlist'>('finished');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ parsed: number; added: number; skipped: number; message?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch('/api/book-bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, defaultStatus: status }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      else {
        setResult({ parsed: data.parsed, added: data.added, skipped: data.skipped, message: data.message });
        if (data.added > 0) onDone(data.added);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-0 md:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[var(--card)] border border-zinc-800 w-full md:max-w-xl md:rounded-xl min-h-screen md:min-h-0 md:my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-[var(--card)] z-10">
          <p className="text-sm font-bold text-white">Bulk Import</p>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Paste your audiobook list in any format — bullet points, commas, copy-paste from Notes, or just one per line.
            Claude will parse it, Open Library will enrich with covers and lengths, and anything already in your library gets skipped.
          </p>

          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Project Hail Mary — Andy Weir\nRed Rising, Pierce Brown\n- The Power Law (Sebastian Mallaby)\n...`}
            rows={12}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-700 resize-y font-mono focus:outline-none transition"
          />

          <div className="flex items-center gap-3">
            <label className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Import as</label>
            <div className="flex gap-1.5">
              {(['finished', 'wishlist'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`text-xs font-bold font-mono px-3 py-1 rounded-lg border transition ${
                    status === s ? 'bg-amber-500 text-black border-amber-500' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'
                  }`}
                >
                  {s === 'finished' ? 'Finished' : 'Wishlist'}
                </button>
              ))}
            </div>
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}

          {result && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-xs">
              <p className="text-emerald-400 font-bold">
                Added {result.added} of {result.parsed} books.
                {result.skipped > 0 && <span className="text-zinc-500 font-normal"> ({result.skipped} skipped as duplicates)</span>}
              </p>
              {result.message && <p className="text-zinc-500 mt-1">{result.message}</p>}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-zinc-800 sticky bottom-0 bg-[var(--card)]">
          <button
            onClick={submit}
            disabled={loading || !text.trim()}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs py-2 rounded-lg transition"
          >
            {loading ? 'Parsing + enriching…' : result ? 'Import more' : 'Import'}
          </button>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xs px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 transition">
            {result ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CurrentlyListening({ book, onUpdate }: { book: Book; onUpdate: (id: string, patch: Partial<Book>) => void }) {
  const pct = book.length_minutes ? Math.min(100, (book.listened_minutes / book.length_minutes) * 100) : 0;
  const daysIn = book.started_at
    ? Math.max(1, Math.round((Date.now() - new Date(book.started_at + 'T00:00:00').getTime()) / 86400000))
    : null;
  const minutesPerDay = daysIn && book.listened_minutes ? book.listened_minutes / daysIn : null;
  const remaining = book.length_minutes ? book.length_minutes - book.listened_minutes : null;
  const daysToFinish = minutesPerDay && remaining ? Math.ceil(remaining / minutesPerDay) : null;

  const [editing, setEditing] = useState(false);
  const [listened, setListened] = useState((book.listened_minutes / 60).toFixed(1));

  async function saveProgress() {
    const mins = Math.round(parseFloat(listened) * 60);
    if (isNaN(mins)) { setEditing(false); return; }
    const patch: Partial<Book> = { listened_minutes: mins };
    if (book.length_minutes && mins >= book.length_minutes) {
      patch.status = 'finished';
      patch.finished_at = new Date().toISOString().split('T')[0];
    }
    await onUpdate(book.id, patch);
    setEditing(false);
  }

  return (
    <div className="bg-[var(--card)] border border-amber-500/20 rounded-xl overflow-hidden">
      <div className="flex gap-4 p-5 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent">
        {book.cover_url ? (
          <div className="w-24 h-32 md:w-28 md:h-40 relative shrink-0 rounded-lg overflow-hidden shadow-lg">
            <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="w-24 h-32 md:w-28 md:h-40 shrink-0 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-700 text-xs">no cover</div>
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-amber-400 mb-1">Currently Listening</p>
          <p className="text-base md:text-lg font-bold text-white leading-tight">{book.title}</p>
          <p className="text-sm text-zinc-400 mb-3">{book.author}</p>
          {book.length_minutes && (
            <>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                <span className="text-zinc-300 font-bold">{formatHours(book.listened_minutes)}</span>
                <span className="text-zinc-700">of</span>
                <span>{formatHours(book.length_minutes)}</span>
                <span className="text-zinc-700">·</span>
                <span className="text-amber-400">{pct.toFixed(0)}%</span>
              </div>
            </>
          )}
          <div className="mt-auto pt-3 flex items-center gap-3 text-[11px] font-mono text-zinc-500">
            {daysIn && <span>{daysIn}d in</span>}
            {minutesPerDay && <span className="text-zinc-700">· {formatHours(Math.round(minutesPerDay))}/day</span>}
            {daysToFinish && <span className="text-zinc-700">· ~{daysToFinish}d to finish</span>}
          </div>
          <div className="flex gap-2 mt-2">
            {editing ? (
              <>
                <input
                  type="number" step="0.1" value={listened} onChange={e => setListened(e.target.value)}
                  className="w-20 bg-zinc-900 border border-amber-500/40 rounded px-2 py-1 text-xs text-white focus:outline-none"
                />
                <span className="text-xs text-zinc-600 self-center">hrs listened</span>
                <button onClick={saveProgress} className="ml-auto bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded hover:bg-amber-400 transition">Save</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 px-3 py-1 rounded-lg transition">
                Update progress
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookCard({ book, onUpdate, onDelete }: { book: Book; onUpdate: (id: string, patch: Partial<Book>) => void; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-[var(--card)] border border-zinc-800 rounded-xl overflow-hidden group">
      <div className="flex gap-3 p-3">
        {book.cover_url ? (
          <div className="w-12 h-16 relative shrink-0 rounded overflow-hidden">
            <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="w-12 h-16 shrink-0 bg-zinc-900 rounded" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{book.title}</p>
          <p className="text-xs text-zinc-500 truncate">{book.author}</p>
          <div className="flex items-center gap-2 mt-1">
            {book.rating != null && <StarRating value={book.rating} size={12} />}
            {book.length_minutes && <span className="text-[10px] text-zinc-600 font-mono">{formatHours(book.length_minutes)}</span>}
          </div>
          {book.rec_reason && !expanded && (
            <button onClick={() => setExpanded(true)} className="text-[10px] text-amber-400/70 hover:text-amber-400 mt-1 truncate block w-full text-left">
              Why? ▾
            </button>
          )}
          {expanded && book.rec_reason && (
            <p className="text-[11px] text-zinc-500 italic mt-1 leading-snug">{book.rec_reason}</p>
          )}
        </div>
        <button onClick={() => onDelete(book.id)} className="text-zinc-700 hover:text-red-400 text-xs self-start opacity-0 group-hover:opacity-100 transition">✕</button>
      </div>
      {book.status === 'wishlist' && (
        <button
          onClick={() => onUpdate(book.id, { status: 'listening', started_at: new Date().toISOString().split('T')[0] })}
          className="w-full text-[11px] font-mono text-amber-400 py-1.5 border-t border-zinc-800 hover:bg-amber-500/5 transition"
        >
          Start listening →
        </button>
      )}
      {book.status === 'finished' && book.rating == null && (
        <div className="border-t border-zinc-800 px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-600">Rate:</span>
          <StarRating value={null} size={14} onChange={v => onUpdate(book.id, { rating: v })} />
        </div>
      )}
    </div>
  );
}

function RecsPanel({ onSave, onDismiss }: {
  onSave: (rec: Recommendation) => Promise<void>;
  onDismiss: (rec: Recommendation) => Promise<void>;
}) {
  const [vibe, setVibe] = useState('');
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function fetchRecs() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/book-recs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vibe: vibe.trim() || undefined }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); setRecs([]); }
      else setRecs(data.recommendations ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-bold font-mono uppercase tracking-widest text-amber-400">Rocky Recommends</span>
        <div className="flex-1 h-px bg-zinc-800/60" />
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={vibe}
          onChange={e => setVibe(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchRecs()}
          placeholder="Vibe? (e.g. short, fiction, like Project Hail Mary) — optional"
          className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition"
        />
        <button
          onClick={fetchRecs}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs px-4 rounded-lg transition whitespace-nowrap"
        >
          {loading ? '…' : recs.length ? 'Regenerate' : 'Get recs'}
        </button>
      </div>
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      {recs.length > 0 && (
        <div className="space-y-2">
          {recs.map((r, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
              <p className="text-sm font-bold text-white">{r.title}</p>
              <p className="text-xs text-zinc-500 mb-1.5">{r.author}</p>
              <p className="text-[11px] text-zinc-400 italic leading-snug">{r.why}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onSave(r)}
                  className="text-[11px] font-bold text-amber-400 border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5 px-2.5 py-1 rounded transition"
                >
                  + Wishlist
                </button>
                <button
                  onClick={() => { onDismiss(r); setRecs(recs.filter(x => x !== r)); }}
                  className="text-[11px] text-zinc-600 hover:text-zinc-300 px-2.5 py-1 transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReadingTab() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [view, setView] = useState<'library' | 'wishlist'>('library');
  const { toast } = useToast();

  async function reloadBooks() {
    const res = await fetch('/api/books');
    const { books } = await res.json();
    setBooks(books ?? []);
  }

  useEffect(() => {
    fetch('/api/books')
      .then(r => r.json())
      .then(({ books }) => setBooks(books ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function addBook(book: Partial<Book>) {
    const res = await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(book),
    });
    const { book: saved } = await res.json();
    if (saved) {
      setBooks(prev => [saved, ...prev]);
      toast(`Added: ${saved.title}`, 'success');
    }
    setShowAdd(false);
  }

  async function updateBook(id: string, patch: Partial<Book>) {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
    await fetch('/api/books', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    if (patch.status === 'finished') toast('Finished — nice.', 'success');
  }

  async function deleteBook(id: string) {
    setBooks(prev => prev.filter(b => b.id !== id));
    await fetch('/api/books', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async function saveRec(rec: Recommendation) {
    await addBook({
      title: rec.title,
      author: rec.author,
      status: 'wishlist',
      rec_reason: rec.why,
    });
  }

  async function dismissRec(rec: Recommendation) {
    await fetch('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: rec.title,
        author: rec.author,
        status: 'dismissed',
        rec_reason: rec.why,
      }),
    });
  }

  const current = books.filter(b => b.status === 'listening');
  const finished = books.filter(b => b.status === 'finished')
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''));
  const wishlist = books.filter(b => b.status === 'wishlist');

  const booksThisYear = finished.filter(b => b.finished_at?.startsWith(new Date().getFullYear().toString())).length;
  const avgRating = finished.filter(b => b.rating != null).length > 0
    ? finished.filter(b => b.rating != null).reduce((s, b) => s + (b.rating ?? 0), 0) / finished.filter(b => b.rating != null).length
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <p className="text-sm font-medium text-white">{finished.length} <span className="text-zinc-500">finished</span></p>
          <p className="text-sm text-zinc-500">{booksThisYear} this year</p>
          {avgRating != null && <p className="text-sm text-zinc-500">avg <span className="text-amber-400 font-mono">{avgRating.toFixed(1)}</span></p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulk(true)}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-3 py-2 rounded-lg transition border border-zinc-700"
          >
            Bulk Import
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2 rounded-lg transition"
          >
            + Add Book
          </button>
        </div>
      </div>

      {/* Currently listening */}
      {current.map(b => (
        <CurrentlyListening key={b.id} book={b} onUpdate={updateBook} />
      ))}

      {/* View toggle */}
      <div className="flex gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 w-fit">
        <button onClick={() => setView('library')}
          className={`text-[11px] font-mono px-3 py-1.5 rounded-md transition ${view === 'library' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}>
          Library ({finished.length})
        </button>
        <button onClick={() => setView('wishlist')}
          className={`text-[11px] font-mono px-3 py-1.5 rounded-md transition ${view === 'wishlist' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}>
          Wishlist ({wishlist.length})
        </button>
      </div>

      {/* Book grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          {view === 'library' && (
            finished.length === 0 ? (
              <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-10 text-center text-zinc-500 text-sm">
                No finished books yet. Add one to start building your library.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {finished.map(b => <BookCard key={b.id} book={b} onUpdate={updateBook} onDelete={deleteBook} />)}
              </div>
            )
          )}
          {view === 'wishlist' && (
            wishlist.length === 0 ? (
              <div className="bg-[var(--card)] border border-zinc-800 rounded-xl p-10 text-center text-zinc-500 text-sm">
                Wishlist is empty. Hit "Get recs" below to have Rocky pitch some titles.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {wishlist.map(b => <BookCard key={b.id} book={b} onUpdate={updateBook} onDelete={deleteBook} />)}
              </div>
            )
          )}
        </>
      )}

      {/* Recs panel */}
      <RecsPanel onSave={saveRec} onDismiss={dismissRec} />

      {showAdd && <AddBookModal onAdd={addBook} onClose={() => setShowAdd(false)} />}
      {showBulk && (
        <BulkImportModal
          onDone={(n) => { toast(`Imported ${n} books`, 'success'); reloadBooks(); }}
          onClose={() => setShowBulk(false)}
        />
      )}
    </div>
  );
}
