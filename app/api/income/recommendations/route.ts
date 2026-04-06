import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

const client = new Anthropic();

export async function POST(request: Request) {
  const body = await request.json();
  const { months, bigGoal } = body;

  if (!months || !Array.isArray(months)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const GOAL = 1001000;
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const locked = months.filter((m: any) => m.actual != null);
  const actuals = locked.filter((m: any) => !m.is_forecast);
  const ytd = locked.reduce((s: number, m: any) => s + m.actual, 0);
  const planYtd = locked.reduce((s: number, m: any) => s + m.plan, 0);
  const runRate = locked.length > 0 ? ytd / locked.length : 0;
  const remainingMonths = 12 - locked.length;
  const projectedTotal = ytd + runRate * remainingMonths;
  const beat = ytd - planYtd;
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

  const monthSummary = months.map((m: any) => {
    const label = m.actual != null
      ? `${MONTH_NAMES[m.month - 1]}: ${fmt(m.actual)} (${m.is_forecast ? 'forecast' : 'actual'}, plan ${fmt(m.plan)}, ${m.actual >= m.plan ? '+' : ''}${fmt(m.actual - m.plan)} vs plan)`
      : `${MONTH_NAMES[m.month - 1]}: open (plan ${fmt(m.plan)})`;
    return label;
  }).join('\n');

  const summary = `
INCOME PERFORMANCE SUMMARY
===========================
YTD Net Income: ${fmt(ytd)} (${actuals.length} actual months, ${locked.length - actuals.length} forecast)
Plan YTD: ${fmt(planYtd)} → ${beat >= 0 ? '+' : ''}${fmt(beat)} vs plan
Run Rate: ${fmt(runRate)}/mo
Projected Full Year: ${fmt(projectedTotal)}
$1M Goal: ${(ytd / GOAL * 100).toFixed(1)}% complete, ${fmt(Math.max(0, GOAL - ytd))} remaining
${bigGoal ? `${fmt(bigGoal)} UIP Goal: ${(ytd / bigGoal * 100).toFixed(1)}% complete, ${fmt(Math.max(0, bigGoal - ytd))} remaining` : ''}
Months remaining: ${remainingMonths}

MONTHLY BREAKDOWN:
${monthSummary}
`.trim();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a sharp, direct financial advisor analyzing the SEI-Miami LLC net income performance for David Ortiz, Managing Director and part owner.

Context:
- $1M goal is the base annual net income target
- BIG UIP goal (${bigGoal ? fmt(bigGoal) : '$1.7M'}) is the stretch target
- Base salary is $300K — net income above that represents business performance
- David is age 46, located in Parkland, FL

Analyze the income data and return ONLY a valid JSON array — no markdown, no explanation, just the array.

Each element must have exactly these three string fields:
- "category": one of: Pacing Analysis, Goal Strategy, Monthly Variance, Run Rate, Q2 Outlook, Year-End Projection
- "priority": one of: high, medium, low
- "recommendation": specific actionable insight referencing actual dollar amounts and months

Generate 4-6 recommendations. Be specific to the numbers — reference actual months, variances, and projections.`,
    messages: [
      {
        role: 'user',
        content: `Here is the SEI-Miami net income data:\n\n${summary}\n\nGive me your recommendations as a JSON array only.`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';

  let recommendations: { category: string; priority: string; recommendation: string }[] = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array found');
    recommendations = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 500 });
  }

  return NextResponse.json({ recommendations, generatedAt: new Date().toISOString() });
}
