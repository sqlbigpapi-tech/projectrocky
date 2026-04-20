import { getSupabase } from '@/lib/supabase';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const OWNER_ID = process.env.TELEGRAM_OWNER_ID!;

async function sendTelegram(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

export async function POST(request: Request) {
  // Verify request is actually from Telegram. The secret is registered with
  // Telegram via setWebhook ?secret_token=... and echoed back in this header.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.replace(/^["']|["']$/g, '').trim();
  const actual = request.headers.get('x-telegram-bot-api-secret-token');
  if (!expected || actual !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const update = await request.json();
  const message = update.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const body = message.text.trim();

  // Only respond to owner
  if (userId !== OWNER_ID) {
    await sendTelegram(chatId, 'Unknown user.');
    return NextResponse.json({ ok: true });
  }

  // /start command
  if (body === '/start') {
    await sendTelegram(chatId, '🥊 *Project Rocky* is online.\n\nJust talk to me naturally:\n• "Add a task to call Charlie by Friday"\n• "What are my tasks this week?"\n• "What\'s my net worth?"\n• "What meetings do I have today?"\n• "How am I doing financially?"\n\nOr type /help for all commands.');
    return NextResponse.json({ ok: true });
  }

  if (body === '/help') {
    await sendTelegram(chatId, '*Rocky Commands:*\n\nJust talk naturally — I figure out what you need:\n• "Add a task to call Charlie by Friday"\n• "Mark the Cummins task as done"\n• "What are my tasks?"\n• "Update share price to 425"\n• "Update mercedes mileage to 21000"\n• "What\'s my net worth?"\n• "What meetings do I have today?"\n• Any financial question');
    return NextResponse.json({ ok: true });
  }

  const base = new URL(request.url).origin;
  const db = getSupabase();

  // Gather context for Rocky
  const [tasksResult, engResult, nwResult, deibFactors, deibCommentStats] = await Promise.all([
    db.from('tasks').select('id, title, due_date, completed, recurrence').eq('completed', false).order('due_date'),
    db.from('engagements').select('id, deal_name, rate, sow_start, sow_end, status, consultants(first_name, last_name, level), clients(name)').neq('status', 'closed'),
    db.from('net_worth_snapshots').select('date, accounts').order('date', { ascending: false }).limit(1),
    db.from('deib_surveys').select('factor, demographic_type, demographic_value, score').eq('survey_period', 'Fall 2025').is('question', null).eq('demographic_type', 'office'),
    db.from('deib_comments').select('sentiment'),
  ]);

  const openTasks = (tasksResult.data ?? []).slice(0, 15);
  const taskList = openTasks.map(t => `- "${t.title}" (id: ${t.id}${t.due_date ? ', due: ' + t.due_date : ''})`).join('\n');

  // Engagements context
  const engagements = (engResult.data ?? []) as any[];
  const today = new Date();
  const sixtyOut = new Date(today); sixtyOut.setDate(sixtyOut.getDate() + 60);
  const engList = engagements.map(e => {
    const name = e.consultants ? `${e.consultants.first_name} ${e.consultants.last_name}` : 'Unknown';
    const client = e.clients?.name ?? 'Unknown';
    const endDate = new Date(e.sow_end);
    const daysLeft = Math.round((endDate.getTime() - today.getTime()) / 86400000);
    const ending = daysLeft <= 60 ? ` ⚠ ENDING IN ${daysLeft} DAYS` : '';
    return `- ${name} (${e.consultants?.level}) @ ${client} | $${e.rate}/hr | SOW ends ${e.sow_end}${ending}`;
  }).join('\n');

  // Net worth
  let nwContext = '';
  if (nwResult.data?.[0]) {
    const accts = nwResult.data[0].accounts as { category: string; balance: number; name: string }[];
    const liabCats = ['credit_card', 'auto_loan', 'personal_loan'];
    const assets = accts.filter(a => !liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
    const liab = accts.filter(a => liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
    nwContext = `Net Worth: $${Math.round(assets - liab).toLocaleString()} (Assets: $${Math.round(assets).toLocaleString()}, Liabilities: $${Math.round(liab).toLocaleString()})`;
  }

  // DEIB context
  let deibContext = '';
  const deibRows = (deibFactors.data ?? []) as { factor: string; demographic_value: string; score: number }[];
  if (deibRows.length > 0) {
    // Overall scores by factor
    const overallFactors = deibRows.filter(r => r.demographic_value === 'Overall')
      .sort((a, b) => a.score - b.score)
      .map(r => `  ${r.factor}: ${Math.round(r.score * 100)}%`);
    // Office D&I scores
    const diByOffice = deibRows.filter(r => r.factor === 'Diversity & Inclusion' && r.demographic_value !== 'Overall')
      .sort((a, b) => b.score - a.score)
      .map(r => `  ${r.demographic_value}: ${Math.round(r.score * 100)}%`);
    // Comment sentiments
    const sentiments: Record<string, number> = {};
    for (const c of (deibCommentStats.data ?? []) as { sentiment: string }[]) {
      sentiments[c.sentiment] = (sentiments[c.sentiment] ?? 0) + 1;
    }
    const sentimentStr = Object.entries(sentiments).map(([k, v]) => `${k}: ${v}`).join(', ');

    deibContext = `DEIB DATA (Fall 2025 Survey, 483 respondents):
All Factors (firmwide, ranked lowest to highest):
${overallFactors.join('\n')}

D&I Score by Office:
${diByOffice.join('\n')}

Employee Comments Sentiment: ${sentimentStr} (${(deibCommentStats.data ?? []).length} total comments)`;
  }

  const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;

  try {
    const { text: replyRaw } = await generateText({
      model: 'anthropic/claude-sonnet-4.6',
      maxOutputTokens: 800,
      system: `You are Rocky, David's AI assistant via Telegram. You are named after Rocky from "Project Hail Mary." When sharing good news, say "Amaze amaze amaze!"

You can perform these ACTIONS by returning a special JSON block. If the user wants an action, return ONLY the JSON — no extra text before it.

ACTIONS (return as JSON):

1. Add a task:
{"action":"add_task","title":"task title here","due_date":"2026-04-18 or null"}
Parse natural dates: "by Friday" = next Friday, "by tomorrow" = tomorrow, "by 4/20" = April 20.
Today is ${todayStr}.

2. Complete a task:
{"action":"complete_task","task_id":"uuid here"}
Match the user's description to the closest task from the list below.

3. List tasks:
{"action":"list_tasks"}

4. Update share price:
{"action":"update_share_price","price":425.50}

5. Update car mileage:
{"action":"update_mileage","car":"mercedes or bmw","miles":21000}

6. Get net worth:
{"action":"get_net_worth"}

7. Get today's meetings:
{"action":"get_meetings"}

8. List engagements:
{"action":"list_engagements"}

9. List engagements ending soon:
{"action":"ending_soon"}

If the user is asking a financial question, about engagements, consultants, clients, or just chatting, respond conversationally using the data below (no JSON). Keep responses under 300 words for readability.

CURRENT OPEN TASKS:
${taskList || 'None'}

ACTIVE ENGAGEMENTS:
${engList || 'None'}

FINANCIAL SNAPSHOT:
${nwContext || 'No data'}

${deibContext || ''}`,
      prompt: body,
    });

    const reply = replyRaw.trim();

    // Check if Rocky returned an action JSON
    const jsonMatch = reply.match(/\{[\s\S]*"action"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const action = JSON.parse(jsonMatch[0]);
        const result = await handleAction(action, db, base);
        await sendTelegram(chatId, result);
        return NextResponse.json({ ok: true });
      } catch {}
    }

    await sendTelegram(chatId, reply.slice(0, 4000));
  } catch {
    await sendTelegram(chatId, 'Rocky is having trouble right now. Try again.');
  }

  return NextResponse.json({ ok: true });
}

async function handleAction(action: any, db: ReturnType<typeof getSupabase>, base: string): Promise<string> {
  switch (action.action) {
    case 'add_task': {
      const { error } = await db.from('tasks').insert({
        title: action.title, notes: '', priority: 'Medium', category: 'Business',
        due_date: action.due_date || null, completed: false, recurrence: null,
      }).select().single();
      if (error) return 'Failed to create task.';
      return `✓ Added: ${action.title}${action.due_date ? '\nDue: ' + action.due_date : ''}`;
    }
    case 'complete_task': {
      const { data, error } = await db.from('tasks').update({ completed: true }).eq('id', action.task_id).select('title').single();
      if (error || !data) return 'Couldn\'t find that task.';
      return `✓ Done: ${data.title}`;
    }
    case 'list_tasks': {
      const { data } = await db.from('tasks').select('title, due_date').eq('completed', false).order('due_date');
      const tasks = data ?? [];
      if (tasks.length === 0) return 'No open tasks. All clear!';
      const lines = tasks.slice(0, 10).map(t => `• ${t.title}${t.due_date ? ' (' + t.due_date + ')' : ''}`);
      return `📋 ${tasks.length} open tasks:\n${lines.join('\n')}${tasks.length > 10 ? `\n...and ${tasks.length - 10} more` : ''}`;
    }
    case 'update_share_price': {
      const price = Number(action.price);
      if (!price || price <= 0) return 'Invalid price.';
      await db.from('settings').upsert({ key: 'manual_share_price', value: String(price) }, { onConflict: 'key' });
      return `✓ Share price updated to $${price.toFixed(2)}`;
    }
    case 'update_mileage': {
      const car = action.car?.toLowerCase();
      if (car !== 'mercedes' && car !== 'bmw') return 'Specify mercedes or bmw.';
      const miles = Number(action.miles);
      if (!miles || miles <= 0) return 'Invalid mileage.';
      const { data: existing } = await db.from('settings').select('value').eq('key', `car_value_${car}`).single();
      const current = existing?.value ? JSON.parse(existing.value) : {};
      await db.from('settings').upsert({ key: `car_value_${car}`, value: JSON.stringify({ ...current, miles, updatedAt: new Date().toISOString() }) }, { onConflict: 'key' });
      return `✓ ${car === 'mercedes' ? 'Mercedes' : 'BMW X1'} mileage updated to ${miles.toLocaleString()} miles.`;
    }
    case 'get_net_worth': {
      const { data } = await db.from('net_worth_snapshots').select('accounts').order('date', { ascending: false }).limit(1).single();
      if (!data) return 'No net worth data yet.';
      const accts = data.accounts as { category: string; balance: number }[];
      const liabCats = ['credit_card', 'auto_loan', 'personal_loan'];
      const assets = accts.filter(a => !liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      const liab = accts.filter(a => liabCats.includes(a.category)).reduce((s, a) => s + a.balance, 0);
      return `💰 Net Worth: $${Math.round(assets - liab).toLocaleString()}\nAssets: $${Math.round(assets).toLocaleString()}\nLiabilities: $${Math.round(liab).toLocaleString()}`;
    }
    case 'get_meetings': {
      try {
        const res = await fetch(`${base}/api/calendar`);
        const data = await res.json();
        const meetings = (data.events ?? []).filter((e: any) => !e.isAllDay);
        if (meetings.length === 0) return 'No meetings today. Clear day!';
        const lines = meetings.map((m: any) => {
          const time = new Date(m.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
          return `• ${time} — ${m.summary}`;
        });
        return `📅 ${meetings.length} meetings today:\n${lines.join('\n')}`;
      } catch { return 'Couldn\'t fetch calendar.'; }
    }
    case 'list_engagements': {
      const { data } = await db.from('engagements')
        .select('deal_name, rate, sow_start, sow_end, status, consultants(first_name, last_name, level), clients(name)')
        .neq('status', 'closed');
      const engs = (data ?? []) as any[];
      if (engs.length === 0) return 'No active engagements.';
      const lines = engs.map(e => {
        const name = e.consultants ? `${e.consultants.first_name} ${e.consultants.last_name}` : '?';
        const client = e.clients?.name ?? '?';
        return `• ${name} @ ${client} — $${e.rate}/hr — ends ${e.sow_end}`;
      });
      return `📋 ${engs.length} active engagements:\n${lines.join('\n')}`;
    }
    case 'ending_soon': {
      const { data } = await db.from('engagements')
        .select('deal_name, rate, sow_end, status, consultants(first_name, last_name), clients(name)')
        .neq('status', 'closed');
      const now = new Date();
      const sixtyDays = new Date(now); sixtyDays.setDate(sixtyDays.getDate() + 60);
      const ending = ((data ?? []) as any[]).filter(e => {
        const end = new Date(e.sow_end);
        return end >= now && end <= sixtyDays;
      }).sort((a: any, b: any) => new Date(a.sow_end).getTime() - new Date(b.sow_end).getTime());
      if (ending.length === 0) return 'No engagements ending in the next 60 days. All clear!';
      const lines = ending.map((e: any) => {
        const name = e.consultants ? `${e.consultants.first_name} ${e.consultants.last_name}` : '?';
        const client = e.clients?.name ?? '?';
        const daysLeft = Math.round((new Date(e.sow_end).getTime() - now.getTime()) / 86400000);
        return `⚠ ${name} @ ${client} — ends ${e.sow_end} (${daysLeft} days)`;
      });
      return `🔔 ${ending.length} ending within 60 days:\n${lines.join('\n')}`;
    }
    default: return 'I didn\'t understand that action.';
  }
}
