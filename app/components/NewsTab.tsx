'use client';
import { useState, useEffect } from 'react';
import type { NewsItem } from '../api/news/route';

const CATEGORIES = ['All', 'Mets', 'Giants', 'Knicks', 'Business', 'Tech & AI', 'South Florida'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<string, { badge: string; dot: string }> = {
  Mets:            { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25',       dot: 'bg-blue-400' },
  Giants:          { badge: 'bg-red-500/15 text-red-400 border-red-500/25',          dot: 'bg-red-400' },
  Knicks:          { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25', dot: 'bg-orange-400' },
  Business:        { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25',    dot: 'bg-amber-400' },
  'Tech & AI':     { badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',       dot: 'bg-cyan-400' },
  'South Florida': { badge: 'bg-teal-500/15 text-teal-400 border-teal-500/25',       dot: 'bg-teal-400' },
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function NewsCard({ item }: { item: NewsItem }) {
  const colors = CATEGORY_COLORS[item.category] ?? { badge: 'bg-zinc-800 text-zinc-400 border-zinc-700', dot: 'bg-zinc-500' };

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 bg-zinc-950 rounded-xl border border-zinc-800 p-4 hover:border-zinc-600 transition-colors"
    >
      {/* Category + time */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border font-mono tracking-wide ${colors.badge}`}>
          {item.category}
        </span>
        <span className="text-xs text-zinc-600 shrink-0">{timeAgo(item.pubDate)}</span>
      </div>

      {/* Headline */}
      <p className="text-sm font-semibold text-zinc-200 leading-snug group-hover:text-white transition-colors line-clamp-3">
        {item.title}
      </p>

      {/* Source */}
      <div className="flex items-center gap-1.5 mt-auto">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
        <span className="text-xs text-zinc-600 truncate">{item.source}</span>
      </div>
    </a>
  );
}

export default function NewsTab() {
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category>('All');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      setArticles(data.articles ?? []);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'All' ? articles : articles.filter(a => a.category === filter);
  const countFor = (cat: string) => articles.filter(a => a.category === cat).length;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">News</h2>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-zinc-600">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            className="text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => {
          const colors = CATEGORY_COLORS[cat];
          const isActive = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition border ${
                isActive
                  ? cat === 'All'
                    ? 'bg-zinc-700 text-white border-zinc-600'
                    : colors.badge
                  : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-white hover:border-zinc-600'
              }`}
            >
              {cat}
              {cat !== 'All' && !loading && (
                <span className="ml-1.5 opacity-60">{countFor(cat)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 animate-pulse h-40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-12 text-center text-zinc-500">
          No articles found{filter !== 'All' ? ` for ${filter}` : ''}.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item, i) => (
            <NewsCard key={`${item.link}-${i}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
