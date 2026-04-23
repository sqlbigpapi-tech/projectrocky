'use client';
import { useState, useEffect, Suspense, useCallback, createContext, useContext } from 'react';
import BriefingTab from './components/BriefingTab';
import SportsTab from './components/SportsTab';
import TasksTab from './components/TasksTab';
import IncomeTab from './components/IncomeTab';
import IncomeChartsTab from './components/IncomeChartsTab';
import ReadingTab from './components/ReadingTab';
import TripsTab from './components/TripsTab';
import NetWorthTab from './components/NetWorthTab';
import QuickLinks from './components/QuickLinks';
import NotificationsTab from './components/NotificationsTab';
import FinancialModelTab from './components/FinancialModelTab';
import HeadcountTab from './components/HeadcountTab';
import EquityTab from './components/EquityTab';
import DEIBTab from './components/DEIBTab';
import CashFlowTab from './components/CashFlowTab';
import Spotlight from './components/Spotlight';
import AskRocky from './components/AskRocky';
import GuideTab from './components/GuideTab';
import {
  BriefingSkeleton, NetWorthSkeleton, SportsSkeleton,
  TasksSkeleton, IncomeSkeleton,
} from './components/Skeletons';

type MainTab = 'briefing' | 'sports' | 'tasks' | 'finance' | 'personal' | 'reading' | 'trips' | 'notifications' | 'guide';
type FinanceSubTab = 'income' | 'finmodel' | 'headcount' | 'equity' | 'deib';
type PersonalSubTab = 'networth' | 'cashflow';

/* ── Toast System ── */
type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };
type ToastCtx = { toast: (message: string, type?: Toast['type']) => void };
const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export function useToast() { return useContext(ToastContext); }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          onAnimationEnd={(e) => { if (e.animationName === 'toastOut') onDismiss(t.id); }}
          className={`pointer-events-auto toast-slide-in px-4 py-2.5 rounded-xl text-sm font-mono shadow-xl border backdrop-blur-sm cursor-pointer ${
            t.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            t.type === 'error'   ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                   'bg-zinc-900/90 border-zinc-700 text-zinc-300'
          }`}
          onClick={() => onDismiss(t.id)}
        >
          {t.type === 'success' && '✓ '}{t.type === 'error' && '✗ '}{t.message}
        </div>
      ))}
    </div>
  );
}

/* ── Live Clock + Next Meeting ── */
type NextMeeting = { summary: string; start: string } | null;

function LiveClock() {
  const [now, setNow] = useState(new Date());
  const [nextMeeting, setNextMeeting] = useState<NextMeeting>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);

    // Fetch calendar every 5 minutes
    function fetchCal() {
      fetch('/api/calendar')
        .then(r => r.json())
        .then(d => {
          if (!d.events) return;
          const upcoming = d.events.find((e: { isAllDay: boolean; start: string }) =>
            !e.isAllDay && new Date(e.start) > new Date()
          );
          setNextMeeting(upcoming ?? null);
        })
        .catch(() => {});
    }
    fetchCal();
    const calInterval = setInterval(fetchCal, 300000);

    return () => { clearInterval(tick); clearInterval(calInterval); };
  }, []);

  // Calculate countdown
  let countdown: string | null = null;
  if (nextMeeting) {
    const diff = new Date(nextMeeting.start).getTime() - now.getTime();
    if (diff > 0 && diff < 86400000) {
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (hrs > 0) countdown = `in ${hrs}h ${mins}m`;
      else if (mins > 0) countdown = `in ${mins}m`;
      else countdown = 'now';
    }
  }

  return (
    <div className="text-center">
      <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
        {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </p>
      {nextMeeting && countdown && (
        <div className="mt-1">
          <p className="text-[9px] text-zinc-600 font-mono truncate px-1" title={nextMeeting.summary}>
            {nextMeeting.summary.length > 18 ? nextMeeting.summary.slice(0, 17) + '…' : nextMeeting.summary}
          </p>
          <p className={`text-[10px] font-mono font-bold tabular-nums ${
            countdown === 'now' ? 'text-amber-400 animate-pulse' :
            countdown.includes('m') && !countdown.includes('h') ? 'text-amber-400' :
            'text-zinc-500'
          }`}>{countdown}</p>
        </div>
      )}
    </div>
  );
}

