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

/* ── SVG Icons (20×20) ── */
function IconBriefing({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 8h14M8 8v9" />
    </svg>
  );
}
function IconTeams({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M6 13s1.5-2 4-2 4 2 4 2" />
      <path d="M7.5 8.5L9 10l3-3" />
    </svg>
  );
}
function IconTasks({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5h8M6 8.5h8M6 12h5" />
      <path d="M13 12l1.5 1.5L17 11" />
    </svg>
  );
}
function IconFinance({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17V7l4-4 3 3 4-3 3 3v11z" />
      <path d="M3 17h14" />
    </svg>
  );
}
function IconHealth({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10c0-3.5 3.5-6 7-2.5C13.5 4 17 6.5 17 10c0 4-7 7-7 7s-7-3-7-7z" />
    </svg>
  );
}
function IconNetWorth({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v14M7 6l3-3 3 3M5 10h10" />
      <path d="M6 14h8" />
    </svg>
  );
}
function IconAlerts({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3a5 5 0 0 1 5 5c0 3 1 5 1 5H4s1-2 1-5a5 5 0 0 1 5-5z" />
      <path d="M8.5 15a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}
function IconChevron({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg className={`${className} transition-transform duration-200 ${open ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 5l5 5-5 5" />
    </svg>
  );
}

const TAB_ICONS: Record<MainTab, (props: { className?: string }) => React.ReactElement> = {
  briefing: IconBriefing,
  sports: IconTeams,
  tasks: IconTasks,
  finance: IconFinance,
  health: IconHealth,
  networth: IconNetWorth,
  notifications: IconAlerts,
};

export default function Home() {
  const [tab, setTab] = useState<MainTab>('briefing');
  const [financeTab, setFinanceTab] = useState<FinanceSubTab>('income');
  const [incomeView, setIncomeView] = useState<'tracker' | 'charts'>('tracker');
  const [financeOpen, setFinanceOpen] = useState(false);
  const role = getRole();
  const isTeam = role === 'team';

  function navigate(target: string) {
    if (['income', 'finmodel', 'headcount', 'equity'].includes(target)) {
      setTab('finance');
      setFinanceTab(target as FinanceSubTab);
      setFinanceOpen(true);
    } else {
      setTab(target as MainTab);
    }
  }

  function selectTab(key: MainTab) {
    if (key === 'finance') {
      setFinanceOpen(o => !o);
      setTab('finance');
    } else {
      setTab(key);
      setFinanceOpen(false);
    }
  }

  const ALL_MAIN_TABS: { key: MainTab; label: string; ownerOnly?: boolean }[] = [
    { key: 'briefing', label: 'Briefing', ownerOnly: true },
    { key: 'sports', label: 'My Teams', ownerOnly: true },
    { key: 'tasks', label: 'Tasks', ownerOnly: true },
    { key: 'finance', label: 'SEI Miami' },
    { key: 'health', label: 'Health', ownerOnly: true },
    { key: 'networth', label: 'Net Worth', ownerOnly: true },
    { key: 'notifications', label: 'Alerts', ownerOnly: true },
  ];
  const MAIN_TABS = ALL_MAIN_TABS.filter(t => !t.ownerOnly || !isTeam);

  useEffect(() => {
    if (isTeam && tab !== 'finance') setTab('finance');
  }, [isTeam]);

  // Keep finance sub-menu open when finance tab is active
  useEffect(() => {
    if (tab === 'finance') setFinanceOpen(true);
  }, [tab]);

  const FINANCE_SUBS: { key: FinanceSubTab; label: string }[] = [
    { key: 'income', label: 'Net Income' },
    { key: 'finmodel', label: 'P&L Model' },
    { key: 'headcount', label: 'Headcount' },
    { key: 'equity', label: 'Equity' },
  ];

  return (
    <main suppressHydrationWarning className="min-h-screen bg-black text-white">

      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-56 flex-col bg-zinc-950 border-r border-zinc-800/60 z-40">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-zinc-800/60">
          <p className="text-[10px] text-amber-400 uppercase tracking-[0.3em] font-mono mb-0.5">David Ortiz</p>
          <h1 className="text-lg font-bold text-white tracking-tight">Project Rocky</h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          {MAIN_TABS.map(t => {
            const Icon = TAB_ICONS[t.key];
            const active = tab === t.key;
            const isFinance = t.key === 'finance';
            return (
              <div key={t.key}>
                <button
                  onClick={() => selectTab(t.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group ${
                    active
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors duration-150 ${active ? 'text-amber-400' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                  <span className="flex-1 text-left">{t.label}</span>
                  {isFinance && <IconChevron className="w-3.5 h-3.5 text-zinc-600" open={financeOpen} />}
                </button>

                {/* Finance sub-items */}
                {isFinance && financeOpen && (
                  <div className="ml-[30px] mt-0.5 mb-1 border-l border-zinc-800 pl-3 space-y-0.5">
                    {FINANCE_SUBS.map(s => (
                      <button
                        key={s.key}
                        onClick={() => { setTab('finance'); setFinanceTab(s.key); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 ${
                          tab === 'finance' && financeTab === s.key
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/40'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800/60">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-700 font-mono">Parkland, FL</p>
            <button
              onClick={() => { document.cookie = 'session=; path=/; max-age=0'; document.cookie = 'role=; path=/; max-age=0'; window.location.href = '/login'; }}
              className="text-[10px] text-zinc-700 font-mono hover:text-red-400 transition"
            >
              logout
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="md:hidden px-5 pt-5 pb-3 border-b border-zinc-800/60">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] text-amber-400 uppercase tracking-[0.3em] font-mono mb-0.5">David Ortiz</p>
            <h1 className="text-lg font-bold text-white tracking-tight">Project Rocky</h1>
          </div>
          <button
            onClick={() => { document.cookie = 'session=; path=/; max-age=0'; document.cookie = 'role=; path=/; max-age=0'; window.location.href = '/login'; }}
            className="text-xs text-zinc-700 font-mono hover:text-red-400 transition"
          >
            logout
          </button>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="md:ml-56 min-h-screen">
        <div className="max-w-6xl mx-auto p-5 md:p-8 pb-24 md:pb-8">

          {/* Quick Links */}
          <QuickLinks />

          {/* Finance sub-tabs (mobile only, since desktop has them in sidebar) */}
          {tab === 'finance' && (
            <div className="flex gap-2 mb-5 md:hidden overflow-x-auto">
              {FINANCE_SUBS.map(s => (
                <button key={s.key} onClick={() => setFinanceTab(s.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest transition whitespace-nowrap ${
                    financeTab === s.key
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-600 hover:text-white'
                  }`}>
                  {s.label.toUpperCase()}
                </button>
              ))}
            </div>
          )}

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
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800/60 z-40">
        <div className="flex items-center justify-around px-2 py-1.5">
          {MAIN_TABS.map(t => {
            const Icon = TAB_ICONS[t.key];
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-150 min-w-[48px] ${
                  active ? 'text-amber-400' : 'text-zinc-600 active:text-zinc-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-mono font-medium tracking-wider">{t.label.length > 7 ? t.label.slice(0, 6) + '.' : t.label}</span>
              </button>
            );
          })}
        </div>
        {/* Safe area spacer for iPhones */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </main>
  );
}
