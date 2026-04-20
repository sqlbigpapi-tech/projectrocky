// Rocky Command Center Widget for Scriptable
//
// Setup:
// 1. Download "Scriptable" from the App Store
// 2. Open Scriptable → tap + → paste this entire script
// 3. Name it "Rocky"
// 4. Go to home screen → long press → add widget → Scriptable
// 5. Choose medium size → tap widget → select "Rocky"

const BASE = "https://finance-dashboard-one-henna.vercel.app";

// ── Fetch data ──
async function fetchJSON(path) {
  try {
    const req = new Request(`${BASE}${path}`);
    req.timeoutInterval = 15;
    return await req.loadJSON();
  } catch { return null; }
}

const [cal, tasks, weather] = await Promise.all([
  fetchJSON("/api/calendar"),
  fetchJSON("/api/tasks"),
  fetchJSON("/api/weather"),
]);

// ── Parse data ──
const now = new Date();

// Calendar
const meetings = (cal?.events ?? []).filter(e => !e.isAllDay);
const nextMeeting = meetings.find(e => new Date(e.start) > now);
let countdown = "";
if (nextMeeting) {
  const diff = new Date(nextMeeting.start).getTime() - now.getTime();
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) countdown = `in ${hrs}h ${mins}m`;
  else if (mins > 0) countdown = `in ${mins}m`;
  else countdown = "now";
}

// Tasks
const openTasks = (tasks?.tasks ?? []).filter(t => !t.completed);
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const threeDaysOut = new Date(now);
threeDaysOut.setDate(threeDaysOut.getDate() + 3);
const threeDaysStr = `${threeDaysOut.getFullYear()}-${String(threeDaysOut.getMonth() + 1).padStart(2, "0")}-${String(threeDaysOut.getDate()).padStart(2, "0")}`;

const overdueTasks = openTasks.filter(t => t.due_date && t.due_date < todayStr);
const upcomingTasks = openTasks
  .filter(t => t.due_date && t.due_date >= todayStr && t.due_date <= threeDaysStr)
  .sort((a, b) => a.due_date.localeCompare(b.due_date));

// Weather
const temp = weather?.current?.temp ?? "—";
const condition = weather?.current?.condition ?? "";

