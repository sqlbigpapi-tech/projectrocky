'use client';
import { useState } from 'react';

type Step = {
  title: string;
  description: string;
  steps: string[];
};

type Section = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  guides: Step[];
};

const SECTIONS: Section[] = [
  {
    id: 'headcount',
    icon: '👥',
    title: 'Headcount & Engagements',
    subtitle: 'Staff consultants, set rates, manage SOW dates',
    color: 'text-emerald-400',
    guides: [
      {
        title: 'Add a New Engagement',
        description: 'When a consultant starts billing a client.',
        steps: [
          'Go to Business → Headcount',
          'Click "+ Add Engagement" at the top',
          'Select the consultant from the dropdown (or click "+ New" to add a new consultant)',
          'Select the client (or click "+ New" to add a new client)',
          'Enter the bill rate ($/hr), deal name, SOW start date, and SOW end date',
          'Click "Add" — the engagement appears in the roster',
          'The P&L model and billing forecast update automatically',
        ],
      },
      {
        title: 'Update a Bill Rate',
        description: 'When a rate changes mid-engagement.',
        steps: [
          'Go to Business → Headcount → Roster view',
          'Find the consultant in the table',
          'Click the rate number — it becomes editable',
          'Type the new rate and press Enter',
          'The P&L recalculates automatically',
        ],
      },
      {
        title: 'Extend or End a SOW',
        description: 'When an engagement is extended or wrapping up.',
        steps: [
          'Go to Business → Headcount → Roster view',
          'Find the engagement in the table',
          'Click the SOW End date — a date picker opens',
          'Select the new end date',
          'To mark as ended, change the Status dropdown to "CLOSED"',
        ],
      },
      {
        title: 'Change a Client',
        description: 'When a consultant moves to a different client.',
        steps: [
          'Go to Business → Headcount → Roster view',
          'Click the client name in the row — a dropdown appears',
          'Select the new client',
          'Saves automatically',
        ],
      },
      {
        title: 'Add Holidays & PTO',
        description: 'Public holidays affect all consultants. PTO is per-person.',
        steps: [
          'Go to Business → Headcount → PTO view',
          'For a public holiday: pick a date and click "+ Add Holiday" — reduces working days for everyone',
          'For consultant PTO: select the consultant, pick a date, click "+ Add PTO"',
          'Remove any date by clicking the ✕ next to it',
          'The billing forecast recalculates — fewer working days = lower billing',
        ],
      },
      {
        title: 'Manage the Clients Master List',
        description: 'Central source of truth for client names, industry, and URL.',
        steps: [
          'Go to Business → Headcount → CLIENTS view',
          'Click "+ New Client" to add a client (Name / Industry / URL). Duplicate names are blocked case-insensitively',
          'Click any field on an existing row to inline-edit — renames propagate to every engagement automatically',
          'Clients with 0 engagements show a "Delete" button to prune stale records',
          'Engagements always pull the client name from this master, so the list stays consistent everywhere',
        ],
      },
    ],
  },
  {
    id: 'pnl',
    icon: '📊',
    title: 'P&L Model',
    subtitle: 'How revenue and costs are calculated',
    color: 'text-amber-400',
    guides: [
      {
        title: 'How the P&L Works',
        description: 'End-to-end flow from engagements to net income.',
        steps: [
          'Revenue = sum of all engagement billing (working days × 8hrs × rate)',
          'Consultant cost depends on level: Principals 65%, Seniors 60%, Consultants $155K salary, Associates flat rate',
          'Benefits & taxes are 17% of all wages',
          'Overhead: management salaries ($65K/mo), admin ($55K/mo), shared services ($56K/mo), bench cost ($55K/mo)',
          'Profit sharing is 1.5% of revenue',
          'Net Income = Revenue − Consultant Labor − SGA',
          'Months with actuals are locked. Forecast months auto-calculate from engagements.',
        ],
      },
      {
        title: 'Override a Forecast Number',
        description: 'When you want to manually set a value.',
        steps: [
          'Go to Business → P&L Model',
          'Click any number in a forecast month (April onward)',
          'Type your value and press Enter',
          'Your number sticks — the system won\'t overwrite it on reload',
          'Net income recalculates based on your override',
        ],
      },
      {
        title: 'Lock Actuals',
        description: 'When monthly numbers are finalized.',
        steps: [
          'Go to Business → P&L Model',
          'Find the month row',
          'Click the "FCST" button to toggle it to "ACTUAL"',
          'Enter the actual revenue, SGA, and consultant labor',
          'The month is now locked and won\'t be overwritten by forecasts',
        ],
      },
    ],
  },
  {
    id: 'networth',
    icon: '💰',
    title: 'Net Worth',
    subtitle: 'Track personal assets and liabilities',
    color: 'text-violet-400',
    guides: [
      {
        title: 'Update Net Worth',
        description: 'When you have new account balances from your banking app.',
        steps: [
          'Screenshot your balances from Copilot or your banking app',
          'Share the screenshot with Claude Code',
          'Claude will post the snapshot to the API — no manual entry needed',
          'Or: Go to Finance → Net Worth, click "Update Balances", enter numbers manually, click "Save Snapshot"',
        ],
      },
      {
        title: 'Set a Net Worth Goal',
        description: 'Track progress toward a target.',
        steps: [
          'Go to Finance → Net Worth',
          'Find the Net Worth Trajectory chart',
          'Edit the Goal field in the top right of the chart',
          'A purple dashed line appears on the chart at your target',
        ],
      },
      {
        title: 'Read the Briefing Sparkline',
        description: 'The Net Worth card on Briefing shows a quick trend.',
        steps: [
          'Open the Briefing tab',
          'Find the Finance column (far right)',
          'The sparkline next to the Net Worth total reflects the last 12 snapshots',
          'Green = trending up since the first snapshot in view; red = trending down',
          'The "since last snapshot" delta below shows the change from the most recent prior snapshot',
        ],
      },
    ],
  },
  {
    id: 'cashflow',
    icon: '💸',
    title: 'Cash Flow',
    subtitle: 'Import transactions from Copilot',
    color: 'text-emerald-400',
    guides: [
      {
        title: 'Upload Transactions',
        description: 'Import your Copilot CSV export.',
        steps: [
          'Open Copilot banking app',
          'Export transactions as CSV',
          'Go to Finance → Cash Flow',
          'Click "Upload CSV" and select the file',
          'Transactions are parsed, deduped, and stored',
          'The dashboard shows income vs expenses, category breakdown, and top merchants',
        ],
      },
      {
        title: 'How Cash Flow Is Calculated',
        description: 'What counts, what gets filtered, and why.',
        steps: [
          'Income = any transaction with type = "income" (Copilot stores these as negative amounts; we take the absolute value)',
          'Expenses = type = "regular" with positive amount; negative amounts (refunds) reduce the total',
          'Internal transfers and credit card payments are excluded — they would double-count real spending',
          'Pending transactions are filtered out — a deposit shows as both "pending" and "posted" during clearing, and we only trust the posted copy',
          'Reversed/clawback income (positive amount on type=income) surfaces a warning in the API response so you can investigate',
        ],
      },
    ],
  },
  {
    id: 'tasks',
    icon: '✅',
    title: 'Tasks & Bills',
    subtitle: 'Track to-dos and recurring payments in one place',
    color: 'text-cyan-400',
    guides: [
      {
        title: 'Add a Task',
        description: 'Quick capture with category, priority, due date, and recurrence.',
        steps: [
          'Go to the Tasks tab',
          'Click "+ Add task"',
          'Set priority (High / Medium / Low), category (Business / Personal), and due date',
          'Optional: mark it "↻ Daily" or "↻ Monthly" to auto-reschedule on completion',
          'Hit "Add Task"',
        ],
      },
      {
        title: 'Mark a Task as a Bill',
        description: 'Distinguishes bills from regular tasks with a $ badge and enables the Briefing widget.',
        steps: [
          'In the add or edit form, toggle "$ Bill" under Type',
          'Enter the amount (optional but recommended — enables $ totals)',
          'Bills show a green "$" badge in the task list and calendar',
          'The Briefing Finance column shows total bills due this month plus the next 3 upcoming',
        ],
      },
      {
        title: 'Edit an Existing Task',
        description: 'Hover a row and click the pencil icon.',
        steps: [
          'Hover over any task to reveal the edit/delete icons',
          'Click the pencil to open the full edit form',
          'Toggle bill on/off, update amount, reschedule, or change priority',
          'Save — the briefing widget and task list update immediately',
        ],
      },
    ],
  },
  {
    id: 'rocky',
    icon: '🥊',
    title: 'Ask Rocky',
    subtitle: 'Your AI financial advisor',
    color: 'text-amber-400',
    guides: [
      {
        title: 'Ask Rocky in the Dashboard',
        description: 'Click the gold button in the sidebar.',
        steps: [
          'Click "Ask Rocky" in the sidebar (or the floating R button on mobile)',
          'Type any financial question or click a quick prompt',
          'Rocky streams his response using your real data',
          'Toggle "Voice" to hear Rocky read his answer',
        ],
      },
      {
        title: 'Ask Rocky via Telegram',
        description: 'Text @ProjectRockyBot on Telegram.',
        steps: [
          'Open Telegram and find @ProjectRockyBot',
          'Just type naturally — no commands needed',
          '"Add a task to review Q2 numbers by Friday"',
          '"What engagements are ending soon?"',
          '"What\'s my net worth?"',
          '"How are our DEIB scores?"',
          '"What meetings do I have today?"',
          'Rocky understands context and performs actions automatically',
        ],
      },
    ],
  },
  {
    id: 'alerts',
    icon: '🔔',
    title: 'Alerts & Crons',
    subtitle: 'Automated notifications via Telegram',
    color: 'text-cyan-400',
    guides: [
      {
        title: 'What Runs Automatically',
        description: 'These fire on schedule — no action needed.',
        steps: [
          'Daily 8AM ET: Morning briefing with meetings + tasks (Telegram + email)',
          'Daily: Evening tasks check, liability zero alerts',
          'Weekly (Monday): Week-ahead briefing, engagement expiry alerts, revenue cliff warnings',
          'Weekly (Sunday): Net worth reminder, car value refresh',
          'Monthly (1st): Full month recap with AI commentary',
        ],
      },
      {
        title: 'Toggle Alerts On/Off',
        description: 'Control which alerts you receive.',
        steps: [
          'Go to the Alerts tab in the sidebar',
          'Toggle individual alerts on or off',
          'Changes take effect on the next scheduled run',
        ],
      },
    ],
  },
  {
    id: 'deib',
    icon: '🤝',
    title: 'DEIB Reporting',
    subtitle: 'Diversity, equity, inclusion, and belonging',
    color: 'text-pink-400',
    guides: [
      {
        title: 'Understanding the Views',
        description: 'Four ways to look at the data.',
        steps: [
          'By Office: horizontal bar charts showing each DEI question scored by office, ranked high to low',
          'Demographic Gaps: gender side-by-side comparison + race/ethnicity YoY movement on D&I',
          'Factor Trends: all 16 engagement factors ranked with YoY direction arrows',
          'Employee Voice: sentiment breakdown, top topics, and 304 filterable free-text comments',
        ],
      },
      {
        title: 'Load New Survey Data',
        description: 'When you have a new Culture Amp export.',
        steps: [
          'Export heatmap files from Culture Amp (one per demographic cut)',
          'Place them in your Downloads folder',
          'Run the load script: npx tsx scripts/load-deib.ts',
          'The dashboard refreshes with the new data',
        ],
      },
    ],
  },
];

