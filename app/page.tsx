'use client';
import { useState, useEffect } from 'react';
import BriefingTab from './components/BriefingTab';
import SportsTab from './components/SportsTab';
import TasksTab from './components/TasksTab';
import IncomeTab from './components/IncomeTab';
import IncomeChartsTab from './components/IncomeChartsTab';
import HealthTab from './components/HealthTab';
import NetWorthTab from './components/NetWorthTab';
import QuickLinks from './components/QuickLinks';
import NotificationsTab from './components/NotificationsTab';
import FinancialModelTab from './components/FinancialModelTab';
import HeadcountTab from './components/HeadcountTab';
import EquityTab from './components/EquityTab';

type MainTab = 'briefing' | 'sports' | 'tasks' | 'finance' | 'health' | 'networth' | 'notifications';
type FinanceSubTab = 'income' | 'finmodel' | 'headcount' | 'equity';

function getRole(): string {
  if (typeof document === 'undefined') return 'owner';
  const match = document.cookie.match(/(?:^|; )role=([^;]*)/);
  return match?.[1] ?? 'owner';
}

export default function Home() {
  const [tab, setTab] = useState<MainTab>('briefing');
  const [financeTab, setFinanceTab] = useState<FinanceSubTab>('income');
  const [incomeView, setIncomeView] = useState<'tracker' | 'charts'>('tracker');
  const role = getRole();
  const isTeam = role === 'team';

  // Allow navigation from briefing tab to any sub-tab
  function navigate(target: string) {
    if (['income', 'finmodel', 'headcount', 'equity'].includes(target)) {
      setTab('finance');
      setFinanceTab(target as FinanceSubTab);
    } else {
      setTab(target as MainTab);
    }
  }

  const ALL_MAIN_TABS: { key: MainTab; label: string; ownerOnly?: boolean }[] = [
    { key: 'briefing', label: 'BRIEFING', ownerOnly: true },
    { key: 'sports', label: 'MY TEAMS', ownerOnly: true },
    { key: 'tasks', label: 'TASKS', ownerOnly: true },
    { key: 'finance', label: 'SEI MIAMI' },
    { key: 'health', label: 'HEALTH', ownerOnly: true },
    { key: 'networth', label: 'NET WORTH', ownerOnly: true },
    { key: 'notifications', label: 'ALERTS', ownerOnly: true },
  ];
  const MAIN_TABS = ALL_MAIN_TABS.filter(t => !t.ownerOnly || !isTeam);

  // Default team users to finance tab
  useEffect(() => {
    if (isTeam && tab !== 'finance') setTab('finance');
  }, [isTeam]);

  const FINANCE_SUBS: { key: FinanceSubTab; label: string }[] = [
    { key: 'income', label: 'SEI NET INCOME' },
    { key: 'finmodel', label: 'P&L MODEL' },
    { key: 'headcount', label: 'HEADCOUNT' },
    { key: 'equity', label: 'EQUITY' },
  ];

  return (
    <main suppressHydrationWarning className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-6 border-b border-zinc-800">
          <div>
            <p className="text-xs text-amber-400 uppercase tracking-[0.3em] font-mono mb-1">David Ortiz</p>
            <h1 className="text-3xl font-bold text-white tracking-tight">Project Rocky</h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-mono">Parkland, FL</p>
            <button onClick={() => { document.cookie = 'session=; path=/; max-age=0'; document.cookie = 'role=; path=/; max-age=0'; window.location.href = '/login'; }}
              className="text-xs text-zinc-700 font-mono hover:text-red-400 transition">logout</button>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-2 mb-4">
          {MAIN_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition font-mono tracking-widest ${
                tab === t.key
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:text-white hover:border-zinc-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Finance Sub-tabs */}
        {tab === 'finance' && (
          <div className="flex gap-2 mb-5">
            {FINANCE_SUBS.map(s => (
              <button key={s.key} onClick={() => setFinanceTab(s.key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest transition ${
                  financeTab === s.key
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-zinc-600 hover:text-white'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Quick Links */}
        <QuickLinks />

        {tab === 'briefing' && <BriefingTab onNavigate={navigate} />}
        {tab === 'sports' && <SportsTab />}
        {tab === 'tasks' && <TasksTab />}
        {tab === 'finance' && financeTab === 'income' && (
          <div>
            <div className="flex gap-2 mb-5">
              {(['tracker', 'charts'] as const).map(v => (
                <button key={v} onClick={() => setIncomeView(v)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest transition ${incomeView === v ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'text-zinc-600 hover:text-white'}`}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
            {incomeView === 'tracker' ? <IncomeTab /> : <IncomeChartsTab />}
          </div>
        )}
        {tab === 'finance' && financeTab === 'finmodel' && <FinancialModelTab />}
        {tab === 'finance' && financeTab === 'headcount' && <HeadcountTab />}
        {tab === 'finance' && financeTab === 'equity' && <EquityTab />}
        {tab === 'health' && <HealthTab />}
        {tab === 'networth' && <NetWorthTab />}
        {tab === 'notifications' && <NotificationsTab />}
      </div>
    </main>
  );
}
