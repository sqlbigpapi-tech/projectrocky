import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

type Account = { name: string; category: string; balance: number };

const LIABILITY_CATS = ['credit_card', 'auto_loan', 'personal_loan'];

const CATEGORY_LABELS: Record<string, string> = {
  business: 'BUSINESS EQUITY',
  depository: 'DEPOSITORY ACCOUNTS',
  retirement: 'RETIREMENT & INVESTMENTS',
  credit_card: 'CREDIT CARDS',
  auto_loan: 'AUTO LOANS',
  personal_loan: 'PERSONAL LOANS',
};

const RecSchema = z.object({
  recommendations: z.array(z.object({
    category: z.string().describe('One of: Debt Payoff Priority, Savings Rate, Retirement Contributions, Net Worth Milestone, Cash Management, Business Equity, Liquidity'),
    priority: z.enum(['high', 'medium', 'low']),
    recommendation: z.string().describe('Specific, actionable advice referencing the actual dollar amounts from the snapshot.'),
  })).min(4).max(6),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { accounts, assumptions } = body as {
    accounts: Account[];
    assumptions?: { age?: string; salary?: string; role?: string; notes?: string };
  };

  if (!accounts || !Array.isArray(accounts)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const age    = assumptions?.age    ?? '46';
  const salary = assumptions?.salary ?? '300000';
  const role   = assumptions?.role   ?? 'Managing Director, part owner of SEI-Miami LLC';
  const notes  = assumptions?.notes  ?? 'SEI-Miami ownership stake is 100% vested and liquid. Southwest Rapid Rewards is highest priority debt.';

  const byCat: Record<string, Account[]> = {};
  for (const a of accounts) {
    if (!byCat[a.category]) byCat[a.category] = [];
    byCat[a.category].push(a);
  }

  const totalAssets = accounts
    .filter(a => !LIABILITY_CATS.includes(a.category))
    .reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts
    .filter(a => LIABILITY_CATS.includes(a.category))
    .reduce((s, a) => s + a.balance, 0);
  const netWorth = totalAssets - totalLiabilities;

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

  const sections: string[] = [];
  for (const [cat, accts] of Object.entries(byCat)) {
    const label = CATEGORY_LABELS[cat] ?? cat.toUpperCase();
    const catTotal = accts.reduce((s, a) => s + a.balance, 0);
    const lines = accts.map(a => `  ${a.name}: ${fmt(a.balance)}`).join('\n');
    sections.push(`${label} (${fmt(catTotal)})\n${lines}`);
  }

  const balanceSummary = `NET WORTH SNAPSHOT
==================
Net Worth: ${fmt(netWorth)}
Total Assets: ${fmt(totalAssets)}
Total Liabilities: ${fmt(totalLiabilities)}

${sections.join('\n\n')}`;

  const prompt = `You are a sharp, direct financial advisor. Analyze David's personal finances and produce 4-6 actionable recommendations.

Client context:
- David Ortiz, age ${age}
- Base salary: $${Number(salary).toLocaleString('en-US')}/year
- Role: ${role}
- Location: Parkland, FL
- Notes: ${notes}

Current snapshot:
${balanceSummary}

Rules for each recommendation:
- Reference the actual dollar amounts, not generic advice.
- Use the "category" field to tag the area (e.g. "Debt Payoff Priority", "Cash Management", "Retirement Contributions").
- Set "priority" based on how urgent the action is.
- Keep each recommendation to 1-2 sentences — punchy, directive, no hedging.`;

  try {
    const { object } = await generateObject({
      model: 'anthropic/claude-sonnet-4.6',
      schema: RecSchema,
      prompt,
    });
    return NextResponse.json({
      recommendations: object.recommendations,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Recommendation generation failed' },
      { status: 500 },
    );
  }
}
