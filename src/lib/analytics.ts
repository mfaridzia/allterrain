/**
 * Athletic Analytics Engine
 * Implements Bannister Impulse-Response PMC, Intervals.icu advanced metrics,
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

