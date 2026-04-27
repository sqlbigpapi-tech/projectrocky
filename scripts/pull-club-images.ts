/**
 * One-time pull of manufacturer product photos into Supabase Storage,
 * then write back the public URLs to golf_clubs.image.
 *
 * Run: npx tsx scripts/pull-club-images.ts
 *
 * Pre-reqs:
 *   1. Public Supabase Storage bucket named `club-images` exists
 *   2. golf_clubs table has the `image` column (alter add if missing)
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const db = createClient(URL, KEY);
const BUCKET = 'club-images';

// Map model name → manufacturer image URL (researched from product pages).
// Mizuno JPX-925 Hot Metal Pro shares one head photo across the iron set.
// Vokey SM10 isn't included — manufacturer site blocks scrapers; drop a photo
// in the bucket manually after this script runs.
const SOURCES: { model: string; url: string; filename: string }[] = [
  {
    model: 'TaylorMade Qi4d LS',
    url: 'https://www.golfiomedia.com/img/lrl2866-desc_1.jpg',
    filename: 'taylormade-qi4d-ls.jpg',
  },
  {
    model: 'TaylorMade Qi4d',
    url: 'https://worldwidegolf.vtexassets.com/arquivos/ids/13114956-800-auto?v=639042284508170000&width=800&height=auto&aspect=true',
    filename: 'taylormade-qi4d-rescue.jpg',
  },
  {
    model: 'Callaway Paradym HL',
    url: 'https://edge.dis.commercecloud.salesforce.com/dw/image/v2/AADH_PRD/on/demandware.static/-/Sites-CGI-ItemMaster/en_US/v1777182100222/sits/fwoods-2023-paradym/fwoods-2023-paradym___1.jpg?sw=1200&q=90&bgcolor=F7F7F7&sfrm=png',
    filename: 'callaway-paradym-3w.jpg',
  },
  {
    model: 'Mizuno JPX-925 Hot Metal Pro',
    url: 'https://cdn11.bigcommerce.com/s-x6b2pdd9ey/products/18191/images/16448/211112_w_1280%2526h_1280%2526fmt_jpg%2526bg_rgb%2528255_255_255%2529__54288.1776859398.386.513.jpg?c=1',
    filename: 'mizuno-jpx-925-hot-metal-pro.jpg',
  },
];

async function fetchBinary(url: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      },
    });
    if (!r.ok) {
      console.error(`  ✗ HTTP ${r.status} from ${url}`);
      return null;
    }
    const data = await r.arrayBuffer();
    const contentType = r.headers.get('content-type') ?? 'image/jpeg';
    return { data, contentType };
  } catch (e) {
    console.error(`  ✗ fetch error: ${(e as Error).message}`);
    return null;
  }
}

async function uploadToBucket(filename: string, data: ArrayBuffer, contentType: string): Promise<string | null> {
  const { error } = await db.storage.from(BUCKET).upload(filename, data, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.error(`  ✗ upload error: ${error.message}`);
    return null;
  }
  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(filename);
  return pub.publicUrl;
}

async function main() {
  console.log(`Pulling images for ${SOURCES.length} models → ${BUCKET}`);
  for (const s of SOURCES) {
    console.log(`\n· ${s.model}`);
    console.log(`  fetching ${s.url}`);
    const got = await fetchBinary(s.url);
    if (!got) continue;
    console.log(`  uploading ${(got.data.byteLength / 1024).toFixed(0)} KB as ${s.filename}`);
    const publicUrl = await uploadToBucket(s.filename, got.data, got.contentType);
    if (!publicUrl) continue;
    console.log(`  → ${publicUrl}`);
    const { error, data } = await db
      .from('golf_clubs')
      .update({ image: publicUrl, updated_at: new Date().toISOString() })
      .eq('model', s.model)
      .select('club');
    if (error) {
      console.error(`  ✗ DB update error: ${error.message}`);
      continue;
    }
    console.log(`  ✓ wrote image to ${data?.length ?? 0} club row(s): ${(data ?? []).map(r => r.club).join(', ')}`);
  }
  console.log('\nDone. Vokey SM10 not auto-pulled — drop a photo in the bucket and run a small UPDATE if you want it linked.');
}

main().catch(e => { console.error(e); process.exit(1); });
