const Database = require("better-sqlite3");

const db = new Database("data/coros_athlete.db");
const row = db.prepare("SELECT access_token FROM auth_tokens WHERE id = 'coros_primary'").get();
const token = row.access_token;

async function checkTools() {
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
      method: "tools/list",
      params: {},
    }),
  });

  const text = await res.text();
  const data = JSON.parse(text);
  const interesting = [
    "querySportRecords",
    "queryDailyHealthData",
    "queryFitnessAssessmentOverview",
    "queryTrainingLoadAssessment",
    "queryRecoveryStatus",
    "queryUserInfo",
    "querySleepHrv",
  ];

  for (const t of data.result.tools) {
    if (interesting.includes(t.name)) {
      console.log(`\n================= ${t.name} =================`);
      console.log("Description:", t.description);
      console.log("Input Schema:", JSON.stringify(t.inputSchema, null, 2));
    }
  }
}

checkTools().catch(console.error);
