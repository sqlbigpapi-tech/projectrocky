'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

type SpotlightItem = {
  id: string;
  label: string;
  sublabel?: string;
  section: string;
  action: () => void;
};

export default function Spotlight({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: SpotlightItem[];
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? items.filter(item => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          (item.sublabel?.toLowerCase().includes(q)) ||
          item.section.toLowerCase().includes(q)
        );
      })
    : items;

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Clamp selection when results change
  useEffect(() => {
    if (selected >= filtered.length) setSelected(Math.max(0, filtered.length - 1));
  }, [filtered.length]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => (s + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => (s - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault();
      filtered[selected].action();
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selected, onClose]);

  if (!open) return null;

  // Group by section
  const sections = new Map<string, typeof filtered>();
  for (const item of filtered) {
    const list = sections.get(item.section) ?? [];
    list.push(item);
    sections.set(item.section, list);
  }

  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[var(--card)] border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <svg className="w-4 h-4 text-zinc-500 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M12.5 12.5L17 17" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKey}
            placeholder="Search tabs, accounts, actions..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none font-mono"
          />
          <kbd className="text-[10px] text-zinc-600 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-600 font-mono text-center py-8">No results</p>
          ) : (
            Array.from(sections.entries()).map(([section, sectionItems]) => (
              <div key={section}>
                <p className="px-4 pt-3 pb-1 text-[10px] text-zinc-600 font-mono uppercase tracking-widest">{section}</p>
                {sectionItems.map(item => {
                  const idx = globalIdx++;
                  const isSelected = idx === selected;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { item.action(); onClose(); }}
                      onMouseEnter={() => setSelected(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        isSelected ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="text-sm flex-1">{item.label}</span>
                      {item.sublabel && <span className="text-xs text-zinc-600 font-mono">{item.sublabel}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-4 py-2 flex items-center gap-4">
          <span className="text-[10px] text-zinc-700 font-mono"><kbd className="bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">↑↓</kbd> navigate</span>
          <span className="text-[10px] text-zinc-700 font-mono"><kbd className="bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">↵</kbd> open</span>
          <span className="text-[10px] text-zinc-700 font-mono"><kbd className="bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
