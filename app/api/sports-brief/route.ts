import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

type GameInfo = {
  id: string;
  date: string;
  opponent: string;
  opponentAbbr: string;
  homeAway: string;
  teamScore: string;
  opponentScore: string;
  result: 'W' | 'L' | null;
  statusDetail: string;
  venue: string;
};

type Standings = {
  divisionGB: string;
  leagueGB: string;
  playoffSeed: number;
  record: string;
  streak: string;
};

type TeamFeed = {
  team: { id: string; name: string; abbr: string; league: string; record: string | null };
  liveGame: GameInfo | null;
  lastGame: GameInfo | null;
  nextGame: GameInfo | null;
  last5: ('W' | 'L')[];
  standings: Standings | null;
};

type TeamKey = string; // "{league}-{teamId}"

const BriefSchema = z.object({
  brief: z.array(z.string()).min(2).max(4).describe('2-4 short paragraphs. First is yesterday/last-game recaps, second is tonight/upcoming, third is a broader storyline for the week.'),
  storylines: z.record(z.string(), z.string()).describe('One-to-two sentence storyline per team, keyed by "{league}-{teamId}". E.g. "mlb-28" → "Marlins chasing the wild card — 4 games back with 19 to play. Atlanta series this weekend is season-defining."'),
});

// Module-level cache. Regenerated at most once per 4 hours per instance.
let cached: { at: number; key: string; data: { brief: string[]; storylines: Record<string, string> } } | null = null;
const CACHE_MS = 4 * 60 * 60 * 1000;

function teamKey(f: TeamFeed): TeamKey {
  return `${f.team.league.toLowerCase()}-${f.team.id}`;
}

function summarizeTeam(f: TeamFeed): string {
  const lines: string[] = [];
  lines.push(`${f.team.name} (${f.team.league})${f.team.record ? ` — record ${f.team.record}` : ''}`);
  lines.push(`key: ${teamKey(f)}`);
  if (f.last5.length > 0) lines.push(`last 5: ${f.last5.join(' ')}`);
  if (f.standings) {
    const bits: string[] = [];
    if (f.standings.divisionGB === '-') bits.push('1st in division');
    else bits.push(`${f.standings.divisionGB} GB division`);
    if (f.standings.leagueGB !== '-') bits.push(`${f.standings.leagueGB} GB league`);
    if (f.standings.streak) bits.push(`streak ${f.standings.streak}`);
    lines.push(`standings: ${bits.join(', ')}`);
  }
  if (f.liveGame) {
    lines.push(`LIVE NOW: ${f.liveGame.homeAway === 'home' ? 'vs' : '@'} ${f.liveGame.opponentAbbr}, ${f.liveGame.teamScore}-${f.liveGame.opponentScore}, ${f.liveGame.statusDetail}`);
  }
  if (f.lastGame) {
    const res = f.lastGame.result ?? '?';
    lines.push(`last game: ${res} ${f.lastGame.teamScore}-${f.lastGame.opponentScore} ${f.lastGame.homeAway === 'home' ? 'vs' : '@'} ${f.lastGame.opponentAbbr} (${f.lastGame.date.slice(0, 10)})`);
  }
  if (f.nextGame) {
    lines.push(`next game: ${f.nextGame.homeAway === 'home' ? 'vs' : '@'} ${f.nextGame.opponentAbbr} at ${f.nextGame.date.slice(0, 16).replace('T', ' ')}`);
  }
  return lines.join('\n  ');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const feeds: TeamFeed[] = (body.feeds ?? []).filter((f: TeamFeed | null) => !!f);

  if (feeds.length === 0) {
    return NextResponse.json({ brief: [], storylines: {} });
  }

  // Cache key: summarizes the state that should cause a re-roll.
  // Change in live status, last game date, or next game date → re-roll.
  const cacheKey = feeds.map(f => [
    teamKey(f),
    f.liveGame?.id ?? '',
    f.lastGame?.date ?? '',
    f.nextGame?.date ?? '',
    f.team.record ?? '',
  ].join('|')).join(';');

  if (cached && cached.key === cacheKey && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  const teamSummaries = feeds.map(f => `- ${summarizeTeam(f)}`).join('\n\n');

  const prompt = `You are Rocky, David Ortiz's sports columnist. Write a tight daily Sports Desk brief for him.

Tone: confident, a little sharp, like a morning sports beat column. Specific names, real numbers, no hedging, no "it will be interesting to see." Short sentences when you can. This is a friend who watches his games, not a press release.

The teams David follows (with current state):

${teamSummaries}

Write:

1. BRIEF — 2 to 4 short paragraphs in David's voice.
   - Paragraph 1: what happened yesterday across his teams (last-game results). Skip teams that didn't play. Specific scores.
   - Paragraph 2: what's on tonight or in the next 24-48 hours. Who's pitching / key matchup angle. If nothing's happening, say so plainly ("quiet 48 hours — breathe, Monday night Heat vs Knicks is the next one worth caring about").
   - Paragraph 3 (optional): the week's bigger storyline — playoff race, rivalry coming up, slump or hot streak worth calling out.

2. STORYLINES — one or two sentences per team. For each team, a single tight narrative Rocky would keep running in his head. Reference standings, streaks, or the next big game. Key format MUST be "{league}-{teamId}" exactly as shown in the team summaries above.

Keep the whole thing under 250 words total across both sections.`;

  try {
    const { object } = await generateObject({
      model: 'anthropic/claude-sonnet-4.6',
      schema: BriefSchema,
      prompt,
    });
    cached = { at: Date.now(), key: cacheKey, data: { brief: object.brief, storylines: object.storylines } };
    return NextResponse.json({ brief: object.brief, storylines: object.storylines });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Brief generation failed' },
      { status: 500 },
    );
  }
}
