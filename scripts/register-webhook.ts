import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.replace(/^["']|["']$/g, '').trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.replace(/^["']|["']$/g, '').trim();
  const url = 'https://finance-dashboard-one-henna.vercel.app/api/telegram/webhook';

  if (!token) { console.error('Missing TELEGRAM_BOT_TOKEN in .env.local'); process.exit(1); }
  if (!secret) { console.error('Missing TELEGRAM_WEBHOOK_SECRET in .env.local — run `vercel env pull .env.local`'); process.exit(1); }

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secret, drop_pending_updates: true }),
  });
  const data = await res.json();
  if (!data.ok) { console.error('setWebhook failed:', data); process.exit(1); }
  console.log('✓ Webhook registered with secret token');
  console.log(`  URL: ${url}`);
}

main().catch(e => { console.error(e); process.exit(1); });
