import { Club, DAVID_CLUBS } from './clubs';

export type Recommendation = {
  /** The yardage being played (target distance + wind-adjusted yards) */
  effectiveDistance: number;
  /** Pick whose carry is closest to effectiveDistance */
  pick: Club;
  /** Next club up (more carry); null if pick is already the longest */
  up: Club | null;
  /** Next club down (less carry); null if pick is already the shortest */
  down: Club | null;
  /** Yards over/under target if user hits the picked club's carry exactly. Negative = short of target. */
  delta: number;
};

/**
 * Wind convention: positive `windMph` is tailwind (helps), negative is headwind (hurts).
 * 1 yard per mph adjustment. Hurts more in real life but the spec is 1:1.
 */
export function recommendClub(
  distance: number,
  windMph: number = 0,
  bag: Club[] = DAVID_CLUBS,
): Recommendation | null {
  if (!Number.isFinite(distance) || distance <= 0 || bag.length === 0) return null;

  const effectiveDistance = distance - windMph;

  // Sort by carry ascending so "up" / "down" map intuitively to longer / shorter clubs.
  const sorted = [...bag].sort((a, b) => a.carry - b.carry);

  // Find the index whose carry is closest to effectiveDistance.
  let bestIdx = 0;
  let bestDelta = Math.abs(sorted[0].carry - effectiveDistance);
  for (let i = 1; i < sorted.length; i++) {
    const d = Math.abs(sorted[i].carry - effectiveDistance);
    if (d < bestDelta) {
      bestIdx = i;
      bestDelta = d;
    }
  }

  const pick = sorted[bestIdx];
  const up = bestIdx < sorted.length - 1 ? sorted[bestIdx + 1] : null;
  const down = bestIdx > 0 ? sorted[bestIdx - 1] : null;

  return {
    effectiveDistance,
    pick,
    up,
    down,
    delta: pick.carry - effectiveDistance,
  };
}
