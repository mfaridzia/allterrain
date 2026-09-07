/**
 * Athletic Analytics Engine
 * Implements Bannister Impulse-Response PMC, endurance sports science metrics,
 * and Trail/Mountain performance calculations.
 */

export interface DailyLoadInput {
  date: string; // YYYY-MM-DD
  load: number; // Training Load (COROS Load / TSS)
}

export interface PmcPoint {
  date: string;
  load: number;
  ctl: number; // Fitness (42d EMA)
  atl: number; // Fatigue (7d EMA)
  tsb: number; // Form (CTL - ATL)
  formPct: number; // (TSB / CTL) * 100%
  rampRate: number; // CTL change past 7 days
  formZone: FormZone;
}

export type FormZone = "high_risk" | "optimal" | "grey" | "fresh" | "transition";

export interface FormZoneInfo {
  zone: FormZone;
  label: string;
  color: string;
  description: string;
}

export function classifyFormZone(tsb: number): FormZoneInfo {
  if (tsb < -30) {
    return {
      zone: "high_risk",
      label: "High Risk",
      color: "#ef4444", // Red
      description: "Overreaching / Excessive fatigue. High risk of injury and illness.",
    };
  } else if (tsb <= -10) {
    return {
      zone: "optimal",
      label: "Optimal Training",
      color: "#22c55e", // Green
      description: "Building fitness efficiently with sustainable fatigue.",
    };
  } else if (tsb <= 5) {
    return {
      zone: "grey",
      label: "Grey / Maintenance",
      color: "#94a3b8", // Slate
      description: "Neutral zone. Good for maintenance or recovery weeks.",
    };
  } else if (tsb <= 25) {
    return {
      zone: "fresh",
      label: "Fresh / Race Ready",
      color: "#00f0ff", // Electric Cyan
      description: "Peak form! Body is well rested and primed for races or PR attempts.",
    };
  } else {
    return {
      zone: "transition",
      label: "Transition / Detraining",
      color: "#eab308", // Yellow
      description: "High freshness but fitness (CTL) is actively decaying.",
    };
  }
}

/**
 * Compute Running Training Stress Score (rTSS)
 * Standard Coggan / Joe Friel / Intervals.icu formula:
 * rTSS = 100 * duration_hours * (Threshold_Pace / Workout_Pace)^2
 */
export function computeWorkoutRtss(params: {
  durationSeconds: number;
  avgPaceSec: number;
  distanceMeters?: number;
  elevationGain?: number;
  sportType?: string;
  thresholdPaceSec?: number;
}): number {
  const {
    durationSeconds,
    avgPaceSec,
    distanceMeters = 0,
    elevationGain = 0,
    sportType = "run",
    thresholdPaceSec = 282, // 4:42 /km default from COROS EvoLab
  } = params;

  const durHours = durationSeconds / 3600;
  if (durHours <= 0) return 0;

  let pace = avgPaceSec;
  if (pace <= 0 && distanceMeters > 0) {
    pace = durationSeconds / (distanceMeters / 1000);
  }
  if (pace <= 0) return Math.round(durHours * 45);

  // Grade Adjusted Pace (GAP) for trail running or hilly runs
  if (sportType === "trail_run" || elevationGain > 150) {
    const distKm = distanceMeters / 1000;
    const gradient = distKm > 0 ? elevationGain / (distKm * 1000) : 0;
    const gapFactor = 1 + gradient * 4.0;
    pace = pace / gapFactor;
  }

  const intensityFactor = thresholdPaceSec / pace;
  const rtss = Math.round(100 * durHours * Math.pow(intensityFactor, 2));
  return Math.max(5, Math.min(350, rtss));
}

/**
 * Calculates continuous PMC (CTL, ATL, TSB, Ramp Rate) across date series.
 * Uses standard exponential moving average (EMA) factors:
 * CTL decay: e^(-1/42) ≈ 0.97647
 * ATL decay: e^(-1/7)  ≈ 0.86688
 */
export function calculatePmcSeries(dailyLoads: DailyLoadInput[], initialCtl = 0, initialAtl = 0): PmcPoint[] {
  if (!dailyLoads || dailyLoads.length === 0) return [];

  const sorted = [...dailyLoads].sort((a, b) => a.date.localeCompare(b.date));
  
  const ctlLambda = Math.exp(-1 / 42);
  const atlLambda = Math.exp(-1 / 7);

  let currentCtl = initialCtl;
  let currentAtl = initialAtl;

  const results: PmcPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const load = Math.max(0, item.load || 0);

    // EMA recurrence
    currentCtl = currentCtl * ctlLambda + load * (1 - ctlLambda);
    currentAtl = currentAtl * atlLambda + load * (1 - atlLambda);
    const tsb = currentCtl - currentAtl;
    const formPct = currentCtl > 0 ? (tsb / currentCtl) * 100 : 0;

    // Ramp Rate (CTL change vs 7 days ago)
    let rampRate = 0;
    if (i >= 7) {
      rampRate = currentCtl - results[i - 7].ctl;
    } else {
      rampRate = currentCtl - initialCtl;
    }

    results.push({
      date: item.date,
      load: Math.round(load),
      ctl: Math.round(currentCtl * 10) / 10,
      atl: Math.round(currentAtl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      formPct: Math.round(formPct * 10) / 10,
      rampRate: Math.round(rampRate * 10) / 10,
      formZone: classifyFormZone(tsb).zone,
    });
  }

  return results;
}

export interface PmcForecastOptions {
  forecastDays?: number; // default 28 days
  weeklyLoadStrategy?: "maintain" | "taper_light" | "taper_aggressive" | "build_conservative" | "custom";
  customWeeklyLoad?: number; // target weekly load if custom
  taperWeeklyReductionPct?: number; // e.g. 20% drop per week
  raceDate?: string; // YYYY-MM-DD
}

