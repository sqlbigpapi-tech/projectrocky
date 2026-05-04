export type Club = {
  /** DB row id, undefined for unsaved/seed entries */
  id?: string;
  /** ordering in the bag, lower = first row */
  position: number;
  club: string;
  /** keep as a string so "10.5°" / "32.5°" round-trip cleanly */
  loft: string;
  carry: number;
  total: number;
  model: string;
  /** Public URL to a product photo (Supabase Storage). Falls back to category icon. */
  image?: string | null;
};

// Default bag (seed). Iron + wedge specs from Club Champion fitting,
// SO# 2511653, 07/28/2025: all Mizuno/Vokey clubs are on Accra iSeries
// Steel Iron 115g shafts, Winn Dri-Tac 2.0 grips, +1° upright,
// swingweights D1 (irons) → D4 (60°).
export const DAVID_CLUBS: Club[] = [
  { position:  0, club: 'Driver',         loft: '9°',    carry: 248, total: 275, model: 'TaylorMade Qi4D LS' },
  { position:  1, club: '3 Wood',         loft: '15°',   carry: 240, total: 262, model: 'TaylorMade Qi4D' },
  { position:  2, club: '2 Hybrid',       loft: '17°',   carry: 218, total: 240, model: 'TaylorMade Qi4D' },
  { position:  3, club: '5 Iron',         loft: '22°',   carry: 188, total: 203, model: 'Mizuno JPX-925 Hot Metal Pro' },
  { position:  4, club: '6 Iron',         loft: '25°',   carry: 178, total: 195, model: 'Mizuno JPX-925 Hot Metal Pro' },
  { position:  5, club: '7 Iron',         loft: '28°',   carry: 172, total: 187, model: 'Mizuno JPX-925 Hot Metal Pro' },
  { position:  6, club: '8 Iron',         loft: '32.5°', carry: 162, total: 175, model: 'Mizuno JPX-925 Hot Metal Pro' },
  { position:  7, club: '9 Iron',         loft: '37°',   carry: 150, total: 162, model: 'Mizuno JPX-925 Hot Metal Pro' },
  { position:  8, club: 'Pitching Wedge', loft: '42°',   carry: 138, total: 148, model: 'Mizuno JPX-925 Hot Metal Pro' },
  { position:  9, club: 'Gap Wedge',      loft: '48°',   carry: 122, total: 130, model: 'Mizuno JPX-925 Hot Metal Pro' },
  { position: 10, club: '52° Wedge',      loft: '52°',   carry: 110, total: 117, model: 'Titleist Vokey SM10 Nickel · 52.08 F' },
  { position: 11, club: '56° Wedge',      loft: '56°',   carry: 95,  total: 100, model: 'Titleist Vokey SM10 Nickel · 56.10 S' },
  { position: 12, club: '60° Wedge',      loft: '60°',   carry: 75,  total: 80,  model: 'Titleist Vokey SM10 Nickel · 60.12 D' },
];

/** Parse "10.5°" / "32.5°" / "60" → 10.5 / 32.5 / 60. Returns NaN if unparseable. */
export function parseLoft(s: string): number {
  return parseFloat(s.replace(/[^0-9.\-]/g, ''));
}
