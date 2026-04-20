'use client';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface ScoreRow {
  demographic_type: string;
  demographic_value: string;
  respondent_count: number;
  factor: string;
  question: string | null;
  score: number;
}
interface CommentRow {
  question: string;
  comment: string;
  rating: string;
  topics: string;
  sentiment: string;
  office_location: string;
}

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: '#34d399', Neutral: '#a1a1aa', Negative: '#f87171', 'No sentiment': '#52525b',
};

const DEI_QUESTIONS = [
  'I feel like I belong at SEI.',
  'My local SEI office values diversity.',
  'People from all backgrounds have equal opportunities to succeed at SEI.',
  'I can voice a contrary opinion without fear of negative consequences.',
];

function pct(v: number): string { return `${Math.round(v * 100)}`; }
function scoreColor(v: number): string {
  if (v >= 0.85) return '#34d399';
  if (v >= 0.70) return '#fbbf24';
  return '#f87171';
}
function scoreBgClass(v: number): string {
  if (v >= 0.90) return 'bg-emerald-500/20 text-emerald-300';
  if (v >= 0.85) return 'bg-emerald-500/10 text-emerald-400';
  if (v >= 0.75) return 'bg-amber-500/10 text-amber-400';
  if (v >= 0.65) return 'bg-orange-500/10 text-orange-400';
  return 'bg-red-500/15 text-red-400';
}
function deltaColor(d: number): string {
  if (d > 0.03) return 'text-emerald-400';
  if (d > 0) return 'text-emerald-400/60';
  if (d < -0.03) return 'text-red-400';
  if (d < 0) return 'text-red-400/60';
  return 'text-zinc-600';
}

