/**
 * Scientific Periodization & Mesocycle 3:1 Training Engine
 * 
 * Based on sports science periodization principles:
 * - Tudor Bompa & Matveyev (Classic Macrocycle / Mesocycle / Microcycle)
 * - Jason Koop (Training Essentials for Ultrarunning - 3:1 Wave Loading)
 * - Joe Friel (The Runner's / Triathlete's Training Bible)
 * - Tim Gabbett (BJSM 2016 ACWR Safe Ramp Rate Ceiling)
 */

export type PeriodizationMode = "continuous" | "target_race";
export type DisciplineFocus = "hybrid" | "road" | "trail";
export type MacroPhase = "base" | "build" | "peak" | "taper" | "race";
export type MesoWeekType = "load_1" | "load_2" | "load_peak" | "deload" | "taper" | "race_week";

export interface WeeklyPlan {
  weekNumber: number; // 1-indexed relative to cycle or countdown
  weekDateStr: string; // e.g. "14 Sep – 20 Sep"
  startDateIso: string;
  phase: MacroPhase;
  phaseLabel: {
    id: string;
    en: string;
  };
  mesoType: MesoWeekType;
  mesoLabel: {
    id: string;
    en: string;
  };
  targetDistanceKm: number;
  targetElevationGain: number;
  targetTrainingLoad: number;
  isCurrentWeek: boolean;
  isDeload: boolean;
  isRaceWeek: boolean;
  volumeMultiplier: number;
  keyWorkoutFocus: {
    id: string;
    en: string;
  };
  prescriptionTip: {
    id: string;
    en: string;
  };
}

export interface PeriodizationOverview {
  mode: PeriodizationMode;
  focus: DisciplineFocus;
  targetRaceDate?: string;
  daysUntilRace?: number;
  weeksUntilRace?: number;
  currentWeek: WeeklyPlan;
  weeksInCycle: WeeklyPlan[];
  nextDeloadInWeeks: number;
  currentPhase: MacroPhase;
  currentPhaseLabel: {
    id: string;
    en: string;
  };
  summaryStats: {
    baselineKm: number;
    baselineGain: number;
    baselineTss: number;
    peakKm: number;
    peakGain: number;
  };
}

export interface PeriodizationParams {
  mode?: PeriodizationMode;
  focus?: DisciplineFocus;
  targetRaceDate?: string; // YYYY-MM-DD
  targetRaceDist?: number; // km
  targetRaceElev?: number; // m
  currentCtl?: number;
  avgWeeklyKm?: number;
  avgWeeklyGain?: number;
  userTimezone?: string;
}

/**
 * Format date range for a week starting on a given Monday
 */
