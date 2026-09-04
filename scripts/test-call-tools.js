const Database = require("better-sqlite3");

const db = new Database("data/coros_athlete.db");
const row = db.prepare("SELECT access_token FROM auth_tokens WHERE id = 'coros_primary'").get();
const token = row.access_token;

async function callTool(name, args) {
  const res = await fetch("https://mcp.coros.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const data = await res.json();
  const text = data.result?.content?.[0]?.text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function run() {
  console.log("=== FITNESS OVERVIEW ===");
  console.log(await callTool("queryFitnessAssessmentOverview", {}));

  console.log("=== RECOVERY STATUS ===");
  console.log(await callTool("queryRecoveryStatus", {}));

  console.log("=== TRAINING LOAD ASSESSMENT ===");
  console.log(await callTool("queryTrainingLoadAssessment", { days: 14 }));

  console.log("=== SPORT RECORDS ===");
  const today = new Date();
  const past90 = new Date(Date.now() - 90 * 86400 * 1000);
  const formatDate = (d) =>
    d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0");

  const records = await callTool("querySportRecords", {
    startDate: formatDate(past90),
    endDate: formatDate(today),
    sportTypeCodes: [100, 101, 102, 103, 104, 105, 200, 201, 65535],
    minDistanceKm: 0,
    maxDistanceKm: 9999,
    minDurationMinutes: 0,
    maxDurationMinutes: 9999,
    maxAveragePace: "99:00",
    locationKeyword: "",
    limit: 50,
  });
  console.log("SPORT RECORDS RESULT:", records);
}

run().catch(console.error);
