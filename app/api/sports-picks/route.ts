import { getSupabase } from '@/lib/supabase';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 45;

type GameInfo = {
  id: string;
  date: string;
  opponent: string;
  opponentAbbr: string;
  homeAway: string;
  statusDetail: string;
  venue: string;
};

type Standings = {
  divisionGB: string;
  leagueGB: string;
  record: string;
  streak: string;
};

type TeamFeed = {
  team: { id: string; name: string; abbr: string; league: string; record: string | null };
  liveGame: GameInfo | null;
  nextGame: GameInfo | null;
  upcoming?: GameInfo[];
  last5: ('W' | 'L')[];
  standings: Standings | null;
};

function easternDateStr(offsetDays = 0): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PickBatchSchema = z.object({
  picks: z.array(z.object({
    event_id: z.string(),
    picked_winner_abbr: z.string(),
    reasoning: z.string().describe('One tight sentence of reasoning. Reference a specific angle — form, matchup, home/away, pitcher, streak, injury. No filler.'),
    confidence: z.enum(['low', 'medium', 'high']),
  })),
});

type PickRow = {
  id: string;
  league: string;
  team_id: string;
  event_id: string;
  pick_date: string;
  game_date: string;
  picked_winner_abbr: string;
  picked_team_abbr: string;
  opponent_abbr: string;
  reasoning: string | null;
  confidence: string | null;
  result: 'win' | 'loss' | 'push' | null;
  actual_winner_abbr: string | null;
  final_score: string | null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const feeds: TeamFeed[] = (body.feeds ?? []).filter((f: TeamFeed | null) => !!f);

  const db = getSupabase();
  const baseUrl = new URL(request.url).origin;
  const todayET = easternDateStr(0);

  // --- GRADE: find ungraded picks where the game is in the past ---
  const { data: pending } = await db
    .from('sports_picks')
    .select('*')
    .is('result', null)
    .lt('game_date', todayET);

  if (pending && pending.length > 0) {
    const gradeResults = await Promise.all(pending.map(async (p: PickRow) => {
      const leagueLower = p.league.toLowerCase();
      const sport =
        leagueLower === 'nfl' || leagueLower === 'ncaaf' || leagueLower === 'college-football' ? 'football'
          : leagueLower === 'nba' ? 'basketball'
          : leagueLower === 'mlb' ? 'baseball'
          : 'football';
      const apiLeague = leagueLower === 'ncaaf' ? 'college-football' : leagueLower;
      try {
        const res = await fetch(`${baseUrl}/api/game-summary?sport=${sport}&league=${apiLeague}&eventId=${p.event_id}`);
        if (!res.ok) return null;
        const s = await res.json();
        if (s.state !== 'post') return null;
        const homeScore = Number(s.home?.score ?? 0);
        const awayScore = Number(s.away?.score ?? 0);
        let winnerAbbr: string | null = null;
        if (homeScore > awayScore) winnerAbbr = s.home?.abbr ?? null;
        else if (awayScore > homeScore) winnerAbbr = s.away?.abbr ?? null;
        const result: 'win' | 'loss' | 'push' = !winnerAbbr
          ? 'push'
          : winnerAbbr === p.picked_winner_abbr ? 'win' : 'loss';
        return {
          id: p.id,
          result,
          actual_winner_abbr: winnerAbbr,
          final_score: `${awayScore}-${homeScore}`,
        };
      } catch {
        return null;
      }
    }));
    const toUpdate = gradeResults.filter((g): g is NonNullable<typeof g> => !!g);
    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map(u =>
        db.from('sports_picks').update({
          result: u.result,
          actual_winner_abbr: u.actual_winner_abbr,
          final_score: u.final_score,
          updated_at: new Date().toISOString(),
        }).eq('id', u.id)
      ));
    }
  }

  // --- GENERATE: today's games without existing picks ---
  type Candidate = { feed: TeamFeed; game: GameInfo };
  const candidates: Candidate[] = [];
  for (const f of feeds) {
    const games = [f.liveGame, f.nextGame, ...(f.upcoming ?? [])].filter((g): g is GameInfo => !!g);
    for (const g of games) {
      if (g.date.slice(0, 10) === todayET && !candidates.find(c => c.game.id === g.id)) {
        candidates.push({ feed: f, game: g });
      }
    }
  }

  if (candidates.length > 0) {
    // Which of these already have picks?
    const eventIds = candidates.map(c => c.game.id);
    const { data: existing } = await db
      .from('sports_picks')
      .select('event_id')
      .in('event_id', eventIds);
    const existingIds = new Set((existing ?? []).map((p: { event_id: string }) => p.event_id));
    const toGenerate = candidates.filter(c => !existingIds.has(c.game.id));

    if (toGenerate.length > 0) {
      const gamesDesc = toGenerate.map(c => {
        const f = c.feed;
        const g = c.game;
        const bits: string[] = [
          `event_id: ${g.id}`,
          `${f.team.abbr} (${f.team.record ?? 'N/A'}${f.last5.length ? `, last 5: ${f.last5.join(' ')}` : ''}) ${g.homeAway === 'home' ? 'vs' : '@'} ${g.opponentAbbr}`,
          `league: ${f.team.league}`,
          `venue: ${g.venue || 'unknown'}`,
        ];
        if (f.standings?.streak) bits.push(`streak: ${f.standings.streak}`);
        if (f.standings?.record) bits.push(`standings: ${f.standings.record}`);
        return bits.map(b => `  ${b}`).join('\n');
      }).join('\n\n');

      const prompt = `You are Rocky, David Ortiz's sports columnist. Pick a winner for each of these games today. For each game, return:
- event_id (MUST match exactly)
- picked_winner_abbr: the team abbreviation you think wins. Must be either David's team's abbr OR the opponent abbr shown.
- reasoning: ONE tight sentence citing a specific angle (form, home/away, pitcher, streak, matchup edge). No filler, no "could be interesting".
- confidence: low/medium/high.

Games:

${gamesDesc}

Be decisive — Rocky has an opinion on every game.`;

      try {
        const { object } = await generateObject({
          model: 'anthropic/claude-sonnet-4.6',
          schema: PickBatchSchema,
          prompt,
        });

        const rows = toGenerate.map(c => {
          const p = object.picks.find(x => x.event_id === c.game.id);
          if (!p) return null;
          return {
            league: c.feed.team.league.toLowerCase(),
            team_id: c.feed.team.id,
            event_id: c.game.id,
            pick_date: todayET,
            game_date: c.game.date.slice(0, 10),
            picked_winner_abbr: p.picked_winner_abbr,
            picked_team_abbr: c.feed.team.abbr,
            opponent_abbr: c.game.opponentAbbr,
            reasoning: p.reasoning,
            confidence: p.confidence,
          };
        }).filter((r): r is NonNullable<typeof r> => !!r);

        if (rows.length > 0) {
          await db.from('sports_picks').insert(rows);
        }
      } catch (err) {
        console.error('Pick generation failed:', err);
      }
    }
  }

  // --- RETURN: today + recent 30 days of picks, and running record ---
  const historyStart = easternDateStr(-30);
  const { data: recent } = await db
    .from('sports_picks')
    .select('*')
    .gte('game_date', historyStart)
    .order('game_date', { ascending: false });
  const picks = (recent ?? []) as PickRow[];

  const today = picks.filter(p => p.game_date === todayET);
  const graded = picks.filter(p => p.result !== null);
  const wins = graded.filter(p => p.result === 'win').length;
  const losses = graded.filter(p => p.result === 'loss').length;
  const pushes = graded.filter(p => p.result === 'push').length;

  // Last 7 days record
  const sevenDayStart = easternDateStr(-7);
  const last7 = graded.filter(p => p.game_date >= sevenDayStart);
  const last7Wins = last7.filter(p => p.result === 'win').length;
  const last7Losses = last7.filter(p => p.result === 'loss').length;

  return NextResponse.json({
    today,
    recent: picks.slice(0, 20),
    record: {
      wins, losses, pushes,
      total: wins + losses + pushes,
      pct: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
      last7: { wins: last7Wins, losses: last7Losses },
    },
  });
}
