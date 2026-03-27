import https from 'https';
import { NextResponse } from 'next/server';

type TellerAccount = {
  id: string;
  name: string;
  type: string;
  subtype: string;
  institution: { name: string; id: string };
  enrollment_id: string;
  last_four: string;
};

type TellerBalance = {
  ledger: string;
  available: string;
};

type TellerTransaction = {
  id: string;
  date: string;
  description: string;
  amount: string;
  details?: {
    category?: string;
    counterparty?: { name: string };
  };
};

// Vercel stores multiline env vars with literal \n — convert to real newlines for mTLS
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
        try { resolve(JSON.parse(body)); } catch { resolve([]); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export async function POST(request: Request) {
  try {
    const { access_token } = await request.json();

    const accountsRaw = await tellerGet('/accounts', access_token) as TellerAccount[];
    if (!Array.isArray(accountsRaw)) {
      console.error('TELLER /accounts not array:', JSON.stringify(accountsRaw));
      return NextResponse.json({ error: 'Failed to fetch accounts', raw: accountsRaw }, { status: 500 });
    }

    const accountData = await Promise.all(
      accountsRaw.map(async acc => {
        const [balance, txns] = await Promise.all([
          tellerGet(`/accounts/${acc.id}/balances`, access_token),
          tellerGet(`/accounts/${acc.id}/transactions`, access_token),
        ]);
        return { acc, balance: balance as TellerBalance, txns: txns as TellerTransaction[] };
      })
    );

    const accounts = accountData.map(({ acc, balance }) => ({
      account_id: acc.id,
      name: `${acc.institution.name} ${acc.name}`,
      type: acc.type,
      subtype: acc.subtype,
      balances: { current: parseFloat(balance?.ledger ?? '0') },
    }));

    const transactions = accountData.flatMap(({ acc, txns }) =>
      (Array.isArray(txns) ? txns : []).map(t => {
        const raw = parseFloat(t.amount);
        // Teller sign convention differs by account type:
        // - depository/investment: positive=credit(income), negative=debit(expense)
        // - credit (cards): positive=charge(expense), negative=payment
        // App convention: positive=expense, negative=income
        const amount = acc.type === 'credit' ? raw : -raw;
        return {
          transaction_id: t.id,
          account_id: acc.id,
          name: t.details?.counterparty?.name || t.description,
          date: t.date,
          amount,
          category: t.details?.category
            ? [t.details.category.replace(/_/g, ' ')]
            : undefined,
        };
      })
    );

    return NextResponse.json({ accounts, transactions });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('TELLER ACCOUNTS ERROR:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
