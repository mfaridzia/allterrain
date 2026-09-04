const Database = require("better-sqlite3");

const db = new Database("data/coros_athlete.db");
const row = db.prepare("SELECT access_token FROM auth_tokens WHERE id = 'coros_primary'").get();
const token = row.access_token;

async function testAllItems() {
  const today = new Date();
  const past90 = new Date(Date.now() - 90 * 86400 * 1000);
  const formatDateStr = (d) =>
    d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0");

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
      params: {
        name: "querySportRecords",
        arguments: {
          startDate: formatDateStr(past90),
          endDate: formatDateStr(today),
          sportTypeCodes: [100, 101, 102, 103, 104, 105, 200, 201, 65535],
          minDistanceKm: 0,
          maxDistanceKm: 9999,
          minDurationMinutes: 0,
          maxDurationMinutes: 9999,
          maxAveragePace: "99:00",
          locationKeyword: "",
          limit: 100,
        },
      },
    }),
  });

  const data = await res.json();
  const text = data.result?.content?.[0]?.text;
  const items = text.split(/\n(?=\d+\.\s+)/);
  console.log("Total raw items:", items.length);

  let matched = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const headerMatch = item.match(/\d+\.\s+([A-Za-z\s]+)\s*—\s*(\d{4}-\d{2}-\d{2})/);
    if (headerMatch) {
      matched++;
    } else {
      console.log(`Failed header match on item ${i}:`, item.slice(0, 80));
    }
  }
  console.log("Total matched:", matched);
}

testAllItems().catch(console.error);
