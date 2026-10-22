import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { callCorosMcpTool } from "@/lib/coros-mcp";
import { getCurrentAthleteId } from "@/lib/session";
import { extractClimbSegments, FitRecordLike } from "@/lib/analytics";
import FitParserModule from "fit-file-parser";

type FitParserInstance = {
  parse: (
    buffer: Buffer,
    callback: (err: unknown, data?: { records?: FitRecordLike[] }) => void
  ) => void;
};

type FitParserConstructor = new (options: Record<string, unknown>) => FitParserInstance;

const FitParser = ((FitParserModule as { default?: FitParserConstructor }).default ||
  FitParserModule) as FitParserConstructor;

export const maxDuration = 60;

// Prevent overlapping batch runs from hammering the COROS MCP endpoint
let backfillInFlight = false;

const RUN_SPORTS = new Set(["run", "trail_run", "track_run", "running", "trail"]);

interface ActivityRow {
  id: string;
  coros_id: string | null;
  sport_type: string;
  raw_data: string | null;
  athlete_id: string | null;
}

function resolveSportTypeCode(sportType: string, rawData: string): number {
  if (sportType === "trail_run" || sportType === "trail") return 102;
  if (sportType === "track_run") return 103;

  const match = rawData.match(/SportType:\s*([0-9]+)/i);
  return match ? parseInt(match[1], 10) : 100;
}

function resolveLabelId(corosId: string | null, activityId: string, rawData: string): string {
  const match = rawData.match(/LabelId:\s*([0-9]+)/i);
  if (match) return match[1];
  return String(corosId || activityId).replace(/^act_/, "");
}

function parseFitRecords(buffer: Buffer): Promise<FitRecordLike[]> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ force: true, mode: "list" });
    parser.parse(buffer, (err, data) => {
      if (err) return reject(err instanceof Error ? err : new Error(String(err)));
      resolve(Array.isArray(data?.records) ? data.records : []);
    });
  });
}

export async function POST(req: NextRequest) {
  const athleteId = await getCurrentAthleteId(req);
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = (await req.json()) as unknown;
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {}

  const limit = Math.max(1, Math.min(10, Number(body.limit) || 5));
  const force = Boolean(body.force);

  if (backfillInFlight) {
    return NextResponse.json(
      { error: "Backfill already running", retryable: true },
      { status: 429 }
    );
  }

  backfillInFlight = true;

  try {
    const db = getDb();

    const pendingRes = await db.execute({
      sql: `SELECT COUNT(*) AS pending FROM activities
            WHERE athlete_id = ?
              AND sport_type IN ('run', 'trail_run', 'track_run', 'running', 'trail')
              AND COALESCE(elevation_gain, 0) >= 100
              AND ${force ? "1 = 1" : "COALESCE(climbs_analyzed_at, 0) = 0"}`,
      args: [athleteId],
    });
    const pending = Number((pendingRes.rows[0] as Record<string, unknown> | undefined)?.pending || 0);

    const candidatesRes = await db.execute({
      sql: `SELECT id, coros_id, sport_type, raw_data, athlete_id FROM activities
            WHERE athlete_id = ?
              AND sport_type IN ('run', 'trail_run', 'track_run', 'running', 'trail')
              AND COALESCE(elevation_gain, 0) >= 100
              AND ${force ? "1 = 1" : "COALESCE(climbs_analyzed_at, 0) = 0"}
            ORDER BY start_time DESC
            LIMIT ?`,
      args: [athleteId, limit],
    });

    let succeeded = 0;
    let failed = 0;
    let climbsFound = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const rawRow of candidatesRes.rows) {
      const row = rawRow as unknown as ActivityRow;
      const activityId = String(row.id);
      const sportType = String(row.sport_type || "").toLowerCase();
      if (!RUN_SPORTS.has(sportType)) continue;

      try {
        const rawData = String(row.raw_data || "");
        const labelId = resolveLabelId(row.coros_id, activityId, rawData);
        const sportTypeCode = resolveSportTypeCode(sportType, rawData);

        const mcpText = await callCorosMcpTool(
          "queryActivityFitFileDownloadUrls",
          { labelId, sportType: sportTypeCode },
          String(row.athlete_id || athleteId)
        );

        const fitUrlMatch =
          typeof mcpText === "string" ? mcpText.match(/https?:\/\/[^\s"'<>]+\.fit/i) : null;
        if (!fitUrlMatch) {
          throw new Error("FIT download URL unavailable");
        }

        const fitRes = await fetch(fitUrlMatch[0]);
        if (!fitRes.ok) {
          throw new Error(`FIT download failed (${fitRes.status})`);
        }

        const buffer = Buffer.from(await fitRes.arrayBuffer());
        const records = await parseFitRecords(buffer);
        const climbs =
          records.length > 0 && records.length <= 30000 ? extractClimbSegments(records) : [];

        await db.execute({
          sql: `UPDATE activities
                SET climb_segments = ?, ascent_time_sec = ?, climbs_analyzed_at = ?
                WHERE id = ? AND athlete_id = ?`,
          args: [
            JSON.stringify(climbs),
            climbs.reduce((sum, c) => sum + (Number(c.ascentTimeSec) || 0), 0),
            Date.now(),
            activityId,
            athleteId,
          ],
        });

        climbsFound += climbs.length;
        succeeded++;
      } catch (err) {
        failed++;
        errors.push({
          id: activityId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: succeeded + failed,
      succeeded,
      failed,
      climbsFound,
      remaining: Math.max(0, pending - succeeded),
      errors,
    });
  } finally {
    backfillInFlight = false;
  }
}
