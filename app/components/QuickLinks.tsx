'use client';
import { useState, useEffect } from 'react';

type Link = { id: string; label: string; url: string; position: number };

const DEFAULTS = [
  { label: 'HubSpot',  url: 'https://app.hubspot.com' },
  { label: 'LinkedIn', url: 'https://www.linkedin.com' },
  { label: 'Gmail',    url: 'https://mail.google.com' },
  { label: 'Calendar', url: 'https://calendar.google.com' },
  { label: 'ESPN',     url: 'https://www.espn.com' },
];

export default function QuickLinks() {
  const [links, setLinks] = useState<Link[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    fetch('/api/quick-links')
      .then(r => r.json())
      .then(async ({ links: fetched }) => {
        if (fetched.length === 0) {
          // Seed defaults on first load
          const seeded: Link[] = [];
          for (let i = 0; i < DEFAULTS.length; i++) {
            const res = await fetch('/api/quick-links', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...DEFAULTS[i], position: i }),
            });
            const { link } = await res.json();
            if (link) seeded.push(link);
          }
          setLinks(seeded);
        } else {
          setLinks(fetched);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function addLink() {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const url = newUrl.startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`;
    const position = links.length;
    const res = await fetch('/api/quick-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim(), url, position }),
    });
    const { link } = await res.json();
    if (link) setLinks(prev => [...prev, link]);
    setNewLabel('');
    setNewUrl('');
  }

  async function removeLink(id: string) {
    if (editingId === id) setEditingId(null);
    setLinks(prev => prev.filter(l => l.id !== id));
    await fetch('/api/quick-links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  function startEdit(link: Link) {
    setEditingId(link.id);
    setEditLabel(link.label);
    setEditUrl(link.url);
  }

  async function commitEdit() {
    if (!editingId || !editLabel.trim() || !editUrl.trim()) { setEditingId(null); return; }
    const url = editUrl.startsWith('http') ? editUrl.trim() : `https://${editUrl.trim()}`;
    setLinks(prev => prev.map(l => l.id === editingId ? { ...l, label: editLabel.trim(), url } : l));
    setEditingId(null);
    await fetch('/api/quick-links', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, label: editLabel.trim(), url }),
    });
  }

  if (!loaded) return <div className="mb-6 h-8" />;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 flex-wrap">
        {links.map(l => (
          <div key={l.id} className="relative">
            {editing && editingId === l.id ? (
              <div className="flex items-center gap-1.5">
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  className="w-20 bg-zinc-900 border border-amber-500/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                  autoFocus />
                <input value={editUrl} onChange={e => setEditUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && commitEdit()}
                  className="w-40 bg-zinc-900 border border-amber-500/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                <button onClick={commitEdit}
                  className="px-2 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors">
                  Save
                </button>
                <button onClick={() => setEditingId(null)}
                  className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <a href={editing ? undefined : l.url}
                  onClick={editing ? (e) => { e.preventDefault(); startEdit(l); } : undefined}
                  target={editing ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 border text-xs font-mono transition-colors ${
                    editing
                      ? 'border-zinc-700 text-zinc-400 cursor-pointer hover:border-amber-500/40 hover:text-white'
                      : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
                  }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 shrink-0" />
                  {l.label}
                  {editing && <span className="text-zinc-700 ml-1">✎</span>}
                </a>
                {editing && (
                  <button onClick={() => removeLink(l.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center leading-none hover:bg-red-400 transition-colors">
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {editing ? (
          <div className="flex items-center gap-1.5 mt-1">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="Label"
              className="w-20 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40" />
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
              placeholder="URL"
              onKeyDown={e => e.key === 'Enter' && addLink()}
              className="w-36 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40" />
            <button onClick={addLink}
              className="px-2 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors">
              Add
            </button>
            <button onClick={() => { setEditing(false); setEditingId(null); setNewLabel(''); setNewUrl(''); }}
              className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:text-white transition-colors">
              Done
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="px-2 py-1.5 rounded-lg border border-dashed border-zinc-800 text-zinc-600 text-xs hover:border-zinc-600 hover:text-zinc-400 transition-colors font-mono">
            + link
          </button>
        )}
      </div>
    </div>
  );
}
