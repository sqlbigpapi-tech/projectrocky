import { NextResponse } from 'next/server';

export type GolfPlayer = {
  position: string;
  name: string;
  score: string;
  today: string;
  rounds: string[];  // per-round to-par strings: ["-7", "-2", "-2", "-"]
};

export type GolfData = {
  tournament: string;
  shortName: string;
  status: 'live' | 'final' | 'upcoming';
  statusDetail: string;
  currentRound: number;
  players: GolfPlayer[];
};

function assignPositions(players: { score: string; position: string }[]) {
  let i = 0;
  while (i < players.length) {
    const score = players[i].score;
    let j = i;
    while (j < players.length && players[j].score === score) j++;
    const label = j - i > 1 ? `T${i + 1}` : String(i + 1);
    for (let k = i; k < j; k++) players[k].position = label;
    i = j;
  }
}

export async function GET() {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard',
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return NextResponse.json({ error: 'Golf data unavailable' }, { status: 500 });

    const data = await res.json();
    const events: unknown[] = data.events ?? [];
    if (events.length === 0) return NextResponse.json({ error: 'No events' }, { status: 404 });

    // Prefer in-progress event, then most recent post, then first upcoming
    const asEvent = (e: unknown) => e as {
      name: string;
      shortName: string;
      status: { period: number; type: { state: string; shortDetail: string } };
      competitions: {
        status: { period: number; type: { state: string; shortDetail: string } };
        competitors: {
          order: number;
          score: string;
          athlete: { displayName: string };
          linescores: { displayValue: string; period: number }[];
        }[];
      }[];
    };

    const sorted = [...events].sort((a, b) => {
      const stateOrder = { in: 0, post: 1, pre: 2 };
      const sa = asEvent(a).competitions?.[0]?.status?.type?.state ?? 'pre';
      const sb = asEvent(b).competitions?.[0]?.status?.type?.state ?? 'pre';
      return (stateOrder[sa as keyof typeof stateOrder] ?? 2) -
             (stateOrder[sb as keyof typeof stateOrder] ?? 2);
    });

    const event = asEvent(sorted[0]);
    const comp = event.competitions?.[0];
    if (!comp) return NextResponse.json({ error: 'No competition data' }, { status: 404 });

    const state = comp.status?.type?.state ?? 'pre';
    const currentRound = comp.status?.period ?? 1;

    const raw = (comp.competitors ?? [])
      .sort((a, b) => a.order - b.order)
      .slice(0, 20)
      .map(p => {
        const rounds = (p.linescores ?? [])
          .sort((a, b) => a.period - b.period)
          .map(ls => ls.displayValue ?? '-');

        // Today = the linescore for the current round
        const todayLs = p.linescores?.find(ls => ls.period === currentRound);
        const today = todayLs?.displayValue ?? '-';

        return {
          position: '',
          name: p.athlete?.displayName ?? 'Unknown',
          score: p.score ?? 'E',
          today,
          rounds,
        };
      });

    assignPositions(raw);

    const result: GolfData = {
      tournament: event.name ?? 'PGA Tour',
      shortName: event.shortName ?? '',
      status: state === 'in' ? 'live' : state === 'post' ? 'final' : 'upcoming',
      statusDetail: comp.status?.type?.shortDetail ?? '',
      currentRound,
      players: raw,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Golf data unavailable' }, { status: 500 });
  }
}
