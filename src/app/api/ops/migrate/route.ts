import { NextRequest, NextResponse } from "next/server";
import { getDb, initSchema } from "@/lib/db";
import { getCurrentAthleteId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OWNER_ATHLETE_ID = "a1eb63e96de04fc1b48785bc47d0676a";
const REQUIRED_COLUMNS = ["climb_segments", "ascent_time_sec", "climbs_analyzed_at"];

/**
 * Idempotent schema migration endpoint for production (Turso).
 *
 * Runs the same CREATE TABLE / ALTER TABLE batch as the runtime initializer,
 * then verifies that the Uphill Score columns actually exist. Safe to call
 * repeatedly.
 *
 * Auth: owner athlete session, or `?key=` / `x-ops-key` matching
 * ADMIN_SECRET_KEY / OPS_SECRET_KEY. The secret must be configured in
 * production; development bypasses auth.
 */
async function runMigration(req: NextRequest) {
  const currentAthleteId = await getCurrentAthleteId(req);
  const url = req.nextUrl;
  const passedKey = url.searchParams.get("key") || req.headers.get("x-ops-key");
  const envSecret = process.env.ADMIN_SECRET_KEY || process.env.OPS_SECRET_KEY;
  const envAdminId = process.env.ADMIN_ATHLETE_ID;

  const isOwner =
    currentAthleteId === OWNER_ATHLETE_ID ||
    Boolean(envAdminId && currentAthleteId === envAdminId);
  const hasValidKey = Boolean(envSecret && passedKey === envSecret);
  const isAuthorized = isOwner || hasValidKey || process.env.NODE_ENV !== "production";

  if (!isAuthorized) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const databaseMode = process.env.TURSO_DATABASE_URL
    ? "Turso Cloud LibSQL"
    : "Local SQLite (data/coros_athlete.db)";

  try {
    const db = getDb();
    await initSchema(db);

    const info = await db.execute("PRAGMA table_info(activities)");
    const columns = new Set(info.rows.map((row) => String(row.name)));
    const missing = REQUIRED_COLUMNS.filter((name) => !columns.has(name));

    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          databaseMode,
          error: "Schema verification failed",
          missing,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      databaseMode,
      verifiedColumns: REQUIRED_COLUMNS,
      message: "Schema is up to date.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        databaseMode,
        error: error instanceof Error ? error.message : "Migration failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return runMigration(req);
}

export async function GET(req: NextRequest) {
  return runMigration(req);
}
