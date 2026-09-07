"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Mountain,
  ArrowLeft,
  Upload,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Droplets,
  Zap,
  ShieldCheck,
  FileText,
  Printer,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Moon,
  Sun,
  Flame,
  Layers,
  MapPin,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  TrendingUp,
  Activity,
  Award,
  Eye,
  EyeOff,
  Minus,
  BookOpen,
  Info,
  Split,
  Trash2,
  Apple,
} from "lucide-react";
import { useAuthStatus } from "@/lib/queries";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  calculateKmEffort,
  formatPace,
  calculateSegmentLogistics,
  SegmentLogisticsResult,
} from "@/lib/analytics";
import { MapPoint, MapCheckpoint } from "@/components/TrailMap";
import { Header } from "@/components/Header";

// Dynamically import Leaflet Map to prevent Next.js SSR window errors
const TrailMap = dynamic(() => import("@/components/TrailMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[460px] sm:h-[520px] rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] flex items-center justify-center text-zinc-700 text-xs">
      <div className="flex flex-col items-center gap-2">
        <div className="w-7 h-7 border-2 border-zinc-950 border-t-amber-500 rounded-full animate-spin" />
        <span className="font-mono font-bold">Memuat Peta Spasial Topografi (Leaflet & OpenTopoMap)...</span>
      </div>
    </div>
  ),
});

export interface Checkpoint {
  id: string;
  name: string;
  distanceKm: number;
  elevationM: number;
  officialCotTime: string; // e.g. "04:00:00"
  officialCotHours: number;
  notes: string;
  rawDesc?: string;
  waterRefillMl: number;
  carbsTargetGrams: number;
  waterNeededMl?: number;
  waterExceedsCapacity?: boolean;
  waterDeficitMl?: number;
  gelsNeeded?: number;
  sodiumNeededMg?: number;
  saltCapsulesCount?: number;
  logisticsAdvice?: string;
  nextSegDurationFormatted?: string;
  nextSegDistanceKm?: number;
  nextSegGainM?: number;
}

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
  lat: number;
  lon: number;
  gradePct?: number;
}

export interface MajorClimb {
  id: string;
  name: string;
  startKm: number;
  endKm: number;
  distanceKm: number;
  gainM: number;
  avgGradePct: number;
  maxGradePct: number;
  category: "HC" | "Cat 1" | "Cat 2" | "Cat 3";
  estimatedMinutes: number;
}

interface RaceProfile {
  id: string;
  name: string;
  location: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  overallCotHours: number;
  description: string;
  elevationPoints: ElevationPoint[];
  checkpoints: Checkpoint[];
}

const PRESET_RACES: RaceProfile[] = [];

// Helper to color segments by slope grade
const getGradeColor = (grade?: number) => {
  if (grade === undefined) return "#06b6d4"; // cyan
  if (grade > 25) return "#ef4444"; // extreme steep wall red (>25%)
  if (grade > 15) return "#f97316"; // steep orange (power-hike 15-25%)
  if (grade > 8) return "#eab308"; // moderate climb yellow (8-15%)
  if (grade > 3) return "#84cc16"; // gentle climb lime (3-8%)
  if (grade < -15) return "#a855f7"; // technical downhill purple (<-15%)
  if (grade < -3) return "#38bdf8"; // moderate descent light blue (-3 to -15%)
  return "#10b981"; // flat/rolling green (-3 to +3%)
};

