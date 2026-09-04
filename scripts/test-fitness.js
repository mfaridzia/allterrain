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
  return data.result?.content?.[0]?.text;
}

async function run() {
  console.log("=== FITNESS OVERVIEW ===");
  console.log(await callTool("queryFitnessAssessmentOverview", {}));

  console.log("=== RECOVERY STATUS ===");
  console.log(await callTool("queryRecoveryStatus", {}));

  console.log("=== TRAINING LOAD ===");
  console.log(await callTool("queryTrainingLoadAssessment", { days: 7 }));
}

run().catch(console.error);
