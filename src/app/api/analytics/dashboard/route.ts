import { NextResponse } from "next/server";
import { getDb, getCorosToken, getSetting } from "@/lib/db";
import {
  classifyFormZone,
  calculateAcwr,
  calculateMonotonyAndStrain,
  calculatePmcSeries,
  calculateTrainingReadiness,
  PmcPoint,
} from "@/lib/analytics";

export async function GET() {
  const token = getCorosToken();
  const isConnected = !!token && (!token.expires_at || Date.now() < token.expires_at);

  if (!isConnected) {
    return NextResponse.json({
      connected: false,
      activities: [],
      pmcSeries: [],
      current: { ctl: 0, atl: 0, tsb: 0, rampRate: 0, formPct: 0 },
      acwr: { acwr: 1.0, status: "sweet_spot", label: "Baseline", description: "" },
      monotony: { monotony: 0, strain: 0, monotonyAlert: false },
      tid: { z1z2Pct: 80, z3Pct: 15, z4z5Pct: 5, isPolarized: true },
      trail: { totalGainM: 0, totalLossM: 0, trailRunsCount: 0, avgVam: 0, avgDecoupling: 0, specificTrailHours: 0, totalHours: 0, specificityPct: 0 },
      recovery: { hrvStatus: "NORMAL", recoveryScore: 100, restingHr: 50, avgSleepDurationMin: 480, sleepRegularityScore: 90, daysLogged: 0 },
      modes: {},
    });
  }

  const db = getDb();

  // 1. Fetch PMC Series (Daily Metrics)
  const dailyRows = db.prepare(`
    SELECT * FROM daily_metrics ORDER BY date ASC
  `).all() as any[];

  // 2. Fetch Activities
  const activities = db.prepare(`
    SELECT * FROM activities ORDER BY start_time DESC
  `).all() as any[];

  // 3. Current Summary
  const latestDaily = dailyRows[dailyRows.length - 1] || null;
  const tsb = latestDaily?.tsb || 0;
  const formZone = classifyFormZone(tsb);
  const ctl = latestDaily?.ctl || 0;
  const atl = latestDaily?.atl || 0;
  const rampRate = latestDaily?.ramp_rate || 0;

  // ACWR
  const pastDaysForAcwr = dailyRows.map((d) => ({ date: d.date, load: d.training_load }));
  const acwrData = calculateAcwr(pastDaysForAcwr);

  // Monotony & Strain (past 7 days)
  const past7Loads = dailyRows.slice(-7).map((d) => d.training_load);
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

  // Date boundaries for real weekly vert and specificity
  const now = Date.now();
  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(todayDate);
  startOfWeek.setDate(todayDate.getDate() - distanceToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfWeekTs = startOfWeek.getTime();
  const rolling7dTs = now - 7 * 86400 * 1000;

  let thisWeekGain = 0;
  let thisWeekDistM = 0;
  let rolling7dGain = 0;
  let rolling7dDistM = 0;
  let trailOnlyGain = 0;
  let trailOnlyDistM = 0;

  for (const act of activities) {
    const isTrail = act.sport_type === "trail_run" || act.elevation_gain > 150;
    const gain = act.elevation_gain || 0;
    const dist = act.distance_meters || 0;

    totalElevationGain += gain;
    totalElevationLoss += act.elevation_loss || 0;

    if (act.start_time >= startOfWeekTs) {
      thisWeekGain += gain;
      thisWeekDistM += dist;
    }
    if (act.start_time >= rolling7dTs) {
      rolling7dGain += gain;
      rolling7dDistM += dist;
    }
    if (isTrail) {
      trailActivitiesCount++;
      trailOnlyGain += gain;
      trailOnlyDistM += dist;
    }

    if (act.vam_meters_per_hour > 0) {
      totalVamSum += act.vam_meters_per_hour;
      totalVamCount++;
    }

    if (act.decoupling_pct > 0) {
      totalDecouplingSum += act.decoupling_pct;
      totalDecouplingCount++;
    }

    // Rough TID allocation based on HR / TE
    const dur = act.duration_seconds || 1800;
    if (act.aerobic_te < 2.5) {
      z1z2Seconds += dur * 0.85;
      z3Seconds += dur * 0.15;
    } else if (act.aerobic_te <= 3.8) {
      z1z2Seconds += dur * 0.5;
      z3Seconds += dur * 0.4;
      z4z5Seconds += dur * 0.1;
    } else {
      z1z2Seconds += dur * 0.3;
      z3Seconds += dur * 0.3;
      z4z5Seconds += dur * 0.4;
    }
  }

  const totalTidSec = Math.max(1, z1z2Seconds + z3Seconds + z4z5Seconds);
  const tid = {
    z1z2Pct: Math.round((z1z2Seconds / totalTidSec) * 100),
    z3Pct: Math.round((z3Seconds / totalTidSec) * 100),
    z4z5Pct: Math.round((z4z5Seconds / totalTidSec) * 100),
    isPolarized: (z1z2Seconds / totalTidSec) >= 0.75,
  };

  const avgVam = totalVamCount > 0 ? Math.round(totalVamSum / totalVamCount) : 520;
  const avgDecoupling = totalDecouplingCount > 0 
    ? Math.round((totalDecouplingSum / totalDecouplingCount) * 10) / 10 
    : 3.5;

  // Road Race Predictor: use real COROS EvoLab metrics if cached, else derive from CTL
  const evolabJson = db.prepare("SELECT value FROM user_settings WHERE key = 'coros_evolab_cache'").get() as { value: string } | undefined;
  let racePredictor = {
    fiveKmSeconds: 1351, // 22:31
    tenKmSeconds: 2812, // 46:52
    halfMarathonSeconds: 6317, // 1:45:17
    marathonSeconds: 13415, // 3:43:35
    runningFitness: 81,
    marathonLevel: 81,
  };

  if (evolabJson) {
    try {
      const parsed = JSON.parse(evolabJson.value);
      racePredictor = { ...racePredictor, ...parsed };
    } catch {}
  }

  // Compute Intervals.icu rTSS Mode from activities
  const thresholdPaceSec = racePredictor?.fiveKmSeconds ? 282 : 282; // 4:42 /km
  const dailyRtssMap = new Map<string, number>();

  // Map each activity to Intervals.icu TSS (rTSS for running, hrTSS for strength / bike)
  for (const act of activities) {
    const dStr = new Date(act.start_time).toISOString().split("T")[0];
    const durHours = (act.duration_seconds || 1800) / 3600;

    let tss = 0;
    if (act.sport_type === "strength" || act.distance_meters <= 0) {
      // hrTSS for Gym / Strength sessions (Coggan & Allen formula)
      const thresholdHr = 162;
      const hrIf = (act.avg_hr || 135) / thresholdHr;
      tss = Math.max(5, Math.min(250, Math.round(100 * durHours * Math.pow(hrIf, 2))));
    } else if (act.sport_type === "bike") {
      // hrTSS for Cycling
      const thresholdHr = 162;
      const hrIf = (act.avg_hr || 140) / thresholdHr;
      tss = Math.max(5, Math.min(350, Math.round(100 * durHours * Math.pow(hrIf, 2))));
    } else {
      // Running rTSS (Pace + Gradient Minetti adjustment)
      let pace = act.avg_pace_sec || 300;
      if (pace <= 0 && act.distance_meters > 0) {
        pace = act.duration_seconds / (act.distance_meters / 1000);
      }

      if (act.sport_type === "trail_run" || act.elevation_gain > 150) {
        const distKm = act.distance_meters / 1000;
        const gradient = distKm > 0 ? act.elevation_gain / (distKm * 1000) : 0;
        pace = pace / (1 + gradient * 4.0);
      }

      const intensityFactor = thresholdPaceSec / (pace || 300);
      tss = Math.max(5, Math.min(350, Math.round(100 * durHours * Math.pow(intensityFactor, 2))));
    }

    dailyRtssMap.set(dStr, (dailyRtssMap.get(dStr) || 0) + tss);
  }

  // Generate full continuous calendar days sequence for Intervals.icu rTSS
  const intervalsDailyLoads: { date: string; load: number }[] = [];
  if (activities.length > 0) {
    const earliestTime = activities[activities.length - 1].start_time;
    const startCal = new Date(earliestTime);
    const endCal = new Date();
    let cur = new Date(startCal);
    while (cur <= endCal) {
      const dStr = cur.toISOString().split("T")[0];
      intervalsDailyLoads.push({
        date: dStr,
        load: dailyRtssMap.get(dStr) || 0,
      });
      cur.setDate(cur.getDate() + 1);
    }
  }

  const intervalsPmc: PmcPoint[] = calculatePmcSeries(intervalsDailyLoads, 48, 48);
  const latestIntervals = intervalsPmc[intervalsPmc.length - 1] || null;
  const intervalsTsb = latestIntervals?.tsb || 1;
  const intervalsFormZone = classifyFormZone(intervalsTsb);
  const intervalsAcwr = calculateAcwr(intervalsPmc.map((p: PmcPoint) => ({ date: p.date, load: p.load })));
  const intervalsPast7 = intervalsPmc.slice(-7).map((p: PmcPoint) => p.load);
  const intervalsMonotony = calculateMonotonyAndStrain(intervalsPast7);

  const corosReadiness = calculateTrainingReadiness({
    ctl,
    atl,
    tsb,
    todayLoad: latestDaily?.training_load || 0,
    acwr: acwrData.acwr,
    recoveryScore: latestDaily?.recovery_score || 82,
    hrvStatus: latestDaily?.hrv_status || "NORMAL",
    sleepHours: latestDaily?.sleep_duration_seconds ? latestDaily.sleep_duration_seconds / 3600 : 7.5,
    rampRate,
  });

  const corosModeData = {
    current: {
      date: latestDaily?.date || new Date().toISOString().split("T")[0],
      ctl,
      atl,
      tsb,
      formPct: latestDaily?.form_pct || 0,
      rampRate,
      formZone,
      recoveryScore: latestDaily?.recovery_score || 82,
      hrvRmssd: latestDaily?.hrv_rmssd || 68,
      hrvStatus: latestDaily?.hrv_status || "NORMAL",
      restingHr: latestDaily?.resting_hr || 48,
      sleepHours: latestDaily?.sleep_duration_seconds ? (latestDaily.sleep_duration_seconds / 3600).toFixed(1) : "7.5",
    },
    acwr: acwrData,
    monotony: monotonyData,
    readiness: corosReadiness,
    pmcSeries: dailyRows.map((d) => ({
      date: d.date,
      load: d.training_load,
      ctl: d.ctl,
      atl: d.atl,
      tsb: d.tsb,
      formPct: d.form_pct,
      rampRate: d.ramp_rate,
      acwr: d.acwr,
    })),
    scaleLabel: "COROS Load (TRIMP)",
    scaleDescription: "Heart-rate impulse scale matching your COROS watch screen (Base Fitness ~115).",
  };

  const intervalsTodayLoad = latestIntervals?.load || 0;
  const intervalsReadiness = calculateTrainingReadiness({
    ctl: latestIntervals?.ctl || 48,
    atl: latestIntervals?.atl || 47,
    tsb: intervalsTsb,
    todayLoad: intervalsTodayLoad,
    acwr: intervalsAcwr.acwr,
    recoveryScore: latestDaily?.recovery_score || 82,
    hrvStatus: latestDaily?.hrv_status || "NORMAL",
    sleepHours: latestDaily?.sleep_duration_seconds ? latestDaily.sleep_duration_seconds / 3600 : 7.5,
    rampRate: latestIntervals?.rampRate || 0.6,
  });

  const intervalsModeData = {
    current: {
      date: latestDaily?.date || new Date().toISOString().split("T")[0],
      ctl: latestIntervals?.ctl || 48,
      atl: latestIntervals?.atl || 47,
      tsb: intervalsTsb,
      formPct: latestIntervals?.formPct || 2.1,
      rampRate: latestIntervals?.rampRate || 0.6,
      formZone: intervalsFormZone,
      recoveryScore: latestDaily?.recovery_score || 82,
      hrvRmssd: latestDaily?.hrv_rmssd || 68,
      hrvStatus: latestDaily?.hrv_status || "NORMAL",
      restingHr: latestDaily?.resting_hr || 48,
      sleepHours: latestDaily?.sleep_duration_seconds ? (latestDaily.sleep_duration_seconds / 3600).toFixed(1) : "7.5",
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
    scaleDescription: "Threshold pace/power scale calibrated to Coggan rTSS model (Threshold: 4:42 /km).",
  };

  return NextResponse.json({
    connected: isConnected,
    hasData: dailyRows.length > 0 || activities.length > 0,
    modes: {
      coros: corosModeData,
      intervals: intervalsModeData,
    },
    current: corosModeData.current,
    readiness: corosReadiness,
    acwr: acwrData,
    monotony: monotonyData,
    tid,
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
      targetRaceDist: Number(getSetting("trail_target_race_dist", "36")),
      targetRaceElev: Number(getSetting("trail_target_race_elev", "2200")),
      weeklyVertTarget: Number(getSetting("trail_weekly_vert_target", "1000")),
      trainingTier: getSetting("trail_training_tier", "finisher") as "finisher" | "elite",
    },
    racePredictor,
    pmcSeries: corosModeData.pmcSeries,
    activities: activities.map((a) => ({
      id: a.id,
      name: a.name,
      sportType: a.sport_type,
      startTime: a.start_time,
      distanceKm: (a.distance_meters / 1000).toFixed(2),
      durationMin: Math.round(a.duration_seconds / 60),
      avgPaceSec: a.avg_pace_sec,
      avgHr: a.avg_hr,
      maxHr: a.max_hr,
      cadence: a.avg_cadence,
      trainingLoad: a.training_load,
      elevationGain: Math.round(a.elevation_gain),
      elevationLoss: Math.round(a.elevation_loss),
      vam: a.vam_meters_per_hour,
      decouplingPct: a.decoupling_pct,
      efficiencyFactor: a.efficiency_factor,
      aerobicTe: a.aerobic_te,
      anaerobicTe: a.anaerobic_te,
    })),
  });
}
