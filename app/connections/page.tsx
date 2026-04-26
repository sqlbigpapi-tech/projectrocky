'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

type Difficulty = 0 | 1 | 2 | 3;
type Category = { name: string; difficulty: Difficulty; words: string[] };

const CORPUS: Category[] = [
  // Yellow — easy
  { name: 'Citrus fruits',         difficulty: 0, words: ['ORANGE', 'LEMON', 'LIME', 'GRAPEFRUIT'] },
  { name: 'Coffee orders',         difficulty: 0, words: ['LATTE', 'MOCHA', 'ESPRESSO', 'AMERICANO'] },
  { name: 'Days of the week',      difficulty: 0, words: ['MONDAY', 'TUESDAY', 'FRIDAY', 'SUNDAY'] },
  { name: 'Pasta shapes',          difficulty: 0, words: ['PENNE', 'FUSILLI', 'RIGATONI', 'ORZO'] },
  { name: 'Found in the sky',      difficulty: 0, words: ['CLOUD', 'KITE', 'MOON', 'STAR'] },
  // Green — medium
  { name: 'Boxing punches',        difficulty: 1, words: ['JAB', 'HOOK', 'CROSS', 'UPPERCUT'] },
  { name: 'Card-game actions',     difficulty: 1, words: ['BLUFF', 'FOLD', 'CALL', 'RAISE'] },
  { name: 'Movie genres',          difficulty: 1, words: ['THRILLER', 'COMEDY', 'DRAMA', 'HORROR'] },
  { name: 'Punctuation marks',     difficulty: 1, words: ['COMMA', 'COLON', 'DASH', 'PERIOD'] },
  { name: 'Small birds',           difficulty: 1, words: ['ROBIN', 'FINCH', 'JAY', 'SPARROW'] },
  // Blue — hard
  { name: 'Words meaning "smart"', difficulty: 2, words: ['SHARP', 'BRIGHT', 'KEEN', 'SAVVY'] },
  { name: 'Words meaning "tiny"',  difficulty: 2, words: ['WEE', 'PETITE', 'POCKET', 'MINI'] },
  { name: 'Things in pairs',       difficulty: 2, words: ['SHOES', 'DICE', 'CHOPSTICKS', 'TWINS'] },
  { name: '___ ball',              difficulty: 2, words: ['BASKET', 'FOOT', 'BASE', 'SOFT'] },
  { name: 'Words for "rich"',      difficulty: 2, words: ['LOADED', 'WEALTHY', 'FLUSH', 'MADE'] },
  // Purple — tricky
  { name: 'Mike ___ (last names)', difficulty: 3, words: ['TYSON', 'PENCE', 'TROUT', 'WAZOWSKI'] },
  { name: '___ attack',            difficulty: 3, words: ['HEART', 'PANIC', 'ASTHMA', 'COUNTER'] },
  { name: 'Words with double letters in middle', difficulty: 3, words: ['BUTTON', 'ATTIC', 'JIGGLE', 'RIBBON'] },
  { name: 'Words for "exhausted"', difficulty: 3, words: ['BEAT', 'WIPED', 'DRAINED', 'SHOT'] },
  { name: 'Ways to start a story', difficulty: 3, words: ['ONCE', 'FIRST', 'BEGINNING', 'OPENING'] },
];

