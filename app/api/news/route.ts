import { NextResponse } from 'next/server';

export type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category: string;
};

const FEEDS = [
  // Sports
  {
    url: 'https://news.google.com/rss/search?q=New+York+Mets+baseball&hl=en-US&gl=US&ceid=US:en',
    category: 'Mets',
    defaultSource: 'Google News',
  },
  {
    url: 'https://news.google.com/rss/search?q=New+York+Giants+NFL+football&hl=en-US&gl=US&ceid=US:en',
    category: 'Giants',
    defaultSource: 'Google News',
  },
  {
    url: 'https://news.google.com/rss/search?q=New+York+Knicks+NBA+basketball&hl=en-US&gl=US&ceid=US:en',
    category: 'Knicks',
    defaultSource: 'Google News',
  },
  // Business & Consulting
  {
    url: 'https://hbr.org/rss/feed',
    category: 'Business',
    defaultSource: 'Harvard Business Review',
  },
  {
    url: 'https://www.fastcompany.com/latest/rss',
    category: 'Business',
    defaultSource: 'Fast Company',
  },
  // Tech & AI
  {
    url: 'https://techcrunch.com/feed/',
    category: 'Tech & AI',
    defaultSource: 'TechCrunch',
  },
  {
    url: 'https://www.wired.com/feed/rss',
    category: 'Tech & AI',
    defaultSource: 'WIRED',
  },
  // South Florida
  {
    url: 'https://news.google.com/rss/search?q=south+florida+miami+local+news&hl=en-US&gl=US&ceid=US:en',
    category: 'South Florida',
    defaultSource: 'Google News',
  },
];

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function extractTag(block: string, tag: string): string {
  // CDATA variant
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i')
  );
  if (cdata) return decodeEntities(cdata[1].trim());

  // Regular variant — strip inner tags (e.g. <source url="...">Name</source>)
  const regular = block.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  );
  if (regular) return decodeEntities(regular[1].replace(/<[^>]+>/g, '').trim());
  return '';
}

function extractLink(block: string): string {
  // Atom: <link href="..." /> or <link rel="alternate" href="..." />
  const atom = block.match(/<link[^>]+href="([^"]+)"[^>]*\/?>/i);
  if (atom) return atom[1];

  // RSS: <link>https://...</link>
  const rss = block.match(/<link[^>]*>([^<\s][^<]*)<\/link>/i);
  if (rss) return decodeEntities(rss[1].trim());

  // Fallback: <guid> often contains the URL in Google News
  const guid = block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (guid && guid[1].startsWith('http')) return guid[1].trim();

  return '';
}

function parseItems(xml: string, category: string, defaultSource: string, limit = 8): NewsItem[] {
  const items: NewsItem[] = [];

  // Determine whether this is RSS (<item>) or Atom (<entry>)
  const itemTag = xml.includes('<item>') || xml.includes('<item ') ? 'item' : 'entry';
  const pattern = new RegExp(`<${itemTag}[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, 'g');

  let match;
  while ((match = pattern.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractLink(block);
    const pubDate =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated');
    const source = extractTag(block, 'source') || defaultSource;

    if (title && link) {
      items.push({ title, link, pubDate, source, category });
    }
  }

  return items;
}

async function fetchFeed(feed: (typeof FEEDS)[0]): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OrtizCommandCenter/1.0)' },
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseItems(xml, feed.category, feed.defaultSource);
  } catch {
    return [];
  }
}

export async function GET() {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const articles = results
    .flat()
    .sort((a, b) => {
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return tb - ta;
    });

  return NextResponse.json({ articles });
}
