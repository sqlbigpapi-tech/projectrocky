import { Club } from './clubs';

export type GapStatus = 'tight' | 'good' | 'wide';

export type Gap = {
  from: Club;
  to: Club;
  yards: number;
  status: GapStatus;
};

const TIGHT_THRESHOLD = 8;
const WIDE_THRESHOLD = 18;

/**
 * Sort clubs longest-first, compute carry-distance gaps between adjacent clubs,
 * and classify each gap as tight / good / wide using universal thresholds.
 *
 * Note: the longest gap is usually Driver → 3 Wood (~25–30y) and will flag
 * as `wide`. That's expected — it's intentional bag design, not a problem.
 * The signal is in the iron/wedge gaps.
 */
export function analyzeGaps(clubs: Club[]): {
  sorted: Club[];
  gaps: Gap[];
  summary: { tight: number; wide: number };
} {
  const sorted = [...clubs].sort((a, b) => b.carry - a.carry);
  const gaps: Gap[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const yards = sorted[i].carry - sorted[i + 1].carry;
    gaps.push({
      from: sorted[i],
      to: sorted[i + 1],
      yards,
      status: yards < TIGHT_THRESHOLD ? 'tight' : yards > WIDE_THRESHOLD ? 'wide' : 'good',
    });
  }
  return {
    sorted,
    gaps,
    summary: {
      tight: gaps.filter(g => g.status === 'tight').length,
      wide: gaps.filter(g => g.status === 'wide').length,
    },
  };
}