export default function DEIBTab() {
  const [loading, setLoading] = useState(true);
  const [currentOffice, setCurrentOffice] = useState<ScoreRow[]>([]);
  const [priorOffice, setPriorOffice] = useState<ScoreRow[]>([]);
  const [currentGender, setCurrentGender] = useState<ScoreRow[]>([]);
  const [currentRace, setCurrentRace] = useState<ScoreRow[]>([]);
  const [priorRace, setPriorRace] = useState<ScoreRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [view, setView] = useState<'heatmap' | 'gaps' | 'trends' | 'voice'>('heatmap');
  const [heatmapMode, setHeatmapMode] = useState<'score' | 'delta'>('score');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/deib?period=Fall+2025&demo=office').then(r => r.json()),
      fetch('/api/deib?period=Oct+2024&demo=office').then(r => r.json()),
      fetch('/api/deib?period=Fall+2025&demo=gender').then(r => r.json()),
      fetch('/api/deib?period=Fall+2025&demo=race').then(r => r.json()),
      fetch('/api/deib?period=Oct+2024&demo=race').then(r => r.json()),
    ]).then(([co, po, cg, cr, pr]) => {
      setCurrentOffice(co.scores ?? []);
      setPriorOffice(po.scores ?? []);
      setCurrentGender(cg.scores ?? []);
      setCurrentRace(cr.scores ?? []);
      setPriorRace(pr.scores ?? []);
      setComments(co.comments ?? []);
    }).finally(() => setLoading(false));
  }, []);

  // ── Heatmap: Office × DEI Questions ──
  const DEI_HEATMAP_QUESTIONS = [
    'I feel like I belong at SEI.',
    'My local SEI office values diversity.',
    'People from all backgrounds have equal opportunities to succeed at SEI.',
    'I can voice a contrary opinion without fear of negative consequences.',
    'I genuinely like, trust, and respect my coworkers.',
    'I support and feel supported by my coworkers.',
  ];

  const heatmapData = useMemo(() => {
    const offices = [...new Set(currentOffice.filter(s => s.question && s.demographic_value !== 'Overall').map(s => s.demographic_value))];
    // Use the DEI questions as columns
    const questions = DEI_HEATMAP_QUESTIONS;
    // Short labels for column headers
    const questionLabels: Record<string, string> = {
      'I feel like I belong at SEI.': 'Belonging',
      'My local SEI office values diversity.': 'Values Diversity',
      'People from all backgrounds have equal opportunities to succeed at SEI.': 'Equal Opportunity',
      'I can voice a contrary opinion without fear of negative consequences.': 'Psychological Safety',
      'I genuinely like, trust, and respect my coworkers.': 'Trust & Respect',
      'I support and feel supported by my coworkers.': 'Peer Support',
    };

    return { offices, questions, questionLabels, getScore: (office: string, question: string) => {
      const shortQ = question.slice(0, 30);
      return currentOffice.find(s => s.demographic_value === office && s.question?.includes(shortQ))?.score ?? null;
    }, getDelta: (office: string, question: string) => {
      const shortQ = question.slice(0, 30);
      const current = currentOffice.find(s => s.demographic_value === office && s.question?.includes(shortQ))?.score;
      const prior = priorOffice.find(s => s.demographic_value === office && s.question?.includes(shortQ))?.score;
      if (current == null || prior == null) return null;
      return current - prior;
    }, getOverall: (question: string) => {
      const shortQ = question.slice(0, 30);
      return currentOffice.find(s => s.demographic_value === 'Overall' && s.question?.includes(shortQ))?.score ?? null;
    }};
  }, [currentOffice, priorOffice]);

  // ── Gaps: Gender + Race on DEI questions ──
  const genderGaps = useMemo(() => {
    return DEI_QUESTIONS.map(q => {
      const shortQ = q.slice(0, 30);
      const male = currentGender.find(s => s.question?.includes(shortQ) && s.demographic_value === 'Male')?.score;
      const female = currentGender.find(s => s.question?.includes(shortQ) && s.demographic_value === 'Female')?.score;
      return { question: q, male, female, gap: male != null && female != null ? male - female : null };
    });
  }, [currentGender]);

  const raceGaps = useMemo(() => {
    const groups = [...new Set(currentRace.filter(s => s.demographic_value !== 'Overall' && s.question).map(s => s.demographic_value))];
    return DEI_QUESTIONS.map(q => {
      const shortQ = q.slice(0, 30);
      const scores = groups.map(g => ({
        group: g.replace(/ \(United States of America\)/, ''),
        score: currentRace.find(s => s.question?.includes(shortQ) && s.demographic_value === g)?.score ?? null,
      })).filter(s => s.score != null);
      return { question: q, scores };
    });
  }, [currentRace]);

  // ── Trends: All factors firmwide YoY ──
  const factorTrends = useMemo(() => {
    const factors = [...new Set(currentOffice.filter(s => !s.question && s.demographic_value === 'Overall').map(s => s.factor))];
    return factors.map(f => {
      const current = currentOffice.find(s => s.factor === f && !s.question && s.demographic_value === 'Overall')?.score ?? 0;
      const prior = priorOffice.find(s => s.factor === f && !s.question && s.demographic_value === 'Overall')?.score ?? null;
      return { factor: f, current, prior, delta: prior != null ? current - prior : null };
    }).sort((a, b) => b.current - a.current);
  }, [currentOffice, priorOffice]);

  // ── Race D&I YoY ──
  const raceDITrend = useMemo(() => {
    const groups = [...new Set(currentRace.filter(s => s.factor === 'Diversity & Inclusion' && !s.question && s.demographic_value !== 'Overall').map(s => s.demographic_value))];
    return groups.map(g => {
      const current = currentRace.find(s => s.factor === 'Diversity & Inclusion' && !s.question && s.demographic_value === g)?.score;
      const prior = priorRace.find(s => s.factor === 'Diversity & Inclusion' && !s.question && s.demographic_value === g)?.score;
      return {
        group: g.replace(/ \(United States of America\)/, ''),
        current: current ? Math.round(current * 100) : 0,
        prior: prior ? Math.round(prior * 100) : 0,
        delta: current != null && prior != null ? Math.round((current - prior) * 100) : 0,
      };
    }).sort((a, b) => b.delta - a.delta);
  }, [currentRace, priorRace]);

  // Comments
  const commentStats = useMemo(() => {
    const sentiments: Record<string, number> = {};
    const topics: Record<string, number> = {};
    for (const c of comments) {
      sentiments[c.sentiment] = (sentiments[c.sentiment] ?? 0) + 1;
      if (c.topics) for (const t of c.topics.split(',').map(s => s.trim()).filter(Boolean)) topics[t] = (topics[t] ?? 0) + 1;
    }
    return { sentiments, topics, total: comments.length };
  }, [comments]);

  const [sentimentFilter, setSentimentFilter] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [showAllComments, setShowAllComments] = useState(false);
  const filteredComments = useMemo(() => comments.filter(c => {
    if (sentimentFilter && c.sentiment !== sentimentFilter) return false;
    if (topicFilter && !c.topics?.includes(topicFilter)) return false;
    return true;
  }), [comments, sentimentFilter, topicFilter]);

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-48 w-full rounded-xl" />)}</div>;

  return (
    <div className="space-y-5">
      {/* Nav */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 w-fit">
        {([['heatmap', 'By Office'], ['gaps', 'Demographic Gaps'], ['trends', 'Factor Trends'], ['voice', 'Employee Voice']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className={`text-[11px] font-mono px-4 py-2 rounded-md transition ${view === k ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-white'}`}>{label}</button>
        ))}
      </div>

      {/* ═══ OFFICE SCORES ═══ */}
      {view === 'heatmap' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-bold">DEIB Scores by Office</p>
              <p className="text-[10px] text-zinc-600 font-mono mt-0.5">Fall 2025 Survey — 483 respondents across 14 offices, ranked by score</p>
            </div>
          </div>

          {heatmapData.questions.map(q => {
            const label = heatmapData.questionLabels[q] ?? q;
            const overall = heatmapData.getOverall(q);
            const officeScores = heatmapData.offices
              .map(office => ({
                office,
                score: Math.round((heatmapData.getScore(office, q) ?? 0) * 100),
                raw: heatmapData.getScore(office, q) ?? 0,
              }))
              .sort((a, b) => b.score - a.score);

            return (
              <div key={q} className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-amber-400 font-mono font-bold uppercase tracking-widest">{label}</p>
                    <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{q}</p>
                  </div>
                  {overall != null && (
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums" style={{ color: scoreColor(overall) }}>{pct(overall)}%</p>
                      <p className="text-[9px] text-zinc-600 font-mono">firmwide</p>
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={Math.max(200, officeScores.length * 22)}>
                  <BarChart data={officeScores} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="office" tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={({ active, payload }: any) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[var(--card)] border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
                          <p className="text-zinc-300 font-bold">{d.office} — {d.score}%</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={18}>
                      {officeScores.map((d, i) => (
                        <Cell key={i} fill={scoreColor(d.raw)} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ DEMOGRAPHIC GAPS ═══ */}
      {view === 'gaps' && (
        <>
          {/* Gender gaps */}
          <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
            <p className="text-sm text-white font-bold mb-1">Gender Gap — DEI Questions</p>
            <p className="text-[10px] text-zinc-600 font-mono mb-4">Male vs Female scores — Fall 2025</p>
            <div className="space-y-3">
              {genderGaps.map((g, i) => (
                <div key={i}>
                  <p className="text-xs text-zinc-400 mb-1.5">{g.question}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-[10px] text-blue-400 font-mono w-8">M</span>
                      <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                        {g.male != null && <div className="h-full bg-blue-500/40 rounded" style={{ width: `${g.male * 100}%` }} />}
                      </div>
                      <span className="text-[11px] font-mono font-bold text-blue-400 w-10">{g.male != null ? pct(g.male) + '%' : '—'}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-[10px] text-pink-400 font-mono w-8">F</span>
                      <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                        {g.female != null && <div className="h-full bg-pink-500/40 rounded" style={{ width: `${g.female * 100}%` }} />}
                      </div>
                      <span className="text-[11px] font-mono font-bold text-pink-400 w-10">{g.female != null ? pct(g.female) + '%' : '—'}</span>
                    </div>
                    {g.gap != null && (
                      <span className={`text-[10px] font-mono font-bold w-12 text-right ${Math.abs(g.gap) > 0.05 ? 'text-amber-400' : 'text-zinc-600'}`}>
                        {Math.round(Math.abs(g.gap) * 100)}pt gap
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Race D&I YoY */}
          <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
            <p className="text-sm text-white font-bold mb-1">D&I by Race/Ethnicity — YoY Movement</p>
            <p className="text-[10px] text-zinc-600 font-mono mb-4">Diversity & Inclusion factor — Oct 2024 vs Fall 2025</p>
            {raceDITrend.length > 0 && (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={raceDITrend} barGap={4} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                    <XAxis dataKey="group" tick={{ fill: '#a1a1aa', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[40, 100]} tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={30} tickFormatter={v => `${v}%`} />
                    <Tooltip content={({ active, payload }: any) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[var(--card)] border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
                          <p className="text-zinc-300 font-bold">{d.group}</p>
                          <p className="text-zinc-500">Oct '24: {d.prior}%</p>
                          <p className="text-emerald-400">Fall '25: {d.current}%</p>
                          <p className={d.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>{d.delta >= 0 ? '+' : ''}{d.delta}pt</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="prior" name="Oct 2024" fill="#52525b" radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="current" name="Fall 2025" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-[10px] font-mono">
                  {raceDITrend.map(g => (
                    <span key={g.group} className={g.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {g.group.slice(0, 10)}: {g.delta >= 0 ? '+' : ''}{g.delta}pt
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Per-question race breakdown */}
          {raceGaps.map((rg, i) => (
            <div key={i} className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
              <p className="text-xs text-zinc-300 mb-3">{rg.question}</p>
              <div className="space-y-1.5">
                {rg.scores.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((s, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono w-36 truncate shrink-0">{s.group}</span>
                    <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${(s.score ?? 0) * 100}%`, backgroundColor: scoreColor(s.score ?? 0) }} />
                    </div>
                    <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color: scoreColor(s.score ?? 0) }}>{s.score != null ? pct(s.score) + '%' : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ═══ FACTOR TRENDS ═══ */}
      {view === 'trends' && (
        <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-5">
          <p className="text-sm text-white font-bold mb-1">All Engagement Factors — Firmwide</p>
          <p className="text-[10px] text-zinc-600 font-mono mb-4">Ranked by Fall 2025 score, with YoY delta where available</p>
          <div className="space-y-2">
            {factorTrends.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[11px] text-zinc-400 w-48 truncate shrink-0">{f.factor}</span>
                <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                  <div className="h-full rounded transition-all" style={{ width: `${f.current * 100}%`, backgroundColor: scoreColor(f.current) }} />
                </div>
                <span className="text-[11px] font-mono font-bold w-10 text-right" style={{ color: scoreColor(f.current) }}>{pct(f.current)}%</span>
                {f.delta != null ? (
                  <span className={`text-[10px] font-mono font-bold w-12 text-right ${deltaColor(f.delta)}`}>
                    {f.delta > 0 ? '↑' : f.delta < 0 ? '↓' : '='}{Math.abs(Math.round(f.delta * 100))}pt
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-700 font-mono w-12 text-right">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ EMPLOYEE VOICE ═══ */}
      {view === 'voice' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-4">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-3">Sentiment</p>
              <div className="flex items-center gap-6">
                <div className="w-28 h-28">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={Object.entries(commentStats.sentiments).map(([name, value]) => ({ name, value }))}
                        dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={2}>
                        {Object.entries(commentStats.sentiments).map(([name], i) => (
                          <Cell key={i} fill={SENTIMENT_COLORS[name] ?? '#52525b'} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(commentStats.sentiments).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                    <button key={name} onClick={() => setSentimentFilter(sentimentFilter === name ? null : name)}
                      className={`flex items-center gap-2 text-xs font-mono transition ${sentimentFilter === name ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SENTIMENT_COLORS[name] }} />
                      {name} ({count})
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-[var(--card)] rounded-xl border border-zinc-800 p-4">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-3">Top Topics</p>
              <div className="space-y-1">
                {Object.entries(commentStats.topics).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => {
                  const max = Math.max(...Object.values(commentStats.topics));
                  return (
                    <button key={topic} onClick={() => setTopicFilter(topicFilter === topic ? null : topic)}
                      className={`w-full flex items-center gap-2 transition ${topicFilter === topic ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}>
                      <span className="text-[10px] font-mono w-28 text-left truncate shrink-0">{topic}</span>
                      <div className="flex-1 h-3 bg-zinc-800 rounded overflow-hidden">
                        <div className="h-full bg-amber-500/30 rounded" style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-mono w-6 text-right shrink-0">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {(sentimentFilter || topicFilter) && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-zinc-600">Filtered:</span>
              {sentimentFilter && <button onClick={() => setSentimentFilter(null)} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-red-400">{sentimentFilter} ✕</button>}
              {topicFilter && <button onClick={() => setTopicFilter(null)} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-red-400">{topicFilter} ✕</button>}
            </div>
          )}

          <div className="space-y-2">
            {filteredComments.slice(0, showAllComments ? undefined : 8).map((c, i) => (
              <div key={i} className="bg-[var(--card)] rounded-xl border border-zinc-800 p-4">
                <p className="text-sm text-zinc-300 leading-relaxed mb-2">{c.comment}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: (SENTIMENT_COLORS[c.sentiment] ?? '#52525b') + '20', color: SENTIMENT_COLORS[c.sentiment] }}>{c.sentiment}</span>
                  {c.office_location && <span className="text-[9px] text-zinc-600 font-mono">{c.office_location}</span>}
                  {c.topics?.split(',').map(t => t.trim()).filter(Boolean).slice(0, 3).map((t, j) => (
                    <button key={j} onClick={() => setTopicFilter(t)} className="text-[9px] text-zinc-700 font-mono hover:text-amber-400">#{t}</button>
                  ))}
                </div>
              </div>
            ))}
            {filteredComments.length > 8 && !showAllComments && (
              <button onClick={() => setShowAllComments(true)} className="text-xs text-zinc-600 font-mono hover:text-zinc-400">Show all {filteredComments.length} comments</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
