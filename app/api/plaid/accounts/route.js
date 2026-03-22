import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { NextResponse } from 'next/server';

const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

export async function POST(request) {
  try {
    const { access_token } = await request.json();
    const [accountsRes, transactionsRes] = await Promise.all([
      plaidClient.accountsGet({ access_token }),
      plaidClient.transactionsGet({
        access_token,
        start_date: '2024-01-01',
        end_date: new Date().toISOString().split('T')[0],
      }),
    ]);
    return NextResponse.json({
      accounts: accountsRes.data.accounts,
      transactions: transactionsRes.data.transactions,
    });
  } catch (error) {
    console.error('ACCOUNTS ERROR:', error.response?.data || error.message);
    return NextResponse.json({ error: error.response?.data || error.message }, { status: 500 });
  }
}