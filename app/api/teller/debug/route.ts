import https from 'https';
import { NextResponse } from 'next/server';

const CERT = process.env.TELLER_CERT?.replace(/\\n/g, '\n');
const KEY = process.env.TELLER_KEY?.replace(/\\n/g, '\n');

function tellerGet(path: string, accessToken: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${accessToken}:`).toString('base64');
    const req = https.request({
      hostname: 'api.teller.io',
      path,
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` },
      cert: CERT,
      key: KEY,
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export async function POST(request: Request) {
  try {
    const { access_token } = await request.json();
    const hasCert = !!CERT;
    const hasKey = !!KEY;
    const certStart = CERT?.slice(0, 40);
    const result = await tellerGet('/accounts', access_token);
    return NextResponse.json({ hasCert, hasKey, certStart, result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg, hasCert: !!CERT, hasKey: !!KEY });
  }
}
