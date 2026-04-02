'use client';
import { useState } from 'react';
import BriefingTab from './components/BriefingTab';
import SportsTab from './components/SportsTab';
import WeatherTab from './components/WeatherTab';
import NewsTab from './components/NewsTab';
import BDTargetsTab from './components/BDTargetsTab';
import TasksTab from './components/TasksTab';

export default function Home() {
  const [tab, setTab] = useState<'briefing' | 'sports' | 'weather' | 'news' | 'bd' | 'tasks'>('sports');

  const TAB_LABELS: Record<string, string> = {
    briefing: 'BRIEFING',
    sports: 'SPORTS',
    weather: 'WEATHER',
    news: 'NEWS',
    bd: 'BD TARGETS',
    tasks: 'TASKS',
  };

  return (
    <main suppressHydrationWarning className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b border-zinc-800">
          <div>
            <p className="text-xs text-amber-400 uppercase tracking-[0.3em] font-mono mb-1">Ortiz</p>
            <h1 className="text-3xl font-bold text-white tracking-tight">Ortiz OS</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-mono">Parkland, FL</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(['briefing', 'sports', 'weather', 'news', 'bd', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition font-mono tracking-widest ${
                tab === t
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:text-white hover:border-zinc-600'
              }`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'briefing' && <BriefingTab />}
        {tab === 'sports' && <SportsTab />}
        {tab === 'weather' && <WeatherTab />}
        {tab === 'news' && <NewsTab />}
        {tab === 'bd' && <BDTargetsTab />}
        {tab === 'tasks' && <TasksTab />}
      </div>
    </main>
  );
}