function getRole(): string {
  if (typeof document === 'undefined') return 'owner';
  const match = document.cookie.match(/(?:^|; )role=([^;]*)/);
  return match?.[1] ?? 'owner';
}

function getUserName(): string {
  if (typeof document === 'undefined') return 'David';
  const match = document.cookie.match(/(?:^|; )user_name=([^;]*)/);
  return match?.[1] ?? 'David';
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
function IconAlerts({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3a5 5 0 0 1 5 5c0 3 1 5 1 5H4s1-2 1-5a5 5 0 0 1 5-5z" />
      <path d="M8.5 15a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}
function IconPersonal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v14M7 6l3-3 3 3M5 10h10" />
      <path d="M6 14h8" />
    </svg>
  );
}
function IconReading({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H3z" />
      <path d="M17 4h-5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h5z" />
    </svg>
  );
}
function IconTrips({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v4M10 14v4M2 10h4M14 10h4" />
      <circle cx="10" cy="10" r="4" />
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
  personal: IconPersonal,
  reading: IconReading,
  trips: IconTrips,
  notifications: IconAlerts,
  guide: IconAlerts, // placeholder — guide isn't in nav
};

export default function Home() {
  const [tab, setTab] = useState<MainTab>('briefing');
  const [financeTab, setFinanceTab] = useState<FinanceSubTab>('income');
  const [personalTab, setPersonalTab] = useState<PersonalSubTab>('networth');
  const [incomeView, setIncomeView] = useState<'tracker' | 'charts'>('tracker');
  const [financeOpen, setFinanceOpen] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const role = getRole();
  const userName = getUserName();
  const isTeam = role === 'team';
  const isManager = role === 'manager';

  let toastId = 0;
  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + (toastId++);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [rockyOpen, setRockyOpen] = useState(false);

  // Cmd+K / Ctrl+K to open spotlight
  useEffect(() => {
    function handleCmdK(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSpotlightOpen(o => !o);
      }
    }
    window.addEventListener('keydown', handleCmdK);
    return () => window.removeEventListener('keydown', handleCmdK);
  }, []);

  function navigate(target: string) {
    if (['income', 'finmodel', 'headcount', 'equity'].includes(target)) {
      setTab('finance');
      setFinanceTab(target as FinanceSubTab);
      setFinanceOpen(true);
    } else if (['networth', 'cashflow'].includes(target)) {
      setTab('personal');
      setPersonalTab(target as PersonalSubTab);
      setPersonalOpen(true);
    } else {
      setTab(target as MainTab);
    }
  }

  function selectTab(key: MainTab) {
    if (key === 'finance') {
      setFinanceOpen(o => !o);
      setTab('finance');
    } else if (key === 'personal') {
      setPersonalOpen(o => !o);
      setTab('personal');
    } else {
      setTab(key);
      setFinanceOpen(false);
      setPersonalOpen(false);
    }
  }

  const ALL_MAIN_TABS: { key: MainTab; label: string; access: ('owner' | 'manager' | 'team')[]; section: 'primary' | 'admin' }[] = [
    { key: 'briefing', label: 'Briefing', access: ['owner'], section: 'primary' },
    { key: 'sports', label: 'Sports', access: ['owner'], section: 'primary' },
    { key: 'tasks', label: 'Tasks', access: ['owner'], section: 'primary' },
    { key: 'finance', label: 'Business', access: ['owner', 'manager', 'team'], section: 'primary' },
    { key: 'personal', label: 'Finance', access: ['owner'], section: 'primary' },
    { key: 'reading', label: 'Reading', access: ['owner'], section: 'primary' },
    { key: 'trips', label: 'Trips', access: ['owner'], section: 'primary' },
    { key: 'notifications', label: 'Alerts', access: ['owner'], section: 'admin' },
    { key: 'guide', label: 'Guide', access: ['owner', 'manager', 'team'], section: 'admin' },
  ];
  const MAIN_TABS = ALL_MAIN_TABS.filter(t => t.access.includes(role as any));
  const PRIMARY_TABS = MAIN_TABS.filter(t => t.section === 'primary');
  const ADMIN_TABS = MAIN_TABS.filter(t => t.section === 'admin');

  useEffect(() => {
    if (isTeam && tab !== 'finance') setTab('finance');
    if (isManager && !['finance', 'guide'].includes(tab)) setTab('finance');
  }, [isTeam, isManager]);

  // Keep sub-menus open when their tab is active
  useEffect(() => {
    if (tab === 'finance') setFinanceOpen(true);
    if (tab === 'personal') setPersonalOpen(true);
  }, [tab]);

  // Keyboard navigation: 1-N for main tabs, shift+1-N for sub-tabs
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const idx = parseInt(e.key) - 1;
      if (!e.shiftKey && idx >= 0 && idx < MAIN_TABS.length) {
        e.preventDefault();
        selectTab(MAIN_TABS[idx].key);
      }
      if (e.shiftKey && tab === 'finance' && idx >= 0 && idx < FINANCE_SUBS.length) {
        e.preventDefault();
        setFinanceTab(FINANCE_SUBS[idx].key);
      }
      if (e.shiftKey && tab === 'personal' && idx >= 0 && idx < PERSONAL_SUBS.length) {
        e.preventDefault();
        setPersonalTab(PERSONAL_SUBS[idx].key);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [tab, MAIN_TABS.length]);

  const FINANCE_SUBS: { key: FinanceSubTab; label: string }[] = [
    { key: 'income', label: 'Net Income' },
    { key: 'finmodel', label: 'P&L Model' },
    { key: 'headcount', label: 'Headcount' },
    { key: 'equity', label: 'Equity' },
    { key: 'deib', label: 'DEIB' },
  ];

  const PERSONAL_SUBS: { key: PersonalSubTab; label: string }[] = [
    { key: 'networth', label: 'Net Worth' },
    { key: 'cashflow', label: 'Cash Flow' },
  ];

  // Spotlight search items
  const spotlightItems = [
    // Main tabs
    ...MAIN_TABS.map(t => ({
      id: `tab-${t.key}`,
      label: t.label,
      section: 'Tabs',
      action: () => selectTab(t.key),
    })),
    // Finance sub-tabs
    ...FINANCE_SUBS.map(s => ({
      id: `fin-${s.key}`,
      label: s.label,
      sublabel: 'Business',
      section: 'Business',
      action: () => { setTab('finance'); setFinanceTab(s.key); setFinanceOpen(true); },
    })),
    // Personal sub-tabs
    ...PERSONAL_SUBS.map(s => ({
      id: `personal-${s.key}`,
      label: s.label,
      sublabel: 'Finance',
      section: 'Finance',
      action: () => { setTab('personal'); setPersonalTab(s.key); setPersonalOpen(true); },
    })),
    // Quick actions
    { id: 'action-rocky', label: 'Ask Rocky', section: 'Actions', action: () => setRockyOpen(true) },
    { id: 'action-snapshot', label: 'Save Net Worth Snapshot', section: 'Actions', action: () => { setTab('personal'); setPersonalTab('networth'); setPersonalOpen(true); } },
    { id: 'action-upload', label: 'Upload Transactions CSV', section: 'Actions', action: () => { setTab('personal'); setPersonalTab('cashflow'); setPersonalOpen(true); } },
    // Accounts (navigates to net worth)
    ...['SEI-Miami LLC Shares', 'IRA', '401(k)', 'Certificate of Deposit', 'Money Market'].map(name => ({
      id: `acct-${name}`,
      label: name,
      sublabel: 'Account',
      section: 'Accounts',
      action: () => { setTab('personal'); setPersonalTab('networth'); setPersonalOpen(true); },
    })),
    // Credit cards (navigates to cash flow)
    ...['Southwest Rapid Rewards', 'Platinum Card', 'Prime Visa', 'Ultimate Rewards', 'Blue Cash Preferred'].map(name => ({
      id: `cc-${name}`,
      label: name,
      sublabel: 'Credit Card',
      section: 'Accounts',
      action: () => { setTab('personal'); setPersonalTab('cashflow'); setPersonalOpen(true); },
    })),
  ];

  return (
    <ToastContext.Provider value={{ toast }}>
    <main suppressHydrationWarning className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">

      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-56 flex-col bg-[var(--card)] border-r border-[var(--border)]/40 z-40">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-[var(--border)]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-black font-bold text-sm font-mono">R</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">Project Rocky</h1>
          </div>
        </div>

        {/* Search */}
        <div className="px-2.5 pt-3 pb-1">
          <button
            onClick={() => setSpotlightOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] text-zinc-600 bg-[var(--card)]/50 border border-[var(--border)]/60 hover:border-zinc-700 hover:text-zinc-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M12.5 12.5L17 17" />
            </svg>
            <span className="flex-1 text-left font-mono">Search...</span>
            <kbd className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded font-mono border border-zinc-700">&#8984;K</kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2.5">
          {PRIMARY_TABS.map((t, i) => {
            const Icon = TAB_ICONS[t.key];
            const active = tab === t.key;
            const isFinance = t.key === 'finance';
            return (
              <div key={t.key}>
                <button
                  onClick={() => selectTab(t.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                    active
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-[var(--card)]/60'
                  }`}
                >
                  <Icon className={`w-[16px] h-[16px] shrink-0 transition-colors duration-150 ${active ? 'text-amber-400' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                  <span className="flex-1 text-left">{t.label}</span>
                  <span className={`text-[10px] font-mono tabular-nums px-1.5 rounded transition-opacity duration-150 ${active ? 'bg-amber-500/20 text-amber-400/70' : 'bg-[var(--card)] text-zinc-700 opacity-0 group-hover:opacity-100'}`}>{i + 1}</span>
                  {(isFinance || t.key === 'personal') && <IconChevron className="w-3 h-3 text-zinc-600" open={isFinance ? financeOpen : personalOpen} />}
                </button>

                {/* Finance sub-items */}
                {isFinance && financeOpen && (
                  <div className="ml-[26px] mt-0.5 mb-1 border-l border-[var(--border)] pl-2.5 space-y-0.5">
                    {FINANCE_SUBS.map((s, si) => (
                      <button
                        key={s.key}
                        onClick={() => { setTab('finance'); setFinanceTab(s.key); }}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-xs font-mono transition-all duration-150 group/sub ${
                          tab === 'finance' && financeTab === s.key
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-zinc-600 hover:text-zinc-300 hover:bg-[var(--card)]/40'
                        }`}
                      >
                        {s.label}
                        <span className={`text-[9px] font-mono tabular-nums transition-opacity duration-150 ${
                          tab === 'finance' && financeTab === s.key ? 'text-emerald-400/50' : 'text-zinc-700 opacity-0 group-hover/sub:opacity-100'
                        }`}>&#8679;{si + 1}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Personal sub-items */}
                {t.key === 'personal' && personalOpen && (
                  <div className="ml-[26px] mt-0.5 mb-1 border-l border-[var(--border)] pl-2.5 space-y-0.5">
                    {PERSONAL_SUBS.map((s, si) => (
                      <button
                        key={s.key}
                        onClick={() => { setTab('personal'); setPersonalTab(s.key); }}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-xs font-mono transition-all duration-150 group/sub ${
                          tab === 'personal' && personalTab === s.key
                            ? 'text-violet-400 bg-violet-500/10'
                            : 'text-zinc-600 hover:text-zinc-300 hover:bg-[var(--card)]/40'
                        }`}
                      >
                        {s.label}
                        <span className={`text-[9px] font-mono tabular-nums transition-opacity duration-150 ${
                          tab === 'personal' && personalTab === s.key ? 'text-violet-400/50' : 'text-zinc-700 opacity-0 group-hover/sub:opacity-100'
                        }`}>&#8679;{si + 1}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Ask Rocky — owner only */}
        {role === 'owner' && (
          <div className="px-2.5 pb-1.5">
            <button
              onClick={() => setRockyOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 text-amber-400 hover:from-amber-500/20 hover:to-amber-600/10 transition-all duration-150"
            >
              <div className="w-4 h-4 rounded bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0">
                <span className="text-black font-bold text-[9px] font-mono">R</span>
              </div>
              Ask Rocky
            </button>
          </div>
        )}

        {/* Admin group — Alerts + Guide */}
        {ADMIN_TABS.length > 0 && (
          <div className="px-2.5 pb-2 border-t border-[var(--border)]/40 pt-2">
            {ADMIN_TABS.map(t => {
              const active = tab === t.key;
              const Icon = TAB_ICONS[t.key];
              return (
                <button
                  key={t.key}
                  onClick={() => selectTab(t.key)}
                  className={`w-full flex items-center gap-2 px-3 py-1 rounded-md text-[11px] font-mono transition-colors duration-150 ${
                    active ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <Icon className={`w-3 h-3 shrink-0 ${active ? 'text-amber-400' : 'text-zinc-700'}`} />
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer — time + logout */}
        <div className="px-4 py-2.5 border-t border-[var(--border)]/60">
          <LiveClock />
          <div className="flex justify-center mt-1.5">
            <button
              onClick={() => { document.cookie = 'session=; path=/; max-age=0'; document.cookie = 'role=; path=/; max-age=0'; window.location.href = '/login'; }}
              className="text-[9px] text-zinc-700 font-mono hover:text-red-400 transition"
            >
              logout
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <div className="md:hidden px-5 pt-5 pb-3 border-b border-[var(--border)]/60">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-black font-bold text-xs font-mono">R</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">Project Rocky</h1>
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

          {/* Finance sub-tabs (mobile only) */}
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

          {/* Personal sub-tabs (mobile only) */}
          {tab === 'personal' && (
            <div className="flex gap-2 mb-5 md:hidden overflow-x-auto">
              {PERSONAL_SUBS.map(s => (
                <button key={s.key} onClick={() => setPersonalTab(s.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-widest transition whitespace-nowrap ${
                    personalTab === s.key
                      ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                      : 'text-zinc-600 hover:text-white'
                  }`}>
                  {s.label.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Tab content with fade-in transition */}
          <div key={tab === 'finance' ? `finance-${financeTab}` : tab === 'personal' ? `personal-${personalTab}` : tab} className="tab-enter">
            {tab === 'briefing' && <Suspense fallback={<BriefingSkeleton />}><BriefingTab onNavigate={navigate} /></Suspense>}
            {tab === 'sports' && <Suspense fallback={<SportsSkeleton />}><SportsTab /></Suspense>}
            {tab === 'tasks' && <Suspense fallback={<TasksSkeleton />}><TasksTab /></Suspense>}
            {tab === 'finance' && financeTab === 'income' && (
              <Suspense fallback={<IncomeSkeleton />}>
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
              </Suspense>
            )}
            {tab === 'finance' && financeTab === 'finmodel' && <Suspense fallback={<IncomeSkeleton />}><FinancialModelTab /></Suspense>}
            {tab === 'finance' && financeTab === 'headcount' && <Suspense fallback={<IncomeSkeleton />}><HeadcountTab /></Suspense>}
            {tab === 'finance' && financeTab === 'equity' && <Suspense fallback={<IncomeSkeleton />}><EquityTab /></Suspense>}
            {tab === 'finance' && financeTab === 'deib' && <DEIBTab />}
            {tab === 'personal' && personalTab === 'networth' && <Suspense fallback={<NetWorthSkeleton />}><NetWorthTab /></Suspense>}
            {tab === 'personal' && personalTab === 'cashflow' && <CashFlowTab />}
            {tab === 'reading' && <ReadingTab />}
            {tab === 'trips' && <TripsTab />}

            {tab === 'notifications' && <NotificationsTab />}
            {tab === 'guide' && <GuideTab />}
          </div>
        </div>
      </div>

      {/* ── Mobile Ask Rocky FAB — owner only ── */}
      {role === 'owner' && <button
        onClick={() => setRockyOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-95 transition-transform"
      >
        <span className="text-black font-bold text-lg font-mono">R</span>
      </button>}

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--card)]/95 backdrop-blur-lg border-t border-[var(--border)]/60 z-40">
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

      <Spotlight open={spotlightOpen} onClose={() => setSpotlightOpen(false)} items={spotlightItems} />
      <AskRocky open={rockyOpen} onClose={() => setRockyOpen(false)} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
    </ToastContext.Provider>
  );
}