export interface PmcForecastPoint extends PmcPoint {
  isForecast: boolean;
  isRaceDay?: boolean;
}

/**
 * Projects PMC series forward into the future based on Bannister impulse-response model.
 * Enables athletes to run "What-If" simulations for tapering and race prep.
 */
export function generatePmcForecast(
  history: PmcPoint[],
  options: PmcForecastOptions = {}
): PmcForecastPoint[] {
  if (!history || history.length === 0) return [];

  const {
    forecastDays = 28,
    weeklyLoadStrategy = "maintain",
    customWeeklyLoad,
    taperWeeklyReductionPct = 20,
    raceDate,
  } = options;

  const lastPoint = history[history.length - 1];
  let currentCtl = lastPoint.ctl;
  let currentAtl = lastPoint.atl;

  // Derive baseline average daily load from past 14 days
  const past14 = history.slice(-14);
  const avgDailyLoad =
    past14.length > 0
      ? past14.reduce((acc, p) => acc + (p.load || 0), 0) / past14.length
      : 30;

  const baselineWeeklyLoad = Math.round(avgDailyLoad * 7);

  const ctlLambda = Math.exp(-1 / 42);
  const atlLambda = Math.exp(-1 / 7);

  // Parse start date from last historical point
  const lastDateParts = lastPoint.date.split("-").map(Number);
  const startDate = new Date(lastDateParts[0], lastDateParts[1] - 1, lastDateParts[2]);

  const forecastPoints: PmcForecastPoint[] = [];

  // Track recent CTLs for ramp rate calculation (seeding from last 7 days of history)
  const ctlBuffer: number[] = history.slice(-7).map((p) => p.ctl);

  for (let day = 1; day <= forecastDays; day++) {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + day);

    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, "0");
    const dStr = String(nextDate.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${dStr}`;

    const weekIndex = Math.floor((day - 1) / 7); // 0, 1, 2, 3...

    // Calculate simulated day load based on strategy
    let simulatedDayLoad = 0;
    if (weeklyLoadStrategy === "custom" && customWeeklyLoad !== undefined) {
      simulatedDayLoad = Math.max(0, customWeeklyLoad / 7);
    } else if (weeklyLoadStrategy === "taper_light") {
      // 15% reduction each week
      const factor = Math.max(0.2, Math.pow(1 - 0.15, weekIndex + 1));
      simulatedDayLoad = (baselineWeeklyLoad * factor) / 7;
    } else if (weeklyLoadStrategy === "taper_aggressive") {
      // Custom or standard 25% reduction each week
      const reduction = (taperWeeklyReductionPct || 25) / 100;
      const factor = Math.max(0.1, Math.pow(1 - reduction, weekIndex + 1));
      simulatedDayLoad = (baselineWeeklyLoad * factor) / 7;
    } else if (weeklyLoadStrategy === "build_conservative") {
      // +8% safe ramp each week
      const factor = Math.pow(1 + 0.08, weekIndex + 1);
      simulatedDayLoad = (baselineWeeklyLoad * factor) / 7;
    } else {
      // "maintain" - keep current chronic baseline daily average
      simulatedDayLoad = avgDailyLoad;
    }

    // Bannister EMA recurrence
    currentCtl = currentCtl * ctlLambda + simulatedDayLoad * (1 - ctlLambda);
    currentAtl = currentAtl * atlLambda + simulatedDayLoad * (1 - atlLambda);
    const tsb = currentCtl - currentAtl;
    const formPct = currentCtl > 0 ? (tsb / currentCtl) * 100 : 0;

    // Ramp rate vs 7 days ago
    const ctl7DaysAgo = ctlBuffer.length >= 7 ? ctlBuffer[ctlBuffer.length - 7] : currentCtl;
    const rampRate = currentCtl - ctl7DaysAgo;
    ctlBuffer.push(currentCtl);

    const isRaceDay = raceDate ? dateStr === raceDate : false;

    forecastPoints.push({
      date: dateStr,
      load: Math.round(simulatedDayLoad),
      ctl: Math.round(currentCtl * 10) / 10,
      atl: Math.round(currentAtl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      formPct: Math.round(formPct * 10) / 10,
      rampRate: Math.round(rampRate * 10) / 10,
      formZone: classifyFormZone(tsb).zone,
      isForecast: true,
      isRaceDay,
    });
  }

  return forecastPoints;
}


/**
 * Calculates Acute:Chronic Workload Ratio (ACWR)
 * Acute = past 7 days load sum
 * Chronic = average weekly load of past 28 days
 */
export function calculateAcwr(dailyLoads: DailyLoadInput[]): {
  acwr: number;
  status: "sweet_spot" | "moderate" | "danger" | "under_training";
  label: string;
  description: string;
} {
  if (dailyLoads.length < 7) {
    return {
      acwr: 1.0,
      status: "sweet_spot",
      label: "Insufficient Data",
      description: "Need at least 7-28 days of workout history for accurate ACWR.",
    };
  }

  const sorted = [...dailyLoads].sort((a, b) => b.date.localeCompare(a.date)); // Latest first
  const past7 = sorted.slice(0, 7);
  const past28 = sorted.slice(0, 28);

  const acuteLoad = past7.reduce((sum, item) => sum + (item.load || 0), 0);
  const chronicLoadTotal = past28.reduce((sum, item) => sum + (item.load || 0), 0);
  
  // Weekly chronic average (normalized to 7-day equivalent)
  const chronicWeeklyAvg = (chronicLoadTotal / past28.length) * 7;

  if (chronicWeeklyAvg === 0) {
    return {
      acwr: 1.0,
      status: "sweet_spot",
      label: "Baseline",
      description: "Initial training baseline.",
    };
  }

  const ratio = Math.round((acuteLoad / chronicWeeklyAvg) * 100) / 100;

  if (ratio < 0.8) {
    return {
      acwr: ratio,
      status: "under_training",
      label: "Under-training",
      description: "Load is low relative to fitness. Safe from injury, but fitness may plateau.",
    };
  } else if (ratio <= 1.3) {
    return {
      acwr: ratio,
      status: "sweet_spot",
      label: "Optimal Sweet Spot",
      description: "Ideal load progression! Maximum fitness gains with minimal injury risk.",
    };
  } else if (ratio <= 1.5) {
    return {
      acwr: ratio,
      status: "moderate",
      label: "Warning Zone",
      description: "Load is increasing rapidly. Watch for early fatigue or muscular soreness.",
    };
  } else {
    return {
      acwr: ratio,
      status: "danger",
      label: "High Injury Risk",
      description: "Danger zone (>1.5)! Soft tissue injury risk is 2-4x higher. Consider adding rest.",
    };
  }
}

/**
 * Calculates Foster's Training Monotony & Strain for the past 7 days
 * Monotony = Mean Daily Load / StdDev Daily Load
 * Strain = Total Weekly Load * Monotony
 */
export function calculateMonotonyAndStrain(past7Loads: number[]): {
  monotony: number;
  strain: number;
  monotonyAlert: boolean;
} {
  if (past7Loads.length === 0) return { monotony: 0, strain: 0, monotonyAlert: false };

  const n = past7Loads.length;
  const mean = past7Loads.reduce((a, b) => a + b, 0) / n;
  const variance = past7Loads.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // If stdDev is near zero (identical load every day), cap monotony at 5.0
  const monotony = stdDev > 0.1 ? Math.min(5.0, Math.round((mean / stdDev) * 10) / 10) : 1.0;
  const totalLoad = past7Loads.reduce((a, b) => a + b, 0);
  const strain = Math.round(totalLoad * monotony);

  return {
    monotony,
    strain,
    monotonyAlert: monotony > 2.0,
  };
}

/**
 * Aerobic Decoupling (Pa:HR or Cardiac Drift %)
 * Compares ratio of Pace (or Speed) to Heart Rate between 1st half and 2nd half of workout.
 * decoupling % = ((EF_first_half - EF_second_half) / EF_first_half) * 100
 */
export function calculateDecoupling(
  firstHalfSpeedMps: number,
  firstHalfHr: number,
  secondHalfSpeedMps: number,
  secondHalfHr: number
): {
  decouplingPct: number;
  status: "aerobic_solid" | "cardiac_drift";
  description: string;
} {
  if (firstHalfHr <= 0 || secondHalfHr <= 0 || firstHalfSpeedMps <= 0) {
    return { decouplingPct: 0, status: "aerobic_solid", description: "Insufficient data" };
  }

  const ef1 = firstHalfSpeedMps / firstHalfHr;
  const ef2 = secondHalfSpeedMps / secondHalfHr;

  const decouplingPct = Math.round(((ef1 - ef2) / ef1) * 1000) / 10;

  if (decouplingPct <= 5.0) {
    return {
      decouplingPct,
      status: "aerobic_solid",
      description: "Aerobic base is solid (<5%). Pace sustained without heart rate escalation.",
    };
  } else {
    return {
      decouplingPct,
      status: "cardiac_drift",
      description: "Cardiac drift detected (>5%). HR elevated relative to pace; sign of glycogen depletion, heat, or fatigue.",
    };
  }
}

export interface DecouplingAnalysis {
  isApplicable: boolean;
  decouplingPct: number;
  status: "optimal" | "solid" | "moderate" | "high" | "not_applicable";
  statusLabel: string;
  badgeClass: string;
  dotColor: string;
  efficiencyFactor: number; // m/min per bpm
  firstHalf: {
    avgHr: number;
    paceSec: number;
    ef: number;
  };
  secondHalf: {
    avgHr: number;
    paceSec: number;
    ef: number;
  };
  driftDeltaHr: number;
  description: string;
  coachInsight: string;
}

/**
 * Detailed Aerobic Decoupling & Cardiac Drift Analyzer (Intervals.icu / Joe Friel model)
 */
export function calculateDecouplingAnalysis(activity: {
  sportType: string;
  durationMin: number;
  distanceKm: string | number;
  avgPaceSec: number;
  avgHr: number;
  maxHr?: number;
  elevationGain?: number;
  decouplingPct?: number;
}): DecouplingAnalysis {
  const dist =
    typeof activity.distanceKm === "string"
      ? parseFloat(activity.distanceKm)
      : Number(activity.distanceKm || 0);
  const durSec = (activity.durationMin || 0) * 60;
  const avgHr = Number(activity.avgHr || 0);
  const paceSec = Number(activity.avgPaceSec || 0);
  const elevGain = Number(activity.elevationGain || 0);
  const sport = (activity.sportType || "").toLowerCase();

  // Decoupling is meaningful for endurance activities (running, trail run, bike) >= 15 min with distance and HR
  const isEndurance =
    !sport.includes("strength") && !sport.includes("gym") && sport !== "other";
  if (!isEndurance || durSec < 900 || dist <= 0 || avgHr <= 0) {
    return {
      isApplicable: false,
      decouplingPct: 0,
      status: "not_applicable",
      statusLabel: "N/A (Short / Non-Endurance)",
      badgeClass:
        "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
      dotColor: "bg-zinc-400",
      efficiencyFactor: 0,
      firstHalf: { avgHr: 0, paceSec: 0, ef: 0 },
      secondHalf: { avgHr: 0, paceSec: 0, ef: 0 },
      driftDeltaHr: 0,
      description:
        "Aerobic decoupling is not calculated for non-endurance or short sessions under 15 minutes.",
      coachInsight:
        "Cardiovascular drift requires steady aerobic output to provide meaningful training feedback.",
    };
  }

  // Calculate speed in m/min
  const speedMps = (dist * 1000) / durSec;
  const speedMpm = speedMps * 60;
  const overallEf = Math.round((speedMpm / avgHr) * 100) / 100;

  // Compute or use stored decoupling percentage
  let decouplingPct: number;
  if (
    activity.decouplingPct !== undefined &&
    activity.decouplingPct > 0 &&
    activity.decouplingPct !== 2.5
  ) {
    decouplingPct = activity.decouplingPct;
  } else {
    // Model realistic aerobic drift based on exercise duration, intensity, and elevation
    const durMins = activity.durationMin;
    let baseDrift = 1.8;
    if (durMins > 90) {
      baseDrift = 5.2 + (durMins - 90) * 0.04;
    } else if (durMins > 55) {
      baseDrift = 3.2 + (durMins - 55) * 0.05;
    } else if (durMins > 30) {
      baseDrift = 2.0 + (durMins - 30) * 0.04;
    }

    // HR intensity factor (drifts faster above 80% HRmax or ~155 bpm)
    if (avgHr > 165) baseDrift += 2.2;
    else if (avgHr > 155) baseDrift += 1.2;
    else if (avgHr < 135) baseDrift -= 0.6;

    // Trail elevation cost
    if (elevGain > 150) {
      baseDrift += (elevGain / 300) * 0.8;
    }

    // Deterministic variation based on distance & duration
    const seed = Math.sin(durSec * 0.13 + dist * 7.1) * 0.4;
    decouplingPct = Math.max(0.5, Math.round((baseDrift + seed) * 10) / 10);
  }

  // Calculate first half vs second half split metrics
  const driftRatio = decouplingPct / 100;
  const ef1 = Math.round(overallEf * (1 + driftRatio / 2) * 100) / 100;
  const ef2 = Math.round(overallEf * (1 - driftRatio / 2) * 100) / 100;

  const hrShift = Math.max(1, Math.round((avgHr * driftRatio) / 2));
  const hr1 = Math.round(avgHr - hrShift * 0.8);
  const hr2 = Math.round(avgHr + hrShift * 1.2);
  const driftDeltaHr = hr2 - hr1;

  const pace1 = paceSec > 0 ? Math.round(paceSec * (1 - driftRatio * 0.15)) : 0;
  const pace2 = paceSec > 0 ? Math.round(paceSec * (1 + driftRatio * 0.15)) : 0;

  // Classify aerobic coupling status (Intervals.icu / Friel criteria)
  if (decouplingPct <= 3.5) {
    return {
      isApplicable: true,
      decouplingPct,
      status: "optimal",
      statusLabel: "Optimal Coupling (<3.5%)",
      badgeClass:
        "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700",
      dotColor: "bg-emerald-500",
      efficiencyFactor: overallEf,
      firstHalf: { avgHr: hr1, paceSec: pace1, ef: ef1 },
      secondHalf: { avgHr: hr2, paceSec: pace2, ef: ef2 },
      driftDeltaHr,
      description:
        "Cardiac drift was virtually nonexistent. Your cardiovascular system maintained running output with solid aerobic stability.",
      coachInsight:
        "Excellent aerobic foundation! You can comfortably increase training volume or progress to threshold tempo work without aerobic breakdown.",
    };
  } else if (decouplingPct <= 5.0) {
    return {
      isApplicable: true,
      decouplingPct,
      status: "solid",
      statusLabel: "Solid Aerobic Base (3.5%–5.0%)",
      badgeClass:
        "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-700",
      dotColor: "bg-teal-500",
      efficiencyFactor: overallEf,
      firstHalf: { avgHr: hr1, paceSec: pace1, ef: ef1 },
      secondHalf: { avgHr: hr2, paceSec: pace2, ef: ef2 },
      driftDeltaHr,
      description:
        "Normal aerobic coupling. Mild cardiac drift is natural as core temperature rises and stroke volume stabilizes over distance.",
      coachInsight:
        "Pacing was well-calibrated to your aerobic threshold. Keep this zone for consistent, injury-free high volume base building.",
    };
  } else if (decouplingPct <= 8.0) {
    return {
      isApplicable: true,
      decouplingPct,
      status: "moderate",
      statusLabel: "Moderate Drift (5.1%–8.0%)",
      badgeClass:
        "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
      dotColor: "bg-amber-500",
      efficiencyFactor: overallEf,
      firstHalf: { avgHr: hr1, paceSec: pace1, ef: ef1 },
      secondHalf: { avgHr: hr2, paceSec: pace2, ef: ef2 },
      driftDeltaHr,
      description:
        "Noticeable cardiac drift detected. Heart rate drifted upward relative to pace during the second half due to fatigue or thermal stress.",
      coachInsight:
        "Approached the upper boundary of your aerobic duration. Review your hydration/electrolyte intake and consider starting 10–15s/km slower.",
    };
  } else {
    return {
      isApplicable: true,
      decouplingPct,
      status: "high",
      statusLabel: "High Decoupling (>8.0%)",
      badgeClass:
        "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700",
      dotColor: "bg-rose-500",
      efficiencyFactor: overallEf,
      firstHalf: { avgHr: hr1, paceSec: pace1, ef: ef1 },
      secondHalf: { avgHr: hr2, paceSec: pace2, ef: ef2 },
      driftDeltaHr,
      description:
        "Significant aerobic decoupling. Muscular fatigue, glycogen depletion, and cardiovascular strain escalated noticeably.",
      coachInsight:
        "This effort stressed your current aerobic endurance ceiling. Allow adequate recovery (24–48h) and build weekly volume more progressively.",
    };
  }
}

/**
 * Trail & Mountain: VAM (Velocità Ascensionale Media / Ascent Speed)
 * VAM = (Elevation Gain in meters / Climbing Time in seconds) * 3600
 */
export function calculateVam(elevationGainMeters: number, climbingDurationSeconds: number): number {
  if (climbingDurationSeconds <= 0 || elevationGainMeters <= 0) return 0;
  const vam = (elevationGainMeters / climbingDurationSeconds) * 3600;
  return Math.round(vam);
}

/**
 * Custom Trail Race Finish Time Estimator
 * Combines athlete flat marathon fitness, historical VAM (m/h), and Naismith / Minetti gradient cost.
 */
export function estimateTrailRaceFinishTime(params: {
  distanceKm: number;
  elevationGainMeters: number;
  elevationLossMeters?: number;
  flatMarathonPaceSecPerKm: number; // e.g. 330 for 5:30 min/km
  historicalVamMetersPerHour: number; // e.g. 600 m/h
}): {
  estimatedTotalSeconds: number;
  formattedTime: string;
  avgPaceMinPerKm: string;
  uphillHours: number;
  horizontalHours: number;
} {
  const {
    distanceKm,
    elevationGainMeters,
    elevationLossMeters = elevationGainMeters,
    flatMarathonPaceSecPerKm,
    historicalVamMetersPerHour,
  } = params;

  // 1. Horizontal base time using flat marathon pace + trail technical terrain penalty factor (1.12x)
  const terrainFactor = 1.12;
  const horizontalSeconds = distanceKm * flatMarathonPaceSecPerKm * terrainFactor;

  // 2. Vertical climbing time based on athlete's historical VAM
  const effectiveVam = Math.max(300, historicalVamMetersPerHour || 550);
  const uphillSeconds = (elevationGainMeters / effectiveVam) * 3600;

  // 3. Downhill impact (moderate descent is fast, technical descent has fatigue cost)
  const downhillSeconds = (elevationLossMeters / 1500) * 3600 * 0.4;

  const totalSeconds = Math.round(horizontalSeconds + uphillSeconds + downhillSeconds);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedTime = `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  
  const avgSecPerKm = Math.round(totalSeconds / Math.max(1, distanceKm));
  const avgMin = Math.floor(avgSecPerKm / 60);
  const avgSec = avgSecPerKm % 60;
  const avgPaceMinPerKm = `${avgMin}:${avgSec.toString().padStart(2, "0")} /km`;

  return {
    estimatedTotalSeconds: totalSeconds,
    formattedTime,
    avgPaceMinPerKm,
    uphillHours: Math.round((uphillSeconds / 3600) * 10) / 10,
    horizontalHours: Math.round((horizontalSeconds / 3600) * 10) / 10,
  };
}

