import { NextResponse } from 'next/server';

const ICS_URL = process.env.OUTLOOK_ICS_URL;

type CalEvent = {
  summary: string;
  start: string;      // ISO string
  end: string;        // ISO string
  location: string;
  isAllDay: boolean;
};

function parseICS(text: string, targetDate: string): CalEvent[] {
  const events: CalEvent[] = [];
  const blocks = text.split('BEGIN:VEVENT');

  // Parse timezone offsets from VTIMEZONE blocks
  // For simplicity, we handle Eastern Standard Time / Eastern Daylight Time
  const now = new Date();
  const isEDT = isDST(now);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    if (!block) continue;

    const get = (key: string): string => {
      const regex = new RegExp(`^${key}[;:](.*)$`, 'm');
      const match = block.match(regex);
      return match?.[1]?.trim() ?? '';
    };

    const summary = get('SUMMARY');
    const location = get('LOCATION');
    const dtStartRaw = get('DTSTART');
    const dtEndRaw = get('DTEND');
    const status = get('STATUS');

    if (status === 'CANCELLED') continue;

    // Parse date/time
    const startInfo = parseDT(dtStartRaw, block, isEDT);
    const endInfo = parseDT(dtEndRaw, block, isEDT);

    if (!startInfo) continue;

    // Check if event falls on target date
    const startLocal = new Date(startInfo.iso);
    const startDateStr = `${startLocal.getFullYear()}-${String(startLocal.getMonth() + 1).padStart(2, '0')}-${String(startLocal.getDate()).padStart(2, '0')}`;

    // For all-day events, the DTSTART is just a date
    const isAllDay = startInfo.allDay;

    if (isAllDay) {
      // All-day: DTSTART;VALUE=DATE:20260413
      const dateOnly = dtStartRaw.replace('VALUE=DATE:', '');
      const formatted = `${dateOnly.slice(0, 4)}-${dateOnly.slice(4, 6)}-${dateOnly.slice(6, 8)}`;
      if (formatted !== targetDate) continue;
    } else {
      if (startDateStr !== targetDate) continue;
    }

    events.push({
      summary,
      start: startInfo.iso,
      end: endInfo?.iso ?? startInfo.iso,
      location,
      isAllDay,
    });
  }

  // Sort by start time, all-day events first
  events.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return a.start.localeCompare(b.start);
  });

  return events;
}

function isDST(date: Date): boolean {
  // US DST: 2nd Sunday of March to 1st Sunday of November
  const year = date.getFullYear();
  const mar = new Date(year, 2, 1); // March 1
  const marchSecondSunday = new Date(year, 2, 8 + (7 - mar.getDay()) % 7, 2); // 2 AM
  const nov = new Date(year, 10, 1); // November 1
  const novFirstSunday = new Date(year, 10, 1 + (7 - nov.getDay()) % 7, 2); // 2 AM
  return date >= marchSecondSunday && date < novFirstSunday;
}

function parseDT(raw: string, block: string, isEDT: boolean): { iso: string; allDay: boolean } | null {
  if (!raw) return null;

  // All-day: VALUE=DATE:20260413
  if (raw.includes('VALUE=DATE:')) {
    const d = raw.split(':').pop() ?? '';
    return { iso: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00`, allDay: true };
  }

  // With timezone: TZID=Eastern Standard Time:20260413T093000
  const tzMatch = raw.match(/TZID=([^:]+):(\d{8}T\d{6})/);
  if (tzMatch) {
    const [, tz, dt] = tzMatch;
    const base = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T${dt.slice(9, 11)}:${dt.slice(11, 13)}:${dt.slice(13, 15)}`;

    // Append timezone offset so browsers parse it correctly
    const isEastern = tz.includes('Eastern');
    const isCentral = tz.includes('Central');
    const isMountain = tz.includes('Mountain');
    const isPacific = tz.includes('Pacific');
    let offset = isEDT ? '-04:00' : '-05:00'; // default Eastern
    if (isCentral) offset = isEDT ? '-05:00' : '-06:00';
    if (isMountain) offset = isEDT ? '-06:00' : '-07:00';
    if (isPacific) offset = isEDT ? '-07:00' : '-08:00';
    if (isEastern || isCentral || isMountain || isPacific) {
      return { iso: base + offset, allDay: false };
    }
    return { iso: base, allDay: false };
  }

  // UTC: 20260413T130000Z
  const utcMatch = raw.match(/(\d{8}T\d{6})Z/);
  if (utcMatch) {
    const dt = utcMatch[1];
    const utcDate = new Date(`${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T${dt.slice(9, 11)}:${dt.slice(11, 13)}:${dt.slice(13, 15)}Z`);
    // Convert to Eastern
    const offset = isEDT ? -4 : -5;
    const eastern = new Date(utcDate.getTime() + offset * 3600000);
    const iso = eastern.toISOString().slice(0, 19);
    return { iso, allDay: false };
  }

  // Plain: 20260413T093000
  const plainMatch = raw.match(/(\d{8}T\d{6})/);
  if (plainMatch) {
    const dt = plainMatch[1];
    const iso = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T${dt.slice(9, 11)}:${dt.slice(11, 13)}:${dt.slice(13, 15)}`;
    return { iso, allDay: false };
  }

  return null;
}

// In-memory cache for the raw ICS text — survives across requests on the same function instance (Fluid Compute)
let icsCache: { text: string; fetchedAt: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function getICSText(): Promise<string | null> {
  if (icsCache && Date.now() - icsCache.fetchedAt < CACHE_TTL) {
    return icsCache.text;
  }

  if (!ICS_URL) return null;
  const res = await fetch(ICS_URL);
  if (!res.ok) return icsCache?.text ?? null; // return stale on error
  const text = await res.text();
  icsCache = { text, fetchedAt: Date.now() };
  return text;
}

export async function GET(request: Request) {
  if (!ICS_URL) {
    return NextResponse.json({ error: 'No calendar URL configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const defaultDate = `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;
  const date = searchParams.get('date') ?? defaultDate;

  try {
    const text = await getICSText();
    if (!text) return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 502 });

    const events = parseICS(text, date);
    return NextResponse.json({ date, events, count: events.length });
  } catch (err) {
    return NextResponse.json({ error: 'Calendar fetch failed' }, { status: 500 });
  }
}
