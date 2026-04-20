'use client';
import { useState, useEffect } from 'react';

type NotifKey = 'notif_daily_tasks' | 'notif_evening_tasks' | 'notif_weekly_networth' | 'notif_liability_zero' | 'notif_week_ahead' | 'notif_engagement_expiry' | 'notif_month_close' | 'notif_revenue_cliff';

const ALERTS: { key: NotifKey; label: string; schedule: string; description: string; emoji: string }[] = [
  {
    key: 'notif_daily_tasks',
    label: 'Morning Task Digest',
    schedule: 'Every day at 8am',
    description: 'Tasks due today and any overdue items.',
    emoji: '🗂',
  },
  {
    key: 'notif_evening_tasks',
    label: 'Evening Task Check-in',
    schedule: 'Every day at 8pm',
    description: 'Reminder for tasks still due today or overdue.',
    emoji: '🌙',
  },
  {
    key: 'notif_week_ahead',
    label: 'Week Ahead Briefing',
    schedule: 'Mondays at 7am',
    description: 'All tasks due in the next 7 days.',
    emoji: '📅',
  },
  {
    key: 'notif_engagement_expiry',
    label: 'Engagement Expiry Warning',
    schedule: 'Mondays at 9am',
    description: 'SOWs ending within 30 days with monthly revenue at risk.',
    emoji: '⚠️',
  },
  {
    key: 'notif_revenue_cliff',
    label: 'Revenue Cliff Alert',
    schedule: 'Mondays at 9am',
    description: 'Fires when next month forecast revenue drops 20%+ vs current month.',
    emoji: '🚨',
  },
  {
    key: 'notif_month_close',
    label: 'Month-End Close Reminder',
    schedule: '1st of each month at 10am',
    description: 'Reminds you to upload the prior month worksheet. Shows YTD net income.',
    emoji: '📊',
  },
  {
    key: 'notif_weekly_networth',
    label: 'Weekly Net Worth Summary',
    schedule: 'Sundays at 9am',
    description: 'Total assets, liabilities, and net worth with week-over-week change.',
    emoji: '💰',
  },
  {
    key: 'notif_liability_zero',
    label: 'Liability Paid Off',
    schedule: 'Checked daily at 8am',
    description: 'Instant alert when any debt balance hits zero.',
    emoji: '🎉',
  },
];

export default function NotificationsTab() {
  const [enabled, setEnabled] = useState<Record<NotifKey, boolean>>({
    notif_daily_tasks: true,
    notif_evening_tasks: true,
    notif_weekly_networth: true,
    notif_liability_zero: true,
    notif_week_ahead: true,
    notif_engagement_expiry: true,
    notif_month_close: true,
    notif_revenue_cliff: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<NotifKey | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  useEffect(() => {
    Promise.all(
      ALERTS.map(a =>
        fetch(`/api/settings?key=${a.key}`)
          .then(r => r.json())
          .then(d => ({ key: a.key, value: d.value !== 'false' }))
      )
    ).then(results => {
      const next = { ...enabled };
      results.forEach(({ key, value }) => { next[key] = value; });
      setEnabled(next);
      setLoading(false);
    });
  }, []);

  async function toggle(key: NotifKey) {
    const next = !enabled[key];
    setEnabled(prev => ({ ...prev, [key]: next }));
    setSaving(key);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: String(next) }),
    });
    setSaving(null);
  }

  async function sendTest() {
    setTestStatus('sending');
    setTestError('');
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: '👋 Rocky is online. SMS notifications are working.' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Unknown error');
      setTestStatus('sent');
      setTimeout(() => setTestStatus('idle'), 4000);
    } catch (e: any) {
      setTestStatus('error');
      setTestError(e.message);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Header */}
      <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-1">Project Rocky</p>
            <h2 className="text-xl font-bold text-white">Telegram Alerts</h2>
            <p className="text-sm text-zinc-500 mt-1">{ALERTS.length} alerts configured · {Object.values(enabled).filter(Boolean).length} active</p>
          </div>
          <button
            onClick={sendTest}
            disabled={testStatus === 'sending'}
            className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-widest transition border ${
              testStatus === 'sent'    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              testStatus === 'error'   ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              testStatus === 'sending' ? 'bg-zinc-900 border-zinc-700 text-zinc-500' :
              'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'
            }`}
          >
            {testStatus === 'sending' ? 'Sending…' : testStatus === 'sent' ? '✓ Sent!' : testStatus === 'error' ? '✗ Failed' : 'Send Test'}
          </button>
        </div>
        {testStatus === 'error' && testError && (
          <p className="mt-3 text-xs text-red-400 font-mono">{testError}</p>
        )}
      </div>

      {/* Alert toggles */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-900 animate-pulse" />
          ))
        ) : (
          ALERTS.map(alert => (
            <div
              key={alert.key}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                enabled[alert.key]
                  ? 'bg-[var(--card)] border-zinc-700'
                  : 'bg-[var(--card)]/50 border-zinc-800 opacity-60'
              }`}
            >
              <span className="text-2xl shrink-0">{alert.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-white">{alert.label}</p>
                  <span className="text-xs text-zinc-600 font-mono">{alert.schedule}</span>
                </div>
                <p className="text-xs text-zinc-500">{alert.description}</p>
              </div>
              <button
                onClick={() => toggle(alert.key)}
                disabled={saving === alert.key}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                  enabled[alert.key] ? 'bg-amber-500' : 'bg-zinc-700'
                }`}
                aria-label={enabled[alert.key] ? 'Disable' : 'Enable'}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  enabled[alert.key] ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
