const Database = require("better-sqlite3");
const fs = require("fs");

const db = new Database("data/coros_athlete.db");
const row = db.prepare("SELECT access_token FROM auth_tokens WHERE id = 'coros_primary'").get();
if (!row) {
  console.log("No token in DB");
  process.exit(1);
}

const token = row.access_token;

async function run() {
  const listRes = await fetch("https://mcp.coros.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }),
  });

  const listData = await listRes.json();
  const interesting = [
    "querySportRecords",
    "queryDailyHealthData",
    "queryFitnessAssessmentOverview",
    "queryTrainingLoadAssessment",
    "queryRecoveryStatus",
    "queryUserInfo",
    "querySleepHrv",
  ];

  for (const tool of listData.result.tools) {
    if (interesting.includes(tool.name)) {
      console.log(`\n================= ${tool.name} =================`);
      console.log("Description:", tool.description);
      console.log("Input Schema:", JSON.stringify(tool.inputSchema, null, 2));
    }
  }
}

run().catch(console.error);