export default function TrailPlannerPage() {
  const [customRace, setCustomRace] = useState<RaceProfile | null>(null);

  // Athlete Calibration inputs
  const [athleteVam, setAthleteVam] = useState<number>(503);
  const [athleteFlatPaceSec, setAthleteFlatPaceSec] = useState<number>(318);

  // Strategy Mode: Finisher (Realistic), Target Sub-18 (Intermediate), or Fast/Elite
  const [strategyTier, setStrategyTier] = useState<"finisher" | "intermediate" | "elite">("finisher");

  // Official Race Cut-Off Time (Editable by user - Default 20.0 Hours)
  const [raceOfficialCotHours, setRaceOfficialCotHours] = useState<number>(20.0);

  // Visibility toggle for Pacing Estimation Card
  const [showPacingEstimation, setShowPacingEstimation] = useState<boolean>(true);

  // Advanced Pacing Simulation Controls (Night & Fatigue)
  const [raceStartTime, setRaceStartTime] = useState<string>("00:00"); // Midnight start typical for ultra
  const [fatigueDegradationPct, setFatigueDegradationPct] = useState<number>(14); // 14% second-half degradation
  const [nightPenaltyPct, setNightPenaltyPct] = useState<number>(16); // 16% slower under headlamp on technical rock
  const [aidStationMinutes, setAidStationMinutes] = useState<number>(8); // Average 8 mins per WS

  // Feature C: Aid Station Nutrition & Hydration Settings
  const [targetCarbsPerHour, setTargetCarbsPerHour] = useState<number>(60); // 60g carbs/hr (Jeukendrup gold standard)
  const [targetWaterPerHourMl, setTargetWaterPerHourMl] = useState<number>(500); // 500ml/hr standard
  const [flaskCapacityMl, setFlaskCapacityMl] = useState<number>(1000); // 2 x 500ml soft flasks (1,000ml)
  const [showNutritionPlan, setShowNutritionPlan] = useState<boolean>(true);

  // Bidirectional Map <-> Chart Hover State
  const [hoverDistanceKm, setHoverDistanceKm] = useState<number | null>(null);

  // Segment Breakdown Tab State ("checkpoint" vs "gradient")
  const [segmentTab, setSegmentTab] = useState<"checkpoint" | "gradient">("checkpoint");
  const [expandedSegmentId, setExpandedSegmentId] = useState<string | null>(null);

  // Methodology Explainer Modal/Accordion State
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  // Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Current active race profile (Starts as null until user uploads GPX)
  const activeRace = customRace;

  // Redirect to landing page if disconnected
  const router = useRouter();
  const { data: authStatus } = useAuthStatus();
  useEffect(() => {
    if (authStatus && !authStatus.connected) {
      router.replace("/");
    }
  }, [authStatus, router]);

  // Sync official COT when active race changes
  useEffect(() => {
    if (activeRace && activeRace.overallCotHours) {
      setRaceOfficialCotHours(activeRace.overallCotHours);
    }
  }, [activeRace]);

  // Downsample chart data points for ultra-fast 60 FPS Recharts hover interaction
  const chartPoints = useMemo(() => {
    if (!activeRace?.elevationPoints) return [];
    const pts = activeRace.elevationPoints;
    if (pts.length <= 600) return pts;
    const step = Math.ceil(pts.length / 600);
    const result: ElevationPoint[] = [];
    for (let i = 0; i < pts.length; i += step) {
      result.push(pts[i]);
    }
    if (result[result.length - 1] !== pts[pts.length - 1]) {
      result.push(pts[pts.length - 1]);
    }
    return result;
  }, [activeRace]);

  // Compute SVG linear gradient stops for the elevation cross-section
  const elevationGradientStops = useMemo(() => {
    if (!activeRace || !chartPoints || chartPoints.length < 2) return [];
    const pts = chartPoints;
    const totalDist = activeRace.distanceKm || 1;

    return pts.map((pt) => {
      const offset = Math.min(100, Math.max(0, (pt.distanceKm / totalDist) * 100));
      const color = getGradeColor(pt.gradePct);
      return { offset: Math.round(offset * 10) / 10, color };
    });
  }, [chartPoints, activeRace]);

  // Parse Race Start Time to hours
  const startHourOfDay = useMemo(() => {
    const parts = raceStartTime.split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h + m / 60;
  }, [raceStartTime]);

  // Track Overview & In-Depth Analytics Stats Card
  const trackStats = useMemo(() => {
    if (!activeRace) return null;
    const pts = activeRace.elevationPoints;
    let highestM = 0;
    let lowestM = Infinity;
    let maxSteepness = 0;
    let totalClimbDistKm = 0;
    let totalDescentDistKm = 0;
    let weightedClimbGrade = 0;

    for (let i = 0; i < pts.length; i++) {
      if (pts[i].elevationM > highestM) highestM = pts[i].elevationM;
      if (pts[i].elevationM < lowestM) lowestM = pts[i].elevationM;

      if (i > 0) {
        const segDist = pts[i].distanceKm - pts[i - 1].distanceKm;
        const g = pts[i].gradePct || 0;
        if (Math.abs(g) > maxSteepness) maxSteepness = Math.abs(g);

        if (g > 3) {
          totalClimbDistKm += segDist;
          weightedClimbGrade += g * segDist;
        } else if (g < -3) {
          totalDescentDistKm += segDist;
        }
      }
    }

    if (lowestM === Infinity) lowestM = 0;

    const avgClimbGrade = totalClimbDistKm > 0 ? weightedClimbGrade / totalClimbDistKm : 0;
    const densityRatio = activeRace.distanceKm > 0 ? activeRace.elevationGainM / activeRace.distanceKm : 0;
    const kmEffort = calculateKmEffort(activeRace.distanceKm, activeRace.elevationGainM);

    // Approximate Calories (~65 kcal per km flat + ~1 kcal per 10m D+ for 65kg athlete)
    const estCalories = Math.round(activeRace.distanceKm * 65 + (activeRace.elevationGainM / 10) * 8);

    // Difficulty Tier
    let difficultyTier = "Moderate Mountain Trail";
    let difficultyColor = "text-zinc-950 border-2 border-zinc-950 bg-amber-300 shadow-[2px_2px_0px_0px_#09090b]";
    if (densityRatio > 80 || activeRace.elevationGainM > 3500) {
      difficultyTier = "Alpine Skyrunning (Ultra Extreme)";
      difficultyColor = "text-zinc-950 border-2 border-zinc-950 bg-rose-400 shadow-[2px_2px_0px_0px_#09090b]";
    } else if (densityRatio > 50 || activeRace.elevationGainM > 2000) {
      difficultyTier = "Hard Trail / Steep Alpine";
      difficultyColor = "text-zinc-950 border-2 border-zinc-950 bg-orange-400 shadow-[2px_2px_0px_0px_#09090b]";
    }

    // Official ITRA Points Scale (0 to 6 Endurance Points based on Km-Effort)
    let itraPoints = 0;
    if (kmEffort >= 210) itraPoints = 6;
    else if (kmEffort >= 155) itraPoints = 5;
    else if (kmEffort >= 115) itraPoints = 4;
    else if (kmEffort >= 75) itraPoints = 3;
    else if (kmEffort >= 45) itraPoints = 2;
    else if (kmEffort >= 25) itraPoints = 1;
    else itraPoints = 0;

    // Official ITRA Mountain Level (0 to 12 scale based on Climb Density & Altitude)
    let mLevel = 1;
    if (densityRatio < 15) mLevel = 1;
    else if (densityRatio < 25) mLevel = 2;
    else if (densityRatio < 35) mLevel = 3;
    else if (densityRatio < 45) mLevel = 4;
    else if (densityRatio < 55) mLevel = 5;
    else if (densityRatio < 65) mLevel = 6;
    else if (densityRatio < 75) mLevel = 7;
    else if (densityRatio < 85) mLevel = 8;
    else mLevel = 9;

    if (highestM >= 2500) mLevel += 1.5;
    else if (highestM >= 2000) mLevel += 1.0;

    if (activeRace.elevationGainM >= 3500) mLevel += 1.5;
    else if (activeRace.elevationGainM >= 2000) mLevel += 1.0;

    const itraMountainLevel = Math.min(12, Math.max(1, Math.round(mLevel)));

    return {
      distanceKm: activeRace.distanceKm.toFixed(1),
      gainM: Math.round(activeRace.elevationGainM).toLocaleString(),
      lossM: Math.round(activeRace.elevationLossM).toLocaleString(),
      highestM: Math.round(highestM).toLocaleString(),
      lowestM: Math.round(lowestM).toLocaleString(),
      densityRatio: densityRatio.toFixed(1),
      avgClimbGrade: avgClimbGrade.toFixed(1),
      maxSteepness: maxSteepness.toFixed(1),
      kmEffort: kmEffort.toFixed(1),
      estCalories: estCalories.toLocaleString(),
      difficultyTier,
      difficultyColor,
      itraPoints,
      itraMountainLevel,
    };
  }, [activeRace]);

  // Major Mountain Passes & Categorized Climbs
  const majorClimbs = useMemo<MajorClimb[]>(() => {
    if (!activeRace?.elevationPoints || activeRace.elevationPoints.length < 2) return [];
    const pts = activeRace.elevationPoints;

    const climbs: MajorClimb[] = [];
    let inClimb = false;
    let climbStartIdx = 0;
    let minEle = pts[0].elevationM;
    let maxEle = pts[0].elevationM;

    for (let i = 1; i < pts.length; i++) {
      const diff = pts[i].elevationM - pts[i - 1].elevationM;

      if (diff > 0) {
        if (!inClimb) {
          inClimb = true;
          climbStartIdx = i - 1;
          minEle = pts[i - 1].elevationM;
          maxEle = pts[i].elevationM;
        } else {
          maxEle = Math.max(maxEle, pts[i].elevationM);
        }
      } else {
        if (inClimb) {
          const gain = maxEle - minEle;
          const dist = pts[i - 1].distanceKm - pts[climbStartIdx].distanceKm;

          if (gain >= 200 && dist > 0.4) {
            const avgGrade = Math.round((gain / (dist * 1000)) * 1000) / 10;
            const climbPts = pts.slice(climbStartIdx, i);
            const maxGrade = Math.max(...climbPts.map((p) => Math.abs(p.gradePct || 0)), avgGrade);

            let cat: "HC" | "Cat 1" | "Cat 2" | "Cat 3" = "Cat 3";
            if (gain >= 1000 || avgGrade > 20) cat = "HC";
            else if (gain >= 600 || avgGrade > 15) cat = "Cat 1";
            else if (gain >= 300) cat = "Cat 2";

            const estMinutes = Math.round((gain / athleteVam) * 60);

            climbs.push({
              id: `climb-${climbs.length + 1}`,
              name: `Tanjakan Utama ${climbs.length + 1}`,
              startKm: pts[climbStartIdx].distanceKm,
              endKm: pts[i - 1].distanceKm,
              distanceKm: Math.round(dist * 10) / 10,
              gainM: Math.round(gain),
              avgGradePct: avgGrade,
              maxGradePct: Math.round(maxGrade * 10) / 10,
              category: cat,
              estimatedMinutes: estMinutes,
            });
          }
          inClimb = false;
        }
      }
    }

    if (inClimb) {
      const gain = maxEle - minEle;
      const dist = pts[pts.length - 1].distanceKm - pts[climbStartIdx].distanceKm;
      if (gain >= 200 && dist > 0.4) {
        const avgGrade = Math.round((gain / (dist * 1000)) * 1000) / 10;
        let cat: "HC" | "Cat 1" | "Cat 2" | "Cat 3" = "Cat 3";
        if (gain >= 1000) cat = "HC";
        else if (gain >= 600) cat = "Cat 1";
        else if (gain >= 300) cat = "Cat 2";

        climbs.push({
          id: `climb-${climbs.length + 1}`,
          name: `Tanjakan Utama ${climbs.length + 1}`,
          startKm: pts[climbStartIdx].distanceKm,
          endKm: pts[pts.length - 1].distanceKm,
          distanceKm: Math.round(dist * 10) / 10,
          gainM: Math.round(gain),
          avgGradePct: avgGrade,
          maxGradePct: avgGrade * 1.5,
          category: cat,
          estimatedMinutes: Math.round((gain / athleteVam) * 60),
        });
      }
    }

    return climbs;
  }, [activeRace, athleteVam]);

  // Realistic Terrain & Gradient Distribution Breakdown (7 Professional Categories)
  const gradientBreakdown = useMemo(() => {
    if (!activeRace?.elevationPoints || activeRace.elevationPoints.length < 2) {
      return { flat: 0, gentleUp: 0, moderateUp: 0, steepUp: 0, extremeUp: 0, descentMod: 0, descentTech: 0 };
    }
    const pts = activeRace.elevationPoints;
    if (!pts || pts.length < 2) {
      return { flat: 10, gentleUp: 12, moderateUp: 18, steepUp: 22, extremeUp: 14, descentMod: 12, descentTech: 12 };
    }

    let flatDist = 0;
    let gentleUpDist = 0;
    let moderateUpDist = 0;
    let steepUpDist = 0;
    let extremeUpDist = 0;
    let descentModDist = 0;
    let descentTechDist = 0;
    let totalD = 0;

    for (let i = 1; i < pts.length; i++) {
      const segDist = pts[i].distanceKm - pts[i - 1].distanceKm;
      totalD += segDist;
      const g = pts[i].gradePct || 0;

      if (g > 25) extremeUpDist += segDist;
      else if (g > 15) steepUpDist += segDist;
      else if (g > 8) moderateUpDist += segDist;
      else if (g > 3) gentleUpDist += segDist;
      else if (g < -15) descentTechDist += segDist;
      else if (g < -3) descentModDist += segDist;
      else flatDist += segDist; // Strict flat: -3% to +3%
    }

    if (totalD === 0) totalD = 1;

    return {
      flat: Math.round((flatDist / totalD) * 100),
      gentleUp: Math.round((gentleUpDist / totalD) * 100),
      moderateUp: Math.round((moderateUpDist / totalD) * 100),
      steepUp: Math.round((steepUpDist / totalD) * 100),
      extremeUp: Math.round((extremeUpDist / totalD) * 100),
      descentMod: Math.round((descentModDist / totalD) * 100),
      descentTech: Math.round((descentTechDist / totalD) * 100),
    };
  }, [activeRace]);

  // Active Strategy Benchmark Stats
  const activeStrategyStats = useMemo(() => {
    if (strategyTier === "elite") {
      return {
        name: "Top Runner / Podium",
        vam: Math.max(Math.round(athleteVam * 1.85), 920),
        flatPace: Math.min(Math.round(athleteFlatPaceSec * 0.7), 235),
      };
    }
    if (strategyTier === "intermediate") {
      return {
        name: "Target Menengah (Sub-COT)",
        vam: Math.max(Math.round(athleteVam * 1.35), 660),
        flatPace: Math.min(Math.round(athleteFlatPaceSec * 0.85), 275),
      };
    }
    return {
      name: "Finisher (Realistis)",
      vam: Math.min(athleteVam, 480),
      flatPace: athleteFlatPaceSec,
    };
  }, [strategyTier, athleteVam, athleteFlatPaceSec]);

  // CALIBRATED MOUNTAIN PHYSIOLOGY PACING SIMULATION
  // Accurately predicts realistic finish time and compares against user's raceOfficialCotHours
  const evaluatedCheckpoints = useMemo(() => {
    if (!activeRace) return [];
    let cumSeconds = 0;
    let prevDistKm = 0;
    let runningGainM = 0;

    const totalRaceDist = activeRace.distanceKm || 40;
    const pts = activeRace.elevationPoints || [];

    // Define Strategy Profile Parameters
    let profileVam = athleteVam;
    let profileFlatPaceSec = athleteFlatPaceSec;
    let profileWsMinutes = aidStationMinutes;
    let profileFatigueImpact = fatigueDegradationPct / 100;
    let profileNightImpact = nightPenaltyPct / 100;
    let descentSecsPer1000m = 360;

    if (strategyTier === "elite") {
      // Top Runner / Podium Contender (Rinjani 60K ~10 - 11 Jam)
      profileVam = Math.max(athleteVam * 1.85, 920);
      profileFlatPaceSec = Math.min(athleteFlatPaceSec * 0.7, 235);
      profileWsMinutes = Math.min(aidStationMinutes * 0.2, 1.5);
      profileFatigueImpact = (fatigueDegradationPct / 100) * 0.25;
      profileNightImpact = (nightPenaltyPct / 100) * 0.25;
      descentSecsPer1000m = 180;
    } else if (strategyTier === "intermediate") {
      // Competitive Sub-COT Target (Rinjani 60K ~14 - 15 Jam)
      profileVam = Math.max(athleteVam * 1.35, 660);
      profileFlatPaceSec = Math.min(athleteFlatPaceSec * 0.85, 275);
      profileWsMinutes = Math.min(aidStationMinutes * 0.5, 3.5);
      profileFatigueImpact = (fatigueDegradationPct / 100) * 0.55;
      profileNightImpact = (nightPenaltyPct / 100) * 0.55;
      descentSecsPer1000m = 280;
    } else {
      // Finisher (Realistis - Target Safe Finish within 20h COT ~18 - 18.5 Jam)
      profileVam = Math.min(athleteVam, 480);
      profileFlatPaceSec = Math.max(athleteFlatPaceSec * 1.15, 360);
      profileWsMinutes = aidStationMinutes;
      profileFatigueImpact = (fatigueDegradationPct / 100) * 0.75;
      profileNightImpact = (nightPenaltyPct / 100) * 0.75;
      descentSecsPer1000m = 380;
    }

    const baseEvaluated = activeRace.checkpoints.map((cp, idx) => {
      const segDistKm = Math.max(0, cp.distanceKm - prevDistKm);

      // Compute TRUE CUMULATIVE SEGMENT ELEVATION GAIN (D+) AND LOSS (D-)
      let segGainM = 0;
      let segLossM = 0;
      let avgAltM = cp.elevationM;
      let segPtCount = 0;

      for (let i = 1; i < pts.length; i++) {
        if (pts[i].distanceKm >= prevDistKm && pts[i].distanceKm <= cp.distanceKm) {
          const diff = pts[i].elevationM - pts[i - 1].elevationM;
          if (diff > 0) segGainM += diff;
          else segLossM += Math.abs(diff);
          avgAltM += pts[i].elevationM;
          segPtCount++;
        }
      }

      if (segPtCount > 0) avgAltM = avgAltM / (segPtCount + 1);
      runningGainM += segGainM;
      const cumGainM = runningGainM;

      // 1. Horizontal Component on Mountain Trail
      const baseTrailPace = profileFlatPaceSec * 1.20;
      let segSecs = segDistKm * baseTrailPace * 0.50;

      // 2. Vertical Climbing Physics
      if (segGainM > 0) {
        const altitudeFactor = avgAltM > 3000 ? 0.88 : avgAltM > 2200 ? 0.94 : 1.0;
        const effectiveVam = profileVam * altitudeFactor;
        const climbHours = segGainM / Math.max(200, effectiveVam);
        segSecs += climbHours * 3600;
      }

      // 3. Technical Mountain Downhill Braking
      if (segLossM > 0) {
        segSecs += (segLossM / 1000) * descentSecsPer1000m;
      }

      // 4. Progressive Fatigue Factor (degradation in 2nd half)
      const raceProgressPct = cp.distanceKm / totalRaceDist;
      if (raceProgressPct > 0.35) {
        const progressDecay = 1 + ((raceProgressPct - 0.35) / 0.65) * profileFatigueImpact;
        segSecs *= progressDecay;
      }

      // 5. Night Headlamp Penalty (between 18:00 and 06:00)
      const currentHourOfDay = (startHourOfDay + cumSeconds / 3600) % 24;
      const isNight = currentHourOfDay >= 18 || currentHourOfDay < 6;
      if (isNight && segDistKm > 0) {
        segSecs *= 1 + profileNightImpact;
      }

      // 6. Aid Station Stoppage Time
      if (idx > 0 && idx < activeRace.checkpoints.length - 1) {
        const isMajorStation =
          cp.name.toLowerCase().includes("rim") ||
          cp.name.toLowerCase().includes("plawangan") ||
          cp.name.toLowerCase().includes("danau") ||
          cp.name.toLowerCase().includes("cetho");
        const stopMinutes = isMajorStation ? profileWsMinutes * 1.25 : profileWsMinutes * 0.75;
        segSecs += stopMinutes * 60;
      }

      cumSeconds += segSecs;
      prevDistKm = cp.distanceKm;

      // Elapsed Time format
      const predHours = Math.floor(cumSeconds / 3600);
      const predMins = Math.floor((cumSeconds % 3600) / 60);
      const predictedTimeStr = `${predHours.toString().padStart(2, "0")}j ${predMins.toString().padStart(2, "0")}m`;

      // Actual Clock Time of Day
      const clockHour = Math.floor((startHourOfDay + cumSeconds / 3600) % 24);
      const clockMin = Math.floor(((startHourOfDay + cumSeconds / 3600) * 60) % 60);
      const clockAmPm = clockHour >= 12 ? "PM" : "AM";
      const clockHour12 = clockHour % 12 === 0 ? 12 : clockHour % 12;
      const clockTimeStr = `${clockHour12.toString().padStart(2, "0")}:${clockMin.toString().padStart(2, "0")} ${clockAmPm}`;

      // Dynamic checkpoint COT based on Mountain Km-Effort Difficulty
      let cpCotHours = 0;
      const isFinish = idx === activeRace.checkpoints.length - 1 || cp.id === "finish";

      if (idx === 0) {
        cpCotHours = 0;
      } else if (isFinish) {
        cpCotHours = raceOfficialCotHours;
      } else if (cp.officialCotHours && cp.officialCotHours > 0 && activeRace.id !== "custom") {
        cpCotHours = cp.officialCotHours;
      } else {
        const totalGain = activeRace.elevationGainM || 1;
        const totalEffort = totalRaceDist + (totalGain / 100);
        const cpEffort = cp.distanceKm + (cumGainM / 100);
        const effortRatio = Math.min(1.0, Math.max(0, cpEffort / totalEffort));
        const timeRatio = Math.pow(effortRatio, 0.88);
        cpCotHours = Math.round(timeRatio * raceOfficialCotHours * 10) / 10;
      }

      const cotTotalMinutes = cpCotHours * 60;
      const bufferMinutes = Math.round(cotTotalMinutes - (cumSeconds / 60));

      const cotH = Math.floor(cpCotHours);
      const cotM = Math.round((cpCotHours - cotH) * 60);
      const officialCotTime =
        idx === 0
          ? "00j 00m"
          : isFinish
          ? `${cotH.toString().padStart(2, "0")}j ${cotM.toString().padStart(2, "0")}m (Resmi)`
          : `${cotH.toString().padStart(2, "0")}j ${cotM.toString().padStart(2, "0")}m`;

      let status: "safe" | "caution" | "danger" = "safe";
      if (bufferMinutes < 0) {
        status = "danger";
      } else if (bufferMinutes < 30) {
        status = "caution";
      }

      // Smart Tactical Advice based on Upcoming Terrain, Distance & Altitude
      let smartNotes = "";
      if (idx === 0) {
        const nextCp = activeRace.checkpoints[1];
        smartNotes = nextCp
          ? `Garis start. Jaga ritme awal tetap santai & konservatif menuju ${nextCp.name}.`
          : "Garis start lomba. Jaga ritme awal tetap santai dan stabil.";
      } else if (isFinish) {
        smartNotes = "Garis akhir finish! Selamat finish, segera lakukan rehidrasi elektrolit & nutrisi recovery.";
      } else {
        const nextCp = activeRace.checkpoints[idx + 1];
        const nextDist = nextCp ? Math.max(0.1, Math.round((nextCp.distanceKm - cp.distanceKm) * 10) / 10) : 0;

        let nextSegGain = 0;
        let nextSegLoss = 0;
        if (nextCp) {
          for (let j = 1; j < pts.length; j++) {
            if (pts[j].distanceKm >= cp.distanceKm && pts[j].distanceKm <= nextCp.distanceKm) {
              const diff = pts[j].elevationM - pts[j - 1].elevationM;
              if (diff > 0) nextSegGain += diff;
              else nextSegLoss += Math.abs(diff);
            }
          }
        }

        const adviceList: string[] = [];

        // 1. High altitude exposure
        if (cp.elevationM >= 2300) {
          adviceList.push("Punggungan dingin & angin kencang (kenakan windbreaker/buff)");
        }

        // 2. Night running condition
        if (isNight) {
          adviceList.push("Sesi malam (headlamp aktif & fokus navigasi)");
        }

        // 3. Upcoming Terrain profile to next aid station
        if (nextSegGain >= 500) {
          adviceList.push(
            `Tanjakan berat +${Math.round(nextSegGain)}m ke ${nextCp?.name || "pos berikut"}, isi air penuh & siapkan trekking pole`
          );
        } else if (nextSegLoss >= 500) {
          adviceList.push(
            `Turunan teknis -${Math.round(nextSegLoss)}m, kendalikan rem quad & waspada batuan licin`
          );
        } else if (nextDist >= 7.5) {
          adviceList.push(
            `Jarak panjang ${nextDist}km ke pos berikutnya, wajib isi botol air penuh & stok gel`
          );
        } else if (nextSegGain >= 200) {
          adviceList.push(`Tanjakan bertahap +${Math.round(nextSegGain)}m, atur cadence stabil`);
        } else {
          adviceList.push("Medan rolling, pertahankan tempo efisien & konsumsi nutrisi rutin");
        }

        smartNotes = adviceList.join(" • ");
      }

      return {
        ...cp,
        notes: smartNotes,
        rawDesc: cp.rawDesc || cp.notes,
        officialCotHours: cpCotHours,
        officialCotTime,
        predictedSeconds: Math.round(cumSeconds),
        predictedTimeStr,
        clockTimeStr,
        isNight,
        bufferMinutes,
        status,
        isFinish,
      };
    });

    // Feature C: Dynamic Aid Station Restock Calculations (Second Pass)
    return baseEvaluated.map((cp, idx) => {
      if (idx === baseEvaluated.length - 1 || cp.isFinish) {
        return {
          ...cp,
          waterRefillMl: 0,
          waterNeededMl: 0,
          waterExceedsCapacity: false,
          waterDeficitMl: 0,
          carbsTargetGrams: 0,
          gelsNeeded: 0,
          sodiumNeededMg: 0,
          saltCapsulesCount: 0,
          logisticsAdvice: "Garis Finish! Segera rehidrasi elektrolit, protein pemulihan (20-25g), dan makanan padat.",
          nextSegDurationFormatted: "-",
          nextSegDistanceKm: 0,
          nextSegGainM: 0,
        };
      }

      const nextCp = baseEvaluated[idx + 1];
      const nextDist = Math.max(0.1, Math.round((nextCp.distanceKm - cp.distanceKm) * 10) / 10);
      const nextSegSeconds = Math.max(60, nextCp.predictedSeconds - cp.predictedSeconds);

      let nextSegGain = 0;
      let nextSegLoss = 0;
      for (let j = 1; j < pts.length; j++) {
        if (pts[j].distanceKm >= cp.distanceKm && pts[j].distanceKm <= nextCp.distanceKm) {
          const diff = pts[j].elevationM - pts[j - 1].elevationM;
          if (diff > 0) nextSegGain += diff;
          else nextSegLoss += Math.abs(diff);
        }
      }

      const logistics = calculateSegmentLogistics({
        segmentDurationSeconds: nextSegSeconds,
        segmentDistanceKm: nextDist,
        segmentGainM: Math.round(nextSegGain),
        segmentLossM: Math.round(nextSegLoss),
        targetCarbsPerHourGrams: targetCarbsPerHour,
        targetWaterPerHourMl: targetWaterPerHourMl,
        flaskCapacityMl: flaskCapacityMl,
      });

      return {
        ...cp,
        waterRefillMl: logistics.recommendedWaterRefillMl,
        waterNeededMl: logistics.waterNeededMl,
        waterExceedsCapacity: logistics.waterExceedsCapacity,
        waterDeficitMl: logistics.waterDeficitMl,
        carbsTargetGrams: logistics.carbsNeededGrams,
        gelsNeeded: logistics.gelsNeeded,
        sodiumNeededMg: logistics.sodiumNeededMg,
        saltCapsulesCount: logistics.saltCapsulesCount,
        logisticsAdvice: logistics.tacticalLogisticsAdvice,
        nextSegDurationFormatted: logistics.durationFormatted,
        nextSegDistanceKm: nextDist,
        nextSegGainM: Math.round(nextSegGain),
      };
    });
  }, [
    activeRace,
    athleteVam,
    athleteFlatPaceSec,
    strategyTier,
    raceOfficialCotHours,
    startHourOfDay,
    fatigueDegradationPct,
    nightPenaltyPct,
    aidStationMinutes,
    targetCarbsPerHour,
    targetWaterPerHourMl,
    flaskCapacityMl,
  ]);

  // Overall finish prediction details
  const finishCheckpoint = evaluatedCheckpoints[evaluatedCheckpoints.length - 1];
  const finishSeconds = finishCheckpoint?.predictedSeconds || 0;
  const finishHours = Math.floor(finishSeconds / 3600);
  const finishMins = Math.floor((finishSeconds % 3600) / 60);
  const overallBufferMinutes = Math.round((raceOfficialCotHours * 60) - (finishSeconds / 60));

  const avgOverallSpeedKmh =
    activeRace && finishSeconds > 0 ? (activeRace.distanceKm / (finishSeconds / 3600)).toFixed(2) : "0.00";
  const avgOverallPaceSec =
    activeRace && activeRace.distanceKm > 0 ? Math.round(finishSeconds / activeRace.distanceKm) : 0;

  // Format Buffer Minutes into clean Indonesian text (+2j 30m Aman)
  const formatBufferText = (mins: number, compact: boolean = false) => {
    const absM = Math.abs(mins);
    const h = Math.floor(absM / 60);
    const m = absM % 60;
    if (mins >= 0) {
      if (compact) {
        return h > 0 ? `+${h}j ${m}m Aman` : `+${m}m Aman`;
      }
      return h > 0 ? `+${h}j ${m}m Aman dari COT (${raceOfficialCotHours}j)` : `+${m}m Aman dari COT`;
    }
    if (compact) {
      return h > 0 ? `-${h}j ${m}m Terkena COT` : `-${m}m Terkena COT`;
    }
    return h > 0 ? `-${h}j ${m}m Terkena COT (${raceOfficialCotHours}j)` : `-${m}m Terkena COT`;
  };

  // Feature C: Total Race Nutrition & Hydration Plan Summary
  const raceNutritionSummary = useMemo(() => {
    let totalCarbs = 0;
    let totalGels = 0;
    let totalWaterMl = 0;
    let totalSodiumMg = 0;
    let totalSaltCaps = 0;
    let highWaterAlertsCount = 0;

    evaluatedCheckpoints.forEach((cp, idx) => {
      if (idx < evaluatedCheckpoints.length - 1) {
        totalCarbs += cp.carbsTargetGrams || 0;
        totalGels += cp.gelsNeeded || 0;
        totalWaterMl += cp.waterNeededMl || 0;
        totalSodiumMg += cp.sodiumNeededMg || 0;
        totalSaltCaps += cp.saltCapsulesCount || 0;
        if (cp.waterExceedsCapacity) highWaterAlertsCount++;
      }
    });

    const totalWaterLiters = Math.round((totalWaterMl / 1000) * 10) / 10;
    const estTotalHours = Math.round((finishSeconds / 3600) * 10) / 10;

    return {
      totalCarbs,
      totalGels,
      totalWaterLiters,
      totalWaterMl,
      totalSodiumMg,
      totalSaltCaps,
      estTotalHours,
      highWaterAlertsCount,
    };
  }, [evaluatedCheckpoints, finishSeconds]);

  // 3-Category Gradient Distribution (Uphill, Flat, Downhill) - Like Plan Your Trail
  const gradientSummary = useMemo(() => {
    if (!activeRace?.elevationPoints || activeRace.elevationPoints.length < 2) {
      return {
        uphillPct: 0,
        uphillKm: "0.0",
        flatPct: 0,
        flatKm: "0.0",
        downhillPct: 0,
        downhillKm: "0.0",
      };
    }
    const pts = activeRace.elevationPoints;

    let uphillKm = 0;
    let flatKm = 0;
    let downhillKm = 0;
    let totalD = 0;

    for (let i = 1; i < pts.length; i++) {
      const segDist = pts[i].distanceKm - pts[i - 1].distanceKm;
      totalD += segDist;
      const g = pts[i].gradePct || 0;

      if (g > 3) uphillKm += segDist;
      else if (g < -3) downhillKm += segDist;
      else flatKm += segDist;
    }

    if (totalD === 0) totalD = 1;

    const uphillPct = Math.round((uphillKm / totalD) * 100);
    const flatPct = Math.round((flatKm / totalD) * 100);
    const downhillPct = Math.max(0, 100 - uphillPct - flatPct);

    return {
      uphillPct,
      uphillKm: uphillKm.toFixed(1),
      flatPct,
      flatKm: flatKm.toFixed(1),
      downhillPct,
      downhillKm: downhillKm.toFixed(1),
    };
  }, [activeRace]);

  // Segment Breakdown based on Checkpoints (Pos WS)
  const checkpointSegments = useMemo(() => {
    if (!activeRace) return [];
    const cps = evaluatedCheckpoints;
    const pts = activeRace.elevationPoints || [];
    if (!cps || cps.length < 2) return [];

    const segments = [];
    for (let i = 0; i < cps.length - 1; i++) {
      const from = cps[i];
      const to = cps[i + 1];
      const distKm = Math.max(0.1, Math.round((to.distanceKm - from.distanceKm) * 100) / 100);

      // Compute Gain and Loss between from and to
      let gainM = 0;
      let lossM = 0;
      for (let j = 1; j < pts.length; j++) {
        if (pts[j].distanceKm >= from.distanceKm && pts[j].distanceKm <= to.distanceKm) {
          const diff = pts[j].elevationM - pts[j - 1].elevationM;
          if (diff > 0) gainM += diff;
          else lossM += Math.abs(diff);
        }
      }

      const segSecs = Math.max(0, to.predictedSeconds - from.predictedSeconds);
      const segH = Math.floor(segSecs / 3600);
      const segM = Math.floor((segSecs % 3600) / 60);
      const durationStr = segH > 0 ? `${segH}j ${segM}m` : `${segM}m`;
      const segPaceSec = distKm > 0 ? Math.round(segSecs / distKm) : 0;
      const avgGradePct = distKm > 0 ? Math.round(((gainM - lossM) / (distKm * 1000)) * 1000) / 10 : 0;

      segments.push({
        id: `cp-seg-${i}`,
        title: `${from.name} - ${to.name}`,
        fromName: from.name,
        toName: to.name,
        startKm: from.distanceKm,
        endKm: to.distanceKm,
        distanceKm: distKm,
        gainM: Math.round(gainM),
        lossM: Math.round(lossM),
        avgGradePct,
        durationStr,
        paceStr: formatPace(segPaceSec),
        waterRefillMl: from.waterRefillMl,
        waterNeededMl: from.waterNeededMl,
        waterExceedsCapacity: from.waterExceedsCapacity,
        carbsTargetGrams: from.carbsTargetGrams,
        gelsNeeded: from.gelsNeeded,
        logisticsAdvice: from.logisticsAdvice,
        notes: to.notes,
      });
    }
    return segments;
  }, [evaluatedCheckpoints, activeRace]);

  // Segment Breakdown based on Terrain Gradient
  const gradientSegments = useMemo(() => {
    if (!activeRace?.elevationPoints || activeRace.elevationPoints.length < 2) return [];
    const pts = activeRace.elevationPoints;

    const classifyGrade = (g: number): "Climb" | "Uphill" | "Descent" | "Flat" => {
      if (g > 8) return "Climb";
      if (g > 2) return "Uphill";
      if (g < -2) return "Descent";
      return "Flat";
    };

    interface RawBlock {
      type: "Climb" | "Uphill" | "Descent" | "Flat";
      startIdx: number;
      endIdx: number;
      startKm: number;
      endKm: number;
      distKm: number;
    }

    const rawBlocks: RawBlock[] = [];
    let currentType = classifyGrade(pts[0].gradePct || 0);
    let startIdx = 0;

    for (let i = 1; i < pts.length; i++) {
      const type = classifyGrade(pts[i].gradePct || 0);
      if (type !== currentType) {
        const startKm = pts[startIdx].distanceKm;
        const endKm = pts[i - 1].distanceKm;
        rawBlocks.push({
          type: currentType,
          startIdx,
          endIdx: i - 1,
          startKm,
          endKm,
          distKm: endKm - startKm,
        });
        currentType = type;
        startIdx = i;
      }
    }

    const lastIdx = pts.length - 1;
    rawBlocks.push({
      type: currentType,
      startIdx,
      endIdx: lastIdx,
      startKm: pts[startIdx].distanceKm,
      endKm: pts[lastIdx].distanceKm,
      distKm: pts[lastIdx].distanceKm - pts[startIdx].distanceKm,
    });

    // Multi-pass smoothing to eliminate micro-fluctuations (< 1.2 km)
    let merged = [...rawBlocks];
    let changed = true;
    let passes = 0;

    while (changed && passes < 5) {
      changed = false;
      passes++;
      const nextMerged: RawBlock[] = [];

      for (let i = 0; i < merged.length; i++) {
        const curr = merged[i];
        if (curr.distKm < 1.2 && nextMerged.length > 0 && i < merged.length - 1) {
          const prev = nextMerged[nextMerged.length - 1];
          const next = merged[i + 1];

          const isPrevClimb = prev.type === "Climb" || prev.type === "Uphill";
          const isNextClimb = next.type === "Climb" || next.type === "Uphill";
          const isPrevDown = prev.type === "Descent";
          const isNextDown = next.type === "Descent";

          if (isPrevClimb && isNextClimb) {
            prev.endIdx = next.endIdx;
            prev.endKm = next.endKm;
            prev.distKm = prev.endKm - prev.startKm;
            i++;
            changed = true;
            continue;
          } else if (isPrevDown && isNextDown) {
            prev.endIdx = next.endIdx;
            prev.endKm = next.endKm;
            prev.distKm = prev.endKm - prev.startKm;
            i++;
            changed = true;
            continue;
          } else {
            prev.endIdx = curr.endIdx;
            prev.endKm = curr.endKm;
            prev.distKm = prev.endKm - prev.startKm;
            changed = true;
            continue;
          }
        } else if (nextMerged.length > 0 && nextMerged[nextMerged.length - 1].type === curr.type) {
          const prev = nextMerged[nextMerged.length - 1];
          prev.endIdx = curr.endIdx;
          prev.endKm = curr.endKm;
          prev.distKm = prev.endKm - prev.startKm;
          changed = true;
        } else {
          nextMerged.push({ ...curr });
        }
      }
      merged = nextMerged;
    }

    return merged.map((block, idx) => {
      let gainM = 0;
      let lossM = 0;
      for (let i = block.startIdx + 1; i <= block.endIdx; i++) {
        const diff = pts[i].elevationM - pts[i - 1].elevationM;
        if (diff > 0) gainM += diff;
        else lossM += Math.abs(diff);
      }

      const distKm = Math.max(0.1, Math.round((block.endKm - block.startKm) * 100) / 100);
      const startEle = pts[block.startIdx].elevationM;
      const endEle = pts[block.endIdx].elevationM;
      const avgGradePct = Math.round(((endEle - startEle) / (distKm * 1000)) * 1000) / 10;

      let finalType: "Climb" | "Uphill" | "Descent" | "Flat" = block.type;
      if (avgGradePct > 7) finalType = "Climb";
      else if (avgGradePct > 2) finalType = "Uphill";
      else if (avgGradePct < -2) finalType = "Descent";
      else finalType = "Flat";

      let estSecs = distKm * activeStrategyStats.flatPace * 1.25 * 0.55;
      if (gainM > 0) estSecs += (gainM / activeStrategyStats.vam) * 3600;
      if (lossM > 0) estSecs += (lossM / 1000) * 280;

      const h = Math.floor(estSecs / 3600);
      const m = Math.floor((estSecs % 3600) / 60);
      const durationStr = h > 0 ? `${h}j ${m}m` : `${m}m`;

      return {
        id: `grad-seg-${idx}`,
        type: finalType,
        rangeLabel: `KM ${block.startKm.toFixed(1)}–${block.endKm.toFixed(1)}`,
        startKm: block.startKm,
        endKm: block.endKm,
        distanceKm: distKm,
        gainM: Math.round(gainM),
        lossM: Math.round(lossM),
        avgGradePct,
        durationStr,
      };
    });
  }, [activeRace, activeStrategyStats]);

  // Haversine distance calculator
  const haversineDistKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Reusable GPX Parser for both uploaded files and 1-click Demo tracks
  const parseGpxTextToProfile = (text: string, defaultName: string): RaceProfile => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");

    const trkpts = xml.querySelectorAll("trkpt");
    if (!trkpts || trkpts.length < 2) {
      throw new Error("File GPX tidak valid: Kurang dari 2 titik koordinat track (<trkpt>).");
    }

    const rawPoints: { lat: number; lon: number; ele: number }[] = [];
    trkpts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute("lat") || "0");
      const lon = parseFloat(pt.getAttribute("lon") || "0");
      const eleNode = pt.querySelector("ele");
      const ele = eleNode ? parseFloat(eleNode.textContent || "0") : 1000;
      rawPoints.push({ lat, lon, ele });
    });

    // 1. Calculate cumulative distance & raw elevation
    const tempPoints: { lat: number; lon: number; ele: number; cumDist: number }[] = [];
    let cumD = 0;

    for (let i = 0; i < rawPoints.length; i++) {
      if (i > 0) {
        const d = haversineDistKm(
          rawPoints[i - 1].lat,
          rawPoints[i - 1].lon,
          rawPoints[i].lat,
          rawPoints[i].lon
        );
        cumD += d;
      }
      tempPoints.push({
        lat: rawPoints[i].lat,
        lon: rawPoints[i].lon,
        ele: rawPoints[i].ele,
        cumDist: cumD,
      });
    }

    // 2. Rolling Window Smoothing (~80 meters) to calculate realistic slope gradient without GPS jitter
    const WINDOW_KM = 0.08; // 80 meters
    const elevationPoints: ElevationPoint[] = [];

    for (let i = 0; i < tempPoints.length; i++) {
      const curr = tempPoints[i];

      let k = i;
      while (k > 0 && curr.cumDist - tempPoints[k].cumDist < WINDOW_KM / 2) {
        k--;
      }

      let j = i;
      while (j < tempPoints.length - 1 && tempPoints[j].cumDist - curr.cumDist < WINDOW_KM / 2) {
        j++;
      }

      const windowDistM = (tempPoints[j].cumDist - tempPoints[k].cumDist) * 1000;
      const windowEleDiff = tempPoints[j].ele - tempPoints[k].ele;
      const gradePct = windowDistM > 5 ? (windowEleDiff / windowDistM) * 100 : 0;

      elevationPoints.push({
        distanceKm: Math.round(curr.cumDist * 100) / 100,
        elevationM: Math.round(curr.ele),
        lat: curr.lat,
        lon: curr.lon,
        gradePct: Math.round(gradePct * 10) / 10,
      });
    }

    // 3. ITRA Standard Hysteresis Elevation Filter (3.0m threshold)
    let totalGain = 0;
    let totalLoss = 0;
    const ELE_THRESHOLD = 3.0; // 3 meters
    let anchorEle = elevationPoints[0]?.elevationM || 0;

    for (let i = 1; i < elevationPoints.length; i++) {
      const diff = elevationPoints[i].elevationM - anchorEle;
      if (Math.abs(diff) >= ELE_THRESHOLD) {
        if (diff > 0) totalGain += diff;
        else totalLoss += Math.abs(diff);
        anchorEle = elevationPoints[i].elevationM;
      }
    }

    const totalDistKm = Math.round(cumD * 10) / 10;
    const totalGainM = Math.round(totalGain);
    const totalLossM = Math.round(totalLoss);

    // Scan GPX XML Text for explicit COT (Regex Scanner)
    let detectedCotHours = 20.0;
    const cotRegex = /(?:cot|cut[\s_-]?off|limit)[\s:]*([0-9]{1,2}(?::[0-9]{2})?|\d+\s*(?:jam|hours|h|j))/i;
    const sampleXml = text.slice(0, 15000);
    const cotMatch = sampleXml.match(cotRegex);

    if (cotMatch && cotMatch[1]) {
      const raw = cotMatch[1].replace(/jam|hours|h|j/i, "").trim();
      if (raw.includes(":")) {
        const [h, m] = raw.split(":");
        detectedCotHours = parseInt(h, 10) + parseInt(m, 10) / 60;
      } else {
        detectedCotHours = parseFloat(raw);
      }
    } else {
      if (totalDistKm >= 50) {
        detectedCotHours = 20.0;
      } else if (totalDistKm >= 90) {
        detectedCotHours = 36.0;
      } else if (totalDistKm >= 40) {
        detectedCotHours = 16.0;
      } else if (totalDistKm >= 30) {
        detectedCotHours = 15.0;
      } else {
        detectedCotHours = 12.0;
      }
    }

    setRaceOfficialCotHours(detectedCotHours);

    // Extract Checkpoints from Waypoints (<wpt>)
    const wpts = xml.querySelectorAll("wpt");
    const parsedCheckpoints: Checkpoint[] = [];

    if (wpts && wpts.length > 0) {
      wpts.forEach((wpt, idx) => {
        const lat = parseFloat(wpt.getAttribute("lat") || "0");
        const lon = parseFloat(wpt.getAttribute("lon") || "0");
        const name =
          wpt.querySelector("name")?.textContent?.trim() ||
          wpt.querySelector("desc")?.textContent?.trim() ||
          `Pos ${idx + 1}`;
        const eleNode = wpt.querySelector("ele");
        const ele = eleNode ? parseFloat(eleNode.textContent || "0") : 0;

        let minDist = Infinity;
        let matchDistKm = 0;
        let matchEle = ele;

        for (const pt of elevationPoints) {
          const d = haversineDistKm(lat, lon, pt.lat, pt.lon);
          if (d < minDist) {
            minDist = d;
            matchDistKm = pt.distanceKm;
            if (ele === 0) matchEle = pt.elevationM;
          }
        }

        parsedCheckpoints.push({
          id: `wpt-${idx}`,
          name,
          distanceKm: Math.round(matchDistKm * 10) / 10,
          elevationM: Math.round(matchEle),
          officialCotTime: "--",
          officialCotHours: 0,
          notes: wpt.querySelector("desc")?.textContent?.trim() || "Pos resmi lintasan GPX",
          rawDesc: wpt.querySelector("desc")?.textContent?.trim() || "",
          waterRefillMl: 750,
          carbsTargetGrams: 50,
        });
      });

      parsedCheckpoints.sort((a, b) => a.distanceKm - b.distanceKm);

      if (parsedCheckpoints[0].distanceKm > 1.0) {
        parsedCheckpoints.unshift({
          id: "start",
          name: "Start Point",
          distanceKm: 0,
          elevationM: elevationPoints[0].elevationM,
          officialCotTime: "00:00:00",
          officialCotHours: 0,
          notes: "Garis start lomba.",
          waterRefillMl: 0,
          carbsTargetGrams: 0,
        });
      }

      const lastCp = parsedCheckpoints[parsedCheckpoints.length - 1];
      if (totalDistKm - lastCp.distanceKm > 1.5) {
        parsedCheckpoints.push({
          id: "finish",
          name: "Finish Line",
          distanceKm: totalDistKm,
          elevationM: elevationPoints[elevationPoints.length - 1].elevationM,
          officialCotTime: `${detectedCotHours}j 00m`,
          officialCotHours: detectedCotHours,
          notes: "Garis akhir finish!",
          waterRefillMl: 0,
          carbsTargetGrams: 0,
        });
      }
    } else {
      const numCheckpoints = Math.max(3, Math.min(8, Math.round(totalDistKm / 9)));
      const stepDist = totalDistKm / numCheckpoints;

      for (let i = 0; i <= numCheckpoints; i++) {
        const targetD = i * stepDist;
        const closestPt = elevationPoints.reduce((prev, curr) =>
          Math.abs(curr.distanceKm - targetD) < Math.abs(prev.distanceKm - targetD) ? curr : prev
        );

        parsedCheckpoints.push({
          id: `cp-${i}`,
          name:
            i === 0
              ? "Start Point"
              : i === numCheckpoints
              ? "Finish Line"
              : `WS ${i} (Pos Air)`,
          distanceKm: Math.round(closestPt.distanceKm * 10) / 10,
          elevationM: closestPt.elevationM,
          officialCotTime: "--",
          officialCotHours: 0,
          notes: i === 0 ? "Titik awal mulai." : i === numCheckpoints ? "Garis akhir finish!" : "Pos pengisian air & nutrisi.",
          waterRefillMl: i === 0 || i === numCheckpoints ? 0 : 750,
          carbsTargetGrams: i === 0 || i === numCheckpoints ? 0 : 45,
        });
      }
    }

    const isRinjani = defaultName.toLowerCase().includes("rinjani");
    return {
      id: isRinjani ? "rinjani-60k" : "custom",
      name: defaultName.toUpperCase(),
      location: isRinjani ? "Gunung Rinjani, Lombok NTB" : "Uploaded GPX Course",
      distanceKm: totalDistKm,
      elevationGainM: totalGainM,
      elevationLossM: totalLossM,
      overallCotHours: detectedCotHours,
      description: `Rute GPX berhasil dimuat: ${rawPoints.length.toLocaleString()} titik GPS, ${parsedCheckpoints.length} pos terdeteksi, elevasi +${totalGainM.toLocaleString()}m D+.`,
      elevationPoints,
      checkpoints: parsedCheckpoints,
    };
  };

  // Load 1-Click Demo Track (Rinjani 100 — 60K)
  const loadDemoGpx = async () => {
    try {
      setIsUploading(true);
      setUploadError(null);
      const res = await fetch("/demo/rinjani-100-60k.gpx");
      if (!res.ok) {
        throw new Error("Gagal mengambil file GPX demo dari server.");
      }
      const text = await res.text();
      const profile = parseGpxTextToProfile(text, "Rinjani 100 — 60K Ultra");
      setCustomRace(profile);
    } catch (err: any) {
      setUploadError(err.message || "Gagal memuat rute demo.");
    } finally {
      setIsUploading(false);
    }
  };

  // Robust GPX XML File Parser with Smoothing, Waypoints (<wpt>), & Regex COT Scanner
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const raceName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        const profile = parseGpxTextToProfile(text, raceName);
        setCustomRace(profile);
      } catch (err: any) {
        setUploadError(err.message || "Gagal memproses file GPX.");
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-zinc-950 antialiased">
      {/* Universal Global Navigation Shell */}
      <Header
        extraActions={
          <div className="flex items-center gap-1.5">
            {activeRace && (
              <button
                onClick={() => {
                  if (window.confirm("Ganti rute GPX saat ini?")) {
                    setCustomRace(null);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg bg-white border-2 border-zinc-950 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b] hover:bg-zinc-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                title="Ganti atau Hapus Rute GPX"
              >
                <Upload className="h-3.5 w-3.5 text-zinc-950" />
                <span className="hidden md:inline">Ganti Rute</span>
              </button>
            )}

            {activeRace && activeRace.id !== "rinjani-60k" && (
              <button
                onClick={loadDemoGpx}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b] hover:bg-[#F3F0E6] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
                title="Muat Rute Demo Rinjani 100 60K"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="hidden lg:inline">Demo Rinjani 60K</span>
              </button>
            )}

            {activeRace && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg bg-amber-400 border-2 border-zinc-950 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b] hover:bg-amber-300 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                title="Print Wristband Pace Card"
              >
                <Printer className="h-3.5 w-3.5 text-zinc-950" />
                <span className="hidden sm:inline">Cetak Cheat-Sheet</span>
              </button>
            )}
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Context Page Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-zinc-950">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2.5">
              <span>GPX Course & Cut-Off Time (COT) Simulator</span>
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                PRO TRAIL 360
              </span>
            </h1>
            <p className="text-xs text-zinc-600 mt-1 font-medium">
              Peta spasial topografi interaktif, spektrum gradien lintasan, deteksi tanjakan HC, dan simulasi strategi tiba pos WS.
            </p>
          </div>
        </div>

        {!activeRace || !trackStats ? (
          <div className="space-y-8 py-6">
            {/* Main Upload Dropzone Hero */}
            <div className="p-8 sm:p-12 rounded-2xl bg-white border-4 border-dashed border-zinc-950 shadow-[6px_6px_0px_0px_#09090b] text-center space-y-6 max-w-3xl mx-auto">
              <div className="mx-auto h-20 w-20 rounded-2xl bg-[#FAF9F5] border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[4px_4px_0px_0px_#09090b]">
                <Mountain className="h-10 w-10" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                  Unggah File GPX Rute Lomba Anda
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed">
                  Aplikasi ini menganalisis file rute trail running (<code className="text-zinc-950 font-black font-mono bg-zinc-100 px-1 py-0.5 rounded border border-zinc-300">.gpx</code>) secara instan dan lokal di browser Anda. Unggah rute lomba Anda atau coba langsung menggunakan data rute resmi ultra marathon demo.
                </p>
              </div>

              {/* Action Buttons: Primary Upload + 1-Click Demo */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <label className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-black cursor-pointer border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all">
                  <Upload className="h-4 w-4" />
                  <span>{isUploading ? "Memproses File GPX..." : "Pilih File .GPX Rute Anda"}</span>
                  <input
                    type="file"
                    accept=".gpx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={loadDemoGpx}
                  disabled={isUploading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 text-sm font-black border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Coba Demo: Rinjani 100 — 60K</span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-600 font-mono font-medium">
                <span>Mendukung koordinat GPS resmi (<code className="text-zinc-900 font-bold">&lt;trkpt&gt;</code>) dan pos Water Station (<code className="text-zinc-900 font-bold">&lt;wpt&gt;</code>)</span>
              </div>

              {uploadError && (
                <div className="p-4 rounded-xl bg-red-100 border-2 border-red-500 text-red-950 text-xs flex items-center justify-center gap-2 max-w-md mx-auto font-bold shadow-[2px_2px_0px_0px_#ef4444]">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-2">
                <div className="h-9 w-9 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <Compass className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-zinc-950">Peta Topografi &amp; Radar Interaktif</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Peta spasial OpenTopoMap &amp; Satelit yang sinkron secara dua arah dengan cross-section elevasi. Arahkan kursor di grafik untuk melacak posisi di peta.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-2">
                <div className="h-9 w-9 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-zinc-950">Spektrum Gradien 7 Kategori</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Deteksi otomatis persentase rute datar, tanjakan landai, power hike, hingga tanjakan dinding ekstrem &gt;25% dengan pewarnaan standar industri.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-2">
                <div className="h-9 w-9 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-zinc-950">Simulasi COT &amp; Fisiologi Gunung</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Perhitungan waktu tiba pos WS berbasis VAM atlet, penalti lari malam, kelelahan paruh kedua, dan waktu istirahat di pos aid station.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Active GPX Course Info & Action Bar */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-400 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[2px_2px_0px_0px_#09090b]">
                  <Mountain className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-zinc-950 tracking-tight">
                      {activeRace.name}
                    </h2>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-[#FAF9F5] text-zinc-950 border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                      GPX Aktif
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 flex flex-wrap items-center gap-2 mt-0.5 font-mono font-bold">
                    <span>{trackStats.distanceKm} km</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-black">+{trackStats.gainM}m D+</span>
                    <span>•</span>
                    <span className="text-rose-700 font-black">-{trackStats.lossM}m D-</span>
                    <span>•</span>
                    <span>{activeRace.checkpoints.length} Pos/WS</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-start md:self-auto">
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border-2 border-zinc-950 hover:bg-zinc-100 text-zinc-950 text-xs font-black cursor-pointer shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all">
                  <Upload className="h-3.5 w-3.5 text-zinc-950" />
                  <span>{isUploading ? "Memproses..." : "Ganti File GPX"}</span>
                  <input
                    type="file"
                    accept=".gpx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => setCustomRace(null)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 hover:bg-rose-50 text-rose-700 text-xs font-black shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                  title="Tutup rute GPX ini dan kembali ke menu upload"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Tutup Rute</span>
                </button>
              </div>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-red-100 border-2 border-red-500 text-red-950 text-xs flex items-center gap-2 font-bold shadow-[2px_2px_0px_0px_#ef4444]">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{uploadError}</span>
              </div>
            )}

        {/* Track Overview & In-Depth Analytics Stats Card */}
        <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-zinc-950 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-zinc-950 tracking-tight">
                  Track Overview & Altimetry Stats ({activeRace.name})
                </h3>
                <p className="text-[11px] text-zinc-600 font-medium">
                  Karakteristik medan, elevasi vertikal, densitas tanjakan, dan beban fisiologis ITRA
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase border-2 border-zinc-950 bg-amber-400 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b] flex items-center gap-1">
                <Award className="h-3 w-3" />
                <span>{trackStats.itraPoints} ITRA Points</span>
              </span>

              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase border-2 border-zinc-950 bg-sky-300 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b] flex items-center gap-1">
                <Mountain className="h-3 w-3" />
                <span>Mountain Level {trackStats.itraMountainLevel}/12</span>
              </span>

              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] ${trackStats.difficultyColor}`}>
                {trackStats.difficultyTier}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs font-mono">
            {/* Distance */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] text-zinc-600 font-sans font-bold block">Jarak (Distance)</span>
              <div className="text-lg font-black text-zinc-950">{trackStats.distanceKm} <span className="text-xs text-zinc-600 font-normal">km</span></div>
              <p className="text-[10px] text-zinc-500 font-sans">Panjang rute GPX</p>
            </div>

            {/* D+ Gain */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] text-emerald-700 font-sans font-bold flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                Elevasi Gain (D+)
              </span>
              <div className="text-lg font-black text-emerald-700">+{trackStats.gainM} <span className="text-xs text-zinc-600 font-normal">m</span></div>
              <p className="text-[10px] text-zinc-500 font-sans">Total tanjakan</p>
            </div>

            {/* D- Loss */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] text-rose-700 font-sans font-bold flex items-center gap-1">
                <ArrowDownRight className="h-3 w-3" />
                Elevasi Loss (D-)
              </span>
              <div className="text-lg font-black text-rose-700">-{trackStats.lossM} <span className="text-xs text-zinc-600 font-normal">m</span></div>
              <p className="text-[10px] text-zinc-500 font-sans">Ujian otot quad</p>
            </div>

            {/* Peaks (High & Low) */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] text-zinc-600 font-sans font-bold block">Peak & Valley</span>
              <div className="text-sm font-black text-zinc-950">
                ▲ {trackStats.highestM}m
              </div>
              <div className="text-xs text-zinc-500 font-bold">
                ▼ {trackStats.lowestM} mdpl
              </div>
            </div>

            {/* Climb Density */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] text-amber-800 font-sans font-bold block">Climb Density</span>
              <div className="text-lg font-black text-amber-700">{trackStats.densityRatio} <span className="text-xs text-zinc-600 font-normal">m/km</span></div>
              <p className="text-[10px] text-zinc-500 font-sans">&gt;80 = Skyrunning</p>
            </div>

            {/* ITRA Km-Effort */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] text-purple-800 font-sans font-bold block">ITRA Km-Effort</span>
              <div className="text-lg font-black text-purple-700">{trackStats.kmEffort} <span className="text-xs text-zinc-600 font-normal">km-eff</span></div>
              <p className="text-[10px] text-zinc-500 font-sans">Jarak + D+/100</p>
            </div>

            {/* ITRA Points */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] text-amber-800 font-sans font-bold flex items-center gap-1">
                <Award className="h-3 w-3" />
                ITRA Points
              </span>
              <div className="text-lg font-black text-amber-700">{trackStats.itraPoints} <span className="text-xs text-zinc-600 font-normal">Pts</span></div>
              <p className="text-[10px] text-zinc-500 font-sans">Skala 0–6 Finisher</p>
            </div>

            {/* Mountain Level */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] text-sky-800 font-sans font-bold flex items-center gap-1">
                <Mountain className="h-3 w-3" />
                Mountain Level
              </span>
              <div className="text-lg font-black text-sky-700">{trackStats.itraMountainLevel} <span className="text-xs text-zinc-600 font-normal">/12</span></div>
              <p className="text-[10px] text-zinc-500 font-sans">{trackStats.itraMountainLevel >= 11 ? "Ekstrem Alpin" : trackStats.itraMountainLevel >= 8 ? "Sangat Terjal" : "Trail Sedang"}</p>
            </div>
          </div>
        </div>

        {/* Feature 1: Interactive Geospatial Topographic Map */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black text-zinc-950">
              <Compass className="h-4 w-4 text-zinc-950" />
              <span>Peta Spasial Rute & Pos Water Station (OpenTopoMap & Satelit)</span>
            </div>
            <span className="text-[11px] text-zinc-600 font-mono font-bold hidden sm:inline">
              Gerakkan kursor di grafik elevasi untuk menggerakkan radar beacon di peta 📍
            </span>
          </div>

          <TrailMap
            points={activeRace.elevationPoints}
            checkpoints={evaluatedCheckpoints}
            hoverDistanceKm={hoverDistanceKm}
            onHoverDistanceChange={setHoverDistanceKm}
            raceName={activeRace.name}
          />
        </div>

        {/* Feature 2 & 3: Multi-Colored Elevation Profile Cross-Section & Gradient Strip */}
        <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-zinc-950 pb-3">
            <div>
              <h3 className="text-sm font-black text-zinc-950 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-zinc-950" />
                <span>Profil Ketinggian Jalur Berwarna (Multi-Colored Elevation Cross-Section)</span>
              </h3>
              <p className="text-[11px] text-zinc-600 font-medium">
                Warna grafik merefleksikan tingkat kecuraman lereng gunung secara real-time (Merah = Tanjakan Ekstrem, Oranye = Power Hike, Hijau = Datar)
              </p>
            </div>

            {hoverDistanceKm !== null && (
              <div className="px-3 py-1 rounded-lg bg-amber-400 border-2 border-zinc-950 text-zinc-950 text-xs font-mono font-black shadow-[2px_2px_0px_0px_#09090b]">
                KM {hoverDistanceKm.toFixed(1)}
              </div>
            )}
          </div>

          {/* Elevation Area Chart with 100% Reliable Multi-Event Mouse Tracking */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartPoints}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onMouseMove={(state: any) => {
                  if (state) {
                    let dist: number | null = null;
                    if (state.activeTooltipIndex !== undefined && chartPoints[state.activeTooltipIndex]) {
                      dist = chartPoints[state.activeTooltipIndex].distanceKm;
                    } else if (state.activePayload && state.activePayload[0]?.payload?.distanceKm !== undefined) {
                      dist = state.activePayload[0].payload.distanceKm;
                    } else if (state.activeLabel !== undefined) {
                      const parsed = parseFloat(state.activeLabel);
                      if (!isNaN(parsed)) dist = parsed;
                    }
                    if (dist !== null) {
                      setHoverDistanceKm(dist);
                    }
                  }
                }}
                onMouseLeave={() => setHoverDistanceKm(null)}
              >
                <defs>
                  <linearGradient id="elevationSlopeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    {elevationGradientStops.map((stop, idx) => (
                      <stop key={idx} offset={`${stop.offset}%`} stopColor={stop.color} />
                    ))}
                  </linearGradient>
                  <linearGradient id="elevationSlopeArea" x1="0%" y1="0%" x2="100%" y2="0%">
                    {elevationGradientStops.map((stop, idx) => (
                      <stop key={idx} offset={`${stop.offset}%`} stopColor={stop.color} stopOpacity={0.45} />
                    ))}
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="distanceKm"
                  stroke="#18181b"
                  tick={{ fontSize: 10, fill: "#18181b", fontWeight: 700 }}
                  unit=" km"
                />
                <YAxis
                  stroke="#18181b"
                  tick={{ fontSize: 10, fill: "#18181b", fontWeight: 700 }}
                  unit="m"
                  domain={["dataMin - 100", "dataMax + 100"]}
                />
                <Tooltip
                  wrapperStyle={{ zIndex: 9999 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as ElevationPoint;
                      const gradeColor = getGradeColor(d.gradePct);
                      const gradeLabel =
                        d.gradePct === undefined
                          ? "0%"
                          : d.gradePct > 25
                          ? `${d.gradePct}% (Tanjakan Ekstrem)`
                          : d.gradePct > 15
                          ? `${d.gradePct}% (Power Hike)`
                          : d.gradePct > 8
                          ? `${d.gradePct}% (Nanjak Sedang)`
                          : d.gradePct > 3
                          ? `${d.gradePct}% (Nanjak Landai)`
                          : d.gradePct < -15
                          ? `${d.gradePct}% (Turunan Curam)`
                          : d.gradePct < -3
                          ? `${d.gradePct}% (Turunan Sedang)`
                          : `${d.gradePct}% (Datar)`;

                      return (
                        <div className="p-3 rounded-xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] text-xs font-mono space-y-1 text-zinc-950">
                          <div className="font-black text-zinc-950">Jarak: {d.distanceKm} km</div>
                          <div className="text-amber-600 font-black">Ketinggian: {d.elevationM} mdpl</div>
                          <div className="text-[11px] font-bold">
                            Kemiringan: <strong style={{ color: gradeColor }}>{gradeLabel}</strong>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="elevationM"
                  stroke="url(#elevationSlopeGrad)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#elevationSlopeArea)"
                  isAnimationActive={false}
                />
                {hoverDistanceKm !== null && (
                  <ReferenceLine x={hoverDistanceKm} stroke="#18181b" strokeWidth={2} strokeDasharray="3 3" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Synchronized Terrain Gradient Timeline Strip (7 Exact Categories) */}
          <div className="space-y-1.5 pt-2 border-t-2 border-zinc-950">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-zinc-950">Pita Kontur Kemiringan Jalur (Terrain Gradient Timeline)</span>
              <span className="text-[11px] text-zinc-600 font-mono font-bold">{activeRace.distanceKm} km total</span>
            </div>

            <div className="h-4 w-full bg-zinc-200 border-2 border-zinc-950 rounded-lg overflow-hidden flex">
              <div style={{ width: `${gradientBreakdown.flat}%` }} className="bg-emerald-500 h-full" title={`Datar: ${gradientBreakdown.flat}%`} />
              <div style={{ width: `${gradientBreakdown.gentleUp}%` }} className="bg-lime-400 h-full" title={`Nanjak Landai: ${gradientBreakdown.gentleUp}%`} />
              <div style={{ width: `${gradientBreakdown.moderateUp}%` }} className="bg-yellow-500 h-full" title={`Nanjak Sedang: ${gradientBreakdown.moderateUp}%`} />
              <div style={{ width: `${gradientBreakdown.steepUp}%` }} className="bg-orange-500 h-full" title={`Power Hike: ${gradientBreakdown.steepUp}%`} />
              <div style={{ width: `${gradientBreakdown.extremeUp}%` }} className="bg-red-500 h-full" title={`Tanjakan Ekstrem: ${gradientBreakdown.extremeUp}%`} />
              <div style={{ width: `${gradientBreakdown.descentMod}%` }} className="bg-sky-400 h-full" title={`Turunan: ${gradientBreakdown.descentMod}%`} />
              <div style={{ width: `${gradientBreakdown.descentTech}%` }} className="bg-purple-500 h-full" title={`Turunan Curam: ${gradientBreakdown.descentTech}%`} />
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] font-mono font-bold text-zinc-800 pt-1 gap-2">
              <span className="text-emerald-700">🟢 Datar (-3 s/d +3%): {gradientBreakdown.flat}%</span>
              <span className="text-lime-700">🌱 Nanjak Landai (3-8%): {gradientBreakdown.gentleUp}%</span>
              <span className="text-yellow-700">🟡 Nanjak Sedang (8-15%): {gradientBreakdown.moderateUp}%</span>
              <span className="text-orange-700">🟠 Power Hike (15-25%): {gradientBreakdown.steepUp}%</span>
              <span className="text-red-700">🔴 Tanjakan Ekstrem (&gt;25%): {gradientBreakdown.extremeUp}%</span>
              <span className="text-sky-700">🔵 Turunan (-3 s/d -15%): {gradientBreakdown.descentMod}%</span>
              <span className="text-purple-700">🟣 Turunan Curam (&lt;-15%): {gradientBreakdown.descentTech}%</span>
            </div>
          </div>
        </div>

        {/* Feature: Segment Breakdown & Gradient Distribution (Plan Your Trail Style) */}
        <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-5">
          {/* Header with Title and Tab Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-950 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Split className="h-4 w-4 text-zinc-950" />
                <h3 className="text-sm font-black text-zinc-950 tracking-tight">
                  Segment Breakdown
                </h3>
              </div>
              <p className="text-xs text-zinc-600 font-mono font-bold pt-0.5">
                {segmentTab === "checkpoint" ? checkpointSegments.length : gradientSegments.length} segments &bull; Based on {segmentTab === "checkpoint" ? "checkpoint" : "gradient"}
              </p>
            </div>

            {/* Segment Tab Toggle Buttons */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border-2 border-zinc-950 text-xs">
              <button
                onClick={() => setSegmentTab("checkpoint")}
                className={`px-4 py-1.5 rounded-lg font-black transition-all ${
                  segmentTab === "checkpoint"
                    ? "bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                    : "text-zinc-600 hover:text-zinc-950 font-bold"
                }`}
              >
                Checkpoint
              </button>
              <button
                onClick={() => setSegmentTab("gradient")}
                className={`px-4 py-1.5 rounded-lg font-black transition-all ${
                  segmentTab === "gradient"
                    ? "bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                    : "text-zinc-600 hover:text-zinc-950 font-bold"
                }`}
              >
                Gradient
              </button>
            </div>
          </div>

          {/* Tab 1: Checkpoint Segments */}
          {segmentTab === "checkpoint" && (
            <div className="divide-y-2 divide-zinc-950 rounded-xl border-2 border-zinc-950 overflow-hidden bg-white shadow-[2px_2px_0px_0px_#09090b]">
              {checkpointSegments.map((seg) => {
                const isExpanded = expandedSegmentId === seg.id;
                return (
                  <div
                    key={seg.id}
                    onMouseEnter={() => setHoverDistanceKm(seg.startKm)}
                    onMouseLeave={() => setHoverDistanceKm(null)}
                    className="hover:bg-[#FAF9F5] transition-colors"
                  >
                    <div
                      onClick={() => setExpandedSegmentId(isExpanded ? null : seg.id)}
                      className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-zinc-950 tracking-tight">
                          {seg.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#FAF9F5] border border-zinc-950 text-zinc-950">
                          {seg.distanceKm.toFixed(2)} km
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-zinc-600 text-xs font-mono font-bold">
                        <span className="hidden sm:inline text-zinc-950 font-black">{seg.durationStr}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-zinc-950" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-zinc-950" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Segment Details */}
                    {isExpanded && (
                      <div className="px-4 pb-3.5 pt-2 text-xs font-mono border-t-2 border-zinc-950 bg-[#FAF9F5]">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                          <div className="p-2.5 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                            <span className="text-[10px] text-zinc-600 font-sans font-bold block">Elevasi (Gain / Loss)</span>
                            <span className="text-emerald-700 font-black">+{seg.gainM}m</span> /{" "}
                            <span className="text-rose-700 font-black">-{seg.lossM}m</span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                            <span className="text-[10px] text-zinc-600 font-sans font-bold block">Rata-rata Kemiringan</span>
                            <span className="text-amber-700 font-black">{seg.avgGradePct}%</span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                            <span className="text-[10px] text-zinc-600 font-sans font-bold block">Estimasi Waktu & Pace</span>
                            <span className="text-zinc-950 font-black">{seg.durationStr}</span>{" "}
                            <span className="text-[10px] text-zinc-600 font-bold">({seg.paceStr}/km)</span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                            <span className="text-[10px] text-zinc-600 font-sans font-bold block">Target Logistik Segmen</span>
                            {seg.waterRefillMl > 0 || seg.carbsTargetGrams > 0 ? (
                              <div className="space-y-0.5">
                                <span className="text-zinc-950 font-black text-xs block">
                                  💧 {seg.waterRefillMl}ml • ⚡ {seg.carbsTargetGrams}g ({seg.gelsNeeded || Math.ceil(seg.carbsTargetGrams / 25)} gel)
                                </span>
                                {seg.waterExceedsCapacity && (
                                  <span className="text-[9px] font-black text-rose-700 block">
                                    ⚠️ Butuh {seg.waterNeededMl}ml (&gt;{flaskCapacityMl}ml)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400 font-bold">-</span>
                            )}
                          </div>
                        </div>

                        {seg.notes && (
                          <p className="mt-2.5 text-[11px] text-zinc-600 font-sans font-medium italic">
                            Catatan: {seg.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Gradient Segments */}
          {segmentTab === "gradient" && (
            <div className="divide-y-2 divide-zinc-950 rounded-xl border-2 border-zinc-950 overflow-hidden bg-white shadow-[2px_2px_0px_0px_#09090b]">
              {gradientSegments.map((seg) => {
                const isExpanded = expandedSegmentId === seg.id;
                const badgeStyle =
                  seg.type === "Climb"
                    ? "bg-rose-300 text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                    : seg.type === "Uphill"
                    ? "bg-orange-300 text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                    : seg.type === "Descent"
                    ? "bg-sky-300 text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                    : "bg-amber-300 text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]";

                return (
                  <div
                    key={seg.id}
                    onMouseEnter={() => setHoverDistanceKm(seg.startKm)}
                    onMouseLeave={() => setHoverDistanceKm(null)}
                    className="hover:bg-[#FAF9F5] transition-colors"
                  >
                    <div
                      onClick={() => setExpandedSegmentId(isExpanded ? null : seg.id)}
                      className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${badgeStyle}`}>
                          {seg.type}
                        </span>
                        <span className="text-xs font-mono font-bold text-zinc-950">
                          {seg.rangeLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-zinc-600 text-xs font-mono font-bold">
                        <span className="text-zinc-950 font-black">{seg.distanceKm.toFixed(2)} km</span>
                        <span className="hidden sm:inline text-zinc-700 font-bold">~{seg.durationStr}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-zinc-950" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-zinc-950" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Gradient Segment Details */}
                    {isExpanded && (
                      <div className="px-4 pb-3.5 pt-2 text-xs font-mono border-t-2 border-zinc-950 bg-[#FAF9F5]">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                          <div className="p-2.5 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                            <span className="text-[10px] text-zinc-600 font-sans font-bold block">Total Elevasi</span>
                            <span className="text-emerald-700 font-black">+{seg.gainM}m</span> /{" "}
                            <span className="text-rose-700 font-black">-{seg.lossM}m</span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                            <span className="text-[10px] text-zinc-600 font-sans font-bold block">Rata-rata Kemiringan</span>
                            <span className="text-amber-700 font-black">{seg.avgGradePct}%</span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                            <span className="text-[10px] text-zinc-600 font-sans font-bold block">Estimasi Durasi</span>
                            <span className="text-zinc-950 font-black">~{seg.durationStr}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Gradient Distribution Summary Card (Matching Plan Your Trail) */}
          <div className="pt-4 border-t-2 border-zinc-950 space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-zinc-950" />
                <h4 className="text-xs font-black text-zinc-950 tracking-tight">
                  Gradient Distribution
                </h4>
              </div>
              <p className="text-[11px] text-zinc-600 pt-0.5 font-medium">
                Terrain breakdown calculated from GPX track points
              </p>
            </div>

            {/* 3-Color Horizontal Gradient Bar */}
            <div className="h-4 w-full bg-zinc-200 border-2 border-zinc-950 rounded-lg overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${gradientSummary.uphillPct}%` }}
                className="bg-rose-500 h-full transition-all"
                title={`Uphill: ${gradientSummary.uphillPct}%`}
              />
              <div
                style={{ width: `${gradientSummary.flatPct}%` }}
                className="bg-amber-400 h-full transition-all"
                title={`Flat: ${gradientSummary.flatPct}%`}
              />
              <div
                style={{ width: `${gradientSummary.downhillPct}%` }}
                className="bg-sky-500 h-full transition-all"
                title={`Downhill: ${gradientSummary.downhillPct}%`}
              />
            </div>

            {/* 3 Metric Cards */}
            <div className="grid grid-cols-3 gap-3">
              {/* Uphill Card */}
              <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-rose-700 font-black">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Uphill</span>
                </div>
                <div className="text-xl font-black text-rose-700 font-mono">
                  {gradientSummary.uphillPct}%
                </div>
                <div className="text-[11px] text-zinc-600 font-mono font-bold">
                  {gradientSummary.uphillKm} km
                </div>
              </div>

              {/* Flat Card */}
              <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-amber-800 font-black">
                  <Minus className="h-3.5 w-3.5" />
                  <span>Flat</span>
                </div>
                <div className="text-xl font-black text-amber-700 font-mono">
                  {gradientSummary.flatPct}%
                </div>
                <div className="text-[11px] text-zinc-600 font-mono font-bold">
                  {gradientSummary.flatKm} km
                </div>
              </div>

              {/* Downhill Card */}
              <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-sky-800 font-black">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  <span>Downhill</span>
                </div>
                <div className="text-xl font-black text-sky-700 font-mono">
                  {gradientSummary.downhillPct}%
                </div>
                <div className="text-[11px] text-zinc-600 font-mono font-bold">
                  {gradientSummary.downhillKm} km
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 4: Major Mountain Passes & Categorized Climbs Breakdown */}
        {majorClimbs.length > 0 && (
          <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-4">
            <div className="flex items-center justify-between border-b-2 border-zinc-950 pb-3">
              <div className="flex items-center gap-2">
                <Mountain className="h-4 w-4 text-zinc-950" />
                <h3 className="text-sm font-black text-zinc-950 tracking-tight">
                  Analisis Tanjakan Utama (Major Mountain Passes & Categorized Climbs)
                </h3>
              </div>
              <span className="text-xs text-zinc-600 font-mono font-bold">
                {majorClimbs.length} Tanjakan Terdeteksi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {majorClimbs.map((climb) => (
                <div
                  key={climb.id}
                  className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-2 hover:bg-white transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-black text-zinc-950">{climb.name}</h4>
                      <p className="text-[10px] text-zinc-600 font-mono font-bold">
                        KM {climb.startKm} &rarr; KM {climb.endKm} ({climb.distanceKm} km)
                      </p>
                    </div>
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase font-mono border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] ${
                        climb.category === "HC"
                          ? "bg-rose-400 text-zinc-950"
                          : climb.category === "Cat 1"
                          ? "bg-orange-400 text-zinc-950"
                          : "bg-amber-300 text-zinc-950"
                      }`}
                    >
                      {climb.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 border-t-2 border-zinc-950">
                    <div>
                      <span className="text-[10px] text-zinc-600 font-sans font-bold block">Total D+</span>
                      <span className="text-emerald-700 font-black">+{climb.gainM}m</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-600 font-sans font-bold block">Rata-rata Slope</span>
                      <span className="text-amber-700 font-black">{climb.avgGradePct}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-600 font-sans font-bold block">Max Slope</span>
                      <span className="text-rose-700 font-black">{climb.maxGradePct}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-600 font-sans font-bold block">Estimasi Nanjak</span>
                      <span className="text-zinc-950 font-black">{climb.estimatedMinutes} menit</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature 5: Advanced Simulation Parameters & Strategy Tiers */}
        <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-950 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-zinc-950" />
              <h3 className="text-sm font-black text-zinc-950 tracking-tight">
                Parameter Simulasi Realistis (Night Pacing, Kelelahan & Waktu Singgah)
              </h3>
              <button
                onClick={() => setShowMethodology(!showMethodology)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-black rounded-lg bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] hover:bg-zinc-100 text-zinc-950 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                title="Pelajari dasar sains & formula simulasi"
              >
                <BookOpen className="h-3.5 w-3.5 text-zinc-950" />
                <span>{showMethodology ? "Tutup Metodologi" : "Metodologi Sains"}</span>
              </button>
            </div>

            {/* Strategy Tier Selector */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border-2 border-zinc-950 text-xs">
              <button
                onClick={() => setStrategyTier("finisher")}
                className={`px-3 py-1 rounded-lg font-black transition-all ${
                  strategyTier === "finisher" ? "bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]" : "text-zinc-600 hover:text-zinc-950 font-bold"
                }`}
                title="Pace aman & stabil untuk memastikan finish sebelum batas COT"
              >
                Finisher (Realistis)
              </button>
              <button
                onClick={() => setStrategyTier("intermediate")}
                className={`px-3 py-1 rounded-lg font-black transition-all ${
                  strategyTier === "intermediate" ? "bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]" : "text-zinc-600 hover:text-zinc-950 font-bold"
                }`}
                title="Pace menengah agresif (Target Sub-17 Jam)"
              >
                Target Menengah
              </button>
              <button
                onClick={() => setStrategyTier("elite")}
                className={`px-3 py-1 rounded-lg font-black transition-all ${
                  strategyTier === "elite" ? "bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]" : "text-zinc-600 hover:text-zinc-950 font-bold"
                }`}
                title="Pace atlet podium / top runner"
              >
                Top Runner
              </button>
            </div>
          </div>

          {/* Scientific Methodology Explainer Card (Collapsible) */}
          {showMethodology && (
            <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] space-y-3.5 text-xs text-zinc-950">
              <div className="flex items-center justify-between border-b-2 border-zinc-950 pb-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-zinc-950" />
                  <h4 className="font-black text-zinc-950 text-sm">
                    Metodologi Sains & Dasar Formula (Hybrid Naismith + VAM COROS + ITRA Km-Effort)
                  </h4>
                </div>
                <button
                  onClick={() => setShowMethodology(false)}
                  className="text-zinc-600 hover:text-zinc-950 font-mono text-xs font-bold"
                >
                  ✕ Tutup
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-900">
                {/* 1. Naismith Hybrid */}
                <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-1.5">
                  <div className="flex items-center gap-2 text-zinc-950 font-black">
                    <Award className="h-4 w-4 text-zinc-950" />
                    <span>1. Hybrid Naismith Rule & VAM Personal</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                    Alih-alih menggunakan formula pejalan kaki seragam (seperti Tobler 6 km/jam atau Naismith 600m/jam statis), kalkulator memisahkan lintasan menjadi <strong>kecepatan lari datar (Flat Pace)</strong> dan <strong>kecepatan vertikal nanjak (VAM / Velocità Ascensionale Media)</strong> yang terkalibrasi dari jam COROS atlet.
                  </p>
                  <div className="p-2 rounded bg-[#FAF9F5] font-mono text-[10px] text-zinc-950 border border-zinc-950 font-bold">
                    Waktu Segmen = (Jarak Datar × Flat Pace) + (D+ Vertikal / VAM)
                  </div>
                </div>

                {/* 2. ITRA Km-Effort */}
                <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-1.5">
                  <div className="flex items-center gap-2 text-zinc-950 font-black">
                    <TrendingUp className="h-4 w-4 text-zinc-950" />
                    <span>2. Alokasi Batas COT Realistis (ITRA Km-Effort)</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                    Pembagian batas waktu linier jarak datar membuat pelari tampak gagal di pos tanjakan awal (misal KM 11 Senaru Rim +2000m D+). Sistem mengalokasikan batas waktu pos berdasarkan rasio <strong>Km-Effort (Jarak + D+/100)</strong> dengan kurva <em>front-load</em> panitia resmi ((Effort Ratio)^0.88).
                  </p>
                  <div className="p-2 rounded bg-[#FAF9F5] font-mono text-[10px] text-zinc-950 border border-zinc-950 font-bold">
                    Km-Effort = Jarak (km) + (D+ / 100) &bull; COT Pos = (Effort Ratio)^0.88 × Batas COT
                  </div>
                </div>

                {/* 3. Minetti Quad Braking */}
                <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-1.5">
                  <div className="flex items-center gap-2 text-zinc-950 font-black">
                    <Activity className="h-4 w-4 text-zinc-950" />
                    <span>3. Minetti Eccentric Quad Braking (Turunan Terjal)</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                    Turunan gunung vulkanik (seperti pasir & bebatuan Rinjani) tidak dapat dituruni secepat jalan aspal. Sistem menambahkan beban pengereman eksentrik otot kuadrisep per 1.000m D- untuk mengantisipasi penurunan kecepatan akibat medan teknis bebatuan.
                  </p>
                  <div className="p-2 rounded bg-[#FAF9F5] font-mono text-[10px] text-zinc-950 border border-zinc-950 font-bold">
                    Waktu Turunan = (D- Vertikal / 1000) × Koefisien Rem Paha (180–380 detik)
                  </div>
                </div>

                {/* 4. Ultra Physiology */}
                <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-1.5">
                  <div className="flex items-center gap-2 text-zinc-950 font-black">
                    <Flame className="h-4 w-4 text-zinc-950" />
                    <span>4. Fisiologi Ultra, Altitude & Headlamp</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                    Memperhitungkan deplesi kadar oksigen tipis di atas 2.200m dan 3.000m mdpl (-6% s/d -12% VAM), penalti visibilitas lari malam (18:00–06:00), serta kelelahan progresif paruh kedua balapan ultra.
                  </p>
                  <div className="p-2 rounded bg-[#FAF9F5] font-mono text-[10px] text-zinc-950 border border-zinc-950 font-bold">
                    Penalti: Altitude (&gt;2200m) + Malam (Headlamp) + Kelelahan Paruh Kedua
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Batas Resmi COT Panitia Input (Editable!) */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-950 font-black flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-zinc-950" />
                  Batas Resmi COT Panitia
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={60}
                  step={0.5}
                  value={raceOfficialCotHours}
                  onChange={(e) => setRaceOfficialCotHours(parseFloat(e.target.value) || 20)}
                  className="w-full bg-white border-2 border-zinc-950 text-zinc-950 font-mono font-black text-sm rounded-lg px-2.5 py-1 text-center shadow-[1px_1px_0px_0px_#09090b] focus:outline-none"
                />
                <span className="text-xs text-zinc-800 font-mono font-bold">Jam</span>
              </div>
              <p className="text-[10px] text-zinc-600 font-medium">
                Rinjani 60K = 20 Jam &bull; 36K = 15 Jam.
              </p>
            </div>

            {/* Start Time Picker */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-950 font-bold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-zinc-950" />
                  Jam Mulai Lomba
                </span>
                <span className="font-mono text-zinc-950 font-black">{raceStartTime}</span>
              </div>
              <select
                value={raceStartTime}
                onChange={(e) => setRaceStartTime(e.target.value)}
                className="w-full bg-white border-2 border-zinc-950 text-zinc-950 rounded-lg p-1.5 text-xs focus:outline-none font-mono font-bold shadow-[1px_1px_0px_0px_#09090b]"
              >
                <option value="00:00">00:00 (Tengah Malam / Ultra Start)</option>
                <option value="02:00">02:00 (Subuh Dini Hari)</option>
                <option value="05:00">05:00 (Fajar / Sunrise)</option>
                <option value="06:00">06:00 (Pagi Hari)</option>
                <option value="20:00">20:00 (Malam Hari)</option>
              </select>
              <p className="text-[10px] text-zinc-600 font-medium">
                Menghitung transisi gelap vs terang.
              </p>
            </div>

            {/* Fatigue Degradation Slider */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-950 font-bold flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-orange-600" />
                  Kelelahan Paruh Kedua
                </span>
                <span className="font-mono text-orange-700 font-black">+{fatigueDegradationPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={2}
                value={fatigueDegradationPct}
                onChange={(e) => setFatigueDegradationPct(Number(e.target.value))}
                className="w-full accent-zinc-950 cursor-pointer h-2 bg-zinc-200 rounded-lg border border-zinc-950"
              />
              <p className="text-[10px] text-zinc-600 font-medium">
                Pace melambat setelah 30% jarak tempuh.
              </p>
            </div>

            {/* Night Headlamp Penalty Slider */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-950 font-bold flex items-center gap-1.5">
                  <Moon className="h-3.5 w-3.5 text-purple-600" />
                  Penalti Lari Malam
                </span>
                <span className="font-mono text-purple-700 font-black">+{nightPenaltyPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={2}
                value={nightPenaltyPct}
                onChange={(e) => setNightPenaltyPct(Number(e.target.value))}
                className="w-full accent-zinc-950 cursor-pointer h-2 bg-zinc-200 rounded-lg border border-zinc-950"
              />
              <p className="text-[10px] text-zinc-600 font-medium">
                Perlambatan di trek gelap (18:00 - 06:00).
              </p>
            </div>
          </div>
        </div>

        {/* Feature C: Aid Station Nutrition & Hydration Planner */}
        <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-950 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Apple className="h-4 w-4 text-orange-600 stroke-[2.5]" />
                <h3 className="text-sm font-black text-zinc-950 tracking-tight">
                  Aid Station Nutrition & Hydration Planner (Strategi Logistik WS)
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-cyan-200 text-cyan-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                  Jeukendrup & Costa
                </span>
              </div>
              <p className="text-xs text-zinc-600 font-medium mt-0.5">
                Kalkulasi kebutuhan restock air dan karbohidrat otomatis antar pos berdasarkan prediksi durasi tempuh & gradien vertikal
              </p>
            </div>

            <button
              onClick={() => setShowNutritionPlan(!showNutritionPlan)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] hover:bg-zinc-100 text-zinc-950 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none self-start sm:self-auto"
            >
              {showNutritionPlan ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 text-zinc-950" />
                  <span>Sembunyikan Strategi</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 text-zinc-950" />
                  <span>Buka Strategi Nutrisi</span>
                </>
              )}
            </button>
          </div>

          {showNutritionPlan && (
            <div className="space-y-5">
              {/* Target Controls Deck */}
              <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-950 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-zinc-950" />
                    Kustomisasi Target Asupan & Kapasitas Vest
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 font-bold">
                    Disesuaikan dengan daya serap lambung (gut training) Anda
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Target Carbs Slider */}
                  <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-zinc-800 flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5 text-amber-600" />
                        Target Karbohidrat
                      </span>
                      <span className="font-mono font-black text-amber-700 text-sm">
                        {targetCarbsPerHour}g / jam
                      </span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={90}
                      step={5}
                      value={targetCarbsPerHour}
                      onChange={(e) => setTargetCarbsPerHour(Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer h-2 bg-zinc-200 rounded-lg border border-zinc-950"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>30g (Ringan)</span>
                      <span>~{Math.round((targetCarbsPerHour / 25) * 10) / 10} gel/jam</span>
                      <span>90g (Gut Trained)</span>
                    </div>
                  </div>

                  {/* Target Water Slider */}
                  <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-zinc-800 flex items-center gap-1">
                        <Droplets className="h-3.5 w-3.5 text-cyan-600" />
                        Target Hidrasi Cairan
                      </span>
                      <span className="font-mono font-black text-cyan-700 text-sm">
                        {targetWaterPerHourMl}ml / jam
                      </span>
                    </div>
                    <input
                      type="range"
                      min={300}
                      max={800}
                      step={50}
                      value={targetWaterPerHourMl}
                      onChange={(e) => setTargetWaterPerHourMl(Number(e.target.value))}
                      className="w-full accent-cyan-600 cursor-pointer h-2 bg-zinc-200 rounded-lg border border-zinc-950"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>300ml (Sejuk)</span>
                      <span>500ml (Standar)</span>
                      <span>800ml (Panas)</span>
                    </div>
                  </div>

                  {/* Flask Capacity Selector */}
                  <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-zinc-800 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Kapasitas Botol Vest
                      </span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        {flaskCapacityMl}ml
                      </span>
                    </div>
                    <select
                      value={flaskCapacityMl}
                      onChange={(e) => setFlaskCapacityMl(Number(e.target.value))}
                      className="w-full bg-white border-2 border-zinc-950 text-zinc-950 rounded-lg p-1.5 text-xs font-mono font-bold shadow-[1px_1px_0px_0px_#09090b] focus:outline-none"
                    >
                      <option value={500}>500ml (1 Softflask Ringan)</option>
                      <option value={1000}>1,000ml (2 x 500ml Standar Trail)</option>
                      <option value={1500}>1,500ml (2 Flasks + 500ml Bladder)</option>
                      <option value={2000}>2,000ml (2 Flasks + 1L Bladder)</option>
                    </select>
                    <p className="text-[10px] text-zinc-500">
                      Sistem memberi peringatan jika segmen butuh air &gt; kapasitas ini.
                    </p>
                  </div>
                </div>
              </div>

              {/* Race Total Fuel & Hydration Scorecard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[10px] text-zinc-600 font-bold block">Total Karbohidrat Balapan</span>
                  <div className="text-xl font-black text-amber-700 font-mono">
                    {raceNutritionSummary.totalCarbs}g
                  </div>
                  <p className="text-[10px] text-zinc-600 font-medium font-mono">
                    ~{raceNutritionSummary.totalGels} Bungkus Energy Gel (@25g)
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[10px] text-zinc-600 font-bold block">Total Hidrasi Cairan</span>
                  <div className="text-xl font-black text-cyan-700 font-mono">
                    {raceNutritionSummary.totalWaterLiters} Liter
                  </div>
                  <p className="text-[10px] text-zinc-600 font-medium font-mono">
                    ~{Math.ceil(raceNutritionSummary.totalWaterMl / 500)} kali refill botol 500ml
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[10px] text-zinc-600 font-bold block">Penggantian Garam (Sodium)</span>
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    {raceNutritionSummary.totalSodiumMg.toLocaleString()} mg
                  </div>
                  <p className="text-[10px] text-zinc-600 font-medium font-mono">
                    ~{raceNutritionSummary.totalSaltCaps} Kapsul Garam (Cegah kram)
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[10px] text-zinc-600 font-bold block">Status Kapasitas Vest</span>
                  <div className="text-base font-black text-zinc-950 font-mono">
                    {raceNutritionSummary.highWaterAlertsCount > 0 ? (
                      <span className="text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {raceNutritionSummary.highWaterAlertsCount} Pos Defisit
                      </span>
                    ) : (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Aman Terpenuhi
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600 font-medium">
                    {raceNutritionSummary.highWaterAlertsCount > 0
                      ? "Butuh extra softflask di tanjakan terjal"
                      : "2 botol 500ml cukup di semua pos"}
                  </p>
                </div>
              </div>

              {/* Station-by-Station Restock Timeline Cards */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-950 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-zinc-950" />
                    Panduan Aksi Restock di Setiap Pos / Water Station (WS)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 font-bold">
                    Siapkan sebelum checkout dari pos
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {evaluatedCheckpoints.map((cp, idx) => {
                    const isFinish = idx === evaluatedCheckpoints.length - 1 || cp.isFinish;
                    const isStart = idx === 0;
                    const nextCp = evaluatedCheckpoints[idx + 1];

                    return (
                      <div
                        key={cp.id || `ws-${idx}`}
                        className={`p-4 rounded-xl border-2 border-zinc-950 space-y-2.5 shadow-[2px_2px_0px_0px_#09090b] ${
                          cp.waterExceedsCapacity
                            ? "bg-rose-50 border-rose-950"
                            : isFinish
                            ? "bg-emerald-50"
                            : isStart
                            ? "bg-amber-50"
                            : "bg-white"
                        }`}
                      >
                        {/* Station Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-2 border-b border-zinc-200 pb-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-zinc-200 text-zinc-950 border border-zinc-950">
                                {isStart ? "START" : isFinish ? "FINISH" : `POS ${idx}`}
                              </span>
                              <span className="text-xs font-black text-zinc-950">{cp.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 font-bold block mt-0.5">
                              KM {cp.distanceKm.toFixed(1)} &bull; {cp.elevationM} mdpl &bull; Tiba: {cp.predictedTimeStr} ({cp.clockTimeStr})
                            </span>
                          </div>

                          {!isFinish && nextCp && (
                            <div className="text-left sm:text-right shrink-0">
                              <span className="text-[9px] font-mono text-zinc-500 block">Menuju {nextCp.name}</span>
                              <span className="text-[11px] font-mono font-black text-zinc-950">
                                {cp.nextSegDistanceKm}km &bull; ~{cp.nextSegDurationFormatted}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Checklist for Non-Finish */}
                        {!isFinish ? (
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[11px]">
                              {/* Water */}
                              <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-300 min-w-0">
                                <span className="text-[9px] text-cyan-900 font-bold block truncate">💧 Refill Air</span>
                                <span className="font-mono font-black text-cyan-950 text-xs block truncate">
                                  {cp.waterRefillMl} ml
                                </span>
                              </div>

                              {/* Carbs */}
                              <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 min-w-0">
                                <span className="text-[9px] text-amber-900 font-bold block truncate">⚡ Ambil Karbo</span>
                                <span className="font-mono font-black text-amber-950 text-xs block truncate">
                                  {cp.carbsTargetGrams}g <span className="text-[9px] font-normal hidden sm:inline">({cp.gelsNeeded} gel)</span>
                                </span>
                              </div>

                              {/* Salt */}
                              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-300 min-w-0">
                                <span className="text-[9px] text-emerald-900 font-bold block truncate">🧂 Elektrolit</span>
                                <span className="font-mono font-black text-emerald-950 text-xs block truncate">
                                  {cp.saltCapsulesCount} kap
                                </span>
                              </div>
                            </div>

                            {/* Alert if water needed exceeds flask capacity */}
                            {cp.waterExceedsCapacity && (
                              <div className="p-2.5 rounded-lg bg-rose-100 border border-rose-400 text-rose-950 text-[11px] font-bold flex items-start gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-700 shrink-0 mt-0.5" />
                                <div>
                                  <strong>Defisit Cairan (+{cp.waterDeficitMl}ml): </strong>
                                  Durasi tanjakan ke {nextCp?.name} (~{cp.nextSegDurationFormatted}) membutuhkan {cp.waterNeededMl}ml air. Bawa botol extra atau minum 300ml sebelum checkout!
                                </div>
                              </div>
                            )}

                            {/* Logistics Tip */}
                            <p className="text-[11px] text-zinc-700 font-medium italic">
                              💡 {cp.logisticsAdvice}
                            </p>
                          </div>
                        ) : (
                          <div className="text-xs text-emerald-900 font-medium space-y-1">
                            <div className="font-black text-emerald-950">🏆 Target Selesai & Pemulihan Segera:</div>
                            <p className="text-[11px]">
                              Segera minum 500ml elektrolit dingin, 20–25g protein recovery, dan karbohidrat padat untuk mempercepat sintesis glikogen otot.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature 6: Athlete Finish Prediction & Checkpoint Timetable */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-5">
          {/* Header with Show/Hide Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-950 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-zinc-950 tracking-tight">
                  Rencana Pos Water Station (WS) & Estimasi Waktu Tiba
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] whitespace-nowrap shrink-0 ${
                    overallBufferMinutes >= 45
                      ? "bg-emerald-300 text-zinc-950"
                      : overallBufferMinutes >= 0
                      ? "bg-amber-300 text-zinc-950"
                      : "bg-rose-300 text-zinc-950"
                  }`}
                >
                  {formatBufferText(overallBufferMinutes)}
                </span>
              </div>
              <p className="text-xs text-zinc-600 font-medium mt-1">
                Dihitung dari VAM COROS ({athleteVam} m/h), deplesi oksigen di ketinggian, dan batas resmi panitia ({raceOfficialCotHours} jam).
              </p>
            </div>

            {/* Toggle Button */}
            <button
              onClick={() => setShowPacingEstimation(!showPacingEstimation)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] hover:bg-zinc-100 text-zinc-950 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none self-start sm:self-auto shrink-0"
            >
              {showPacingEstimation ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 text-zinc-950" />
                  <span>Sembunyikan Estimasi</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 text-zinc-950" />
                  <span>Tampilkan Estimasi</span>
                </>
              )}
            </button>
          </div>

          {/* Collapsible Athlete Finish Prediction Card */}
          {showPacingEstimation && (
            <div className="p-4 rounded-2xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Award className="h-5 w-5 text-zinc-950 shrink-0" />
                  <div>
                    <h4 className="text-sm font-black text-zinc-950 tracking-tight">
                      Estimasi Waktu Finish Atlet (Fisiologi Gunung & VAM COROS Realistis)
                    </h4>
                    <p className="text-[11px] text-zinc-600 font-medium">
                      Batas COT Resmi Panitia: <strong className="text-zinc-950">{raceOfficialCotHours} Jam</strong> &bull; Mode:{" "}
                      <strong className="text-zinc-950 uppercase">{strategyTier}</strong>
                    </p>
                  </div>
                </div>

                <span
                  className={`self-start sm:self-auto px-3 py-1 rounded-md text-xs font-black uppercase border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] whitespace-nowrap shrink-0 ${
                    overallBufferMinutes >= 45
                      ? "bg-emerald-300 text-zinc-950"
                      : overallBufferMinutes >= 0
                      ? "bg-amber-300 text-zinc-950"
                      : "bg-rose-300 text-zinc-950"
                  }`}
                >
                  {formatBufferText(overallBufferMinutes)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs pt-2 border-t-2 border-zinc-950">
                {/* Finish Time */}
                <div className="p-3 rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-0.5">
                  <span className="text-[10px] text-zinc-600 font-sans font-bold block">Total Waktu Finish</span>
                  <div className="text-xl font-black text-zinc-950">
                    {finishHours}j {finishMins}m
                  </div>
                  <div className="text-[10px] text-zinc-700 font-sans font-bold">
                    Jam Tiba: {finishCheckpoint?.clockTimeStr || "--:--"}
                  </div>
                </div>

                {/* Avg Trail Speed & Pace */}
                <div className="p-3 rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-0.5">
                  <span className="text-[10px] text-zinc-600 font-sans font-bold block">Rata-rata Pace Trail</span>
                  <div className="text-xl font-black text-zinc-950">
                    {formatPace(avgOverallPaceSec)}<span className="text-xs font-normal text-zinc-600">/km</span>
                  </div>
                  <div className="text-[10px] text-zinc-600 font-sans font-bold">
                    Speed: {avgOverallSpeedKmh} km/jam
                  </div>
                </div>

                {/* Calibrated VAM */}
                <div className="p-3 rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-0.5">
                  <span className="text-[10px] text-zinc-600 font-sans font-bold block">
                    {strategyTier === "elite"
                      ? "VAM Top Runner"
                      : strategyTier === "intermediate"
                      ? "VAM Target Menengah"
                      : "VAM COROS Atlet"}
                  </span>
                  <div className="text-xl font-black text-amber-700">
                    {activeStrategyStats.vam} <span className="text-xs font-normal text-zinc-600">m/h</span>
                  </div>
                  <div className="text-[10px] text-zinc-600 font-sans font-bold">
                    Flat Pace: {formatPace(activeStrategyStats.flatPace)}/km
                  </div>
                </div>

                {/* Nutrition Targets */}
                <div className="p-3 rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-0.5">
                  <span className="text-[10px] text-zinc-600 font-sans font-bold block">Total Kebutuhan Nutrisi Race</span>
                  <div className="text-lg font-black text-emerald-700">
                    💧 ~{raceNutritionSummary.totalWaterLiters}L Air
                  </div>
                  <div className="text-[10px] text-amber-700 font-sans font-bold">
                    ⚡ {raceNutritionSummary.totalCarbs}g Karbo ({raceNutritionSummary.totalGels} gel) • {raceNutritionSummary.totalSaltCaps} Garam
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timetable of Checkpoints */}
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead className="border-b-2 border-zinc-950 text-[11px] text-zinc-950 font-mono uppercase bg-zinc-100 font-black">
                  <tr>
                    <th className="py-3 px-3">Nama Pos / WS Asli</th>
                    <th className="py-3 px-3">Jarak & Ketinggian</th>
                    <th className="py-3 px-3">Estimasi Tiba (Clock Time)</th>
                    <th className="py-3 px-3">Batas COT ({raceOfficialCotHours}j)</th>
                    <th className="py-3 px-3">Buffer Aman</th>
                    <th className="py-3 px-3">Logistik Refill</th>
                    <th className="py-3 px-3">Catatan Taktis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {evaluatedCheckpoints.map((cp) => (
                    <tr
                      key={cp.id}
                      className="hover:bg-[#FAF9F5] transition-colors font-mono"
                    >
                      <td className="py-3 px-3">
                        <div className="font-black text-zinc-950 font-sans flex items-center gap-1.5">
                          {cp.name}
                          {cp.isNight && (
                            <span className="text-[10px]" title="Zona Lari Malam (Headlamp)">
                              🌙
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-zinc-950">{cp.distanceKm.toFixed(1)} km</div>
                        <div className="text-[10px] text-zinc-600 font-bold">{cp.elevationM} mdpl</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-zinc-950">{cp.predictedTimeStr}</div>
                        <div className="text-[10px] text-zinc-600 flex items-center gap-1 font-sans font-bold">
                          {cp.isNight ? <Moon className="h-3 w-3 text-purple-700" /> : <Sun className="h-3 w-3 text-amber-600" />}
                          <span>{cp.clockTimeStr}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-zinc-950">
                        <div className="font-black">{cp.officialCotTime}</div>
                        {!cp.isFinish && cp.distanceKm > 0 && (
                          <div className="text-[9px] text-zinc-500 font-sans font-medium">Alokasi Km-Effort</div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] whitespace-nowrap inline-block ${
                            cp.status === "safe"
                              ? "bg-emerald-300 text-zinc-950"
                              : cp.status === "caution"
                              ? "bg-amber-300 text-zinc-950"
                              : "bg-rose-300 text-zinc-950"
                          }`}
                        >
                          {formatBufferText(cp.bufferMinutes, true)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {cp.isFinish ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-200 text-emerald-950 border border-zinc-950">
                            Finish Recovery
                          </span>
                        ) : cp.waterRefillMl > 0 || cp.carbsTargetGrams > 0 ? (
                          <div className="space-y-1">
                            <div className="text-[11px] text-zinc-950 font-bold flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-cyan-700 font-black font-mono">💧 {cp.waterRefillMl}ml</span>
                              <span className="text-zinc-400">•</span>
                              <span className="text-amber-700 font-black font-mono">⚡ {cp.carbsTargetGrams}g ({cp.gelsNeeded} gel)</span>
                            </div>
                            {cp.waterExceedsCapacity && (
                              <span className="text-[9px] font-black text-rose-800 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded block whitespace-nowrap">
                                ⚠️ Butuh {cp.waterNeededMl}ml (&gt;{flaskCapacityMl}ml)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 font-bold">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[11px] font-sans min-w-[260px] max-w-sm">
                        <div className="text-zinc-800 leading-snug font-medium">{cp.notes}</div>
                        {cp.rawDesc && cp.rawDesc !== cp.notes && !cp.rawDesc.startsWith("Pos resmi") && (
                          <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1 font-mono">
                            <span className="text-zinc-600 font-bold">Info GPX:</span>
                            <span className="truncate max-w-[200px]" title={cp.rawDesc}>{cp.rawDesc}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </>
      )}
      </main>
    </div>
  );
}
