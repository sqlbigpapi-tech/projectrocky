import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
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

export async function POST() {
  console.log('CLIENT ID:', process.env.PLAID_CLIENT_ID);
  console.log('SECRET:', process.env.PLAID_SECRET);
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'david-ortiz' },
      client_name: 'My Finance Dashboard',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('PLAID ERROR:', error.response?.data || error.message);
    return NextResponse.json({ error: error.response?.data || error.message }, { status: 500 });
  }
}