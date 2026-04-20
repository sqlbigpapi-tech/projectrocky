export type TwilioResult = {
  sid: string;
  status: string;
  error_code: number | null;
  error_message: string | null;
  to: string;
  from: string;
};

const NOTIFY_EMAIL = 'dortiz3436@gmail.com';

// Send via Telegram
async function sendTelegram(body: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: body }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Send email via Resend
async function sendEmail(body: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  try {
    const firstLine = body.split('\n')[0].replace(/[^\w\s·—\-]/g, '').trim();
    const subject = firstLine.slice(0, 60) || 'Project Rocky Alert';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Rocky <onboarding@resend.dev>',
        to: [NOTIFY_EMAIL],
        subject,
        text: body,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Main send function — Telegram primary, email backup
export async function sendSMS(body: string): Promise<TwilioResult> {
  const [telegramSent, emailSent] = await Promise.all([
    sendTelegram(body),
    sendEmail(body),
  ]);

  if (telegramSent) {
    return {
      sid: 'telegram',
      status: 'sent-via-telegram',
      error_code: null,
      error_message: null,
      to: 'telegram',
      from: 'rocky-bot',
    };
  }

  if (emailSent) {
    return {
      sid: 'email-fallback',
      status: 'sent-via-email',
      error_code: null,
      error_message: null,
      to: NOTIFY_EMAIL,
      from: 'rocky@resend.dev',
    };
  }

  throw new Error('Both Telegram and email delivery failed');
}
