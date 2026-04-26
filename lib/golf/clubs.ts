export type Club = {
  club: string;
  loft: string;
  carry: number;
  total: number;
};

export const DAVID_CLUBS: Club[] = [
  { club: 'Driver',         loft: '10.5°', carry: 248, total: 275 },
  { club: '3 Wood',         loft: '15°',   carry: 220, total: 238 },
  { club: '2 Hybrid',       loft: '17°',   carry: 205, total: 220 },
  { club: '5 Iron',         loft: '22°',   carry: 188, total: 203 },
  { club: '6 Iron',         loft: '25°',   carry: 178, total: 195 },
  { club: '7 Iron',         loft: '28°',   carry: 172, total: 187 },
  { club: '8 Iron',         loft: '32.5°', carry: 162, total: 175 },
  { club: '9 Iron',         loft: '37°',   carry: 150, total: 162 },
  { club: 'Pitching Wedge', loft: '42°',   carry: 138, total: 148 },
  { club: 'Gap Wedge',      loft: '48°',   carry: 122, total: 130 },
  { club: '52° Wedge',      loft: '52°',   carry: 110, total: 117 },
  { club: '56° Wedge',      loft: '56°',   carry: 95,  total: 100 },
  { club: '60° Wedge',      loft: '60°',   carry: 75,  total: 80  },
];
