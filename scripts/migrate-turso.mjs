#!/usr/bin/env node
/**
 * Applies the Uphill Score columns to the production Turso database.
 *
 * Usage:
 *   npm run db:migrate
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:migrate
 *
 * The runtime schema initializer (src/lib/db.ts) already attempts these
 * ALTER TABLE statements on first connection. This script exists to apply
 * them explicitly before a deploy, avoiding a cold-start race where a query
 * references the new columns before initSchema() finishes.
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error(
    "TURSO_DATABASE_URL is not set. Add it to .env.local or export it before running."
  );
  process.exit(1);
}

const statements = [
  "ALTER TABLE activities ADD COLUMN climb_segments TEXT;",
  "ALTER TABLE activities ADD COLUMN ascent_time_sec INTEGER DEFAULT 0;",
  "ALTER TABLE activities ADD COLUMN climbs_analyzed_at INTEGER DEFAULT 0;",
];

const expectedColumns = ["climb_segments", "ascent_time_sec", "climbs_analyzed_at"];

const client = createClient({ url, authToken });

let failed = false;

for (const sql of statements) {
  try {
    await client.execute(sql);
    console.log(`applied  ${sql}`);
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err);
    if (/duplicate column|already exists/i.test(message)) {
      console.log(`exists   ${sql}`);
    } else {
      failed = true;
      console.error(`failed   ${sql}\n         ${message}`);
    }
  }
}

try {
  const info = await client.execute("PRAGMA table_info(activities)");
  const columns = new Set(info.rows.map((row) => String(row.name)));
  const missing = expectedColumns.filter((name) => !columns.has(name));

  if (missing.length > 0) {
    failed = true;
    console.error(`verification failed — missing: ${missing.join(", ")}`);
  } else {
    console.log(`verified — ${expectedColumns.join(", ")} present`);
  }
} catch (err) {
  failed = true;
  console.error(`verification failed — ${err instanceof Error ? err.message : String(err)}`);
} finally {
  client.close();
}

process.exit(failed ? 1 : 0);
