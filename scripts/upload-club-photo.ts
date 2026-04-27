/**
 * Upload a local image into Supabase Storage and link it to matching
 * golf_clubs rows by `model LIKE` pattern.
 *
 * Usage:
 *   npx tsx scripts/upload-club-photo.ts <localPath> <bucketFilename> <modelLikePattern>
 *
 * Example:
 *   npx tsx scripts/upload-club-photo.ts ~/Downloads/vokey.jpg vokey-sm10.jpg 'Titleist Vokey SM10%'
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = 'club-images';

async function main() {
  const [localPath, filename, pattern] = process.argv.slice(2);
  if (!localPath || !filename || !pattern) {
    console.error('usage: upload-club-photo.ts <localPath> <bucketFilename> <modelLikePattern>');
    process.exit(1);
  }
  const abs = resolve(localPath.replace(/^~/, process.env.HOME ?? ''));
  console.log(`Reading ${abs}`);
  const data = readFileSync(abs);
  const ext = filename.split('.').pop()?.toLowerCase();
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const db = createClient(URL, KEY);
  console.log(`Uploading ${(data.length / 1024).toFixed(0)} KB → ${BUCKET}/${filename}`);
  const { error: upErr } = await db.storage.from(BUCKET).upload(filename, data, { contentType, upsert: true });
  if (upErr) { console.error('upload error:', upErr.message); process.exit(1); }
  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(filename);
  console.log(`Public URL: ${pub.publicUrl}`);

  console.log(`Updating golf_clubs WHERE model LIKE ${JSON.stringify(pattern)}`);
  const { data: rows, error: dbErr } = await db
    .from('golf_clubs')
    .update({ image: pub.publicUrl, updated_at: new Date().toISOString() })
    .like('model', pattern)
    .select('club, model');
  if (dbErr) { console.error('db error:', dbErr.message); process.exit(1); }
  console.log(`Linked to ${rows?.length ?? 0} row(s):`);
  for (const r of rows ?? []) console.log(`  · ${r.club} — ${r.model}`);
}

main().catch(e => { console.error(e); process.exit(1); });
