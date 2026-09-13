import { NextRequest, NextResponse } from "next/server";
import { getDb, getCorosToken, getSetting, cleanDuplicateActivities } from "@/lib/db";
import { refreshCorosToken } from "@/lib/coros-auth";
import { getCurrentAthleteId, getRequestTimezone } from "@/lib/session";
import {
  classifyFormZone,
  calculateAcwr,
  calculateMonotonyAndStrain,
  calculatePmcSeries,
  calculateTrainingReadiness,
  calculateWeeklyZoneProgression,
  calculateAthleteHrZones,
  estimateActivityHrZones,
  HrZoneCalcMethod,
  PmcPoint,
} from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const athleteId = await getCurrentAthleteId(req);
  let token = athleteId ? await getCorosToken(athleteId) : null;
  let isConnected = false;

  if (token && athleteId) {
    if (!token.expires_at || Date.now() < token.expires_at) {
      isConnected = true;
    } else if (token.refresh_token) {
      // Access token expired - auto refresh seamlessly using refresh_token
      try {
        await refreshCorosToken(athleteId);
        token = await getCorosToken(athleteId);
        isConnected = !!token;
      } catch (err) {
        console.warn(`Dashboard token refresh failed for ${athleteId}:`, err);
        isConnected = false;
      }
    }
  }

  if (!isConnected || !athleteId) {
    return NextResponse.json({
      connected: false,
      activities: [],
      pmcSeries: [],
      current: { ctl: 0, atl: 0, tsb: 0, rampRate: 0, formPct: 0 },
      acwr: { acwr: 1.0, status: "sweet_spot", label: "Baseline", description: "" },
      monotony: { monotony: 0, strain: 0, monotonyAlert: false },
      tid: { z1z2Pct: 80, z3Pct: 15, z4z5Pct: 5, isPolarized: true },
      weeklyZoneProgression: calculateWeeklyZoneProgression([], 162, 14),
      trail: { totalGainM: 0, totalLossM: 0, trailRunsCount: 0, avgVam: 0, avgDecoupling: 0, specificTrailHours: 0, totalHours: 0, specificityPct: 0 },
      recovery: { hrvStatus: "NORMAL", recoveryScore: 100, restingHr: 50, avgSleepDurationMin: 480, sleepRegularityScore: 90, daysLogged: 0 },
      modes: {},
    });
  }

  const db = getDb();

  // Auto-deduplicate any legacy duplicate activities for this athlete
  await cleanDuplicateActivities(db, athleteId);

  // Parallel fetch to eliminate async waterfall (Vercel Best Practice: async-parallel)
  const [
    dailyRes,
    actRes,
    evolabJson,
    targetRaceDistStr,
    targetRaceElevStr,
    weeklyVertTargetStr,
    trainingTierStr,
    hrZoneCalcMethodRes,
    athleteMaxHrRes,
    athleteRestingHrRes,
    athleteLthrRes,
  ] = await Promise.all([
    db.execute({
      sql: `SELECT * FROM daily_metrics WHERE athlete_id = ? ORDER BY date ASC`,
      args: [athleteId],
    }),
    db.execute({
      sql: `SELECT * FROM activities WHERE athlete_id = ? ORDER BY start_time DESC`,
      args: [athleteId],
    }),
    getSetting("coros_evolab_cache", "", athleteId),
    getSetting("trail_target_race_dist", "36", athleteId),
    getSetting("trail_target_race_elev", "2200", athleteId),
    getSetting("trail_weekly_vert_target", "1000", athleteId),
    getSetting("trail_training_tier", "finisher", athleteId),
    getSetting("hr_zone_calc_method", "max_hr", athleteId),
    getSetting("athlete_max_hr", "", athleteId),
    getSetting("athlete_resting_hr", "", athleteId),
    getSetting("athlete_lthr", "", athleteId),
  ]);

  const dailyRows = dailyRes.rows as any[];
  const activities = actRes.rows as any[];
  const targetRaceDist = Number(targetRaceDistStr || "36");
  const targetRaceElev = Number(targetRaceElevStr || "2200");
  const weeklyVertTarget = Number(weeklyVertTargetStr || "1000");
  const trainingTier = (trainingTierStr || "finisher") as "finisher" | "elite";

  // Athlete HR Zones Resolution (Graceful fallbacks: 1. Manual user settings, 2. Activity / metrics auto-detect, 3. Standard baseline)
  const athleteMaxHrStr = (athleteMaxHrRes || "").trim();
  let effectiveMaxHr = 185;
  if (athleteMaxHrStr && !isNaN(Number(athleteMaxHrStr)) && Number(athleteMaxHrStr) >= 100 && Number(athleteMaxHrStr) <= 240) {
    effectiveMaxHr = Math.round(Number(athleteMaxHrStr));
  } else if (activities.length > 0) {
    const activityMaxHrs = activities
      .map((a) => Number(a.max_hr || 0))
      .filter((hr) => hr >= 130 && hr <= 230);
    if (activityMaxHrs.length > 0) {
      effectiveMaxHr = Math.max(...activityMaxHrs);
    }
  }

  const athleteRestingHrStr = (athleteRestingHrRes || "").trim();
  let effectiveRestingHr = 48;
  if (athleteRestingHrStr && !isNaN(Number(athleteRestingHrStr)) && Number(athleteRestingHrStr) >= 30 && Number(athleteRestingHrStr) <= 100) {
    effectiveRestingHr = Math.round(Number(athleteRestingHrStr));
  } else if (dailyRows.length > 0) {
    // Robust 7-day rolling average of valid resting HR nights (filters outlier bad sleep or days without watch)
    const validRhrs = dailyRows
      .map((d) => Number(d.resting_hr || 0))
      .filter((r) => r >= 30 && r <= 100)
      .slice(-7);
    if (validRhrs.length > 0) {
      effectiveRestingHr = Math.round(validRhrs.reduce((sum, v) => sum + v, 0) / validRhrs.length);
    }
  }

  const athleteLthrStr = (athleteLthrRes || "").trim();
  let effectiveLthr = Math.round(effectiveMaxHr * 0.88);
  if (athleteLthrStr && !isNaN(Number(athleteLthrStr)) && Number(athleteLthrStr) >= 100 && Number(athleteLthrStr) <= 220) {
    effectiveLthr = Math.round(Number(athleteLthrStr));
  }

  const hrZoneCalcMethod = (hrZoneCalcMethodRes || "max_hr") as HrZoneCalcMethod;

  const athleteHrZones = calculateAthleteHrZones({
    method: hrZoneCalcMethod,
    maxHr: effectiveMaxHr,
    restingHr: effectiveRestingHr,
    lthr: effectiveLthr,
  });

  // 3. Current Summary
  const latestDaily = dailyRows[dailyRows.length - 1] || null;
  const tsb = Number(latestDaily?.tsb || 0);
  const formZone = classifyFormZone(tsb);
  const ctl = Number(latestDaily?.ctl || 0);
  const atl = Number(latestDaily?.atl || 0);
  const rampRate = Number(latestDaily?.ramp_rate || 0);

  // ACWR
  const pastDaysForAcwr = dailyRows.map((d) => ({ date: String(d.date), load: Number(d.training_load || 0) }));
  const acwrData = calculateAcwr(pastDaysForAcwr);

  // Monotony & Strain (past 7 days)
  const past7Loads = dailyRows.slice(-7).map((d) => Number(d.training_load || 0));
  const monotonyData = calculateMonotonyAndStrain(past7Loads);

  // Training Intensity Distribution (TID) from activities
  let z1z2Seconds = 0;
  let z3Seconds = 0;
  let z4z5Seconds = 0;

  let totalElevationGain = 0;
  let totalElevationLoss = 0;
  let trailActivitiesCount = 0;
  let totalVamSum = 0;
  let totalVamCount = 0;
  let totalDecouplingSum = 0;
  let totalDecouplingCount = 0;

  // Generate full continuous calendar days sequence for Standard rTSS & Weekly windows in athlete's timezone
  const userTimezone = getRequestTimezone(req);
  const localTodayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: userTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Week boundaries (Monday to Sunday) in athlete's timezone
  const [tY, tM, tD] = localTodayStr.split("-").map(Number);
  const todayUtcRef = new Date(Date.UTC(tY, tM - 1, tD));
  const dayOfWeek = todayUtcRef.getUTCDay() || 7; // 1 = Mon, 7 = Sun
  const mondayUtc = new Date(todayUtcRef);
  mondayUtc.setUTCDate(todayUtcRef.getUTCDate() - dayOfWeek + 1);
  const sundayUtc = new Date(mondayUtc);
  sundayUtc.setUTCDate(mondayUtc.getUTCDate() + 6);

  const thisWeekMondayStr = mondayUtc.toISOString().split("T")[0];
  const thisWeekSundayStr = sundayUtc.toISOString().split("T")[0];

  const rolling7dUtc = new Date(todayUtcRef);
  rolling7dUtc.setUTCDate(todayUtcRef.getUTCDate() - 6);
  const rolling7dStartStr = rolling7dUtc.toISOString().split("T")[0];

  let thisWeekGain = 0;
  let thisWeekDistM = 0;
  let rolling7dGain = 0;
  let rolling7dDistM = 0;
  let trailOnlyGain = 0;
  let trailOnlyDistM = 0;

  for (const act of activities) {
    const isTrail = act.sport_type === "trail_run" || Number(act.elevation_gain || 0) > 150;
    const gain = Number(act.elevation_gain || 0);
    const dist = Number(act.distance_meters || 0);
    const startTime = Number(act.start_time || 0);
    const actDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(startTime));
    const dur = Number(act.duration_seconds || 1800);
    const avgHr = Number(act.avg_hr || 0);
    const actMaxHr = Number(act.max_hr || 0);
    const aerobicTe = Number(act.aerobic_te || 0);
    const anaerobicTe = Number(act.anaerobic_te || 0);
    const vam = Number(act.vam_meters_per_hour || 0);
    const decoupling = Number(act.decoupling_pct || 0);

    totalElevationGain += gain;
    totalElevationLoss += Number(act.elevation_loss || 0);

    if (actDate >= thisWeekMondayStr && actDate <= thisWeekSundayStr) {
      thisWeekGain += gain;
      thisWeekDistM += dist;
    }
    if (actDate >= rolling7dStartStr && actDate <= localTodayStr) {
      rolling7dGain += gain;
      rolling7dDistM += dist;
    }
    if (isTrail) {
      trailActivitiesCount++;
      trailOnlyGain += gain;
      trailOnlyDistM += dist;
    }

    if (isTrail && vam > 0) {
      totalVamSum += vam;
      totalVamCount++;
    }

    if (decoupling > 0) {
      totalDecouplingSum += decoupling;
      totalDecouplingCount++;
    }

    // Precise TID allocation based on personalized HR Zones & activity telemetry
    const actZones = estimateActivityHrZones({
      durationSeconds: dur,
      avgHr,
      maxHr: actMaxHr,
      aerobicTe,
      anaerobicTe,
      zones: athleteHrZones,
    });

    z1z2Seconds += actZones.z1 + actZones.z2;
    z3Seconds += actZones.z3;
    z4z5Seconds += actZones.z4 + actZones.z5;
  }

  const totalTidSec = Math.max(1, z1z2Seconds + z3Seconds + z4z5Seconds);
  const tid = {
    z1z2Pct: Math.round((z1z2Seconds / totalTidSec) * 100),
    z3Pct: Math.round((z3Seconds / totalTidSec) * 100),
    z4z5Pct: Math.round((z4z5Seconds / totalTidSec) * 100),
    isPolarized: z1z2Seconds / totalTidSec >= 0.75,
  };

  const avgVam = totalVamCount > 0 ? Math.round(totalVamSum / totalVamCount) : 330;
  const avgDecoupling =
    totalDecouplingCount > 0 ? Math.round((totalDecouplingSum / totalDecouplingCount) * 10) / 10 : 3.5;

  // Road Race Predictor: use real COROS EvoLab metrics if cached, else derive from CTL
  let racePredictor = {
    fiveKmSeconds: 1351,
    tenKmSeconds: 2812,
    halfMarathonSeconds: 6317,
    marathonSeconds: 13415,
    runningFitness: 81,
    marathonLevel: 81,
  };

  if (evolabJson) {
    try {
      const parsed = JSON.parse(evolabJson);
      racePredictor = { ...racePredictor, ...parsed };
    } catch {}
  }


  // Compute Standard rTSS Mode from activities (Functional Threshold Pace from 10K / 1-hour race pace)
  const thresholdPaceSec = racePredictor?.tenKmSeconds
    ? Math.round(racePredictor.tenKmSeconds / 10)
    : racePredictor?.fiveKmSeconds
    ? Math.round((racePredictor.fiveKmSeconds / 5) * 1.06)
    : 300; // default 5:00 /km
  const dailyRtssMap = new Map<string, number>();

  for (const act of activities) {
    const startTime = Number(act.start_time || 0);
    const dStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(startTime));
    const durHours = Number(act.duration_seconds || 1800) / 3600;
    const distM = Number(act.distance_meters || 0);
    const avgHr = Number(act.avg_hr || 140);
    const elevGain = Number(act.elevation_gain || 0);

    let tss = 0;
    const sport = String(act.sport_type || "").toLowerCase();
    const isCycling = sport.includes("bike") || sport.includes("cycling");
    const isStrengthOrCardio = sport === "strength" || sport === "cardio" || sport === "gym" || sport === "crossfit" || distM <= 0;

    if (isStrengthOrCardio) {
      const thresholdHr = effectiveLthr;
      const hrIf = avgHr / thresholdHr;
      tss = Math.max(5, Math.min(250, Math.round(100 * durHours * Math.pow(hrIf, 2))));
    } else if (isCycling) {
      const thresholdHr = effectiveLthr;
      const hrIf = avgHr / thresholdHr;
      tss = Math.max(5, Math.min(350, Math.round(100 * durHours * Math.pow(hrIf, 2))));
    } else {
      let pace = Number(act.avg_pace_sec || 300);
      if (pace <= 0 && distM > 0) {
        pace = Number(act.duration_seconds || 1800) / (distM / 1000);
      }

      if (act.sport_type === "trail_run" || elevGain > 150) {
        const distKm = distM / 1000;
        const gradient = distKm > 0 ? elevGain / (distKm * 1000) : 0;
        pace = pace / (1 + gradient * 4.0);
      }

      const intensityFactor = thresholdPaceSec / (pace || 300);
      tss = Math.max(5, Math.min(350, Math.round(100 * durHours * Math.pow(intensityFactor, 2))));
    }

    dailyRtssMap.set(dStr, (dailyRtssMap.get(dStr) || 0) + tss);
  }

  const latestDailyDate = dailyRows.length > 0 ? String(dailyRows[dailyRows.length - 1].date) : localTodayStr;
  const targetEndStr = latestDailyDate > localTodayStr ? latestDailyDate : localTodayStr;

  const intervalsDailyLoads: { date: string; load: number }[] = [];
  if (activities.length > 0) {
    const earliestTime = Number(activities[activities.length - 1].start_time || Date.now());
    const startCalStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(earliestTime));
    let cur = new Date(`${startCalStr}T00:00:00Z`);
    const endLimit = new Date(`${targetEndStr}T00:00:00Z`);

    while (cur <= endLimit) {
      const dStr = cur.toISOString().split("T")[0];
      intervalsDailyLoads.push({
        date: dStr,
        load: dailyRtssMap.get(dStr) || 0,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  const intervalsPmc: PmcPoint[] = calculatePmcSeries(intervalsDailyLoads);
  const latestIntervals = intervalsPmc[intervalsPmc.length - 1] || null;
  const intervalsTsb = latestIntervals?.tsb || 1;
  const intervalsFormZone = classifyFormZone(intervalsTsb);
  const intervalsAcwr = calculateAcwr(intervalsPmc.map((p: PmcPoint) => ({ date: p.date, load: p.load })));
  const intervalsPast7 = intervalsPmc.slice(-7).map((p: PmcPoint) => p.load);
  const intervalsMonotony = calculateMonotonyAndStrain(intervalsPast7);

  const todayRow = dailyRows.find((d) => String(d.date) === localTodayStr);
  const effectiveTodayLoad = todayRow ? Number(todayRow.training_load || 0) : Number(latestDaily?.training_load || 0);

  const corosReadiness = calculateTrainingReadiness({
    ctl,
    atl,
    tsb,
    todayLoad: effectiveTodayLoad,
    acwr: acwrData.acwr,
    recoveryScore: Number(latestDaily?.recovery_score || 82),
    hrvStatus: String(latestDaily?.hrv_status || "NORMAL"),
    sleepHours: latestDaily?.sleep_duration_seconds ? Number(latestDaily.sleep_duration_seconds) / 3600 : 7.5,
    rampRate,
    athleteMaxHr: effectiveMaxHr,
    athleteHrZones,
  });

  const corosModeData = {
    current: {
      date: String(latestDaily?.date || new Date().toISOString().split("T")[0]),
      ctl,
      atl,
      tsb,
      formPct: Number(latestDaily?.form_pct || 0),
      rampRate,
      formZone,
      recoveryScore: Number(latestDaily?.recovery_score || 82),
      hrvRmssd: Number(latestDaily?.hrv_rmssd || 68),
      hrvStatus: String(latestDaily?.hrv_status || "NORMAL"),
      restingHr: Number(latestDaily?.resting_hr || 48),
      sleepHours: latestDaily?.sleep_duration_seconds
        ? (Number(latestDaily.sleep_duration_seconds) / 3600).toFixed(1)
        : "7.5",
    },
    acwr: acwrData,
    monotony: monotonyData,
    readiness: corosReadiness,
    pmcSeries: dailyRows.map((d) => ({
      date: String(d.date),
      load: Number(d.training_load || 0),
      ctl: Number(d.ctl || 0),
      atl: Number(d.atl || 0),
      tsb: Number(d.tsb || 0),
      formPct: Number(d.form_pct || 0),
      rampRate: Number(d.ramp_rate || 0),
      acwr: Number(d.acwr || 1.0),
    })),
    scaleLabel: "COROS Load (TRIMP)",
    scaleDescription: `Heart-rate impulse scale matching your COROS watch screen (Base Fitness: ${Math.round(ctl)}).`,
  };

  const intervalsTodayLoad = latestIntervals?.load || 0;
  const intervalsReadiness = calculateTrainingReadiness({
    ctl: latestIntervals?.ctl ?? 0,
    atl: latestIntervals?.atl ?? 0,
    tsb: intervalsTsb,
    todayLoad: intervalsTodayLoad,
    acwr: intervalsAcwr.acwr,
    recoveryScore: Number(latestDaily?.recovery_score || 82),
    hrvStatus: String(latestDaily?.hrv_status || "NORMAL"),
    sleepHours: latestDaily?.sleep_duration_seconds ? Number(latestDaily.sleep_duration_seconds) / 3600 : 7.5,
    rampRate: latestIntervals?.rampRate ?? 0,
    athleteMaxHr: effectiveMaxHr,
    athleteHrZones,
  });

  const intervalsPaceMin = Math.floor(thresholdPaceSec / 60);
  const intervalsPaceSec = (thresholdPaceSec % 60).toString().padStart(2, "0");

  const intervalsModeData = {
    current: {
      date: String(latestDaily?.date || new Date().toISOString().split("T")[0]),
      ctl: latestIntervals?.ctl ?? 0,
      atl: latestIntervals?.atl ?? 0,
      tsb: intervalsTsb,
      formPct: latestIntervals?.formPct ?? 0,
      rampRate: latestIntervals?.rampRate ?? 0,
      formZone: intervalsFormZone,
      recoveryScore: Number(latestDaily?.recovery_score || 82),
      hrvRmssd: Number(latestDaily?.hrv_rmssd || 68),
      hrvStatus: String(latestDaily?.hrv_status || "NORMAL"),
      restingHr: Number(latestDaily?.resting_hr || 48),
      sleepHours: latestDaily?.sleep_duration_seconds
        ? (Number(latestDaily.sleep_duration_seconds) / 3600).toFixed(1)
        : "7.5",
    },
    acwr: intervalsAcwr,
    monotony: intervalsMonotony,
    readiness: intervalsReadiness,
    pmcSeries: intervalsPmc.map((p: PmcPoint) => ({
      date: p.date,
      load: p.load,
      ctl: p.ctl,
      atl: p.atl,
      tsb: p.tsb,
      formPct: p.formPct,
      rampRate: p.rampRate,
      acwr: intervalsAcwr.acwr,
    })),
    scaleLabel: "Standard rTSS",
    scaleDescription: `Threshold pace/power scale calibrated to Coggan rTSS model (Threshold: ${intervalsPaceMin}:${intervalsPaceSec} /km).`,
  };

  const weeklyZoneProgression = calculateWeeklyZoneProgression(
    activities.map((a) => ({
      id: String(a.id),
      startTime: Number(a.start_time),
      durationSeconds: Number(a.duration_seconds || 0),
      avgHr: Number(a.avg_hr || 0),
      maxHr: Number(a.max_hr || 0),
      aerobicTe: Number(a.aerobic_te || 0),
      anaerobicTe: Number(a.anaerobic_te || 0),
    })),
    effectiveLthr,
    14,
    athleteHrZones,
    userTimezone
  );

  return NextResponse.json({
    connected: isConnected,
    hasData: dailyRows.length > 0 || activities.length > 0,
    athleteMaxHr: effectiveMaxHr,
    athleteRestingHr: effectiveRestingHr,
    athleteLthr: effectiveLthr,
    hrZoneCalcMethod,
    athleteHrZones,
    modes: {
      coros: corosModeData,
      intervals: intervalsModeData,
    },
    current: corosModeData.current,
    readiness: corosReadiness,
    acwr: acwrData,
    monotony: monotonyData,
    tid,
    weeklyZoneProgression,
    trail: {
      totalElevationGain: Math.round(totalElevationGain),
      totalElevationLoss: Math.round(totalElevationLoss),
      avgVam,
      trailActivitiesCount,
      avgDecoupling,
      thisWeekGain: Math.round(thisWeekGain),
      thisWeekDistanceKm: Math.round((thisWeekDistM / 1000) * 10) / 10,
      thisWeekDensity: thisWeekDistM > 0 ? Math.round((thisWeekGain / (thisWeekDistM / 1000)) * 10) / 10 : 0,
      rolling7dGain: Math.round(rolling7dGain),
      rolling7dDistanceKm: Math.round((rolling7dDistM / 1000) * 10) / 10,
      rolling7dDensity: rolling7dDistM > 0 ? Math.round((rolling7dGain / (rolling7dDistM / 1000)) * 10) / 10 : 0,
      trailOnlyDensity: trailOnlyDistM > 0 ? Math.round((trailOnlyGain / (trailOnlyDistM / 1000)) * 10) / 10 : 68,
      targetRaceDist,
      targetRaceElev,
      weeklyVertTarget,
      trainingTier,
    },
    racePredictor,
    pmcSeries: corosModeData.pmcSeries,
    activities: activities.map((a) => ({
      id: String(a.id),
      name: String(a.name),
      sportType: String(a.sport_type),
      startTime: Number(a.start_time),
      distanceKm: (Number(a.distance_meters || 0) / 1000).toFixed(2),
      durationSeconds: Number(a.duration_seconds || 0),
      durationMin: Math.floor(Number(a.duration_seconds || 0) / 60),
      avgPaceSec: Number(a.avg_pace_sec || 0),
      avgHr: Number(a.avg_hr || 0),
      maxHr: Number(a.max_hr || 0),
      cadence: Number(a.avg_cadence || 0),
      trainingLoad: Number(a.training_load || 0),
      elevationGain: Math.round(Number(a.elevation_gain || 0)),
      elevationLoss: Math.round(Number(a.elevation_loss || 0)),
      vam: Number(a.vam_meters_per_hour || 0),
      decouplingPct: Number(a.decoupling_pct || 0),
      efficiencyFactor: Number(a.efficiency_factor || 0),
      aerobicTe: Number(a.aerobic_te || 0),
      anaerobicTe: Number(a.anaerobic_te || 0),
    })),
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