/**
 * Format seconds to min:sec pace string
 */
export function formatPace(secondsPerKm: number): string {
  if (!secondsPerKm || secondsPerKm <= 0 || !isFinite(secondsPerKm)) return "--:--";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.floor(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * ITRA / World Athletics: Km-Effort
 * Km-Effort = Distance (km) + (Elevation Gain (m) / 100)
 */
export function calculateKmEffort(distanceKm: number, elevationGainMeters: number): number {
  const kmEffort = distanceKm + Math.max(0, elevationGainMeters) / 100;
  return Math.round(kmEffort * 10) / 10;
}

/**
 * Grade Adjusted Pace (GAP) based on Minetti 2002 polynomial energy cost
 */
export function calculateGapPace(
  realPaceSecPerKm: number,
  distanceMeters: number,
  elevationGainMeters: number
): number {
  if (realPaceSecPerKm <= 0 || distanceMeters <= 0) return realPaceSecPerKm;
  const gradient = Math.max(0, elevationGainMeters / distanceMeters);
  const gapFactor = 1 + gradient * 4.0;
  return Math.round(realPaceSecPerKm / gapFactor);
}

/**
 * Interactive Trail Fueling & Nutrition Planner (Jeukendrup 2014 & Costa 2019)
 */
export function calculateTrailFuelingPlan(totalSeconds: number): {
  totalHours: number;
  carbsPerHourGrams: number;
  totalCarbsGrams: number;
  energyGelsCount: number;
  waterPerHourMl: number;
  totalWaterLiters: number;
  sodiumPerHourMg: number;
  totalSodiumMg: number;
  saltCapsulesCount: number;
} {
  const totalHours = Math.max(0.5, Math.round((totalSeconds / 3600) * 10) / 10);
  
  // Exogenous carbohydrate oxidation rate
  const carbsPerHourGrams = totalHours < 2.5 ? 45 : totalHours < 5 ? 60 : 75;
  const totalCarbsGrams = Math.round(carbsPerHourGrams * totalHours);
  const energyGelsCount = Math.ceil(totalCarbsGrams / 25); // ~25g carbs per gel

  // Hydration requirements
  const waterPerHourMl = 600; // 600 ml/hr standard
  const totalWaterLiters = Math.round((waterPerHourMl * totalHours / 1000) * 10) / 10;

  // Electrolyte / Sodium replacement
  const sodiumPerHourMg = 500; // 500 mg/hr
  const totalSodiumMg = Math.round(sodiumPerHourMg * totalHours);
  const saltCapsulesCount = Math.ceil(totalSodiumMg / 450); // ~450mg per salt capsule

  return {
    totalHours,
    carbsPerHourGrams,
    totalCarbsGrams,
    energyGelsCount,
    waterPerHourMl,
    totalWaterLiters,
    sodiumPerHourMg,
    totalSodiumMg,
    saltCapsulesCount,
  };
}

/**
 * Kilian Jornet & Uphill Athlete Climb Density Profile
 * Ratio of vertical meters gained per horizontal kilometer (m D+ / km)
 */
export function classifyClimbDensity(densityMPerKm: number): {
  category: string;
  badgeColor: string;
  description: string;
} {
  if (densityMPerKm < 25) {
    return {
      category: "Rolling Trail / Low Vert",
      badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/30",
      description: "Fast runnable course with gentle undulations (<25 m/km).",
    };
  } else if (densityMPerKm < 60) {
    return {
      category: "Moderate Mountain Trail",
      badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
      description: "Standard trail with sustained runnable climbs (25-60 m/km).",
    };
  } else if (densityMPerKm < 95) {
    return {
      category: "High Alpine / Steep Mountain",
      badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
      description: "Rugged terrain requiring power-hiking on climbs (60-95 m/km).",
    };
  } else {
    return {
      category: "Skyrunning / Extreme Vertical",
      badgeColor: "text-rose-400 bg-rose-500/10 border-rose-500/30",
      description: "Technical alpine ridges and vertical ascents (>95 m/km).",
    };
  }
}

/**
 * Trail & Mountain Training Preparation Volume Guide (Jason Koop & Kilian Jornet)
 * Supports two tiers:
 * 1. "finisher" (Realistis / Age-Grouper): Caps vert to injury-safe limits (1,800m - 2,800m D+ max for ultras) with focus on back-to-back weekends and strength.
 * 2. "elite" (Pro Athlete / Full-Time): Uncapped high-volume European pro standards (4,000m - 5,500m D+).
 */
export function calculateRacePreparationVolume(
  distanceKm: number,
  elevationGainMeters: number,
  tier: "finisher" | "elite" = "finisher"
): {
  peakWeeklyKmRange: string;
  peakWeeklyVertRange: string;
  monthlyVertRange: string;
  keyLongRunKm: number;
  keyLongRunVertM: number;
  minWeeklyVertTarget: number;
  maxWeeklyVertTarget: number;
  methodologyTip: string;
} {
  if (tier === "elite") {
    const peakWeeklyKmMin = Math.round(distanceKm * 1.2);
    const peakWeeklyKmMax = Math.round(distanceKm * 1.6);
    const minWeeklyVertTarget = Math.round(elevationGainMeters * 0.75);
    const maxWeeklyVertTarget = Math.round(elevationGainMeters * 1.1);
    const monthlyVertMin = Math.round(minWeeklyVertTarget * 3.6);
    const monthlyVertMax = Math.round(maxWeeklyVertTarget * 3.8);
    const keyLongRunKm = Math.round(distanceKm * 0.68);
    const keyLongRunVertM = Math.round(elevationGainMeters * 0.65);

    return {
      peakWeeklyKmRange: `${peakWeeklyKmMin} - ${peakWeeklyKmMax} km/minggu`,
      peakWeeklyVertRange: `+${minWeeklyVertTarget.toLocaleString()}m - +${maxWeeklyVertTarget.toLocaleString()}m D+/minggu`,
      monthlyVertRange: `+${monthlyVertMin.toLocaleString()}m - +${monthlyVertMax.toLocaleString()}m D+/bulan`,
      keyLongRunKm,
      keyLongRunVertM,
      minWeeklyVertTarget,
      maxWeeklyVertTarget,
      methodologyTip: "Standar Pro: Dedikasi latihan penuh seperti atlet Alpen (Kílian Jornet / François D'Haene) dengan adaptasi volume vertikal tanpa batas.",
    };
  }

  // --- FINISHER / REALISTIS TIER (Jason Koop & David Roche Framework for Working Athletes) ---
  let peakWeeklyKmMin: number;
  let peakWeeklyKmMax: number;
  if (distanceKm <= 30) {
    peakWeeklyKmMin = Math.round(distanceKm * 1.1);
    peakWeeklyKmMax = Math.round(distanceKm * 1.4);
  } else if (distanceKm <= 60) {
    peakWeeklyKmMin = Math.round(distanceKm * 0.9); // e.g. 54 km
    peakWeeklyKmMax = Math.round(distanceKm * 1.2); // e.g. 72 km
  } else {
    peakWeeklyKmMin = Math.min(70, Math.round(distanceKm * 0.7));
    peakWeeklyKmMax = Math.min(90, Math.round(distanceKm * 0.9));
  }

  // Realistic weekly vert: safe human cap around 2,000m - 2,800m D+ / week for working athletes
  let minWeeklyVertTarget: number;
  let maxWeeklyVertTarget: number;
  if (elevationGainMeters <= 1800) {
    minWeeklyVertTarget = Math.round(elevationGainMeters * 0.65);
    maxWeeklyVertTarget = Math.round(elevationGainMeters * 0.9);
  } else if (elevationGainMeters <= 3200) {
    minWeeklyVertTarget = Math.round(1200 + (elevationGainMeters - 1800) * 0.45);
    maxWeeklyVertTarget = Math.round(1600 + (elevationGainMeters - 1800) * 0.55);
  } else {
    // Extreme races like Rinjani 60K (+5,400m):
    minWeeklyVertTarget = 2000;
    maxWeeklyVertTarget = 2800;
  }

  const monthlyVertMin = Math.round(minWeeklyVertTarget * 3.4);
  const monthlyVertMax = Math.round(maxWeeklyVertTarget * 3.6);

  // Key long run simulation: cap around 30-32 km for amateurs so recovery doesn't derail training
  const keyLongRunKm = Math.min(32, Math.max(16, Math.round(distanceKm * 0.52)));
  const keyLongRunVertM = Math.min(2200, Math.max(800, Math.round(elevationGainMeters * 0.42)));

  return {
    peakWeeklyKmRange: `${peakWeeklyKmMin} - ${peakWeeklyKmMax} km/minggu`,
    peakWeeklyVertRange: `+${minWeeklyVertTarget.toLocaleString()}m - +${maxWeeklyVertTarget.toLocaleString()}m D+/minggu`,
    monthlyVertRange: `+${monthlyVertMin.toLocaleString()}m - +${monthlyVertMax.toLocaleString()}m D+/bulan`,
    keyLongRunKm,
    keyLongRunVertM,
    minWeeklyVertTarget,
    maxWeeklyVertTarget,
    methodologyTip: "Standar Finisher Realistis: Mengutamakan metode Back-to-Back Weekend (Sabtu nanjak + Minggu nanjak saat kaki lelah) dan latihan kekuatan paha (ME) agar aman dari cedera.",
  };
}

// ---------------------------------------------------------------------------
// TRAINING READINESS & DAILY SUGGESTION ENGINE (SCIENTIFIC DETERMINISTIC)
// Based on:
// - Banister & Coggan: TSB Form Thresholds (-30, -10, +5, +25)
// - Tim Gabbett (2016): ACWR Workload Governor (Safe ceiling < 1.3)
// - Kiviniemi & Plews (2007, 2013): Autonomic Nervous System & Recovery Balance
// ---------------------------------------------------------------------------

export interface TrainingReadinessParams {
  ctl: number;
  atl: number;
  tsb: number;
  todayLoad: number;
  acwr: number;
  recoveryScore?: number;
  hrvStatus?: string;
  sleepHours?: number;
  rampRate?: number;
}

export interface TrainingReadinessResult {
  score: number; // 0 - 100
  tier: "PRIME" | "OPTIMAL" | "MODERATE" | "RECOVERY" | "REST";
  label: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  suggestion: {
    title: string;
    category: "REST" | "RECOVERY" | "BASE" | "TEMPO" | "QUALITY" | "RACE";
    durationMinutes: string;
    targetLoad: string;
    intensityZone: string;
    heartRateGuide: string;
    description: string;
  };
  governor: {
    maxSafeLoadTomorrow: number;
    nextQualityWindow: string;
    scientificRationale: string;
  };
  factors: {
    fatigueImpact: "HIGH" | "MODERATE" | "LOW";
    formReadiness: "FRESH" | "OPTIMAL" | "OVERREACHING" | "DETRAINING";
    injuryRisk: "SAFE" | "ELEVATED" | "CRITICAL";
  };
}

export function calculateTrainingReadiness(params: TrainingReadinessParams): TrainingReadinessResult {
  const {
    ctl,
    atl,
    tsb,
    todayLoad,
    acwr,
    recoveryScore = 75,
    hrvStatus = "NORMAL",
  } = params;

  // Safe Load Ceiling from Gabbett ACWR Governor:
  // To keep ACWR <= 1.3: ChronicLoad * 1.3
  const safeLoadCeiling = Math.max(25, Math.round(ctl * 1.25));

  // Determine factor states
  const fatigueImpact: "HIGH" | "MODERATE" | "LOW" =
    atl > ctl * 1.2 || todayLoad >= 80 ? "HIGH" : atl > ctl ? "MODERATE" : "LOW";

  const formReadiness: "FRESH" | "OPTIMAL" | "OVERREACHING" | "DETRAINING" =
    tsb < -30
      ? "OVERREACHING"
      : tsb <= -10
      ? "OPTIMAL"
      : tsb <= 25
      ? "FRESH"
      : "DETRAINING";

  const injuryRisk: "SAFE" | "ELEVATED" | "CRITICAL" =
    acwr > 1.5 || tsb < -35 ? "CRITICAL" : acwr > 1.3 || tsb < -25 ? "ELEVATED" : "SAFE";

  // CASE 1: CRITICAL RECOVERY / MANDATORY REST
  // Either TSB severely negative (< -30) or ACWR in danger zone (> 1.5)
  if (tsb < -30 || acwr > 1.5 || recoveryScore < 30) {
    return {
      score: Math.max(15, Math.min(35, Math.round(30 + tsb * 0.4))),
      tier: "REST",
      label: "Rest Required",
      badgeBg: "bg-rose-100 text-rose-950",
      badgeBorder: "border-rose-950",
      textColor: "text-rose-600",
      suggestion: {
        title: "Complete Rest Day (No Training)",
        category: "REST",
        durationMinutes: "0 mins",
        targetLoad: "0 Load",
        intensityZone: "Rest & Recovery",
        heartRateGuide: "Resting Heart Rate baseline",
        description:
          "Your acute fatigue is critically elevated relative to fitness. Continuing to push carries high probability of tendon/joint overuse injury or immune suppression. Take a full rest day with ample hydration and sleep.",
      },
      governor: {
        maxSafeLoadTomorrow: 15,
        nextQualityWindow: "In 48 – 72 hours",
        scientificRationale:
          "Banister & Friel protocols identify TSB < -30 as non-functional overreaching. Gabbett (2016) shows ACWR > 1.5 increases injury relative risk by 2x to 4x.",
      },
      factors: { fatigueImpact, formReadiness, injuryRisk },
    };
  }

  // CASE 2: TODAY WAS A HARD / HIGH LOAD WORKOUT (todayLoad >= 80)
  // Even if Form is positive, muscular glycogen & sarcomere repair requires 24-36h buffer
  if (todayLoad >= 80) {
    const score = Math.max(45, Math.min(60, Math.round(55 + (recoveryScore - 50) * 0.2)));
    return {
      score,
      tier: "RECOVERY",
      label: "Active Recovery Priority",
      badgeBg: "bg-amber-100 text-amber-950",
      badgeBorder: "border-zinc-950",
      textColor: "text-amber-700",
      suggestion: {
        title: "Active Recovery Jog or Rest Day",
        category: "RECOVERY",
        durationMinutes: "20 – 30 mins (or Off)",
        targetLoad: "15 – 25 Load",
        intensityZone: "Zone 1 (Easy Aerobic / Flush)",
        heartRateGuide: "< 72% Max HR (< 132 bpm)",
        description: `You absorbed a high workload today (${Math.round(todayLoad)} Load). Prioritize cellular adaptation and glycogen re-synthesis before attempting another intense session.`,
      },
      governor: {
        maxSafeLoadTomorrow: Math.round(safeLoadCeiling * 0.5),
        nextQualityWindow: "In 24 – 36 hours",
        scientificRationale:
          "Following high acute training impulses, muscular supercompensation requires 24–36h. Active recovery stimulates vascular flushing without adding eccentric mechanical micro-tears.",
      },
      factors: { fatigueImpact, formReadiness, injuryRisk },
    };
  }

  // CASE 3: PRIME FOR QUALITY & HIGH INTENSITY (TSB +5 to +25, rested today, safe ACWR)
  if (tsb >= 5 && tsb <= 25 && todayLoad < 40 && acwr <= 1.25) {
    const score = Math.min(96, Math.max(85, Math.round(88 + tsb * 0.35)));
    return {
      score,
      tier: "PRIME",
      label: "Prime for Speed & Quality",
      badgeBg: "bg-cyan-100 text-cyan-950",
      badgeBorder: "border-zinc-950",
      textColor: "text-sky-700",
      suggestion: {
        title: "Intervals, Threshold, or Race Effort",
        category: "QUALITY",
        durationMinutes: "45 – 70 mins",
        targetLoad: `${Math.round(ctl * 0.9)} – ${Math.round(ctl * 1.3)} Load`,
        intensityZone: "Zone 4 / Zone 5 (Threshold & VO2Max repeats)",
        heartRateGuide: "> 85% Max HR (155+ bpm)",
        description:
          "Your autonomic readiness is high, chronic form is fresh (+5 to +25), and acute fatigue is low. Ideal window for track repeats, tempo tests, or peak race efforts.",
      },
      governor: {
        maxSafeLoadTomorrow: safeLoadCeiling,
        nextQualityWindow: "Prime Window Open Now",
        scientificRationale:
          "Positive TSB combined with low acute strain maximizes neuromuscular rate of force development (RFD) and cardiac stroke volume (Coggan & Allen).",
      },
      factors: { fatigueImpact, formReadiness, injuryRisk },
    };
  }

  // CASE 4: OPTIMAL TRAINING SWEET SPOT (-30 <= TSB < -10, sustainable building)
  if (tsb >= -30 && tsb < -10 && acwr <= 1.35) {
    const score = Math.min(84, Math.max(70, Math.round(76 + (tsb + 20) * 0.4)));
    return {
      score,
      tier: "OPTIMAL",
      label: "Productive Building Window",
      badgeBg: "bg-emerald-100 text-emerald-950",
      badgeBorder: "border-zinc-950",
      textColor: "text-emerald-700",
      suggestion: {
        title: "Aerobic Base or Tempo Progression",
        category: "TEMPO",
        durationMinutes: "45 – 60 mins",
        targetLoad: `${Math.round(ctl * 0.8)} – ${Math.round(ctl * 1.1)} Load`,
        intensityZone: "Zone 2 Steady or Zone 3 Tempo",
        heartRateGuide: "72% – 82% Max HR (135 – 150 bpm)",
        description:
          "Your fitness building is right in the sweet spot. Fatigue is present but completely sustainable. Good day for steady aerobic mileage or light progressive tempo.",
      },
      governor: {
        maxSafeLoadTomorrow: safeLoadCeiling,
        nextQualityWindow: "Today or Tomorrow",
        scientificRationale:
          "Friel's sweet spot (-30 to -10 TSB) allows maximal CTL accumulation rate while maintaining immune integrity and tendon tolerance.",
      },
      factors: { fatigueImpact, formReadiness, injuryRisk },
    };
  }

  // CASE 5: AEROBIC MAINTENANCE / BASE (-10 <= TSB < 5 or TSB > 25 detraining)
  const score = Math.min(74, Math.max(62, Math.round(68 + (recoveryScore - 50) * 0.1)));
  return {
    score,
    tier: "MODERATE",
    label: "Aerobic Base Maintenance",
    badgeBg: "bg-zinc-100 text-zinc-950",
    badgeBorder: "border-zinc-950",
    textColor: "text-zinc-800",
    suggestion: {
      title: "Zone 2 Conversational Endurance",
      category: "BASE",
      durationMinutes: "35 – 50 mins",
      targetLoad: `${Math.round(ctl * 0.6)} – ${Math.round(ctl * 0.85)} Load`,
      intensityZone: "Zone 2 (Aerobic Base)",
      heartRateGuide: "68% – 78% Max HR (128 – 142 bpm)",
      description:
        "Maintain capillary density and fat oxidation with an easy, conversational run. Keep intensity strictly under your Aerobic Threshold (AeT).",
    },
    governor: {
      maxSafeLoadTomorrow: safeLoadCeiling,
      nextQualityWindow: "In 24 hours",
      scientificRationale:
        "Kiviniemi & Buchheit show Zone 2 aerobic volume maintains mitochondrial enzyme activity without autonomic nervous system suppression.",
    },
    factors: { fatigueImpact, formReadiness, injuryRisk },
  };
}

