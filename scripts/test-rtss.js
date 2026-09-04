const Database = require("better-sqlite3");

const db = new Database("data/coros_athlete.db");
const activities = db.prepare("SELECT * FROM activities ORDER BY start_time ASC").all();

const THRESHOLD_PACE_SEC = 282; // 4:42 /km from user COROS EvoLab

function computeRtss(act) {
  const durHours = act.duration_seconds / 3600;
  if (durHours <= 0) return 0;

  let pace = act.avg_pace_sec;
  if (pace <= 0 && act.distance_meters > 0) {
    pace = act.duration_seconds / (act.distance_meters / 1000);
  }
  if (pace <= 0) return 30; // default low

  // For trail run or steep climbing, pace is slower due to gradient,
  // so adjust to Effort Pace (GAP)
  if (act.sport_type === "trail_run" || act.elevation_gain > 200) {
    const distKm = act.distance_meters / 1000;
    const gradient = distKm > 0 ? act.elevation_gain / (distKm * 1000) : 0;
    // Minetti/GAP adjustment
    const gapFactor = 1 + gradient * 4.0;
    pace = pace / gapFactor;
  }

  const intensityFactor = THRESHOLD_PACE_SEC / pace;
  const rtss = Math.round(100 * durHours * Math.pow(intensityFactor, 2));
  // Cap reasonable daily single workout TSS
  return Math.max(5, Math.min(350, rtss));
}

console.log("Total activities:", activities.length);

// Aggregate by date
const dailyRtssMap = new Map();
for (const act of activities) {
  const date = new Date(act.start_time).toISOString().split("T")[0];
  const tss = computeRtss(act);
  dailyRtssMap.set(date, (dailyRtssMap.get(date) || 0) + tss);
}

// Generate full continuous calendar days
const sortedDates = Array.from(dailyRtssMap.keys()).sort();
const firstDate = new Date(sortedDates[0]);
const lastDate = new Date(sortedDates[sortedDates.length - 1]);

const continuousDays = [];
let cur = new Date(firstDate);
while (cur <= lastDate) {
  const dStr = cur.toISOString().split("T")[0];
  continuousDays.push({
    date: dStr,
    load: dailyRtssMap.get(dStr) || 0,
  });
  cur.setDate(cur.getDate() + 1);
}

// Calculate EMA with initial seed ~40 (standard rolling accumulation)
const ctlLambda = Math.exp(-1 / 42);
const atlLambda = Math.exp(-1 / 7);

let ctl = 42; // seed
let atl = 45; // seed

const pmc = [];
for (let i = 0; i < continuousDays.length; i++) {
  const day = continuousDays[i];
  ctl = ctl * ctlLambda + day.load * (1 - ctlLambda);
  atl = atl * atlLambda + day.load * (1 - atlLambda);
  const tsb = ctl - atl;
  pmc.push({
    date: day.date,
    load: day.load,
    ctl: Math.round(ctl * 10) / 10,
    atl: Math.round(atl * 10) / 10,
    tsb: Math.round(tsb * 10) / 10,
  });
}

console.log("\nLast 5 days of Intervals rTSS PMC:");
pmc.slice(-5).forEach((p) => console.log(p));

console.log("\nSample workout comparison (Tue 11 Aug):");
const aug11Act = activities.find(
  (a) => new Date(a.start_time).toISOString().split("T")[0] === "2026-08-11"
);
if (aug11Act) {
  console.log("Aug 11 workout:", aug11Act.name, "dist:", (aug11Act.distance_meters / 1000).toFixed(2), "km, pace:", aug11Act.avg_pace_sec, "Computed rTSS:", computeRtss(aug11Act));
}
