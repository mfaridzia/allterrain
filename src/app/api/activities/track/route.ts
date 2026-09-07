import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { callCorosMcpTool } from "@/lib/coros-mcp";
import { getCurrentAthleteId } from "@/lib/session";
// @ts-ignore
import FitParserModule from "fit-file-parser";
const FitParser = (FitParserModule as any).default || FitParserModule;

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Ramer-Douglas-Peucker (RDP) trajectory simplification algorithm
 */
function simplifyRdp(points: LatLng[], epsilon: number): LatLng[] {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const a = points[0];
  const b = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const numerator = Math.abs(
      (b.lat - a.lat) * p.lng - (b.lng - a.lng) * p.lat + b.lng * a.lat - b.lat * a.lng
    );
    const denominator = Math.sqrt(Math.pow(b.lat - a.lat, 2) + Math.pow(b.lng - a.lng, 2));
    const d = denominator === 0 ? 0 : numerator / denominator;
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const rec1 = simplifyRdp(points.slice(0, index + 1), epsilon);
    const rec2 = simplifyRdp(points.slice(index), epsilon);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  } else {
    return [a, b];
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const activityId = url.searchParams.get("id");

  if (!activityId) {
    return NextResponse.json({ error: "Missing activity id" }, { status: 400 });
  }

  const athleteId = await getCurrentAthleteId(req);
  const db = getDb();

  try {
    // 1. Check if activity exists in database
    const actRes = await db.execute({
      sql: `SELECT id, coros_id, sport_type, raw_data, gps_track, athlete_id FROM activities WHERE id = ? LIMIT 1`,
      args: [activityId],
    });

    if (actRes.rows.length === 0) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const act = actRes.rows[0] as any;

    // 2. Return cached GPS track if already parsed
    if (act.gps_track) {
      try {
        const cached = JSON.parse(act.gps_track);
        if (Array.isArray(cached) && cached.length > 2) {
          return NextResponse.json({
            success: true,
            isRealGps: true,
            points: cached,
            cached: true,
          });
        }
      } catch {}
    }

    // 3. Skip indoor / strength sports with no GPS
    const sportType = String(act.sport_type || "").toLowerCase();
    if (
      sportType.includes("strength") ||
      sportType.includes("gym") ||
      sportType.includes("indoor") ||
      sportType.includes("treadmill")
    ) {
      return NextResponse.json({
        success: true,
        isRealGps: false,
        points: null,
        reason: "indoor_workout",
      });
    }

    // 4. Extract labelId and sportTypeCode
    const rawData = String(act.raw_data || "");
    const labelMatch = rawData.match(/LabelId:\s*([0-9]+)/i);
    const sportTypeMatch = rawData.match(/SportType:\s*([0-9]+)/i);

    const labelId = labelMatch ? labelMatch[1] : String(act.coros_id || act.id).replace(/^act_/, "");
    let sportTypeCode = sportTypeMatch ? parseInt(sportTypeMatch[1], 10) : 100;
    if (sportType === "trail_run") sportTypeCode = 102;
    else if (sportType === "track_run") sportTypeCode = 103;
    else if (sportType === "bike") sportTypeCode = 200;

    const targetAthleteId = act.athlete_id || athleteId || "athlete_primary";

    // 5. Query COROS MCP for FIT file download URL
    const mcpText = await callCorosMcpTool(
      "queryActivityFitFileDownloadUrls",
      {
        labelId,
        sportType: sportTypeCode,
      },
      targetAthleteId
    );

    const fitUrlMatch = typeof mcpText === "string" ? mcpText.match(/https:\/\/s3\.coros\.com\/fit\/[^\s\)\n]+\.fit/i) : null;
    if (!fitUrlMatch) {
      return NextResponse.json({
        success: true,
        isRealGps: false,
        points: null,
        reason: "fit_url_unavailable",
      });
    }

    const fitUrl = fitUrlMatch[0];

    // 6. Download FIT file binary
    const fitRes = await fetch(fitUrl);
    if (!fitRes.ok) {
      throw new Error(`Failed to download FIT file from S3: ${fitRes.statusText}`);
    }

    const arrayBuffer = await fitRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 7. Parse FIT file with fit-file-parser
    const rawGpsPoints: LatLng[] = await new Promise((resolve, reject) => {
      const fitParser = new FitParser({
        force: true,
        mode: "list",
      });

      fitParser.parse(buffer, (err: any, data: any) => {
        if (err) {
          return reject(err);
        }
        const records = data?.records || [];
        const pts: LatLng[] = [];
        for (const r of records) {
          if (r.position_lat != null && r.position_long != null) {
            pts.push({
              lat: Number(r.position_lat),
              lng: Number(r.position_long),
            });
          }
        }
        resolve(pts);
      });
    });

    if (!rawGpsPoints || rawGpsPoints.length < 5) {
      // Record empty in DB to avoid retrying continuously
      await db.execute({
        sql: `UPDATE activities SET gps_track = ? WHERE id = ?`,
        args: ["[]", act.id],
      });
      return NextResponse.json({
        success: true,
        isRealGps: false,
        points: null,
        reason: "no_gps_points_in_fit",
      });
    }

    // 8. Simplify trajectory using RDP (0.00004 deg approx 4m tolerance)
    const simplified = simplifyRdp(rawGpsPoints, 0.00004);

    // 9. Cache in database
    await db.execute({
      sql: `UPDATE activities SET gps_track = ? WHERE id = ?`,
      args: [JSON.stringify(simplified), act.id],
    });

    return NextResponse.json({
      success: true,
      isRealGps: true,
      points: simplified,
      cached: false,
    });
  } catch (err: any) {
    console.error("Failed to fetch/parse activity GPS track:", err);
    return NextResponse.json({
      success: false,
      isRealGps: false,
      error: err.message || "Failed to process GPS track",
    });
  }
}
