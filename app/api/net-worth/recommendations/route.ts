import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

const client = new Anthropic();

export async function POST(request: Request) {
  const body = await request.json();
  const { accounts, assumptions } = body;

  if (!accounts || !Array.isArray(accounts)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const age    = assumptions?.age    ?? '46';
  const salary = assumptions?.salary ?? '300000';
  const role   = assumptions?.role   ?? 'Managing Director, part owner of SEI-Miami LLC';
  const notes  = assumptions?.notes  ?? 'SEI-Miami ownership stake is 100% vested and liquid. Southwest Rapid Rewards is highest priority debt.';

  // Build a readable summary of balances for the prompt
  const categories: Record<string, { name: string; balance: number }[]> = {
    business: [],
    depository: [],
    retirement: [],
    liability: [],
  };

  for (const a of accounts) {
    if (categories[a.category]) {
      categories[a.category].push({ name: a.name, balance: a.balance });
    }
  }

  const totalAssets = accounts
    .filter((a: any) => a.category !== 'liability')
    .reduce((s: number, a: any) => s + a.balance, 0);
  const totalLiabilities = accounts
    .filter((a: any) => a.category === 'liability')
    .reduce((s: number, a: any) => s + a.balance, 0);
  const netWorth = totalAssets - totalLiabilities;

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

  const balanceSummary = `
NET WORTH SNAPSHOT
==================
Net Worth: ${fmt(netWorth)}
Total Assets: ${fmt(totalAssets)}
Total Liabilities: ${fmt(totalLiabilities)}

BUSINESS EQUITY
${categories.business.map(a => `  ${a.name}: ${fmt(a.balance)}`).join('\n')}

DEPOSITORY ACCOUNTS
${categories.depository.map(a => `  ${a.name}: ${fmt(a.balance)}`).join('\n')}

RETIREMENT & INVESTMENTS
${categories.retirement.map(a => `  ${a.name}: ${fmt(a.balance)}`).join('\n')}

LIABILITIES
${categories.liability.map(a => `  ${a.name}: ${fmt(a.balance)}`).join('\n')}
`.trim();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a sharp, direct financial advisor. Analyze the personal finances provided and return ONLY a valid JSON array — no markdown fences, no explanation, no text before or after the array.

Each element must have exactly these three string fields:
- "category": one of: Debt Payoff Priority, Savings Rate, Retirement Contributions, Net Worth Milestone, Cash Management, Business Equity
- "priority": one of: high, medium, low
- "recommendation": specific actionable advice referencing the actual dollar amounts

Client context:
- Name: David Ortiz, age ${age}
- Base salary: $${Number(salary).toLocaleString('en-US')}/year
- Role: ${role}
- Location: Parkland, FL
- Notes: ${notes}

Generate 4-6 recommendations. Be specific to the numbers — not generic advice.`,
    messages: [
      {
        role: 'user',
        content: `Here are my current account balances:\n\n${balanceSummary}\n\nGive me your recommendations as a JSON array only.`,
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
