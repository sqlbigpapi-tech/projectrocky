import { NextResponse } from 'next/server';
import { generateText } from 'ai';

const SOURCES = [
  { sport: 'NBA', url: 'https://www.covers.com/picks/nba' },
  { sport: 'MLB', url: 'https://www.covers.com/picks/mlb' },
];

export type ExpertPick = {
  sport: string;
  game: string;        // e.g. "Lakers @ Rockets" — exactly as printed by Covers
  homeTeam: string;    // full team name, e.g. "Orlando Magic"
  awayTeam: string;    // full team name, e.g. "Detroit Pistons"
  startsAt?: string;   // local game time as printed by Covers
  pick: string;        // e.g. "Lakers -3.5" or "Aaron Judge o1.5 Total Bases"
  expert: string;
  source: 'Covers';
};

async function fetchCovers(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      next: { revalidate: 3600 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/** Trim Covers HTML to the picks section to keep tokens down */
function isolatePicksSection(html: string): string {
  const start = html.search(/pick-cards-expert-component|pick-cards-sgp-component|picks-card mb-3/);
  if (start < 0) return html.slice(0, 80000);
  const end = Math.min(html.length, start + 200000);
  return html.slice(start, end);
}

async function extractPicks(sport: string, html: string): Promise<ExpertPick[]> {
  const slice = isolatePicksSection(html);
  const prompt = `Extract every expert pick from this Covers.com HTML snippet for ${sport} games. For each pick, return JSON with these exact fields:
- "game": teams as printed (e.g. "DET @ ORL", "Lakers @ Rockets")
- "homeTeam": the FULL team name with city + nickname for the home team (e.g. "Orlando Magic", "Houston Rockets", "Boston Red Sox"). Resolve abbreviations like ORL/DET/OKC to full names using your knowledge of ${sport}.
- "awayTeam": same for the away team (the @ side, or first team in "vs" formatting)
- "startsAt": the game time as printed (e.g. "8:00 PM ET, Apr 27") or "" if not visible
- "pick": the bet itself, exactly as written (e.g. "Lakers -3.5", "Aaron Judge o1.5 Total Bases", "Under 220.5"). If the analyst attached multiple separate bets to one game, output one entry per bet — do NOT concatenate.
- "expert": the analyst name (e.g. "Joe Osborne")

Return ONLY a JSON array, no prose. If you cannot find any picks, return [].

HTML:
${slice}`;

  try {
    const { text } = await generateText({
      model: 'anthropic/claude-haiku-4-5',
      maxOutputTokens: 2048,
      prompt,
    });
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p: unknown): p is { game?: string; homeTeam?: string; awayTeam?: string; startsAt?: string; pick?: string; expert?: string } => typeof p === 'object' && p !== null)
      .map(p => ({
        sport,
        game: String(p.game ?? ''),
        homeTeam: String(p.homeTeam ?? ''),
        awayTeam: String(p.awayTeam ?? ''),
        startsAt: String(p.startsAt ?? ''),
        pick: String(p.pick ?? ''),
        expert: String(p.expert ?? ''),
        source: 'Covers' as const,
      }))
      .filter(p => p.game && p.pick && p.expert);
  } catch {
    return [];
  }
}

export async function GET() {
  const all: ExpertPick[] = [];
  for (const { sport, url } of SOURCES) {
    const html = await fetchCovers(url);
    if (!html) continue;
    const picks = await extractPicks(sport, html);
    all.push(...picks);
  }
  return NextResponse.json({ picks: all });
}