const TIER: Record<Difficulty, { label: string; bg: string; ring: string; text: string; bar: string }> = {
  0: { label: 'Easy',   bg: 'bg-yellow-500/15',  ring: 'ring-yellow-500/40',  text: 'text-yellow-200',  bar: 'bg-yellow-500'  },
  1: { label: 'Medium', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/40', text: 'text-emerald-200', bar: 'bg-emerald-500' },
  2: { label: 'Hard',   bg: 'bg-blue-500/15',    ring: 'ring-blue-500/40',    text: 'text-blue-200',    bar: 'bg-blue-500'    },
  3: { label: 'Tricky', bg: 'bg-purple-500/15',  ring: 'ring-purple-500/40',  text: 'text-purple-200',  bar: 'bg-purple-500'  },
};

// Deterministic PRNG (Mulberry32) for date-seeded shuffles
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickCategoriesForSeed(seedStr: string): Category[] {
  const rng = mulberry32(hashStr(seedStr));
  const tiers: Category[][] = [[], [], [], []];
  CORPUS.forEach(c => tiers[c.difficulty].push(c));
  return tiers.map(tier => shuffle(tier, rng)[0]);
}

function todayET(): string {
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;
}

type Saved = {
  seed: string;
  solved: number[];
  mistakes: number;
  done: 'won' | 'lost' | null;
  remaining: string[];
  selected: string[];
};

export default function ConnectionsPage() {
  const today = useMemo(() => todayET(), []);
  const [seed, setSeed] = useState<string>(today);
  const [isDaily, setIsDaily] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const categories = useMemo(() => pickCategoriesForSeed(seed), [seed]);
  const allWords = useMemo(() => categories.flatMap(c => c.words), [categories]);

  const [remaining, setRemaining] = useState<string[]>(() =>
    shuffle(allWords, mulberry32(hashStr(`grid:${seed}`)))
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState<'won' | 'lost' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  // Restore daily state
  useEffect(() => {
    if (!isDaily) { setHydrated(true); return; }
    try {
      const raw = localStorage.getItem(`rocky:connections:${today}`);
      if (raw) {
        const s: Saved = JSON.parse(raw);
        if (s.seed === today) {
          setRemaining(s.remaining);
          setSolved(s.solved);
          setMistakes(s.mistakes);
          setDone(s.done);
          setSelected(s.selected || []);
        }
      }
    } catch {}
    setHydrated(true);
  }, [today, isDaily]);

  // Persist daily state
  useEffect(() => {
    if (!hydrated || !isDaily) return;
    try {
      const s: Saved = { seed, solved, mistakes, done, remaining, selected };
      localStorage.setItem(`rocky:connections:${today}`, JSON.stringify(s));
    } catch {}
  }, [hydrated, isDaily, seed, solved, mistakes, done, remaining, selected, today]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1700);
    return () => clearTimeout(t);
  }, [toast]);

  const toggle = useCallback((word: string) => {
    if (done) return;
    setSelected(s => {
      if (s.includes(word)) return s.filter(w => w !== word);
      if (s.length >= 4) return s;
      return [...s, word];
    });
  }, [done]);

  const submit = useCallback(() => {
    if (selected.length !== 4 || done) return;
    const idxs = selected.map(w => categories.findIndex(c => c.words.includes(w)));
    const counts: Record<number, number> = {};
    idxs.forEach(i => { counts[i] = (counts[i] || 0) + 1; });
    const max = Math.max(...Object.values(counts));

    if (max === 4) {
      const catIdx = idxs[0];
      setSolved(s => {
        const next = [...s, catIdx];
        if (next.length === 4) {
          setDone('won');
          setToast('🎯 Solved!');
        } else {
          setToast(`✓ ${categories[catIdx].name}`);
        }
        return next;
      });
      setRemaining(r => r.filter(w => !selected.includes(w)));
      setSelected([]);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 420);
      setMistakes(m => {
        const next = m + 1;
        if (next >= 4) {
          setDone('lost');
          setToast('Out of mistakes');
        } else if (max === 3) {
          setToast('One away…');
        } else {
          setToast('Not quite');
        }
        return next;
      });
      // keep selection so user sees what they tried; clear after a beat
      setTimeout(() => setSelected([]), 600);
    }
  }, [selected, categories, done]);

  const shuffleRemaining = useCallback(() => {
    setRemaining(r => shuffle(r, Math.random));
  }, []);

  const deselect = useCallback(() => setSelected([]), []);

  const newRandom = useCallback(() => {
    const rseed = `random:${Math.random().toString(36).slice(2)}`;
    setIsDaily(false);
    setSeed(rseed);
    const cats = pickCategoriesForSeed(rseed);
    const words = cats.flatMap(c => c.words);
    setRemaining(shuffle(words, mulberry32(hashStr(`grid:${rseed}`))));
    setSelected([]);
    setSolved([]);
    setMistakes(0);
    setDone(null);
    setToast(null);
  }, []);

  const backToDaily = useCallback(() => {
    setIsDaily(true);
    setSeed(today);
    // Reload from localStorage on next effect tick — easier: just reset state and let restore kick in
    const cats = pickCategoriesForSeed(today);
    const words = cats.flatMap(c => c.words);
    try {
      const raw = localStorage.getItem(`rocky:connections:${today}`);
      if (raw) {
        const s: Saved = JSON.parse(raw);
        if (s.seed === today) {
          setRemaining(s.remaining);
          setSolved(s.solved);
          setMistakes(s.mistakes);
          setDone(s.done);
          setSelected(s.selected || []);
          return;
        }
      }
    } catch {}
    setRemaining(shuffle(words, mulberry32(hashStr(`grid:${today}`))));
    setSolved([]);
    setMistakes(0);
    setDone(null);
    setSelected([]);
  }, [today]);

  // Show solved categories at top, in tier order; reveal unsolved if game is lost
  const solvedSet = new Set(solved);
  const toReveal = done === 'lost' ? categories.map((_, i) => i).filter(i => !solvedSet.has(i)) : [];

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="max-w-2xl mx-auto p-5 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <a href="/" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition">← Rocky</a>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-300 via-blue-300 to-emerald-300 bg-clip-text text-transparent">
            Connections
          </h1>
          <span className="text-[10px] font-mono text-zinc-600 tabular-nums">
            {isDaily ? today : 'random'}
          </span>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between mb-4 text-xs font-mono">
          <span className="text-zinc-500">
            <span className="text-zinc-300">{solved.length}</span>/4 solved
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 mr-1">mistakes</span>
            {[0, 1, 2, 3].map(i => (
              <span
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i < mistakes ? 'bg-zinc-500' : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Solved rows */}
        <div className="space-y-2 mb-3">
          {solved.map(catIdx => {
            const cat = categories[catIdx];
            const tier = TIER[cat.difficulty];
            return (
              <div
                key={catIdx}
                className={`rounded-xl ${tier.bg} ring-1 ${tier.ring} px-3 py-2.5 text-center`}
              >
                <div className={`text-[10px] font-mono font-bold uppercase tracking-widest ${tier.text}`}>
                  {cat.name}
                </div>
                <div className="text-[13px] font-mono font-semibold text-white mt-0.5">
                  {cat.words.join(' · ')}
                </div>
              </div>
            );
          })}
          {toReveal.map(catIdx => {
            const cat = categories[catIdx];
            const tier = TIER[cat.difficulty];
            return (
              <div
                key={`reveal-${catIdx}`}
                className={`rounded-xl ${tier.bg} ring-1 ${tier.ring} px-3 py-2.5 text-center opacity-70`}
              >
                <div className={`text-[10px] font-mono font-bold uppercase tracking-widest ${tier.text}`}>
                  {cat.name}
                </div>
                <div className="text-[13px] font-mono font-semibold text-zinc-300 mt-0.5">
                  {cat.words.join(' · ')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        {remaining.length > 0 && !done && (
          <div className={`grid grid-cols-4 gap-2 mb-4 ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}>
            {remaining.map(word => {
              const sel = selected.includes(word);
              return (
                <button
                  key={word}
                  onClick={() => toggle(word)}
                  className={`aspect-[1.4/1] rounded-lg px-1 text-[12px] sm:text-[13px] font-mono font-bold tracking-tight transition-all duration-100 break-words leading-tight ${
                    sel
                      ? 'bg-zinc-200 text-black scale-[0.97]'
                      : 'bg-[var(--card)] text-zinc-200 hover:bg-zinc-800 active:scale-[0.97]'
                  }`}
                >
                  {word}
                </button>
              );
            })}
          </div>
        )}

        {/* Toast */}
        <div className="h-7 flex items-center justify-center mb-2">
          {toast && (
            <div className="px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-xs font-mono text-zinc-200 shadow-lg">
              {toast}
            </div>
          )}
        </div>

        {/* Controls */}
        {!done && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={shuffleRemaining}
              disabled={remaining.length === 0}
              className="py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)]/40 text-[11px] font-mono font-bold tracking-widest text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition"
            >
              SHUFFLE
            </button>
            <button
              onClick={deselect}
              disabled={selected.length === 0}
              className="py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)]/40 text-[11px] font-mono font-bold tracking-widest text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition"
            >
              DESELECT
            </button>
            <button
              onClick={submit}
              disabled={selected.length !== 4}
              className={`py-2.5 rounded-xl text-[11px] font-mono font-bold tracking-widest transition ${
                selected.length === 4
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400 active:scale-[0.99]'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              SUBMIT
            </button>
          </div>
        )}

        {/* End state */}
        {done && (
          <div className={`rounded-xl border p-4 text-center mb-4 ${
            done === 'won' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'
          }`}>
            <div className="text-sm font-mono font-bold text-white">
              {done === 'won' ? `Solved with ${mistakes} mistake${mistakes === 1 ? '' : 's'}` : 'Better luck next time'}
            </div>
            <div className="text-[11px] font-mono text-zinc-400 mt-1">
              {isDaily
                ? (done === 'won' ? 'Come back tomorrow for a new puzzle' : 'New puzzle tomorrow')
                : 'Random puzzle complete'}
            </div>
          </div>
        )}

        {/* Random/daily toggle */}
        <div className="flex gap-2">
          <button
            onClick={newRandom}
            className="flex-1 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)]/40 text-[11px] font-mono font-bold tracking-widest text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            {done || !isDaily ? 'PLAY RANDOM' : 'SKIP TO RANDOM'}
          </button>
          {!isDaily && (
            <button
              onClick={backToDaily}
              className="flex-1 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)]/40 text-[11px] font-mono font-bold tracking-widest text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            >
              BACK TO DAILY
            </button>
          )}
        </div>

        <div className="text-center text-[10px] font-mono text-zinc-700 mt-4 tracking-widest">
          Pick 4 words that share a connection · 4 mistakes max
        </div>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </main>
  );
}
