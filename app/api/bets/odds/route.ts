import { NextResponse } from 'next/server';

const SPORTS_IN_SEASON = [
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'baseball_mlb',   label: 'MLB' },
];

type OddsApiOutcome = { name: string; price: number; point?: number };
type OddsApiMarket = { key: string; outcomes: OddsApiOutcome[] };
type OddsApiBookmaker = { key: string; title: string; markets: OddsApiMarket[] };
type OddsApiGame = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
};

export type GameLines = {
  id: string;
  sport: string;
  startsAt: string;
  home: string;
  away: string;
  /** Best (most favorable to a bettor) line per market+side, with the book that has it */
  bestLines: {
    moneyline?: { home: { price: number; book: string }; away: { price: number; book: string } };
    spread?:    { home: { price: number; point: number; book: string }; away: { price: number; point: number; book: string } };
    total?:     { over: { price: number; point: number; book: string }; under: { price: number; point: number; book: string } };
  };
  bookCount: number;
};

function pickBestPriceOnly(games: OddsApiGame[]): GameLines[] {
  return games.map(g => {
    const result: GameLines = {
      id: g.id,
      sport: g.sport_title,
      startsAt: g.commence_time,
      home: g.home_team,
      away: g.away_team,
      bestLines: {},
      bookCount: g.bookmakers.length,
    };
    for (const bm of g.bookmakers) {
      for (const mkt of bm.markets) {
        if (mkt.key === 'h2h') {
          const home = mkt.outcomes.find(o => o.name === g.home_team);
          const away = mkt.outcomes.find(o => o.name === g.away_team);
          if (home && away) {
            const cur = result.bestLines.moneyline;
            if (!cur || home.price > cur.home.price) {
              result.bestLines.moneyline = result.bestLines.moneyline ?? { home: { price: home.price, book: bm.title }, away: { price: away.price, book: bm.title } };
              if (!cur || home.price > cur.home.price) result.bestLines.moneyline!.home = { price: home.price, book: bm.title };
              if (!cur || away.price > cur.away.price) result.bestLines.moneyline!.away = { price: away.price, book: bm.title };
            }
          }
        } else if (mkt.key === 'spreads') {
          const home = mkt.outcomes.find(o => o.name === g.home_team);
          const away = mkt.outcomes.find(o => o.name === g.away_team);
          if (home?.point != null && away?.point != null) {
            const cur = result.bestLines.spread;
            if (!cur) {
              result.bestLines.spread = {
                home: { price: home.price, point: home.point, book: bm.title },
                away: { price: away.price, point: away.point, book: bm.title },
              };
            } else {
              if (home.price > cur.home.price) result.bestLines.spread!.home = { price: home.price, point: home.point, book: bm.title };
              if (away.price > cur.away.price) result.bestLines.spread!.away = { price: away.price, point: away.point, book: bm.title };
            }
          }
        } else if (mkt.key === 'totals') {
          const over = mkt.outcomes.find(o => o.name === 'Over');
          const under = mkt.outcomes.find(o => o.name === 'Under');
          if (over?.point != null && under?.point != null) {
            const cur = result.bestLines.total;
            if (!cur) {
              result.bestLines.total = {
                over: { price: over.price, point: over.point, book: bm.title },
                under: { price: under.price, point: under.point, book: bm.title },
              };
            } else {
              if (over.price > cur.over.price) result.bestLines.total!.over = { price: over.price, point: over.point, book: bm.title };
              if (under.price > cur.under.price) result.bestLines.total!.under = { price: under.price, point: under.point, book: bm.title };
            }
          }
        }
      }
    }
    return result;
  });
}

export async function GET() {
  const key = process.env.THE_ODDS_API_KEY;
  if (!key) return NextResponse.json({ error: 'THE_ODDS_API_KEY not set' }, { status: 500 });

  try {
    const allGames: GameLines[] = [];
    let creditsUsed = 0;
    let creditsRemaining: string | null = null;

    for (const sport of SPORTS_IN_SEASON) {
      const url = `https://api.the-odds-api.com/v4/sports/${sport.key}/odds?apiKey=${key}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`;
      const r = await fetch(url, { next: { revalidate: 1800 } }); // 30-minute cache
      if (!r.ok) continue;
      const data: OddsApiGame[] = await r.json();
      creditsUsed += Number(r.headers.get('x-requests-used') ?? 0);
      creditsRemaining = r.headers.get('x-requests-remaining');
      const parsed = pickBestPriceOnly(data);
      // Only include games starting within the next 36 hours so we don't show stale schedule
      const cutoff = Date.now() + 36 * 3600 * 1000;
      allGames.push(...parsed.filter(g => new Date(g.startsAt).getTime() < cutoff));
    }

    allGames.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return NextResponse.json({ games: allGames, creditsUsed, creditsRemaining });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
