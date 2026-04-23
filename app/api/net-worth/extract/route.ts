import { getSupabase } from '@/lib/supabase';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

type Account = { id: string; name: string; category: string; balance: number; priority?: boolean };

const LIAB_CATS = ['credit_card', 'auto_loan', 'personal_loan'];

const ExtractSchema = z.object({
  accounts: z.array(z.object({
    name: z.string().describe('Account display name exactly as shown, minus the last-4 digits suffix'),
    balance: z.number().describe('Current balance in USD. Always a positive number — if this is a liability, return the magnitude.'),
    last4: z.string().nullable().describe('Last 4 digits of the account number if shown next to the name (e.g. "6895" from "Ira 6895"), else null'),
    section: z.string().nullable().describe('The section heading the row lives under, e.g. "Investments", "Loans", "Credit cards", "Depository"'),
  })),
});

type Extracted = z.infer<typeof ExtractSchema>['accounts'][number];

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
}

function extractLast4FromName(name: string): string | null {
  const m = name.match(/(\d{4})/);
  return m ? m[1] : null;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeName(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.max(ta.size, tb.size);
}

function bestMatch(ex: Extracted, existing: Account[]): { match: Account | null; score: number } {
  let best: Account | null = null;
  let bestScore = 0;
  for (const a of existing) {
    let score = tokenOverlap(ex.name, a.name);
    const existingLast4 = extractLast4FromName(a.name);
    if (ex.last4 && existingLast4 && ex.last4 === existingLast4) {
      score += 0.6;
    }
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return { match: best, score: bestScore };
}

function guessCategory(section: string | null): string {
  if (!section) return 'depository';
  const s = section.toLowerCase();
  if (s.includes('investment') || s.includes('retirement')) return 'retirement';
  if (s.includes('business') || s.includes('equity')) return 'business';
  if (s.includes('depos') || s.includes('cash') || s.includes('savings') || s.includes('checking')) return 'depository';
  if (s.includes('credit')) return 'credit_card';
  if (s.includes('auto') || s.includes('car')) return 'auto_loan';
  if (s.includes('loan') || s.includes('personal')) return 'personal_loan';
  return 'depository';
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll('images').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 });
  }

  // Read each image as base64
  const images = await Promise.all(files.map(async f => {
    const buf = Buffer.from(await f.arrayBuffer());
    return { mediaType: f.type || 'image/png', base64: buf.toString('base64') };
  }));

  // Fetch the latest snapshot so we can match against existing accounts
  const db = getSupabase();
  const { data: latest } = await db
    .from('net_worth_snapshots')
    .select('accounts')
    .order('date', { ascending: false })
    .limit(1)
    .single();
  const existing: Account[] = (latest?.accounts as Account[]) ?? [];

  let extracted: Extracted[];
  try {
    const { object } = await generateObject({
      model: 'anthropic/claude-sonnet-4.6',
      schema: ExtractSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `These are screenshots from a personal finance tracker. Extract every account balance row you can see.

Rules:
- Pull the account name exactly as shown, minus the last-4 digits suffix (if the row says "Ira 6895", the name is "Ira" and last4 is "6895").
- Balance is always positive — the magnitude of the dollar amount shown.
- Section is the group heading the row lives under (Investments, Loans, Credit cards, Depository, etc).
- Skip subtotal/total rows and any header rows.
- Skip any "last synced" timestamps or percentage deltas — those are not accounts.
- Include zero-balance accounts — those matter for tracking.
- If an account's name contains "CD", "Savings", "Checking", "Money Market", "Spend", section is depository even if the source doesn't label it.`,
            },
            ...images.map(img => ({
              type: 'image' as const,
              image: `data:${img.mediaType};base64,${img.base64}`,
            })),
          ],
        },
      ],
    });
    extracted = object.accounts;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 },
    );
  }

  // Match against existing accounts
  const MATCH_THRESHOLD = 0.5;
  const usedExistingIds = new Set<string>();
  type MatchResult = {
    extracted: Extracted;
    match: Account | null;
    score: number;
    suggested_category: string;
  };
  const results: MatchResult[] = [];

  for (const ex of extracted) {
    const { match, score } = bestMatch(ex, existing);
    if (match && score >= MATCH_THRESHOLD && !usedExistingIds.has(match.id)) {
      usedExistingIds.add(match.id);
      results.push({
        extracted: ex,
        match,
        score,
        suggested_category: match.category,
      });
    } else {
      results.push({
        extracted: ex,
        match: null,
        score,
        suggested_category: guessCategory(ex.section),
      });
    }
  }

  // Accounts in the current snapshot that weren't matched by anything extracted
  const missing = existing.filter(a => !usedExistingIds.has(a.id));

  // Build a preview payload — this is what the UI will confirm/edit
  const totals = {
    current: (() => {
      const assets = existing.filter(a => !LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      const liab   = existing.filter(a =>  LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      return { assets, liab, net: assets - liab };
    })(),
    proposed: (() => {
      const proposed: Account[] = existing.map(a => {
        const r = results.find(x => x.match?.id === a.id);
        return r ? { ...a, balance: r.extracted.balance } : { ...a };
      });
      // Add brand-new accounts (unmatched extracted rows)
      for (const r of results) {
        if (r.match) continue;
        const id = normalizeName(r.extracted.name).replace(/\s+/g, '_') || `new_${Date.now()}`;
        proposed.push({
          id,
          name: r.extracted.name,
          category: r.suggested_category,
          balance: r.extracted.balance,
        });
      }
      const assets = proposed.filter(a => !LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      const liab   = proposed.filter(a =>  LIAB_CATS.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      return { assets, liab, net: assets - liab, accounts: proposed };
    })(),
  };

  return NextResponse.json({
    results,
    missing: missing.map(a => ({ id: a.id, name: a.name, category: a.category, current_balance: a.balance })),
    totals,
  });
}