function dueLabel(due) {
  if (due === todayStr) return "today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  if (due === tomStr) return "tmrw";
  const d = new Date(due + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

// ── Build Widget ──
const w = new ListWidget();
w.backgroundColor = new Color("#000000");
w.setPadding(12, 14, 10, 14);

// Header row: Rocky + weather
const header = w.addStack();
header.centerAlignContent();

const title = header.addText("ROCKY");
title.font = Font.boldMonospacedSystemFont(10);
title.textColor = new Color("#f59e0b");

header.addSpacer();

const weatherText = header.addText(`${temp}°F ${condition}`);
weatherText.font = Font.mediumMonospacedSystemFont(10);
weatherText.textColor = new Color("#71717a");

w.addSpacer(6);

// Two-column layout
const columns = w.addStack();
columns.spacing = 14;

// ── Left column: Next meeting ──
const left = columns.addStack();
left.layoutVertically();
left.size = new Size(165, 0);

if (nextMeeting) {
  const meetRow = left.addStack();
  meetRow.centerAlignContent();

  const dot = meetRow.addText("●");
  dot.font = Font.systemFont(6);
  dot.textColor = countdown === "now" || !countdown.includes("h") ? new Color("#f59e0b") : new Color("#52525b");
  meetRow.addSpacer(4);

  const meetLabel = meetRow.addText("NEXT");
  meetLabel.font = Font.boldMonospacedSystemFont(8);
  meetLabel.textColor = new Color("#52525b");
  meetRow.addSpacer(4);

  const meetTime = meetRow.addText(countdown);
  meetTime.font = Font.boldMonospacedSystemFont(8);
  meetTime.textColor = countdown === "now" || !countdown.includes("h") ? new Color("#f59e0b") : new Color("#a1a1aa");

  left.addSpacer(2);

  const meetName = left.addText(nextMeeting.summary);
  meetName.font = Font.mediumSystemFont(12);
  meetName.textColor = Color.white();
  meetName.lineLimit = 1;

  const meetingTime = new Date(nextMeeting.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const meetDetail = left.addText(`${meetingTime}${nextMeeting.location?.includes("Teams") ? " · Teams" : ""}`);
  meetDetail.font = Font.mediumMonospacedSystemFont(9);
  meetDetail.textColor = new Color("#71717a");
} else {
  const noMeet = left.addText("No more meetings");
  noMeet.font = Font.mediumSystemFont(12);
  noMeet.textColor = new Color("#52525b");
}

left.addSpacer(6);

// Stats row under meeting
const stats = left.addStack();
stats.centerAlignContent();

const meetNum = stats.addText(`${meetings.length}`);
meetNum.font = Font.boldMonospacedSystemFont(14);
meetNum.textColor = new Color("#f59e0b");
stats.addSpacer(3);
const meetLabel2 = stats.addText("mtgs");
meetLabel2.font = Font.mediumMonospacedSystemFont(9);
meetLabel2.textColor = new Color("#52525b");

if (overdueTasks.length > 0) {
  stats.addSpacer(10);
  const odNum = stats.addText(`${overdueTasks.length}`);
  odNum.font = Font.boldMonospacedSystemFont(14);
  odNum.textColor = new Color("#f87171");
  stats.addSpacer(3);
  const odLabel = stats.addText("late");
  odLabel.font = Font.mediumMonospacedSystemFont(9);
  odLabel.textColor = new Color("#f87171", 0.6);
}

stats.addSpacer(10);
const tkNum = stats.addText(`${openTasks.length}`);
tkNum.font = Font.boldMonospacedSystemFont(14);
tkNum.textColor = new Color("#a1a1aa");
stats.addSpacer(3);
const tkLabel = stats.addText("tasks");
tkLabel.font = Font.mediumMonospacedSystemFont(9);
tkLabel.textColor = new Color("#52525b");

// ── Right column: Tasks due in 3 days ──
const right = columns.addStack();
right.layoutVertically();

const taskHeader = right.addStack();
taskHeader.centerAlignContent();
const taskTitle = taskHeader.addText("DUE SOON");
taskTitle.font = Font.boldMonospacedSystemFont(8);
taskTitle.textColor = new Color("#52525b");

right.addSpacer(4);

const showTasks = [...overdueTasks, ...upcomingTasks].slice(0, 5);

if (showTasks.length === 0) {
  right.addSpacer(4);
  const clear = right.addText("All clear ✓");
  clear.font = Font.mediumSystemFont(11);
  clear.textColor = new Color("#52525b");
} else {
  for (const t of showTasks) {
    const row = right.addStack();
    row.centerAlignContent();
    row.spacing = 4;

    const isOverdue = t.due_date && t.due_date < todayStr;
    const isToday = t.due_date === todayStr;

    const bullet = row.addText("•");
    bullet.font = Font.systemFont(8);
    bullet.textColor = isOverdue ? new Color("#f87171") : isToday ? new Color("#f59e0b") : new Color("#52525b");

    const taskName = row.addText(t.title);
    taskName.font = Font.mediumSystemFont(10);
    taskName.textColor = isOverdue ? new Color("#f87171") : Color.white();
    taskName.lineLimit = 1;

    right.addSpacer(1);

    if (t.due_date) {
      const due = right.addText(`  ${isOverdue ? "overdue" : dueLabel(t.due_date)}`);
      due.font = Font.mediumMonospacedSystemFont(8);
      due.textColor = isOverdue ? new Color("#f87171", 0.6) : isToday ? new Color("#f59e0b", 0.6) : new Color("#52525b");
    }

    right.addSpacer(2);
  }
}

// Tap to open dashboard
w.url = BASE;

// Refresh every 5 min
w.refreshAfterDate = new Date(Date.now() + 5 * 60000);

if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentMedium();
}

Script.complete();
