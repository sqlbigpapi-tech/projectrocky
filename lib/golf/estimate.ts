import { Club, parseLoft } from './clubs';

/**
 * Estimate carry distance for a new club at the given loft, using the
 * existing bag's loft → carry curve. Linear interpolation between the
 * two bracketing clubs; linear extrapolation outside the bag.
 */
export function estimateCarry(loftDeg: number, bag: Club[]): number {
  if (!Number.isFinite(loftDeg)) return 0;

  const points = bag
    .map(c => ({ loft: parseLoft(c.loft), carry: c.carry }))
    .filter(p => Number.isFinite(p.loft))
    .sort((a, b) => a.loft - b.loft);

  if (points.length === 0) return 150;
  if (points.length === 1) return points[0].carry;

  // Below smallest loft → extrapolate using first segment slope
  if (loftDeg <= points[0].loft) {
    const slope =
      (points[1].carry - points[0].carry) / (points[1].loft - points[0].loft);
    return Math.max(0, Math.round(points[0].carry + slope * (loftDeg - points[0].loft)));
  }
  // Above largest loft → extrapolate using last segment slope
  const last = points[points.length - 1];
  const second = points[points.length - 2];
  if (loftDeg >= last.loft) {
    const slope = (last.carry - second.carry) / (last.loft - second.loft);
    return Math.max(0, Math.round(last.carry + slope * (loftDeg - last.loft)));
  }
  // Within range → bracket and interpolate
  for (let i = 0; i < points.length - 1; i++) {
    if (loftDeg >= points[i].loft && loftDeg <= points[i + 1].loft) {
      const t = (loftDeg - points[i].loft) / (points[i + 1].loft - points[i].loft);
      return Math.round(points[i].carry + t * (points[i + 1].carry - points[i].carry));
    }
  }
  return points[Math.floor(points.length / 2)].carry;
}

/**
 * Estimate total (carry + roll) for a new club. Roll-out at a given loft is
 * approximated from the closest existing club's roll-out (total - carry).
 */
export function estimateTotal(loftDeg: number, carry: number, bag: Club[]): number {
  if (!Number.isFinite(loftDeg) || !Number.isFinite(carry)) return Math.round(carry);
  if (bag.length === 0) return Math.round(carry * 1.07);

  let closestRoll = bag[0].total - bag[0].carry;
  let minDiff = Math.abs(parseLoft(bag[0].loft) - loftDeg);
  for (const c of bag) {
    const d = Math.abs(parseLoft(c.loft) - loftDeg);
    if (d < minDiff) {
      minDiff = d;
      closestRoll = c.total - c.carry;
    }
  }
  return Math.max(Math.round(carry), Math.round(carry + closestRoll));
}
