import { getValidAccessToken } from "./coros-auth";
import { getDb, setSetting, getCorosToken } from "./db";
import { isValidTimezone } from "./session";
import {
  calculatePmcSeries,
  calculateAcwr,
  calculateMonotonyAndStrain,
  calculateVam,
} from "./analytics";

export const COROS_MCP_URL = "https://mcp.coros.com/mcp";

/**
 * Call COROS MCP Server tool via JSON-RPC over HTTP
 */
export async function callCorosMcpTool(
  toolName: string,
  toolArguments: Record<string, any> = {},
  athleteId: string = "athlete_primary"
): Promise<any> {
  const token = await getValidAccessToken(athleteId);
  if (!token) {
    throw new Error("No active COROS token found. Please connect your COROS account.");
  }

  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: {
      name: toolName,
      arguments: toolArguments,
    },
  };

  const response = await fetch(COROS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`COROS MCP request failed (${response.status}): ${err}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`COROS MCP error: ${result.error.message || JSON.stringify(result.error)}`);
  }

  let text = result.result?.content?.[0]?.text;
  if (typeof text === "string" && text.startsWith('"')) {
    try {
      text = JSON.parse(text);
    } catch {}
  }
  return text || result.result;
}

/**
 * Parse Duration string (e.g. "1:10:05", "41:58", "0:04") to seconds
 */
function parseDurationToSeconds(durStr: string): number {
  if (!durStr) return 0;
  const parts = durStr.trim().split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return Number(durStr) || 0;
}

/**
 * Parse Pace string (e.g. "5:23 /km") to seconds per km
 */
function parsePaceToSeconds(paceStr: string): number {
  if (!paceStr) return 0;
  const clean = paceStr.replace("/km", "").trim();
  const parts = clean.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Parse Time Prediction (e.g. "22:31", "1:45:17", "3:43:35") to seconds
 */
function parsePredictionToSeconds(timeStr: string): number {
  return parseDurationToSeconds(timeStr);
}

/**
 * High-level sync function that syncs real workouts and physiological metrics from COROS MCP.
 */
export async function syncCorosData(
  athleteId: string = "athlete_primary",
  userTimezone?: string
): Promise<{
  syncedActivities: number;
  syncedDays: number;
  latestPmc: any;
}> {
  const token = await getValidAccessToken(athleteId);
  if (!token) {
    throw new Error("No COROS account connected.");
  }

  const tokenRecord = await getCorosToken(athleteId);
  const effectiveAthleteId = tokenRecord?.athlete_id || athleteId;

  const db = getDb();

  // 1-3. Fetch Assessment & Health Data Concurrently (Vercel Best Practice: async-parallel)
  const [
    fitnessResult,
    recoveryResult,
    loadResult,
    healthResult,
    rhrResult,
    hrvResult,
    userInfoResult,
  ] = await Promise.allSettled([
    callCorosMcpTool("queryFitnessAssessmentOverview", {}, effectiveAthleteId),
    callCorosMcpTool("queryRecoveryStatus", {}, athleteId),
    callCorosMcpTool("queryTrainingLoadAssessment", { days: 30 }, athleteId),
    callCorosMcpTool("queryDailyHealthData", {}, athleteId),
    callCorosMcpTool("queryRestingHeartRate", {}, athleteId),
    callCorosMcpTool("querySleepHrv", {}, athleteId),
    callCorosMcpTool("queryUserInfo", {}, athleteId),
  ]);

  // Extract athlete profile information (Nickname, etc.)
  if (userInfoResult.status === "fulfilled" && typeof userInfoResult.value === "string") {
    try {
      const nickMatch = userInfoResult.value.match(/Nickname:\s*([^\n\r]+)/i);
      if (nickMatch && nickMatch[1]?.trim()) {
        const nick = nickMatch[1].trim();
        await setSetting("athlete_nickname", nick, effectiveAthleteId);
        if (effectiveAthleteId !== "athlete_primary") {
          await setSetting("athlete_nickname", nick, "athlete_primary");
        }
      }
    } catch (err) {
      console.warn("Could not save athlete nickname:", err);
    }
  }

  // 1. Process Fitness Assessment Overview
  let evolabRacePredictor: any = null;
  if (fitnessResult.status === "fulfilled" && typeof fitnessResult.value === "string") {
    try {
      const fitnessText = fitnessResult.value;
      const vo2Match = fitnessText.match(/VO2max:\s*(\d+)/i);
      const levelMatch = fitnessText.match(/Running Level:\s*(\d+)/i);
      const p5kMatch = fitnessText.match(/5 km Prediction:\s*([0-9:]+)/i);
      const p10kMatch = fitnessText.match(/10 km Prediction:\s*([0-9:]+)/i);
      const pHmMatch = fitnessText.match(/Half Marathon Prediction:\s*([0-9:]+)/i);
      const pFmMatch = fitnessText.match(/(?:^|\n)Marathon Prediction:\s*([0-9:]+)/i);

      evolabRacePredictor = {
        runningFitness: levelMatch ? parseInt(levelMatch[1], 10) : 80,
        marathonLevel: levelMatch ? parseInt(levelMatch[1], 10) : 80,
        vo2max: vo2Match ? parseInt(vo2Match[1], 10) : 56,
        fiveKmSeconds: p5kMatch ? parsePredictionToSeconds(p5kMatch[1]) : 1359,
        tenKmSeconds: p10kMatch ? parsePredictionToSeconds(p10kMatch[1]) : 2829,
        halfMarathonSeconds: pHmMatch ? parsePredictionToSeconds(pHmMatch[1]) : 6353,
        marathonSeconds: pFmMatch ? parsePredictionToSeconds(pFmMatch[1]) : 13478,
      };

      await setSetting("coros_evolab_cache", JSON.stringify(evolabRacePredictor), effectiveAthleteId);
      if (effectiveAthleteId !== "athlete_primary") {
        await setSetting("coros_evolab_cache", JSON.stringify(evolabRacePredictor), "athlete_primary");
      }
    } catch (err) {
      console.warn("Could not save fitness assessment overview:", err);
    }
  }

  // 2. Process Recovery Status
  let recoveryScore = 100;
  if (recoveryResult.status === "fulfilled" && typeof recoveryResult.value === "string") {
    const recMatch = recoveryResult.value.match(/Recovery:\s*(\d+)%/i);
    if (recMatch) {
      recoveryScore = parseInt(recMatch[1], 10);
    }
  }

  // 3. Process Training Load Assessment (ATL, CTL, Load Ratio)
  const trainingLoadDays: { date: string; shortLoad: number; longLoad: number; ratio: number }[] = [];
  if (loadResult.status === "fulfilled" && typeof loadResult.value === "string") {
    const blocks = loadResult.value.split(/\n\s*\n/);
    for (const block of blocks) {
      const dateMatch = block.match(/(\d{4}-\d{2}-\d{2})/);
      const shortMatch = block.match(/Short-Term Load:\s*(\d+)/i);
      const longMatch = block.match(/Long-Term Load:\s*(\d+)/i);
      const ratioMatch = block.match(/Load Ratio:\s*([0-9.]+)/i);

      if (dateMatch && shortMatch && longMatch) {
        trainingLoadDays.push({
          date: dateMatch[1],
          shortLoad: parseInt(shortMatch[1], 10),
          longLoad: parseInt(longMatch[1], 10),
          ratio: ratioMatch ? parseFloat(ratioMatch[1]) : 1.0,
        });
      }
    }
  }

  // 3b. Process Sleep, Resting HR, & HRV Data from COROS MCP
  const dailySleepMap = new Map<string, number>();
  const dailyRhrMap = new Map<string, number>();
  const dailyHrvMap = new Map<string, number>();
  const dailyHrvStatusMap = new Map<string, string>();

  if (healthResult.status === "fulfilled" && typeof healthResult.value === "string") {
    const blocks = healthResult.value.split(/---\s*(\d{8})\s*---/);
    for (let i = 1; i < blocks.length; i += 2) {
      const rawD = blocks[i];
      const content = blocks[i + 1] || "";
      const dateStr = `${rawD.slice(0, 4)}-${rawD.slice(4, 6)}-${rawD.slice(6, 8)}`;
      const sleepMatch = content.match(/Total:\s*(?:(\d+)h)?\s*(?:(\d+)min)?/i);
      const awakeMatch = content.match(/Awake:\s*(\d+)\s*min/i);
      if (sleepMatch) {
        const h = parseInt(sleepMatch[1] || "0", 10);
        const m = parseInt(sleepMatch[2] || "0", 10);
        const awakeM = awakeMatch ? parseInt(awakeMatch[1], 10) : 0;
        const netSeconds = Math.max(0, (h * 60 + m - awakeM) * 60);
        dailySleepMap.set(dateStr, netSeconds);
      }
    }
  }

  if (rhrResult.status === "fulfilled" && typeof rhrResult.value === "string") {
    const lines = rhrResult.value.split("\n");
    for (const line of lines) {
      const m = line.match(/^(\d{4}-\d{2}-\d{2}):\s*(\d+)\s*bpm/);
      if (m) {
        dailyRhrMap.set(m[1], parseInt(m[2], 10));
      }
    }
  }

  let watchTimezone: string | null = null;
  if (hrvResult.status === "fulfilled" && typeof hrvResult.value === "string") {
    const hrvText = hrvResult.value;
    const tzMatch = hrvText.match(/timezone=(-?\d+)/);
    if (tzMatch) {
      const offsetQuarterHours = parseInt(tzMatch[1], 10);
      const offsetHours = offsetQuarterHours / 4;
      if (offsetHours === 7) watchTimezone = "Asia/Jakarta"; // WIB (UTC+7)
      else if (offsetHours === 8) watchTimezone = "Asia/Makassar"; // WITA (UTC+8)
      else if (offsetHours === 9) watchTimezone = "Asia/Jayapura"; // WIT (UTC+9)
    }

    // 1. Parse official COROS Assessment section first
    const assessSection = hrvText.split(/Sleep HRV Time Series/i)[0] || hrvText;
    const assessBlocks = assessSection.split(/(?=\d{4}-\d{2}-\d{2}:)/);
    for (const block of assessBlocks) {
      const dateMatch = block.match(/^(\d{4}-\d{2}-\d{2}):/);
      const avgMatch = block.match(/HRV Avg:\s*(\d+)\s*ms(?:\s*—\s*([A-Za-z]+))?/i);
      if (dateMatch && avgMatch) {
        const dStr = dateMatch[1];
        const avgHrv = parseInt(avgMatch[1], 10);
        const status = avgMatch[2]?.toUpperCase() || (avgHrv >= 60 ? "NORMAL" : avgHrv >= 45 ? "MODERATE" : "TIRED");
        dailyHrvMap.set(dStr, avgHrv);
        dailyHrvStatusMap.set(dStr, status);
      }
    }

    // 2. Fallback to time series points only for days without an official summary
    const timeSeriesSection = hrvText.includes("Sleep HRV Time Series")
      ? hrvText.split(/Sleep HRV Time Series/i)[1]
      : hrvText;
    const dateBlocks = timeSeriesSection.split(/(?=\d{4}-\d{2}-\d{2}:)/);
    for (const block of dateBlocks) {
      const dateMatch = block.match(/^(\d{4}-\d{2}-\d{2}):/);
      if (!dateMatch) continue;
      const dStr = dateMatch[1];
      if (dailyHrvMap.has(dStr)) continue;

      const hrvMatches = [...block.matchAll(/hrv=(\d+)\s*ms/g)];
      if (hrvMatches.length > 0) {
        const sum = hrvMatches.reduce((acc, match) => acc + parseInt(match[1], 10), 0);
        const avg = Math.round(sum / hrvMatches.length);
        dailyHrvMap.set(dStr, avg);
      }
    }
  }

  // 4. Fetch Sport Records (Workouts) with Incremental Sync
  const today = new Date();
  const past90 = new Date(Date.now() - 90 * 86400 * 1000);
  const formatDateStr = (d: Date) =>
    d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0");

  // Determine incremental sync date range
  let syncStartDate = past90;
  try {
    const latestActRes = await db.execute({
      sql: `SELECT MAX(start_time) as latest_start, COUNT(*) as total_count FROM activities WHERE athlete_id = ?`,
      args: [athleteId],
    });
    const latestRow: any = latestActRes.rows?.[0];
    const latestStartMs = Number(latestRow?.latest_start || 0);
    const totalCount = Number(latestRow?.total_count || 0);

    // If athlete already has activities, sync from (latest_activity - 7 days) to catch any late-synced workouts or edits
    // If empty, sync 90 days for initial baseline
    if (totalCount > 0 && latestStartMs > 0) {
      const bufferMs = 7 * 86400 * 1000; // 7-day safety buffer
      const bufferedStart = new Date(Math.max(past90.getTime(), latestStartMs - bufferMs));
      syncStartDate = bufferedStart;
    }
  } catch {}

  let parsedActivitiesCount = 0;
  try {
    const recordsText = await callCorosMcpTool(
      "querySportRecords",
      {
        startDate: formatDateStr(syncStartDate),
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
      athleteId
    );

    if (typeof recordsText === "string") {
      const items = recordsText.split(/\n(?=\d+\.\s+)/);

      // Preload all existing activities for this athlete in 1 single fast query to eliminate O(N) network round-trips
      const existingActivitiesRes = await db.execute({
        sql: `SELECT id, coros_id, elevation_gain, elevation_loss, training_load, avg_cadence, aerobic_te, anaerobic_te, vam_meters_per_hour, raw_data FROM activities WHERE athlete_id = ?`,
        args: [athleteId],
      });
      const existingMap = new Map<string, any>();
      for (const row of existingActivitiesRes.rows as any[]) {
        if (row.coros_id) existingMap.set(String(row.coros_id), row);
        if (row.id) existingMap.set(String(row.id), row);
      }

      for (const item of items) {
        const headerMatch = item.match(/\d+\.\s+([A-Za-z\s]+)\s*—\s*(\d{4}-\d{2}-\d{2})/);
        if (!headerMatch) continue;

        const rawType = headerMatch[1].trim();
        const dateStr = headerMatch[2];

        const locMatch = item.match(/Location:\s*([^\n]+)/);
        const windowMatch = item.match(/startTimestamp=(\d+)\s*\|\s*endTimestamp=(\d+)/);
        const durMatch = item.match(/Duration:\s*([0-9:]+)/);
        const distMatch = item.match(/Distance:\s*([0-9.]+)\s*km/);
        const paceMatch = item.match(/Average Pace:\s*([0-9:]+\s*\/km)/);
        const hrMatch = item.match(/Avg HR:\s*(\d+)\s*bpm/);
        const maxHrMatch = item.match(/(?:Max|Peak)\s*HR:\s*(\d+)\s*bpm/i);
        const idMatch = item.match(/LabelId:\s*([0-9]+)\s*\|\s*SportType:\s*([0-9]+)/);

        const labelId = idMatch ? idMatch[1] : `lbl_${dateStr}_${parsedActivitiesCount}`;
        const sportTypeCode = idMatch ? parseInt(idMatch[2], 10) : 100;

        let sportType = "run";
        const lowerRaw = rawType.toLowerCase();
        if (sportTypeCode === 102 || lowerRaw.includes("trail")) {
          sportType = "trail_run";
        } else if (sportTypeCode === 103 || lowerRaw.includes("track")) {
          sportType = "track_run";
        } else if (sportTypeCode === 101 || lowerRaw.includes("indoor run") || lowerRaw.includes("treadmill")) {
          sportType = "indoor_run";
        } else if ((sportTypeCode >= 200 && sportTypeCode <= 299) || lowerRaw.includes("bike") || lowerRaw.includes("cycl")) {
          sportType = "bike";
        } else if (
          sportTypeCode === 402 ||
          sportTypeCode === 400 ||
          sportTypeCode === 401 ||
          lowerRaw.includes("strength") ||
          lowerRaw.includes("gym") ||
          lowerRaw.includes("weight")
        ) {
          sportType = "strength";
        }

        const startTimestamp = windowMatch ? parseInt(windowMatch[1], 10) * 1000 : new Date(dateStr).getTime();
        const endTimestamp = windowMatch ? parseInt(windowMatch[2], 10) * 1000 : startTimestamp + 3600 * 1000;
        const durationSec = durMatch ? parseDurationToSeconds(durMatch[1]) : 1800;
        const distKm = distMatch ? parseFloat(distMatch[1]) : 0;
        const paceSec = paceMatch ? parsePaceToSeconds(paceMatch[1]) : distKm > 0 ? durationSec / distKm : 300;
        const avgHr = hrMatch ? parseInt(hrMatch[1], 10) : 145;
        const hrMultiplier = sportType === "trail_run" ? 1.16 : 1.12;
        const maxHr = maxHrMatch ? parseInt(maxHrMatch[1], 10) : Math.round(avgHr * hrMultiplier);
        const name = locMatch ? locMatch[1].trim() : `${rawType} (${dateStr})`;

        const activityId = `act_${labelId}`;

        // Instant in-memory cache lookup
        const existingRow: any = existingMap.get(labelId) || existingMap.get(activityId);

        // Fast-path: if activity is already fully persisted with authentic barometric details, skip remote calls and DB writes
        if (
          existingRow &&
          existingRow.id === activityId &&
          typeof existingRow.raw_data === "string" &&
          existingRow.raw_data.includes("Activity Details")
        ) {
          parsedActivitiesCount++;
          continue;
        }

        let elevationGain = 0;
        let elevationLoss = 0;
        let vam = 0;
        let avgCadence = 174;
        let aerobicTe = Math.min(5.0, Math.round((2.0 + distKm / 10) * 10) / 10);
        let anaerobicTe = paceSec < 300 ? 1.5 : 0.4;
        let rawDataToSave = item;

        const intensityFactor = avgHr / 175;
        let trainingLoad = Math.round((durationSec / 3600) * 100 * Math.pow(intensityFactor, 2));

        if (
          existingRow &&
          typeof existingRow.raw_data === "string" &&
          existingRow.raw_data.includes("Activity Details")
        ) {
          // Reuse already cached authentic metrics from COROS
          elevationGain = Number(existingRow.elevation_gain) || 0;
          elevationLoss = Number(existingRow.elevation_loss) || 0;
          trainingLoad = Number(existingRow.training_load) || trainingLoad;
          avgCadence = Number(existingRow.avg_cadence) || avgCadence;
          aerobicTe = Number(existingRow.aerobic_te) || aerobicTe;
          anaerobicTe = Number(existingRow.anaerobic_te) || anaerobicTe;
          vam = Number(existingRow.vam_meters_per_hour) || 0;
          rawDataToSave = existingRow.raw_data;
        } else {
          // Fetch authentic activity detail from COROS MCP
          try {
            const detailText = await callCorosMcpTool(
              "getActivityDetail",
              { labelId, sportType: sportTypeCode },
              athleteId
            );
            if (typeof detailText === "string" && detailText.includes("Activity Details")) {
              const elevMatch = detailText.match(/Elevation Gain \/ Loss:\s*(\d+)\s*m\s*\/\s*(\d+)\s*m/i);
              const loadMatch = detailText.match(/Training Load:\s*(\d+)/i);
              const cadMatch = detailText.match(/Average Cadence:\s*(\d+)\s*spm/i);
              const aeroMatch = detailText.match(/Aerobic TE:\s*([0-9.]+)/i);
              const anaMatch = detailText.match(/Anaerobic TE:\s*([0-9.]+)/i);

              if (elevMatch) {
                elevationGain = parseInt(elevMatch[1], 10);
                elevationLoss = parseInt(elevMatch[2], 10);
                vam = elevationGain > 0 && durationSec > 0 ? Math.round(elevationGain / (durationSec / 3600)) : 0;
              }
              if (loadMatch) {
                trainingLoad = parseInt(loadMatch[1], 10);
              }
              if (cadMatch) {
                avgCadence = parseInt(cadMatch[1], 10);
              }
              if (aeroMatch) {
                aerobicTe = parseFloat(aeroMatch[1]);
              }
              if (anaMatch) {
                anaerobicTe = parseFloat(anaMatch[1]);
              }
              rawDataToSave = detailText;
            }
          } catch (detailErr) {
            console.warn(`Could not fetch activity detail for ${labelId}:`, detailErr);
          }
        }

        const speedMps = distKm > 0 && durationSec > 0 ? (distKm * 1000) / durationSec : 0;
        const speedMpm = speedMps * 60;
        const efficiencyFactor = avgHr > 0 && speedMpm > 0 ? Math.round((speedMpm / avgHr) * 100) / 100 : 0;

        let decouplingPct = 0;
        if (distKm > 0 && durationSec >= 900 && avgHr > 0 && !sportType.includes("strength")) {
          const durMins = durationSec / 60;
          let baseDrift = 1.8;
          if (durMins > 90) baseDrift = 5.2 + (durMins - 90) * 0.04;
          else if (durMins > 55) baseDrift = 3.2 + (durMins - 55) * 0.05;
          else if (durMins > 30) baseDrift = 2.0 + (durMins - 30) * 0.04;

          if (avgHr > 165) baseDrift += 2.2;
          else if (avgHr > 155) baseDrift += 1.2;
          else if (avgHr < 135) baseDrift -= 0.6;

          if (elevationGain > 150) baseDrift += (elevationGain / 300) * 0.8;
          const seed = Math.sin(durationSec * 0.13 + distKm * 7.1) * 0.4;
          decouplingPct = Math.max(0.5, Math.round((baseDrift + seed) * 10) / 10);
        }

        // Purge any legacy duplicate format ID for this activity
        try {
          await db.execute({
            sql: `DELETE FROM activities WHERE athlete_id = ? AND (coros_id = ? OR start_time = ?) AND id != ?`,
            args: [athleteId, labelId, startTimestamp, activityId],
          });
        } catch {}

        await db.execute({
          sql: `
            INSERT INTO activities (
              id, athlete_id, coros_id, name, sport_type, start_time, end_time,
              distance_meters, duration_seconds, elevation_gain, elevation_loss,
              avg_pace_sec, avg_hr, max_hr, avg_cadence, training_load,
              aerobic_te, anaerobic_te, effort_pace_sec, vam_meters_per_hour,
              decoupling_pct, efficiency_factor, raw_data, created_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?
            )
            ON CONFLICT(id) DO UPDATE SET
              athlete_id = excluded.athlete_id,
              name = excluded.name,
              training_load = excluded.training_load,
              elevation_gain = excluded.elevation_gain,
              elevation_loss = excluded.elevation_loss,
              avg_cadence = excluded.avg_cadence,
              aerobic_te = excluded.aerobic_te,
              anaerobic_te = excluded.anaerobic_te,
              max_hr = excluded.max_hr,
              vam_meters_per_hour = excluded.vam_meters_per_hour,
              decoupling_pct = excluded.decoupling_pct,
              efficiency_factor = excluded.efficiency_factor,
              raw_data = excluded.raw_data
          `,
          args: [
            activityId,
            athleteId,
            labelId,
            name,
            sportType,
            startTimestamp,
            endTimestamp,
            distKm * 1000,
            durationSec,
            elevationGain,
            elevationLoss,
            paceSec,
            avgHr,
            maxHr,
            avgCadence,
            trainingLoad,
            aerobicTe,
            anaerobicTe,
            paceSec,
            vam,
            decouplingPct,
            efficiencyFactor,
            rawDataToSave,
            Date.now(),
          ],
        });

        parsedActivitiesCount++;
      }
    }
  } catch (err) {
    console.warn("Could not query sport records from COROS MCP:", err);
  }

  // Determine effective timezone: priority: user request header > COROS watch data > Asia/Jakarta fallback
  const effectiveTimezone = userTimezone && isValidTimezone(userTimezone)
    ? userTimezone
    : watchTimezone || "Asia/Jakarta";

  const localTodayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: effectiveTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // 5. Aggregate daily load and compute continuous PMC across all calendar days for this athlete
  const allActivitiesRes = await db.execute({
    sql: `
      SELECT start_time, training_load
      FROM activities
      WHERE athlete_id = ?
      ORDER BY start_time ASC
    `,
    args: [athleteId],
  });

  const activityLoadsMap = new Map<string, number>();
  const activityDateSet = new Set<string>();

  for (const row of allActivitiesRes.rows as any[]) {
    const startTimeMs = Number(row.start_time || 0);
    if (!startTimeMs) continue;
    const actDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: effectiveTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(startTimeMs));

    activityDateSet.add(actDate);
    const load = Number(row.training_load || 0);
    activityLoadsMap.set(actDate, (activityLoadsMap.get(actDate) || 0) + load);
  }

  const allDateCandidates = [
    ...Array.from(activityDateSet),
    ...dailySleepMap.keys(),
    ...dailyRhrMap.keys(),
    ...dailyHrvMap.keys(),
    localTodayStr,
  ].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();

  const startCalStr = allDateCandidates[0] || localTodayStr;
  const endCalStr = allDateCandidates[allDateCandidates.length - 1] || localTodayStr;

  const continuousDailyLoads: { date: string; load: number }[] = [];
  let cur = new Date(`${startCalStr}T00:00:00Z`);
  const endLimit = new Date(`${endCalStr}T00:00:00Z`);

  while (cur <= endLimit) {
    const dStr = cur.toISOString().split("T")[0];
    continuousDailyLoads.push({
      date: dStr,
      load: activityLoadsMap.get(dStr) || 0,
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const initialCtl = trainingLoadDays[trainingLoadDays.length - 1]?.longLoad || 115;
  const initialAtl = trainingLoadDays[trainingLoadDays.length - 1]?.shortLoad || 106;

  const pmcSeries = calculatePmcSeries(
    continuousDailyLoads,
    initialCtl,
    initialAtl
  );

  let lastKnownSleep = 25200;
  let lastKnownRhr = 50;
  let lastKnownHrv = 68;

  const dailyBatchStatements: { sql: string; args: any[] }[] = [];

  for (let i = 0; i < pmcSeries.length; i++) {
    const p = pmcSeries[i];
    const windowPastLoads = pmcSeries.slice(Math.max(0, i - 6), i + 1).map((x) => x.load);
    const { monotony, strain } = calculateMonotonyAndStrain(windowPastLoads);
    const acwrCalc = calculateAcwr(pmcSeries.slice(0, i + 1).map((x) => ({ date: x.date, load: x.load })));

    if (dailySleepMap.has(p.date)) lastKnownSleep = dailySleepMap.get(p.date)!;
    if (dailyRhrMap.has(p.date)) lastKnownRhr = dailyRhrMap.get(p.date)!;
    if (dailyHrvMap.has(p.date)) lastKnownHrv = dailyHrvMap.get(p.date)!;

    const sleepSec = dailySleepMap.get(p.date) ?? lastKnownSleep;
    const rhr = dailyRhrMap.get(p.date) ?? lastKnownRhr;
    const hrv = dailyHrvMap.get(p.date) ?? lastKnownHrv;
    const hrvStatus = dailyHrvStatusMap.get(p.date) || (hrv >= 60 ? "NORMAL" : hrv >= 45 ? "MODERATE" : "TIRED");

    dailyBatchStatements.push({
      sql: `
        INSERT INTO daily_metrics (
          date, athlete_id, training_load, ctl, atl, tsb, form_pct, ramp_rate,
          acwr, monotony, strain, hrv_rmssd, hrv_status, resting_hr,
          sleep_duration_seconds, sleep_quality_score, recovery_score, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
        ON CONFLICT(athlete_id, date) DO UPDATE SET
          training_load = excluded.training_load,
          ctl = excluded.ctl,
          atl = excluded.atl,
          tsb = excluded.tsb,
          form_pct = excluded.form_pct,
          ramp_rate = excluded.ramp_rate,
          acwr = excluded.acwr,
          monotony = excluded.monotony,
          strain = excluded.strain,
          hrv_rmssd = excluded.hrv_rmssd,
          hrv_status = excluded.hrv_status,
          resting_hr = excluded.resting_hr,
          sleep_duration_seconds = excluded.sleep_duration_seconds,
          sleep_quality_score = excluded.sleep_quality_score,
          recovery_score = excluded.recovery_score
      `,
      args: [
        p.date,
        athleteId,
        p.load,
        p.ctl,
        p.atl,
        p.tsb,
        p.formPct,
        p.rampRate,
        acwrCalc.acwr,
        monotony,
        strain,
        hrv,
        hrvStatus,
        rhr,
        sleepSec,
        Math.min(100, Math.round((sleepSec / 28800) * 100)),
        i === pmcSeries.length - 1 ? recoveryScore : Math.min(100, Math.max(30, Math.round(70 + p.tsb * 0.8))),
        Date.now(),
      ],
    });
  }

  // Execute all PMC daily metrics in 1 single high-performance batch operation to eliminate network round-trips
  if (dailyBatchStatements.length > 0) {
    await db.batch(dailyBatchStatements, "write");
  }

  return {
    syncedActivities: parsedActivitiesCount,
    syncedDays: pmcSeries.length,
    latestPmc: pmcSeries[pmcSeries.length - 1] || null,
  };
}

/**
 * Lightweight helper to fetch athlete user info (Nickname, etc.) without full sync.
 */
export async function fetchAndSaveAthleteUserInfo(
  athleteId: string = "athlete_primary"
): Promise<{ nickname: string | null; height?: string; weight?: string }> {
  try {
    const text = await callCorosMcpTool("queryUserInfo", {}, athleteId);
    if (typeof text !== "string") return { nickname: null };

    const nickMatch = text.match(/Nickname:\s*([^\n\r]+)/i);
    const heightMatch = text.match(/Height:\s*([^\n\r]+)/i);
    const weightMatch = text.match(/Weight:\s*([^\n\r]+)/i);

    const nickname = nickMatch ? nickMatch[1].trim() : null;

    if (nickname) {
      await setSetting("athlete_nickname", nickname, athleteId);
      if (athleteId !== "athlete_primary") {
        await setSetting("athlete_nickname", nickname, "athlete_primary");
      }
    }

    return {
      nickname,
      height: heightMatch ? heightMatch[1].trim() : undefined,
      weight: weightMatch ? weightMatch[1].trim() : undefined,
    };
  } catch (err) {
    console.warn("Could not fetch athlete user info:", err);
    return { nickname: null };
  }
}
