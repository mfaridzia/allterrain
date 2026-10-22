import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { callCorosMcpTool } from "@/lib/coros-mcp";
import { getCurrentAthleteId } from "@/lib/session";
import { calculateDecouplingFromLaps, extractClimbSegments, LapSplitItem, ClimbSegment } from "@/lib/analytics";
// @ts-ignore
import FitParserModule from "fit-file-parser";
const FitParser = (FitParserModule as any).default || FitParserModule;

interface LatLng {
  lat: number;
  lng: number;
}

function formatPaceSec(secPerKm: number): string {
  if (!secPerKm || isNaN(secPerKm) || secPerKm <= 0 || !isFinite(secPerKm)) return "--:--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
      sql: `SELECT id, coros_id, sport_type, raw_data, gps_track, lap_splits, climb_segments, climbs_analyzed_at, decoupling_pct, athlete_id FROM activities WHERE id = ? LIMIT 1`,
      args: [activityId],
    });

    if (actRes.rows.length === 0) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const act = actRes.rows[0] as any;

    // 2. Fast path: If both GPS track and lap_splits are already cached, return immediately
    let cachedGps: LatLng[] | null = null;
    let cachedLaps: LapSplitItem[] | null = null;

    if (act.gps_track) {
      try {
        const parsed = JSON.parse(act.gps_track);
        if (Array.isArray(parsed) && parsed.length > 2) {
          cachedGps = parsed;
        }
      } catch {}
    }

    if (act.lap_splits) {
      try {
        const parsed = JSON.parse(act.lap_splits);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedLaps = parsed;
        }
      } catch {}
    }

    let cachedClimbs: ClimbSegment[] = [];
    if (act.climb_segments) {
      try {
        const parsed = JSON.parse(act.climb_segments);
        if (Array.isArray(parsed)) cachedClimbs = parsed;
      } catch {}
    }

    if (cachedGps && cachedLaps) {
      // Never block the existing activity-detail path on climb extraction.
      // Climb segments are filled by the backfill endpoint and cached separately.
      return NextResponse.json({
        success: true,
        isRealGps: true,
        points: cachedGps,
        laps: cachedLaps,
        climbs: cachedClimbs,
        decouplingPct: Number(act.decoupling_pct || 0),
        cached: true,
        isAuthentic: true,
      });
    }

    // 3. Skip indoor / gym workouts without sensors
    const sportType = String(act.sport_type || "").toLowerCase();
    if (sportType === "strength" || sportType === "gym" || sportType === "weight") {
      return NextResponse.json({
        success: true,
        isRealGps: false,
        points: null,
        laps: null,
        reason: "strength_workout",
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

    const fitUrlMatch = typeof mcpText === "string" ? mcpText.match(/https?:\/\/[^\s"'<>]+\.fit/i) : null;
    if (!fitUrlMatch) {
      // If FIT file URL is unavailable but we had cached GPS, return it
      if (cachedGps) {
        return NextResponse.json({
          success: true,
          isRealGps: true,
          points: cachedGps,
          laps: cachedLaps,
          climbs: cachedClimbs,
          cached: true,
        });
      }
      return NextResponse.json({
        success: true,
        isRealGps: false,
        points: null,
        laps: null,
        reason: "fit_url_unavailable",
      });
    }

    const fitUrl = fitUrlMatch[0];

    // 6. Download FIT file binary from S3
    const fitRes = await fetch(fitUrl);
    if (!fitRes.ok) {
      throw new Error(`Failed to download FIT file from S3: ${fitRes.statusText}`);
    }

    const arrayBuffer = await fitRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 7. Parse FIT file with fit-file-parser (extracting GPS points, authentic laps, and records)
    const fitResult: { gpsPoints: LatLng[]; laps: LapSplitItem[]; climbs: ClimbSegment[] } = await new Promise((resolve, reject) => {
      const fitParser = new FitParser({
        force: true,
        mode: "list",
      });

      fitParser.parse(buffer, (err: any, data: any) => {
        if (err) {
          return reject(err);
        }

        const records = data?.records || [];
        const rawLaps = data?.laps || [];

        // Extract GPS points
        const pts: LatLng[] = [];
        for (const r of records) {
          if (r.position_lat != null && r.position_long != null) {
            pts.push({
              lat: Number(r.position_lat),
              lng: Number(r.position_long),
            });
          }
        }

        // Extract authentic laps
        const parsedLaps: LapSplitItem[] = [];

        if (rawLaps.length > 0) {
          rawLaps.forEach((lap: any, idx: number) => {
            const distM = Number(lap.total_distance || 0);
            const durSec = Number(lap.total_timer_time || lap.total_elapsed_time || 0);
            const distKm = distM / 1000;
            const paceSec = distKm > 0 && durSec > 0 ? Math.round(durSec / distKm) : 0;
            let avgCadence = lap.avg_cadence ? Math.round(lap.avg_cadence) : undefined;
            if (avgCadence && avgCadence < 120) {
              avgCadence = avgCadence * 2; // Normalize stride cycles to spm
            }

            parsedLaps.push({
              lapIndex: idx + 1,
              distanceM: Math.round(distM),
              distanceKm: Math.round(distKm * 100) / 100,
              durationSec: Math.round(durSec),
              paceSec,
              formattedPace: formatPaceSec(paceSec),
              avgHr: lap.avg_heart_rate ? Math.round(lap.avg_heart_rate) : undefined,
              maxHr: lap.max_heart_rate ? Math.round(lap.max_heart_rate) : undefined,
              avgCadence,
              elevationGainM: lap.total_ascent ? Math.round(lap.total_ascent) : 0,
              elevationLossM: lap.total_descent ? Math.round(lap.total_descent) : 0,
            });
          });
        } else if (records.length > 0) {
          // Fallback: If FIT has no separate lap messages, generate authentic 1-km splits from records
          let currentLapStartDist = 0;
          let currentLapStartTime = new Date(records[0].timestamp).getTime();
          let currentLapIndex = 1;
          let hrSum = 0;
          let hrCount = 0;
          let maxHr = 0;
          let gainSum = 0;
          let lastAlt = records[0].altitude || 0;

          for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const dist = Number(r.distance || 0);
            const hr = Number(r.heart_rate || 0);
            const alt = Number(r.altitude || 0);

            if (hr > 0) {
              hrSum += hr;
              hrCount++;
              if (hr > maxHr) maxHr = hr;
            }
            if (alt > lastAlt) {
              gainSum += alt - lastAlt;
            }
            lastAlt = alt;

            const lapDist = dist - currentLapStartDist;
            const isLast = i === records.length - 1;

            if (lapDist >= 1000 || (isLast && lapDist >= 200)) {
              const curTime = new Date(r.timestamp).getTime();
              const durSec = Math.max(1, Math.round((curTime - currentLapStartTime) / 1000));
              const distKm = lapDist / 1000;
              const paceSec = Math.round(durSec / distKm);

              parsedLaps.push({
                lapIndex: currentLapIndex++,
                distanceM: Math.round(lapDist),
                distanceKm: Math.round(distKm * 100) / 100,
                durationSec: durSec,
                paceSec,
                formattedPace: formatPaceSec(paceSec),
                avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : undefined,
                maxHr: maxHr > 0 ? maxHr : undefined,
                elevationGainM: Math.round(gainSum),
                elevationLossM: 0,
              });

              currentLapStartDist = dist;
              currentLapStartTime = curTime;
              hrSum = 0;
              hrCount = 0;
              maxHr = 0;
              gainSum = 0;
            }
          }
        }

        const climbs =
          ["run", "trail_run", "track_run", "running", "trail"].includes(sportType) &&
          records.length <= 30000
            ? extractClimbSegments(records)
            : [];

        resolve({ gpsPoints: pts, laps: parsedLaps, climbs });
      });
    });

    const { gpsPoints: rawGpsPoints, laps, climbs } = fitResult;

    // 8. Simplify trajectory using RDP if GPS points exist
    let simplifiedGps: LatLng[] = [];
    if (rawGpsPoints && rawGpsPoints.length >= 5) {
      simplifiedGps = simplifyRdp(rawGpsPoints, 0.00004);
    }

    // 9. Calculate authentic Aerobic Decoupling (Pa:HR) from real laps
    const authenticDecoupling = calculateDecouplingFromLaps(laps);

    // 10. Cache GPS track, lap_splits, and real decoupling in database
    const updates: string[] = [];
    const args: any[] = [];

    if (simplifiedGps.length > 0) {
      updates.push("gps_track = ?");
      args.push(JSON.stringify(simplifiedGps));
    }
    if (laps.length > 0) {
      updates.push("lap_splits = ?");
      args.push(JSON.stringify(laps));
    }
    updates.push("climb_segments = ?");
    args.push(JSON.stringify(climbs));
    updates.push("ascent_time_sec = ?");
    args.push(climbs.reduce((sum, c) => sum + (Number(c.ascentTimeSec) || 0), 0));
    updates.push("climbs_analyzed_at = ?");
    args.push(Date.now());
    if (authenticDecoupling !== null) {
      updates.push("decoupling_pct = ?");
      args.push(authenticDecoupling);
    }

    if (updates.length > 0) {
      args.push(act.id);
      await db.execute({
        sql: `UPDATE activities SET ${updates.join(", ")} WHERE id = ?`,
        args,
      });
    }

    return NextResponse.json({
      success: true,
      isRealGps: simplifiedGps.length > 0,
      points: simplifiedGps.length > 0 ? simplifiedGps : null,
      laps: laps.length > 0 ? laps : null,
      climbs,
      decouplingPct: authenticDecoupling ?? Number(act.decoupling_pct || 0),
      cached: false,
      isAuthentic: laps.length > 0,
    });
  } catch (err: any) {
    console.error("Failed to fetch/parse activity GPS track & laps:", err);
    return NextResponse.json({
      success: false,
      isRealGps: false,
      points: null,
      laps: null,
      error: err.message || "Failed to process GPS track & laps",
    });
  }
}
