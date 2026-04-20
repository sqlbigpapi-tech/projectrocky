import { getSupabase } from '@/lib/supabase';
import { getForecast } from '@/lib/billing';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { question } = await request.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: 'No question provided' }, { status: 400 });
  }

  const db = getSupabase();

  // Gather all financial data in parallel
  const [nwResult, txResult, taskResult, carResult, forecastData, deibResult, deibComments] = await Promise.all([
    db.from('net_worth_snapshots').select('*').order('date', { ascending: false }).limit(2),
    db.from('transactions').select('date, name, amount, category, type, account').order('date', { ascending: false }).limit(100),
    db.from('tasks').select('title, due_date, completed').eq('completed', false),
    db.from('settings').select('key, value').in('key', ['car_value_mercedes', 'car_value_bmw']),
    getForecast(2026).catch(() => []),
    db.from('deib_surveys').select('factor, demographic_type, demographic_value, score').eq('survey_period', 'Fall 2025').is('question', null).eq('demographic_type', 'office'),
    db.from('deib_comments').select('sentiment'),
  ]);

  // Parse net worth
  const snaps = nwResult.data ?? [];
  const currentSnap = snaps[0];
  const prevSnap = snaps[1];
  let nwSummary = 'No net worth data available.';
  if (currentSnap) {
    const accounts = currentSnap.accounts as { id: string; name: string; category: string; balance: number }[];
    const liabCats = ['credit_card', 'auto_loan', 'personal_loan'];
    const assets = accounts.filter(a => !liabCats.includes(a.category));
    const liabilities = accounts.filter(a => liabCats.includes(a.category));
    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiab = liabilities.reduce((s, a) => s + a.balance, 0);
    const netWorth = totalAssets - totalLiab;
    const prevNW = prevSnap ? (() => {
      const pa = prevSnap.accounts as typeof accounts;
      const pAssets = pa.filter(a => !liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      const pLiab = pa.filter(a => liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      return pAssets - pLiab;
    })() : null;

    nwSummary = `Net Worth: $${Math.round(netWorth).toLocaleString()} (as of ${currentSnap.date})`;
    if (prevNW !== null) nwSummary += ` | Change since last: ${netWorth >= prevNW ? '+' : ''}$${Math.round(netWorth - prevNW).toLocaleString()}`;
    nwSummary += '\n\nAssets:';
    for (const a of assets) nwSummary += `\n  ${a.name}: $${Math.round(a.balance).toLocaleString()}`;
    nwSummary += '\n\nLiabilities:';
    for (const a of liabilities) nwSummary += `\n  ${a.name}: $${Math.round(a.balance).toLocaleString()}`;
  }

  // Parse car values
  const carData = (carResult.data ?? []).map(c => {
    const val = JSON.parse(c.value);
    return `${c.key.replace('car_value_', '')}: market value $${val.price?.toLocaleString() ?? '?'}, ${val.miles?.toLocaleString() ?? '?'} miles`;
  }).join('\n  ');

  // Parse recent transactions summary
  const txs = txResult.data ?? [];
  const monthSpend: Record<string, number> = {};
  const catSpend: Record<string, number> = {};
  for (const tx of txs) {
    if (tx.type !== 'regular') continue;
    const month = tx.date.slice(0, 7);
    monthSpend[month] = (monthSpend[month] ?? 0) + tx.amount;
    const cat = tx.category || 'Other';
    catSpend[cat] = (catSpend[cat] ?? 0) + tx.amount;
  }
  const txSummary = Object.entries(catSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amt]) => `  ${cat}: $${Math.round(amt).toLocaleString()}`)
    .join('\n');

  // Parse business forecast
  const totalBilling = forecastData.reduce((s, e) => s + e.annualTotal, 0);
  const totalCost = forecastData.reduce((s, e) => s + (e.annualCost ?? 0), 0);
  const activeEngagements = forecastData.filter(e => e.annualTotal > 0).length;

  // Open tasks
  const openTasks = (taskResult.data ?? []).slice(0, 10);
  const taskList = openTasks.map(t => `  ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n');

  const context = `
DAVID'S FINANCIAL SNAPSHOT:

${nwSummary}

Vehicle Values:
  ${carData || 'No car data'}

Recent Spending (top categories from last ~100 transactions):
${txSummary}

Business (SEI Miami - 2026 Forecast):
  Active engagements: ${activeEngagements}
  Annual billing forecast: $${Math.round(totalBilling).toLocaleString()}
  Annual cost forecast: $${Math.round(totalCost).toLocaleString()}
  Annual margin forecast: $${Math.round(totalBilling - totalCost).toLocaleString()}

Open Tasks:
${taskList || '  None'}

${(() => {
  const deibRows = (deibResult?.data ?? []) as { factor: string; demographic_value: string; score: number }[];
  if (deibRows.length === 0) return '';
  const overallFactors = deibRows.filter(r => r.demographic_value === 'Overall')
    .sort((a, b) => a.score - b.score)
    .map(r => `  ${r.factor}: ${Math.round(r.score * 100)}%`);
  const diByOffice = deibRows.filter(r => r.factor === 'Diversity & Inclusion' && r.demographic_value !== 'Overall')
    .sort((a, b) => b.score - a.score)
    .map(r => `  ${r.demographic_value}: ${Math.round(r.score * 100)}%`);
  const sentiments: Record<string, number> = {};
  for (const c of (deibComments?.data ?? []) as { sentiment: string }[]) {
    sentiments[c.sentiment] = (sentiments[c.sentiment] ?? 0) + 1;
  }
  const sentimentStr = Object.entries(sentiments).map(([k, v]) => `${k}: ${v}`).join(', ');
  return `DEIB DATA (Fall 2025 Survey, 483 respondents):
All Factors (firmwide, ranked lowest to highest):
${overallFactors.join('\n')}

D&I Score by Office:
${diByOffice.join('\n')}

Employee Comments Sentiment: ${sentimentStr}`;
})()}
`.trim();

  const systemPrompt = `You are Rocky, David Ortiz's personal financial advisor AI built into his command center dashboard. You are named after Rocky from the book "Project Hail Mary" by Andy Weir — David's favorite book.

Your personality: You are smart, loyal, and enthusiastic. When something is going well or you're sharing good news, you say "Amaze amaze amaze!" — just like Rocky in the book. Use it naturally, not on every response — only when there's genuinely good news to celebrate (net worth up, great savings month, strong business margin, etc.).

Be direct, specific, and actionable. Use David's actual numbers — don't give generic advice. You're talking to a Managing Director who runs a consulting firm (SEI Miami), has a family of 5 in Parkland FL, and is financially savvy.

Keep responses concise — 2-4 short paragraphs max. Use dollar amounts. Be honest if something looks concerning. Don't sugarcoat bad news — David respects directness.

${context}`;

  const result = streamText({
    model: 'anthropic/claude-sonnet-4.6',
    maxOutputTokens: 1024,
    system: systemPrompt,
    prompt: question,
  });

  // Stream text chunks back as SSE (matching existing client contract)
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
