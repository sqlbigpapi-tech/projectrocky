export type TwilioResult = {
  sid: string;
  status: string;
  error_code: number | null;
  error_message: string | null;
  to: string;
  from: string;
};

export async function sendSMS(body: string): Promise<TwilioResult> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;
  const to    = process.env.MY_PHONE_NUMBER;

  if (!sid || !token || !from || !to) {
    throw new Error('Missing Twilio environment variables');
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To:   `whatsapp:${to}`,
        From: `whatsapp:${from}`,
        Body: body,
      }),
    }
  );

  const json = await res.json();

  if (!res.ok) {
    throw new Error(`Twilio ${res.status} (code ${json.code ?? '?'}): ${json.message ?? res.statusText}`);
  }

  return {
    sid:           json.sid,
    status:        json.status,
    error_code:    json.error_code   ?? null,
    error_message: json.error_message ?? null,
    to:            json.to,
    from:          json.from,
  };
}
