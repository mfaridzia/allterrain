import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentAthleteId } from "@/lib/session";

export const dynamic = "force-dynamic";

const OWNER_ATHLETE_ID = "a1eb63e96de04fc1b48785bc47d0676a";

export async function GET(req: NextRequest) {
  try {
    const currentAthleteId = await getCurrentAthleteId(req);
    const url = req.nextUrl;
    const queryKey = url.searchParams.get("key");
    const headerKey = req.headers.get("x-ops-key");
    const passedKey = queryKey || headerKey;
    const envSecret = process.env.ADMIN_SECRET_KEY || process.env.OPS_SECRET_KEY || "allterrain-ops";
    const envAdminId = process.env.ADMIN_ATHLETE_ID;

    const isOwner =
      currentAthleteId === OWNER_ATHLETE_ID ||
      (envAdminId && currentAthleteId === envAdminId);

    const hasValidKey = Boolean(passedKey && passedKey === envSecret);

    // Development bypass or authorized in production
    const isAuthorized =
      isOwner ||
      hasValidKey ||
      process.env.NODE_ENV !== "production";

    if (!isAuthorized) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const db = getDb();
    const startTimePing = Date.now();
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    // Run parallel queries
    const [
      tokensRes,
      globalActsRes,
      active7dRes,
      sessionsRes,
      perAthleteRes,
    ] = await Promise.all([
      db.execute({
        sql: `SELECT athlete_id, created_at, updated_at, athlete_info FROM auth_tokens ORDER BY updated_at DESC`,
        args: [],
      }),
      db.execute({
        sql: `SELECT count(*) as total_activities, count(DISTINCT athlete_id) as total_athletes_with_acts, coalesce(sum(distance_meters), 0) as total_dist, coalesce(sum(elevation_gain), 0) as total_gain FROM activities`,
        args: [],
      }),
      db.execute({
        sql: `SELECT count(DISTINCT athlete_id) as active_7d_athletes, count(*) as acts_7d FROM activities WHERE start_time >= ?`,
        args: [sevenDaysAgo],
      }),
      db.execute({
        sql: `SELECT count(*) as active_sessions, count(DISTINCT athlete_id) as session_athletes FROM sessions WHERE expires_at > ?`,
        args: [now],
      }),
      db.execute({
        sql: `SELECT athlete_id, count(*) as count, coalesce(sum(distance_meters), 0) as total_dist, coalesce(sum(elevation_gain), 0) as total_gain, max(start_time) as latest_act FROM activities GROUP BY athlete_id`,
        args: [],
      }),
    ]);

    const pingLatencyMs = Date.now() - startTimePing;

    // Index per-athlete activity stats
    const actStatsMap = new Map<string, { count: number; totalDistKm: number; totalGainM: number; latestAct: number | null }>();
    for (const row of perAthleteRes.rows) {
      const aId = String(row.athlete_id);
      actStatsMap.set(aId, {
        count: Number(row.count || 0),
        totalDistKm: Math.round((Number(row.total_dist || 0) / 1000) * 10) / 10,
        totalGainM: Math.round(Number(row.total_gain || 0)),
        latestAct: row.latest_act ? Number(row.latest_act) : null,
      });
    }

    // Build athlete list
    const athletes = tokensRes.rows.map((row) => {
      const aId = String(row.athlete_id);
      const stats = actStatsMap.get(aId) || {
        count: 0,
        totalDistKm: 0,
        totalGainM: 0,
        latestAct: null,
      };

      let parsedInfo = null;
      if (row.athlete_info && typeof row.athlete_info === "string") {
        try {
          parsedInfo = JSON.parse(row.athlete_info);
        } catch {}
      }

      return {
        athleteId: aId,
        isOwner: aId === OWNER_ATHLETE_ID,
        firstConnectedAt: Number(row.created_at || now),
        lastUpdatedAt: Number(row.updated_at || now),
        activityCount: stats.count,
        totalDistanceKm: stats.totalDistKm,
        totalElevationGainM: stats.totalGainM,
        latestActivityTime: stats.latestAct,
        athleteInfo: parsedInfo,
      };
    });

    const globalActsRow = globalActsRes.rows[0] || {};
    const totalActivities = Number(globalActsRow.total_activities || 0);
    const totalDistanceKm = Math.round((Number(globalActsRow.total_dist || 0) / 1000) * 10) / 10;
    const totalElevationGain = Math.round(Number(globalActsRow.total_gain || 0));

    const active7dAthletes = Number(active7dRes.rows[0]?.active_7d_athletes || 0);
    const recentActivities7d = Number(active7dRes.rows[0]?.acts_7d || 0);

    const activeSessions = Number(sessionsRes.rows[0]?.active_sessions || 0);
    const sessionAthletes = Number(sessionsRes.rows[0]?.session_athletes || 0);

    const databaseMode = process.env.TURSO_DATABASE_URL ? "Turso Cloud LibSQL" : "Local SQLite (data/coros_athlete.db)";

    return NextResponse.json({
      success: true,
      currentViewer: {
        athleteId: currentAthleteId,
        isOwner,
      },
      telemetry: {
        totalRegisteredAthletes: athletes.length,
        activeAthletes7d: Math.max(active7dAthletes, sessionAthletes),
        recentActivities7d,
        totalActivities,
        totalDistanceKm,
        totalElevationGain,
        activeSessions,
        databaseMode,
        pingLatencyMs,
        serverTimestamp: now,
      },
      athletes,
    });
  } catch (err: any) {
    console.error("Ops stats route error:", err);
    return NextResponse.json({ error: "Failed to fetch telemetry stats", message: err.message }, { status: 500 });
  }
}