function formatWeekDateRange(startDate: Date): string {
  const endDate = new Date(startDate.getTime() + 6 * 24 * 3600 * 1000);
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  const startMonth = months[startDate.getMonth()];
  const endMonth = months[endDate.getMonth()];

  if (startMonth === endMonth) {
    return `${startDay} – ${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

/**
 * Get Monday date of the week containing a target date
 */
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Main Periodization Plan Generator
 */
export function generatePeriodizationPlan(params: PeriodizationParams): PeriodizationOverview {
  const {
    mode = "continuous",
    focus = "hybrid",
    targetRaceDate,
    targetRaceDist = 60,
    targetRaceElev = 5400,
    currentCtl = 42,
    avgWeeklyKm = 48,
    avgWeeklyGain = 1600,
  } = params;

  const now = new Date();
  const currentMonday = getMonday(now);

  // Baseline calibration from current athlete fitness
  let baseKm = Math.max(30, Math.round(avgWeeklyKm || currentCtl * 1.15));
  let baseGain = Math.max(300, Math.round(avgWeeklyGain || currentCtl * 38));

  // Focus adjustments
  if (focus === "road") {
    baseKm = Math.round(baseKm * 1.25);
    baseGain = Math.round(baseGain * 0.35); // Lower vert for road
  } else if (focus === "trail") {
    baseGain = Math.round(baseGain * 1.20); // High vert priority
  }

  const baseTss = Math.round(currentCtl * 7 * 1.05);

  if (mode === "continuous" || !targetRaceDate) {
    // -------------------------------------------------------------
    // CONTINUOUS BASE MODE: Rolling 4-Week Mesocycle (3:1 Wave)
    // -------------------------------------------------------------
    const epochMonday = new Date(2026, 0, 5); // Monday Jan 5 2026
    const diffWeeks = Math.floor((currentMonday.getTime() - epochMonday.getTime()) / (7 * 24 * 3600 * 1000));
    const currentWeekInCycle = (Math.abs(diffWeeks) % 4) + 1; // 1, 2, 3, or 4

    const cycleWeeks: WeeklyPlan[] = [];

    for (let w = 1; w <= 4; w++) {
      const weekOffset = w - currentWeekInCycle;
      const weekStartDate = new Date(currentMonday.getTime() + weekOffset * 7 * 24 * 3600 * 1000);
      const isCurrent = w === currentWeekInCycle;
      const isDeload = w === 4;

      let volumeMultiplier = 1.0;
      let mesoType: MesoWeekType = "load_1";
      let mesoLabel = { id: "Beban Dasar (Load 1)", en: "Base Load (Load 1)" };
      let keyWorkout = {
        id: focus === "trail" ? "Long Run Trail Z2 & Teknikal" : "Long Run Aerobik Z2 Stabil",
        en: focus === "trail" ? "Z2 Trail Long Run & Technical Footing" : "Steady Z2 Aerobic Long Run",
      };
      let tip = {
        id: "Bangun ritme latihan mingguan dengan intensitas denyut jantung terkontrol.",
        en: "Establish weekly training rhythm with disciplined heart rate control.",
      };

      if (w === 1) {
        volumeMultiplier = 1.0;
        mesoType = "load_1";
        mesoLabel = { id: "Beban Dasar (Load 1)", en: "Base Load (Load 1)" };
      } else if (w === 2) {
        volumeMultiplier = 1.08;
        mesoType = "load_2";
        mesoLabel = { id: "Beban Progresif (Load 2)", en: "Progressive Load (Load 2)" };
        keyWorkout = {
          id: focus === "trail" ? "Hill Repeats VAM + Tempo Flat" : "Tempo Run di Ambang Laktat (Z3/Z4)",
          en: focus === "trail" ? "Hill Repeats VAM + Flat Tempo" : "Threshold Tempo Run (Z3/Z4)",
        };
        tip = {
          id: "Tingkatkan volume sedikit (+8%) untuk memberikan stimulus baru pada mitokondria.",
          en: "Step up volume (+8%) to deliver fresh mitochondrial adaptation.",
        };
      } else if (w === 3) {
        volumeMultiplier = 1.16;
        mesoType = "load_peak";
        mesoLabel = { id: "Puncak Beban Siklus (Peak Load)", en: "Cycle Peak Load (Overload)" };
        keyWorkout = {
          id: focus === "trail" ? "Back-to-Back Weekend Trail Long Runs" : "Long Run Progresif Jarak Maksimal",
          en: focus === "trail" ? "Back-to-Back Weekend Trail Long Runs" : "Progressive Peak Long Run",
        };
        tip = {
          id: "Minggu terberat dalam siklus. Pastikan nutrisi karbohidrat dan tidur cukup.",
          en: "Heaviest load of the cycle. Prioritize carbohydrate refueling and sleep.",
        };
      } else if (w === 4) {
        volumeMultiplier = 0.68; // -32% reduction
        mesoType = "deload";
        mesoLabel = { id: "Pekan Deload (Pemulihan)", en: "Deload Week (Supercompensation)" };
        keyWorkout = {
          id: "Easy Recovery Run + Mobility & Stretch",
          en: "Easy Recovery Run + Mobility & Stretch",
        };
        tip = {
          id: "Pangkas volume 32% agar terjadi superkompensasi otot dan penurunan kelelahan ATL.",
          en: "Slash volume by 32% to trigger muscular supercompensation and flush fatigue.",
        };
      }

      cycleWeeks.push({
        weekNumber: w,
        weekDateStr: formatWeekDateRange(weekStartDate),
        startDateIso: weekStartDate.toISOString().split("T")[0],
        phase: "base",
        phaseLabel: { id: "Pondasi Berkelanjutan", en: "Continuous Base" },
        mesoType,
        mesoLabel,
        targetDistanceKm: Math.round(baseKm * volumeMultiplier),
        targetElevationGain: Math.round(baseGain * volumeMultiplier),
        targetTrainingLoad: Math.round(baseTss * volumeMultiplier),
        isCurrentWeek: isCurrent,
        isDeload,
        isRaceWeek: false,
        volumeMultiplier,
        keyWorkoutFocus: keyWorkout,
        prescriptionTip: tip,
      });
    }

    const currentWeekPlan = cycleWeeks.find((w) => w.isCurrentWeek) || cycleWeeks[0];
    const nextDeloadInWeeks = currentWeekInCycle === 4 ? 0 : 4 - currentWeekInCycle;

    return {
      mode: "continuous",
      focus,
      currentWeek: currentWeekPlan,
      weeksInCycle: cycleWeeks,
      nextDeloadInWeeks,
      currentPhase: "base",
      currentPhaseLabel: { id: "Pondasi Berkelanjutan", en: "Continuous Base" },
      summaryStats: {
        baselineKm: baseKm,
        baselineGain: baseGain,
        baselineTss: baseTss,
        peakKm: Math.round(baseKm * 1.16),
        peakGain: Math.round(baseGain * 1.16),
      },
    };
  }

  // -------------------------------------------------------------
  // TARGET RACE COUNTDOWN MODE: Anchored Macrocycle to Race Date
  // -------------------------------------------------------------
  const raceDateObj = new Date(targetRaceDate);
  const raceMonday = getMonday(raceDateObj);
  const totalWeeks = Math.max(
    4,
    Math.round((raceMonday.getTime() - currentMonday.getTime()) / (7 * 24 * 3600 * 1000)) + 1
  );

  const daysUntilRace = Math.max(0, Math.round((raceDateObj.getTime() - now.getTime()) / (24 * 3600 * 1000)));

  const targetPeakWeeklyKm = Math.max(baseKm * 1.25, Math.min(100, Math.round(targetRaceDist * 1.1)));
  const targetPeakWeeklyGain = Math.max(baseGain * 1.25, Math.min(6000, Math.round(targetRaceElev * 0.70)));

  const fullRoadmapWeeks: WeeklyPlan[] = [];

  for (let w = 1; w <= totalWeeks; w++) {
    const weekStartDate = new Date(currentMonday.getTime() + (w - 1) * 7 * 24 * 3600 * 1000);
    const weeksToRace = totalWeeks - w;
    const isCurrent = w === 1;
    const isRaceWeek = weeksToRace === 0;

    let phase: MacroPhase = "base";
    let phaseLabel = { id: "Fase Base (Pondasi)", en: "Base Phase" };
    let mesoType: MesoWeekType = "load_1";
    let mesoLabel = { id: "Beban Dasar (Load 1)", en: "Base Load (Load 1)" };
    let isDeload = false;
    let multiplier = 1.0;

    let keyWorkout = {
      id: "Long Run Zona 2 Stabil",
      en: "Steady Zone 2 Long Run",
    };
    let tip = {
      id: "Bangun efisiensi pembakaran lemak aerobik dan kekuatan ligamen.",
      en: "Build aerobic fat oxidation efficiency and ligament durability.",
    };

    if (isRaceWeek) {
      phase = "race";
      phaseLabel = { id: "Pekan Lomba (Race Week)", en: "Race Week" };
      mesoType = "race_week";
      mesoLabel = { id: "Hari H Lomba", en: "Race Day" };
      multiplier = 0.50;
      keyWorkout = {
        id: `RACE DAY: ${targetRaceDist}k (+${targetRaceElev}m D+)`,
        en: `RACE DAY: ${targetRaceDist}k (+${targetRaceElev}m D+)`,
      };
      tip = {
        id: "Istirahat total, carbo-loading 36 jam sebelum start, dan eksekusi nutrisi teratur.",
        en: "Full rest, carbo-load 36h before start, and execute disciplined fueling.",
      };
    } else if (weeksToRace === 1) {
      // Taper Week 1
      phase = "taper";
      phaseLabel = { id: "Fase Tapering", en: "Taper Phase" };
      mesoType = "taper";
      mesoLabel = { id: "Taper 1 (-40% Volume)", en: "Taper 1 (-40% Volume)" };
      multiplier = 0.60;
      keyWorkout = {
        id: "Easy Run Pendek + 4x Strides Akselerasi",
        en: "Short Easy Run + 4x Acceleration Strides",
      };
      tip = {
        id: "Turunkan volume drastis agar TSB naik ke zona segar (+10 s/d +15).",
        en: "Slash volume sharply so TSB surges into fresh zone (+10 to +15).",
      };
    } else if (weeksToRace === 2) {
      // Taper Week 2 or Peak
      phase = "taper";
      phaseLabel = { id: "Fase Tapering", en: "Taper Phase" };
      mesoType = "taper";
      mesoLabel = { id: "Awal Tapering (-25% Volume)", en: "Taper Start (-25% Volume)" };
      multiplier = 0.75;
      keyWorkout = {
        id: "Long Run Moderat + Simulasi Gear Lomba",
        en: "Moderate Long Run + Race Gear Test",
      };
      tip = {
        id: "Uji coba rompi hidrasi, sepatu lomba, dan nutrisi race terakhir kali.",
        en: "Final trial for hydration vest, race shoes, and nutrition strategy.",
      };
    } else if (weeksToRace <= 4) {
      // Peak Weeks
      phase = "peak";
      phaseLabel = { id: "Fase Peak (Volume Puncak)", en: "Peak Phase" };
      mesoType = "load_peak";
      mesoLabel = { id: "Puncak Volume Persiapan", en: "Peak Preparation Volume" };
      multiplier = 1.25;
      keyWorkout = {
        id: focus === "trail" ? "Simulasi Rute Lomba & Back-to-Back Vertikal" : "Peak Long Run di Target Pace",
        en: focus === "trail" ? "Race Course Simulation & Back-to-Back Vert" : "Peak Long Run at Target Pace",
      };
      tip = {
        id: "Volume elevasi dan jarak tertinggi sebelum memasuki fase pemulihan taper.",
        en: "Highest mileage and vert accumulation before transitioning to taper.",
      };
    } else if (weeksToRace <= 8) {
      // Build Phase
      phase = "build";
      phaseLabel = { id: "Fase Build (Spesifisitas)", en: "Build Phase" };
      const subMeso = (w % 4);
      if (subMeso === 0) {
        isDeload = true;
        mesoType = "deload";
        mesoLabel = { id: "Pekan Deload Build (-30%)", en: "Build Deload (-30%)" };
        multiplier = 0.75;
        keyWorkout = { id: "Recovery Run + Peregangan", en: "Recovery Run + Mobility" };
        tip = {
          id: "Jeda pemulihan wajib untuk mengabsorpsi latihan beban tinggi minggu sebelumnya.",
          en: "Mandatory recovery bridge to absorb previous high-load stimuli.",
        };
      } else {
        multiplier = 1.05 + (subMeso * 0.06);
        mesoType = subMeso === 3 ? "load_peak" : "load_2";
        mesoLabel = {
          id: `Build Spesifik (Loading ${subMeso})`,
          en: `Specific Build (Load ${subMeso})`,
        };
        keyWorkout = {
          id: focus === "trail" ? "Tanjakan VAM Terjal + Power Hiking Poles" : "Tempo Interval Ambang Laktat",
          en: focus === "trail" ? "Steep VAM Climb + Power Hiking Poles" : "Lactate Threshold Intervals",
        };
        tip = {
          id: "Fokus melatih ambang batas daya tahan otot pada medan spesifik lomba.",
          en: "Focus on muscular endurance ceiling on race-specific terrain.",
        };
      }
    } else {
      // Base Phase
      phase = "base";
      phaseLabel = { id: "Fase Base (Pondasi Aerobik)", en: "Base Phase" };
      const subMeso = (w % 4);
      if (subMeso === 0) {
        isDeload = true;
        mesoType = "deload";
        mesoLabel = { id: "Pekan Deload Base (-30%)", en: "Base Deload (-30%)" };
        multiplier = 0.70;
        keyWorkout = { id: "Easy Run Santai & Istirahat", en: "Easy Run & Rest" };
        tip = {
          id: "Pekan pemulihan untuk mencegah cedera overuse pada tendon dan sendi.",
          en: "Recovery week to safeguard tendons and joints from overuse.",
        };
      } else {
        multiplier = 0.95 + (subMeso * 0.07);
        mesoType = subMeso === 3 ? "load_peak" : subMeso === 2 ? "load_2" : "load_1";
        mesoLabel = { id: `Pondasi Aerobik (Load ${subMeso})`, en: `Base Aerobic (Load ${subMeso})` };
        keyWorkout = { id: "Long Run Zona 2 Stabil", en: "Steady Zone 2 Long Run" };
        tip = { id: "Jaga denyut jantung tetap di Zona 2 murni.", en: "Keep heart rate strictly within Zone 2." };
      }
    }

    fullRoadmapWeeks.push({
      weekNumber: w,
      weekDateStr: formatWeekDateRange(weekStartDate),
      startDateIso: weekStartDate.toISOString().split("T")[0],
      phase,
      phaseLabel,
      mesoType,
      mesoLabel,
      targetDistanceKm: Math.round(targetPeakWeeklyKm * (multiplier / 1.25)),
      targetElevationGain: Math.round(targetPeakWeeklyGain * (multiplier / 1.25)),
      targetTrainingLoad: Math.round(baseTss * multiplier),
      isCurrentWeek: isCurrent,
      isDeload,
      isRaceWeek,
      volumeMultiplier: multiplier,
      keyWorkoutFocus: keyWorkout,
      prescriptionTip: tip,
    });
  }

  const currentWeekPlan = fullRoadmapWeeks[0];

  let nextDeload = -1;
  for (let i = 0; i < fullRoadmapWeeks.length; i++) {
    if (fullRoadmapWeeks[i].isDeload) {
      nextDeload = i;
      break;
    }
  }

  return {
    mode: "target_race",
    focus,
    targetRaceDate,
    daysUntilRace,
    weeksUntilRace: totalWeeks,
    currentWeek: currentWeekPlan,
    weeksInCycle: fullRoadmapWeeks.slice(0, 16),
    nextDeloadInWeeks: nextDeload >= 0 ? nextDeload : 3,
    currentPhase: currentWeekPlan.phase,
    currentPhaseLabel: currentWeekPlan.phaseLabel,
    summaryStats: {
      baselineKm: baseKm,
      baselineGain: baseGain,
      baselineTss: baseTss,
      peakKm: targetPeakWeeklyKm,
      peakGain: targetPeakWeeklyGain,
    },
  };
}
