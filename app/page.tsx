'use client';
import { useState } from 'react';
import BriefingTab from './components/BriefingTab';
import SportsTab from './components/SportsTab';
import BDTargetsTab from './components/BDTargetsTab';
import TasksTab from './components/TasksTab';
import IncomeTab from './components/IncomeTab';
import IncomeChartsTab from './components/IncomeChartsTab';
import HealthTab from './components/HealthTab';
import NetWorthTab from './components/NetWorthTab';
import QuickLinks from './components/QuickLinks';

export default function Home() {
  const [tab, setTab] = useState<'briefing' | 'sports' | 'bd' | 'tasks' | 'income' | 'health' | 'networth'>('briefing');
  const [incomeView, setIncomeView] = useState<'tracker' | 'charts'>('tracker');

  const TAB_LABELS: Record<string, string> = {
    briefing: 'BRIEFING',
    sports: 'MY TEAMS',
    bd: 'BD TARGETS',
    tasks: 'TASKS',
    income: 'SEI NET INCOME',
    health: 'HEALTH',
    networth: 'NET WORTH',
  };

  return (
    <main suppressHydrationWarning className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-6 border-b border-zinc-800">
          <div>
            <p className="text-xs text-amber-400 uppercase tracking-[0.3em] font-mono mb-1">David Ortiz</p>
            <h1 className="text-3xl font-bold text-white tracking-tight">Project Rocky</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-mono">Parkland, FL</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['briefing', 'sports', 'bd', 'tasks', 'income', 'health', 'networth'] as const).map(t => (
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

        {/* Quick Links */}
        <QuickLinks />

        {tab === 'briefing' && <BriefingTab onNavigate={setTab} />}
        {tab === 'sports' && <SportsTab />}
        {tab === 'bd' && <BDTargetsTab />}
        {tab === 'tasks' && <TasksTab />}
        {tab === 'income' && (
          <div>
            <div className="flex gap-2 mb-5">
              {(['tracker', 'charts'] as const).map(v => (
                <button key={v} onClick={() => setIncomeView(v)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest transition ${incomeView === v ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-600 hover:text-white'}`}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
            {incomeView === 'tracker' ? <IncomeTab /> : <IncomeChartsTab />}
          </div>
        )}
        {tab === 'health' && <HealthTab />}
        {tab === 'networth' && <NetWorthTab />}
      </div>
    </main>
  );
}
