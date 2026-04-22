import { NextResponse } from 'next/server';

type Competitor = {
  id: string;
  abbr: string;
  name: string;
  logo: string;
  score: string;
  homeAway: 'home' | 'away';
  color: string | null;
};

type ScoringPlay = {
  period: number;
  clock: string;
  teamAbbr: string;
  text: string;
  homeScore: string;
  awayScore: string;
};

type LeaderPlayer = {
  name: string;
  stat: string;
  teamAbbr: string;
};

type LeaderCategory = {
  category: string;
  players: LeaderPlayer[];
};

type WinProbPoint = {
  play: number;
  homePct: number;
};

type LineScore = {
  periods: number;              // e.g. 9 for MLB, 4 for NBA/NFL
  periodLabels: string[];       // ["1","2",...,"9"] or ["1","2","3","4"]
  home: string[];               // scores per period, "" for not yet played
  away: string[];
  totals: { home: string; away: string };
  // MLB extras shown after totals
  extras?: { label: string; home: string; away: string }[];
};

type TeamStatLine = {
  label: string;
  home: string;
  away: string;
};

type MLBSituation = {
  balls: number;
  strikes: number;
  outs: number;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  batter: string | null;
  pitcher: string | null;
  lastPlay: string | null;
};

function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object' && val !== null) {
    const o = val as { displayValue?: unknown; value?: unknown };
    if (o.displayValue !== undefined) return String(o.displayValue);
    if (o.value !== undefined) return String(o.value);
  }
  return '';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport');
  const league = searchParams.get('league');
  const eventId = searchParams.get('eventId');

  if (!sport || !league || !eventId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      return NextResponse.json({ error: `ESPN ${res.status}` }, { status: 502 });
    }
    const data = await res.json();

    const header = data.header ?? {};
    const competition = header.competitions?.[0] ?? {};
    const status = competition.status?.type ?? {};
    const comps: any[] = competition.competitors ?? [];

    const parseCompetitor = (c: any): Competitor => ({
      id: str(c?.team?.id),
      abbr: str(c?.team?.abbreviation),
      name: str(c?.team?.displayName),
      logo: str(c?.team?.logos?.[0]?.href),
      score: str(c?.score),
      homeAway: c?.homeAway === 'home' ? 'home' : 'away',
      color: str(c?.team?.color) || null,
    });

    const home = comps.find((c: any) => c.homeAway === 'home');
    const away = comps.find((c: any) => c.homeAway === 'away');
    const homeTeam = home ? parseCompetitor(home) : null;
    const awayTeam = away ? parseCompetitor(away) : null;

    const scoringPlaysRaw: any[] = data.scoringPlays ?? [];
    const scoringPlays: ScoringPlay[] = scoringPlaysRaw.map(p => ({
      period: Number(p?.period?.number ?? 0),
      clock: str(p?.clock?.displayValue),
      teamAbbr: str(p?.team?.abbreviation),
      text: str(p?.text),
      homeScore: str(p?.homeScore),
      awayScore: str(p?.awayScore),
    }));

    // Leaders come in different shapes per sport; normalize to the team-grouped form
    const leaders: LeaderCategory[] = [];
    const leadersRaw: any[] = data.leaders ?? [];
    // shape: [ { team: {abbr}, leaders: [ { displayName: "Hits", leaders: [{ athlete:{displayName}, displayValue }] } ] } ]
    const byCategory: Record<string, LeaderPlayer[]> = {};
    for (const teamBlock of leadersRaw) {
      const abbr = str(teamBlock?.team?.abbreviation);
      for (const cat of (teamBlock?.leaders ?? [])) {
        const catName = str(cat?.displayName) || str(cat?.name);
        if (!catName) continue;
        const top = cat?.leaders?.[0];
        if (!top) continue;
        const player: LeaderPlayer = {
          name: str(top?.athlete?.displayName),
          stat: str(top?.displayValue),
          teamAbbr: abbr,
        };
        if (!byCategory[catName]) byCategory[catName] = [];
        byCategory[catName].push(player);
      }
    }
    for (const [category, players] of Object.entries(byCategory)) {
      leaders.push({ category, players });
    }

    // Win probability — available for NFL, NBA, MLB via data.winprobability
    const wpRaw: any[] = data.winprobability ?? [];
    const winProbability: WinProbPoint[] = wpRaw.map((p, i) => ({
      play: i,
      homePct: Number(p?.homeWinPercentage ?? 0),
    }));

    const venue = str(competition.venue?.fullName);
    const dateStr = str(competition.date ?? header.date);

    // Linescore — pulled from boxscore.teams[].linescores or header competitors[].linescores
    const boxscoreTeams: any[] = data.boxscore?.teams ?? [];
    const homeBoxTeam = boxscoreTeams.find((t: any) => t?.homeAway === 'home' || t?.team?.id === homeTeam?.id);
    const awayBoxTeam = boxscoreTeams.find((t: any) => t?.homeAway === 'away' || t?.team?.id === awayTeam?.id);

    const homeLines: any[] = home?.linescores ?? homeBoxTeam?.linescores ?? [];
    const awayLines: any[] = away?.linescores ?? awayBoxTeam?.linescores ?? [];
    let linescore: LineScore | null = null;
    if (homeLines.length > 0 || awayLines.length > 0) {
      const periods = Math.max(homeLines.length, awayLines.length);
      const minPeriods = league === 'mlb' ? 9 : league === 'nba' ? 4 : league === 'nfl' || league === 'college-football' ? 4 : periods;
      const totalPeriods = Math.max(periods, minPeriods);
      const periodLabels = Array.from({ length: totalPeriods }, (_, i) => {
        if (league === 'nba' || league === 'nfl' || league === 'college-football') {
          if (i < 4) return `Q${i + 1}`;
          return `OT${i - 3 > 1 ? i - 3 : ''}`.trim();
        }
        return String(i + 1);
      });
      const scoreAt = (arr: any[], i: number) => i < arr.length ? str(arr[i]?.value ?? arr[i]?.displayValue) : '';
      linescore = {
        periods: totalPeriods,
        periodLabels,
        home: Array.from({ length: totalPeriods }, (_, i) => scoreAt(homeLines, i)),
        away: Array.from({ length: totalPeriods }, (_, i) => scoreAt(awayLines, i)),
        totals: { home: homeTeam?.score ?? '', away: awayTeam?.score ?? '' },
      };
      // MLB Hits + Errors beside the inning totals
      if (league === 'mlb') {
        const getStat = (team: any, name: string): string => {
          const stats: any[] = team?.statistics ?? [];
          const found = stats.find((s: any) => s?.name === name || s?.abbreviation === name);
          return str(found?.displayValue);
        };
        const hHome = getStat(homeBoxTeam, 'hits');
        const hAway = getStat(awayBoxTeam, 'hits');
        const eHome = getStat(homeBoxTeam, 'errors');
        const eAway = getStat(awayBoxTeam, 'errors');
        if (hHome || hAway || eHome || eAway) {
          linescore.extras = [
            { label: 'H', home: hHome, away: hAway },
            { label: 'E', home: eHome, away: eAway },
          ];
        }
      }
    }

    // Team stats — side-by-side compare, whatever ESPN gives us for this sport
    const teamStats: TeamStatLine[] = [];
    const homeStats: any[] = homeBoxTeam?.statistics ?? [];
    const awayStats: any[] = awayBoxTeam?.statistics ?? [];
    const statByName = (arr: any[]) => {
      const m: Record<string, { label: string; value: string }> = {};
      for (const s of arr) {
        const name = str(s?.name) || str(s?.abbreviation);
        if (!name) continue;
        m[name] = { label: str(s?.label ?? s?.displayName) || name, value: str(s?.displayValue) };
      }
      return m;
    };
    const homeMap = statByName(homeStats);
    const awayMap = statByName(awayStats);
    const statKeys = Array.from(new Set([...Object.keys(homeMap), ...Object.keys(awayMap)]));
    // Drop H/E for MLB since those already show next to the linescore
    const drop = league === 'mlb' ? new Set(['hits', 'errors', 'runs']) : new Set<string>();
    for (const key of statKeys) {
      if (drop.has(key)) continue;
      const h = homeMap[key];
      const a = awayMap[key];
      const label = h?.label ?? a?.label ?? key;
      const home = h?.value ?? '';
      const away = a?.value ?? '';
      if (!home && !away) continue;
      teamStats.push({ label, home, away });
    }

    // MLB live situation — bases/count/outs (only when state === 'in')
    let situation: MLBSituation | null = null;
    if (league === 'mlb' && str(status.state) === 'in') {
      const sit = competition.situation ?? data.situation ?? null;
      if (sit) {
        situation = {
          balls: Number(sit.balls ?? 0),
          strikes: Number(sit.strikes ?? 0),
          outs: Number(sit.outs ?? 0),
          onFirst: Boolean(sit.onFirst),
          onSecond: Boolean(sit.onSecond),
          onThird: Boolean(sit.onThird),
          batter: str(sit.batter?.athlete?.displayName ?? sit.batter?.athlete?.shortName) || null,
          pitcher: str(sit.pitcher?.athlete?.displayName ?? sit.pitcher?.athlete?.shortName) || null,
          lastPlay: str(sit.lastPlay?.text) || null,
        };
      }
    }

    return NextResponse.json({
      eventId,
      state: str(status.state),          // pre | in | post
      statusDetail: str(status.shortDetail),
      statusFull: str(status.detail),
      period: Number(status.period ?? 0),
      clock: str(status.displayClock ?? competition.status?.displayClock),
      home: homeTeam,
      away: awayTeam,
      venue,
      date: dateStr,
      linescore,
      teamStats,
      situation,
      scoringPlays,
      leaders,
      winProbability,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch game summary' },
      { status: 500 },
    );
  }
}
