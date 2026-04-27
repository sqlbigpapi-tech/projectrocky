type Category = 'driver' | 'wood' | 'hybrid' | 'iron' | 'wedge';

export function categoryFor(clubName: string): Category {
  const n = clubName.toLowerCase();
  if (n.includes('driver')) return 'driver';
  if (n.includes('wood')) return 'wood';
  if (n.includes('hybrid') || n.includes('rescue')) return 'hybrid';
  if (n.includes('wedge') || /^\d+°/.test(n)) return 'wedge';
  if (n.includes('iron')) return 'iron';
  return 'iron';
}

/** Stylized side-view silhouettes — recognizable, not photoreal. */
export default function ClubIcon({ category, className = 'w-9 h-9' }: { category: Category; className?: string }) {
  const stroke = '#52525b'; // zinc-600
  const fill = '#27272a';   // zinc-800
  const accent = '#3f3f46'; // zinc-700
  switch (category) {
    case 'driver':
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none">
          <path d="M30 24c0 4-5 7-12 7-5 0-9-2-9-5 0-4 5-8 12-8 5 0 9 2 9 6z" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <path d="M30 24l5-15" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <ellipse cx="14" cy="25" rx="3" ry="1.5" fill={accent} />
        </svg>
      );
    case 'wood':
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none">
          <path d="M28 25c0 3-4 5-9 5-4 0-7-2-7-4 0-3 4-6 9-6 4 0 7 2 7 5z" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <path d="M28 25l5-15" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'hybrid':
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none">
          <path d="M27 26c0 2.5-3.5 4-7.5 4-3.5 0-6-1.5-6-3.5 0-2.5 3.5-5 7.5-5 3.5 0 6 2 6 4.5z" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <path d="M27 26l4-15" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'iron':
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none">
          <path d="M11 30l3-2 4-1 9-2 5-13" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 28l8-2 4-9-9 2-4 9z" fill={fill} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'wedge':
      return (
        <svg viewBox="0 0 40 40" className={className} fill="none">
          <path d="M11 31l4-1 5-1 8-2 4-15" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 30l9-2 4-11-10 2-4 11h1z" fill={fill} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
  }
}
