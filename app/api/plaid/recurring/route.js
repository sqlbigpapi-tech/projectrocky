import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { NextResponse } from 'next/server';

const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

const FREQUENCY_DAYS = {
  weekly: 7,
  biweekly: 14,
  semi_monthly: 15,
  monthly: 30,
  annually: 365,
};

export async function POST(request) {
  try {
    const { access_token, account_ids } = await request.json();
    const res = await plaidClient.transactionsRecurringGet({ access_token, account_ids });
    const outflows = res.data.outflow_streams;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bills = outflows
      .filter(s => s.is_active)
      .map(s => {
        const freq = s.frequency?.toLowerCase().replace(' ', '_');
        const intervalDays = FREQUENCY_DAYS[freq] || 30;
        const lastDate = new Date(s.last_date);
        // advance until next due date is >= today
        let nextDate = new Date(lastDate);
        while (nextDate < today) {
          nextDate = new Date(nextDate.getTime() + intervalDays * 86400000);
        }
        const daysUntil = Math.round((nextDate - today) / 86400000);
        return {
          name: s.merchant_name || s.description,
          amount: Math.abs(s.average_amount?.amount ?? s.last_amount?.amount ?? 0),
          nextDate: nextDate.toISOString().split('T')[0],
          daysUntil,
          frequency: s.frequency,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return NextResponse.json({ bills });
  } catch (error) {
    console.error('RECURRING ERROR:', error.response?.data || error.message);
    return NextResponse.json({ error: error.response?.data || error.message }, { status: 500 });
  }
}