export default function GuideTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <p className="text-sm text-white font-bold">How Project Rocky Works</p>
        <p className="text-[10px] text-zinc-600 font-mono mt-0.5">Step-by-step guides for every feature</p>
      </div>

      {SECTIONS.map(section => (
        <div key={section.id} className="bg-[var(--card)] rounded-xl border border-zinc-800 overflow-hidden">
          {/* Section header */}
          <button
            onClick={() => setExpanded(expanded === section.id ? null : section.id)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-900/30 transition-colors"
          >
            <span className="text-xl">{section.icon}</span>
            <div className="flex-1">
              <p className={`text-sm font-bold ${section.color}`}>{section.title}</p>
              <p className="text-[10px] text-zinc-600 font-mono">{section.subtitle}</p>
            </div>
            <span className={`text-zinc-600 transition-transform ${expanded === section.id ? 'rotate-90' : ''}`}>▸</span>
          </button>

          {/* Guides */}
          {expanded === section.id && (
            <div className="border-t border-zinc-800 px-5 py-3 space-y-2">
              {section.guides.map((guide, gi) => {
                const key = `${section.id}-${gi}`;
                const isOpen = expandedStep === key;
                return (
                  <div key={gi}>
                    <button
                      onClick={() => setExpandedStep(isOpen ? null : key)}
                      className="w-full flex items-center gap-2 py-2 text-left"
                    >
                      <span className={`text-[10px] font-mono ${isOpen ? 'text-amber-400' : 'text-zinc-600'}`}>{isOpen ? '▾' : '▸'}</span>
                      <div className="flex-1">
                        <p className="text-xs text-zinc-300 font-medium">{guide.title}</p>
                        <p className="text-[10px] text-zinc-600">{guide.description}</p>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="ml-5 pl-3 border-l border-zinc-800 space-y-2 pb-2">
                        {guide.steps.map((step, si) => (
                          <div key={si} className="flex items-start gap-2">
                            <span className="text-[10px] text-amber-400 font-mono font-bold mt-0.5 shrink-0 w-4">{si + 1}.</span>
                            <p className="text-xs text-zinc-400 leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
