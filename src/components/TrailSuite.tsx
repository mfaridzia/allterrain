"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Mountain,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Gauge,
  AlertCircle,
  Sparkles,
  Apple,
  Droplets,
  Zap,
  Activity,
  ShieldCheck,
  Compass,
  ArrowRight,
  Dumbbell,
  Target,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Footprints,
  Flame,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
} from "recharts";
import { useUpdateSettingsMutation } from "@/lib/queries";
import { MetricTooltip } from "@/components/MetricTooltip";
import {
  estimateTrailRaceFinishTime,
  calculateKmEffort,
  calculateTrailFuelingPlan,
  classifyClimbDensity,
  calculateRacePreparationVolume,
  calculateGradientEfficiencyCurve,
  GradientEfficiencyAnalysis,
  GradientEfficiencyPoint,
} from "@/lib/analytics";

interface TrailSuiteProps {
  totalGain: number;
  totalLoss: number;
  avgVam: number;
  trailActivitiesCount: number;
  flatMarathonPaceSec?: number;
  thisWeekGain?: number;
  thisWeekDistanceKm?: number;
  thisWeekDensity?: number;
  rolling7dGain?: number;
  rolling7dDistanceKm?: number;
  rolling7dDensity?: number;
  trailOnlyDensity?: number;
  savedTargetRaceDist?: number;
  savedTargetRaceElev?: number;
  savedWeeklyVertTarget?: number;
  savedTrainingTier?: "finisher" | "elite";
}

export const TrailSuite: React.FC<TrailSuiteProps> = ({
  totalGain,
  totalLoss,
  avgVam,
  trailActivitiesCount,
  flatMarathonPaceSec = 318, // 5:18 min/km from COROS FM prediction (3:43:35)
  thisWeekGain = 120,
  thisWeekDistanceKm = 20,
  thisWeekDensity = 6,
  rolling7dGain = 1152,
  rolling7dDistanceKm = 43.7,
  rolling7dDensity = 26.4,
  trailOnlyDensity = 85,
  savedTargetRaceDist,
  savedTargetRaceElev,
  savedWeeklyVertTarget,
  savedTrainingTier,
}) => {
  // Custom Trail Race Estimator interactive state
  const [raceDistance, setRaceDistance] = useState<number>(savedTargetRaceDist || 36);
  const [raceElevation, setRaceElevation] = useState<number>(savedTargetRaceElev || 2200);
  const [weeklyVertTarget, setWeeklyVertTarget] = useState<number>(savedWeeklyVertTarget || 1000);
  const [vertWindow, setVertWindow] = useState<"this_week" | "rolling_7d">("this_week");
  const [trainingTier, setTrainingTier] = useState<"finisher" | "elite">(savedTrainingTier || "finisher");
  const updateSettings = useUpdateSettingsMutation();

  // Load from localStorage on mount (hydration safe)
  useEffect(() => {
    try {
      const localDist = localStorage.getItem("coros_trail_race_dist");
      if (localDist) {
        setRaceDistance(Number(localDist));
      } else if (savedTargetRaceDist) {
        setRaceDistance(savedTargetRaceDist);
      }

      const localElev = localStorage.getItem("coros_trail_race_elev");
      if (localElev) {
        setRaceElevation(Number(localElev));
      } else if (savedTargetRaceElev) {
        setRaceElevation(savedTargetRaceElev);
      }

      const localVert = localStorage.getItem("coros_trail_weekly_vert_target");
      if (localVert) {
        setWeeklyVertTarget(Number(localVert));
      } else if (savedWeeklyVertTarget) {
        setWeeklyVertTarget(savedWeeklyVertTarget);
      }

      const localTier = localStorage.getItem("coros_trail_training_tier");
      if (localTier === "elite" || localTier === "finisher") {
        setTrainingTier(localTier);
      } else if (savedTrainingTier) {
        setTrainingTier(savedTrainingTier);
      }
    } catch (_) {}
  }, [savedTargetRaceDist, savedTargetRaceElev, savedWeeklyVertTarget, savedTrainingTier]);

  // Save to both localStorage AND SQLite backend via /api/settings (debounced)
  useEffect(() => {
    try {
      localStorage.setItem("coros_trail_race_dist", raceDistance.toString());
      localStorage.setItem("coros_trail_race_elev", raceElevation.toString());
      localStorage.setItem("coros_trail_weekly_vert_target", weeklyVertTarget.toString());
      localStorage.setItem("coros_trail_training_tier", trainingTier);
    } catch (_) {}

    const timer = setTimeout(() => {
      updateSettings.mutate({
        trailTargetRaceDist: raceDistance,
        trailTargetRaceElev: raceElevation,
        trailWeeklyVertTarget: weeklyVertTarget,
        trailTrainingTier: trainingTier,
      });
    }, 600);

    return () => clearTimeout(timer);
  }, [raceDistance, raceElevation, weeklyVertTarget, trainingTier]);

  const currentGain = vertWindow === "this_week" ? thisWeekGain : rolling7dGain;
  const currentDist = vertWindow === "this_week" ? thisWeekDistanceKm : rolling7dDistanceKm;
  const currentDensity = vertWindow === "this_week" ? thisWeekDensity : rolling7dDensity;

  const prediction = useMemo(() => {
    return estimateTrailRaceFinishTime({
      distanceKm: raceDistance,
      elevationGainMeters: raceElevation,
      elevationLossMeters: raceElevation,
      flatMarathonPaceSecPerKm: flatMarathonPaceSec,
      historicalVamMetersPerHour: avgVam,
    });
  }, [raceDistance, raceElevation, flatMarathonPaceSec, avgVam]);

  // ITRA Km-Effort
  const kmEffort = useMemo(() => {
    return calculateKmEffort(raceDistance, raceElevation);
  }, [raceDistance, raceElevation]);

  // Fueling Plan based on estimated finish time
  const fuelingPlan = useMemo(() => {
    return calculateTrailFuelingPlan(prediction.estimatedTotalSeconds);
  }, [prediction.estimatedTotalSeconds]);

  // Kilian Jornet Climb Density Profile (D+ / km)
  const climbDensity = useMemo(() => {
    const density = Math.round(raceElevation / Math.max(1, raceDistance));
    return {
      density,
      ...classifyClimbDensity(density),
    };
  }, [raceDistance, raceElevation]);

  // Preparation Volume & Vert Targets (Jason Koop & Kilian Jornet)
  const prepTargets = useMemo(() => {
    return calculateRacePreparationVolume(raceDistance, raceElevation, trainingTier);
  }, [raceDistance, raceElevation, trainingTier]);

  const hasHighDescentPenalty = raceElevation >= 1500;

  // Feature B: Climbing & Descent Efficiency Analysis (VAM vs Gradient & Hike vs Run)
  const [selectedGradient, setSelectedGradient] = useState<number>(12);
  const efficiencyAnalysis = useMemo(() => {
    return calculateGradientEfficiencyCurve({
      athleteVam: avgVam,
      athleteFlatPaceSec: flatMarathonPaceSec,
    });
  }, [avgVam, flatMarathonPaceSec]);

  const activePoint = useMemo(() => {
    const exact = efficiencyAnalysis.curve.find((p) => p.gradientPct === selectedGradient);
    if (exact) return exact;
    return efficiencyAnalysis.curve.reduce((prev, curr) =>
      Math.abs(curr.gradientPct - selectedGradient) < Math.abs(prev.gradientPct - selectedGradient) ? curr : prev
    );
  }, [efficiencyAnalysis, selectedGradient]);

  const chartData = useMemo(() => {
    return efficiencyAnalysis.uphillPoints.map((pt) => ({
      gradient: `${pt.gradientPct}%`,
      gradientPct: pt.gradientPct,
      runVam: pt.runVam,
      hikeVam: pt.hikeVam,
      savingsPct: pt.glycogenSavingsPct,
      runPace: pt.runPaceStr,
      hikePace: pt.hikePaceStr,
      strategy: pt.strategyLabel,
    }));
  }, [efficiencyAnalysis]);

  return (
    <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-6 shadow-[4px_4px_0px_0px_#09090b]">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-cyan-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <Mountain className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-950 tracking-tight flex items-center gap-2">
              <span>Trail & Mountain Running Suite</span>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-cyan-200 text-cyan-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                Uphill Athlete & ITRA
              </span>
            </h3>
            <p className="text-xs font-medium text-zinc-600">
              VAM Climbing Efficiency • ITRA Km-Effort • Kilian Jornet Vertical Metrics • Ultra Fueling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-[#FAF9F5] border-2 border-zinc-950 font-mono text-[11px] font-black text-zinc-900 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            {trailActivitiesCount} Trail sessions logged
          </span>
        </div>
      </div>

      {/* Mountain KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* VAM Card */}
        <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex items-center justify-between">
            <MetricTooltip term="vam">
              <span className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-cyan-700 stroke-[2.5]" />
                Ascent Rate (VAM)
              </span>
            </MetricTooltip>
            <span className="text-[10px] font-mono font-bold text-zinc-500">Average</span>
          </div>
          <div className="text-2xl font-black text-zinc-950 font-mono">
            {avgVam} <span className="text-xs font-normal text-zinc-500">m/h</span>
          </div>
          <p className="text-[11px] font-medium text-zinc-600">
            {avgVam > 700 ? "Elite Mountain Climbing" : avgVam > 500 ? "Strong Uphill Base" : "Moderate Uphill"}
          </p>
        </div>

        {/* Total Elevation Gain D+ */}
        <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex items-center justify-between">
            <MetricTooltip term="cumulative_gain">
              <span className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700 stroke-[2.5]" />
                Cumulative Gain (D+)
              </span>
            </MetricTooltip>
            <span className="text-[10px] font-mono font-bold text-zinc-500">90 Hari</span>
          </div>
          <div className="text-2xl font-black text-zinc-950 font-mono">
            +{totalGain.toLocaleString()} <span className="text-xs font-normal text-zinc-500">m</span>
          </div>
          <p className="text-[11px] font-medium text-zinc-600">Altimeter barometrik seluruh aktivitas</p>
        </div>

        {/* Total Elevation Loss D- */}
        <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex items-center justify-between">
            <MetricTooltip term="cumulative_loss">
              <span className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
                <ArrowDownRight className="h-3.5 w-3.5 text-rose-700 stroke-[2.5]" />
                Cumulative Loss (D-)
              </span>
            </MetricTooltip>
            <span className="text-[10px] font-mono font-bold text-zinc-500">90 Hari</span>
          </div>
          <div className="text-2xl font-black text-zinc-950 font-mono">
            -{totalLoss.toLocaleString()} <span className="text-xs font-normal text-zinc-500">m</span>
          </div>
          <p className="text-[11px] font-medium text-zinc-600">Beban eksentrik turunan (Quad Armor)</p>
        </div>
      </div>

      {/* Interactive Custom Trail Race Predictor & ITRA Km-Effort */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 space-y-5 shadow-[4px_4px_0px_0px_#09090b]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-600 stroke-[2.5]" />
            <h4 className="text-sm font-black text-zinc-950">Custom Trail Race Finish Estimator & ITRA Calculator</h4>
          </div>
          <span className="text-[11px] text-zinc-600 font-mono font-bold">
            VAM ({avgVam} m/h) • Minetti Energetic Model
          </span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-2 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-700 font-bold">Race Distance</span>
              <span className="font-black text-zinc-950 font-mono text-sm">{raceDistance} km</span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={1}
              value={raceDistance}
              onChange={(e) => setRaceDistance(Number(e.target.value))}
              className="w-full accent-cyan-600 cursor-pointer h-2 bg-zinc-200 rounded-lg border border-zinc-950"
            />
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-2 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-700 font-bold">Total Elevation Gain (D+)</span>
              <span className="font-black text-zinc-950 font-mono text-sm">+{raceElevation} m</span>
            </div>
            <input
              type="range"
              min={100}
              max={6000}
              step={50}
              value={raceElevation}
              onChange={(e) => setRaceElevation(Number(e.target.value))}
              className="w-full accent-cyan-600 cursor-pointer h-2 bg-zinc-200 rounded-lg border border-zinc-950"
            />
          </div>
        </div>

        {/* Prediction Results Banner */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-cyan-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Clock className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] text-zinc-600 block font-bold uppercase tracking-wider">Estimated Finish Time</span>
              <div className="text-3xl font-black text-cyan-800 font-mono tracking-tight">
                {prediction.formattedTime}
              </div>
            </div>
          </div>

          {/* ITRA & Climb Profile Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono pt-3 lg:pt-0 border-t-2 lg:border-t-0 lg:border-l-2 border-zinc-200 lg:pl-5">
            <div className="flex flex-col justify-between">
              <MetricTooltip term="km_effort" className="w-fit mb-1">
                <span className="text-[10px] font-sans font-bold text-zinc-600">ITRA Km-Effort</span>
              </MetricTooltip>
              <div className="text-emerald-700 font-black text-base">
                {kmEffort} <span className="text-[10px] font-normal">km-eff</span>
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <span className="text-[10px] font-sans font-bold text-zinc-600 mb-1 block">Avg Trail Pace</span>
              <div className="text-zinc-950 font-black text-base">{prediction.avgPaceMinPerKm}</div>
            </div>
            <div className="flex flex-col justify-between">
              <span className="text-[10px] font-sans font-bold text-zinc-600 mb-1 block">Climb Split</span>
              <div className="text-zinc-950 font-black text-base">{prediction.uphillHours} hrs</div>
            </div>
            <div className="flex flex-col justify-between">
              <MetricTooltip term="climb_density" className="w-fit mb-1">
                <span className="text-[10px] font-sans font-bold text-zinc-600">Climb Density</span>
              </MetricTooltip>
              <div className="text-amber-700 font-black text-base">
                {climbDensity.density} <span className="text-[10px] font-normal">m/km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Climb Density Badge & Desc */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-xs shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex items-center gap-2 min-w-0">
            <Mountain className="h-4 w-4 text-zinc-950 stroke-[2.5] shrink-0" />
            <span className="text-zinc-900 font-bold leading-snug">{climbDensity.description}</span>
          </div>
          <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-black border-2 border-zinc-950 bg-cyan-200 text-cyan-950 shrink-0 whitespace-nowrap shadow-[1px_1px_0px_0px_#09090b]">
            {climbDensity.category}
          </span>
        </div>

        {/* Recommended Training Mileage & Vert Targets (Jason Koop & Kilian Jornet) */}
        <div className="p-5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-4 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-zinc-950">
              <Calendar className="h-4 w-4 text-emerald-700 stroke-[2.5]" />
              <span>Target Latihan Persiapan Lomba ({raceDistance}k / +{raceElevation}m D+)</span>
            </div>

            {/* Tier Switcher: Finisher vs Elite */}
            <div className="flex items-center bg-zinc-200 p-1 rounded-xl border-2 border-zinc-950 self-start sm:self-auto text-[11px]">
              <button
                onClick={() => setTrainingTier("finisher")}
                className={`px-3 py-1 rounded-lg font-black transition-all ${
                  trainingTier === "finisher"
                    ? "bg-emerald-400 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                    : "text-zinc-700 hover:text-zinc-950"
                }`}
              >
                🏃 Finisher (Realistis)
              </button>
              <button
                onClick={() => setTrainingTier("elite")}
                className={`px-3 py-1 rounded-lg font-black transition-all ${
                  trainingTier === "elite"
                    ? "bg-rose-400 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                    : "text-zinc-700 hover:text-zinc-950"
                }`}
              >
                🏔️ Elite / Pro Podium
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
            {/* Weekly Mileage */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border-2 border-zinc-950 flex flex-col justify-between shadow-[2px_2px_0px_0px_#09090b] min-w-0">
              <div>
                <span className="text-[10px] text-zinc-500 block font-sans font-bold uppercase tracking-wider">
                  Weekly Mileage
                </span>
                <div className="text-sm sm:text-base font-black text-zinc-950 font-mono leading-tight mt-1">
                  {prepTargets.peakWeeklyKmMin}–{prepTargets.peakWeeklyKmMax}{" "}
                  <span className="text-[11px] font-bold text-zinc-500 font-sans">km/wk</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-600 font-sans font-medium mt-2 leading-snug">
                {trainingTier === "finisher" ? "Volume aman pelari pekerja" : "Volume puncak atlet pro"}
              </p>
            </div>

            {/* Weekly Elevation */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border-2 border-zinc-950 flex flex-col justify-between shadow-[2px_2px_0px_0px_#09090b] min-w-0">
              <div>
                <span className="text-[10px] text-zinc-500 block font-sans font-bold uppercase tracking-wider">
                  Weekly Vert (D+)
                </span>
                <div className="text-sm sm:text-base font-black text-emerald-700 font-mono leading-tight mt-1">
                  +{prepTargets.minWeeklyVertTarget.toLocaleString()}–{prepTargets.maxWeeklyVertTarget.toLocaleString()}{" "}
                  <span className="text-[11px] font-bold text-emerald-600 font-sans">m/wk</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-600 font-sans font-medium mt-2 leading-snug">
                {trainingTier === "finisher" ? "Fokus Back-to-Back weekend" : "75% - 110% dari total D+ race"}
              </p>
            </div>

            {/* Monthly Elevation */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border-2 border-zinc-950 flex flex-col justify-between shadow-[2px_2px_0px_0px_#09090b] min-w-0">
              <div>
                <span className="text-[10px] text-zinc-500 block font-sans font-bold uppercase tracking-wider">
                  Monthly Vert (D+)
                </span>
                <div className="text-sm sm:text-base font-black text-cyan-700 font-mono leading-tight mt-1">
                  +{prepTargets.monthlyVertMin.toLocaleString()}–{prepTargets.monthlyVertMax.toLocaleString()}{" "}
                  <span className="text-[11px] font-bold text-cyan-600 font-sans">m/mo</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-600 font-sans font-medium mt-2 leading-snug">
                Beban vertikal per bulan
              </p>
            </div>

            {/* Key Long Run Simulation */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border-2 border-zinc-950 flex flex-col justify-between shadow-[2px_2px_0px_0px_#09090b] min-w-0">
              <div>
                <span className="text-[10px] text-zinc-500 block font-sans font-bold uppercase tracking-wider">
                  Key Long Run
                </span>
                <div className="text-sm sm:text-base font-black text-amber-700 font-mono leading-tight mt-1">
                  {prepTargets.keyLongRunKm}k{" "}
                  <span className="text-[11px] font-bold text-amber-600 font-sans">(+{prepTargets.keyLongRunVertM}m)</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-600 font-sans font-medium mt-2 leading-snug">
                Lari simulasi terpanjang
              </p>
            </div>
          </div>

          {/* Coaching Methodology Tip */}
          <div className="p-3 rounded-xl bg-white border-2 border-zinc-950 text-[11px] text-zinc-800 leading-relaxed flex items-start gap-2.5 shadow-[1.5px_1.5px_0px_0px_#09090b] font-medium">
            <Sparkles className="h-4 w-4 text-amber-600 stroke-[2.5] shrink-0 mt-0.5" />
            <span>{prepTargets.methodologyTip}</span>
          </div>
        </div>

        {/* Interactive Ultra Fueling & Hydration Plan (Jeukendrup / Costa 2019) */}
        <div className="p-5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-4 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black text-zinc-950">
              <Apple className="h-4 w-4 text-orange-600 stroke-[2.5]" />
              <span>Scientific Trail Fueling & Hydration Plan</span>
            </div>
            <span className="text-[10px] text-zinc-600 font-mono font-bold">Jeukendrup & Costa Model</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Carbohydrates / Gels */}
            <div className="p-3.5 rounded-xl bg-white border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
              <div className="flex items-center justify-between text-xs text-orange-700 font-black">
                <span className="flex items-center gap-1"><Zap className="h-3 w-3 stroke-[2.5]" /> Carbs Strategy</span>
                <span className="text-[10px] font-mono font-bold text-zinc-500">{fuelingPlan.carbsPerHourGrams}g/hr</span>
              </div>
              <div className="text-2xl font-black text-zinc-950 font-mono">
                {fuelingPlan.totalCarbsGrams}g <span className="text-xs font-normal text-zinc-500">total</span>
              </div>
              <p className="text-[10px] text-zinc-600 font-medium">Target: ~{fuelingPlan.energyGelsCount} Energy Gels ({Math.round(fuelingPlan.totalHours * 10) / 10} hrs)</p>
            </div>

            {/* Hydration / Water */}
            <div className="p-3.5 rounded-xl bg-white border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
              <div className="flex items-center justify-between text-xs text-cyan-700 font-black">
                <span className="flex items-center gap-1"><Droplets className="h-3 w-3 stroke-[2.5]" /> Fluid Volume</span>
                <span className="text-[10px] font-mono font-bold text-zinc-500">{fuelingPlan.waterPerHourMl}ml/hr</span>
              </div>
              <div className="text-2xl font-black text-zinc-950 font-mono">
                {fuelingPlan.totalWaterLiters}L <span className="text-xs font-normal text-zinc-500">hydration</span>
              </div>
              <p className="text-[10px] text-zinc-600 font-medium">Sip 150ml every 15 mins to maintain plasma volume</p>
            </div>

            {/* Electrolytes / Sodium */}
            <div className="p-3.5 rounded-xl bg-white border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
              <div className="flex items-center justify-between text-xs text-emerald-700 font-black">
                <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 stroke-[2.5]" /> Sodium / Salt</span>
                <span className="text-[10px] font-mono font-bold text-zinc-500">{fuelingPlan.sodiumPerHourMg}mg/hr</span>
              </div>
              <div className="text-2xl font-black text-zinc-950 font-mono">
                {fuelingPlan.totalSodiumMg}mg <span className="text-xs font-normal text-zinc-500">sodium</span>
              </div>
              <p className="text-[10px] text-zinc-600 font-medium">~{fuelingPlan.saltCapsulesCount} Salt capsules (Prevents cramp & hyponatremia)</p>
            </div>
          </div>
        </div>

        {/* Kilian Jornet & Uphill Athlete Aerobic Deficiency Syndrome (ADS) Diagnostic */}
        <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-2.5 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-zinc-950 min-w-0">
              <Activity className="h-4 w-4 text-cyan-600 stroke-[2.5] shrink-0" />
              <span>Training for the Uphill Athlete: Aerobic Base Diagnostic</span>
            </div>
            <span className="self-start sm:self-auto text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-300 text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] whitespace-nowrap shrink-0">
              No ADS Detected • Robust Base
            </span>
          </div>
          <p className="text-xs text-zinc-700 leading-relaxed font-medium">
            Scott Johnston & Kilian Jornet Field Test: With historical <strong className="text-zinc-950 font-black">Decoupling at 2.5%</strong> (&lt;3.5% drift threshold), your fat oxidation metabolism is fully developed. Your aerobic threshold (AeT) operates close to your lactate threshold, allowing sustained power-hiking on steep ascents without depleting glycogen stores prematurely.
          </p>
        </div>

        {hasHighDescentPenalty && (
          <div className="flex items-start gap-2.5 text-xs text-amber-950 bg-amber-100 border-2 border-zinc-950 p-3.5 rounded-xl shadow-[2px_2px_0px_0px_#09090b] font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 stroke-[2.5]" />
            <span>
              <strong className="font-black text-zinc-950">High Descent Muscle Trauma ({raceElevation}m D-):</strong> As shown by Millet et al. (UTMB neuromuscular study), downhill slopes &gt;1,500m cause significant eccentric sarcolemma micro-damage. Moderate early downhill speed to preserve quads for the final climbs.
            </span>
          </div>
        )}
      </div>

      {/* Feature B: Climbing & Descent Efficiency Analysis (VAM vs Gradient & Hike vs Run) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 space-y-5 shadow-[4px_4px_0px_0px_#09090b]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-950 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Footprints className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm sm:text-base font-black text-zinc-950">
                  Climbing & Descent Efficiency (VAM vs Gradient)
                </h4>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-300 text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] whitespace-nowrap shrink-0">
                  Hike vs Run Breakeven
                </span>
              </div>
              <p className="text-xs text-zinc-600 font-medium">
                Analisis titik temu transisi kemiringan (gradient %) antara lari vs power-hiking berdasarkan model Minetti & Joubert 2022
              </p>
            </div>
          </div>

          {/* Breakeven Sweet Spot Badge */}
          <div className="p-2.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-right shrink-0 shadow-[2px_2px_0px_0px_#09090b]">
            <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">
              Walk-Run Breakeven
            </span>
            <div className="text-sm sm:text-base font-black text-zinc-950 font-mono">
              {efficiencyAnalysis.breakevenGradientPct}% Kemiringan
            </div>
          </div>
        </div>

        {/* Executive Summary Alert */}
        <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-zinc-950 text-xs text-zinc-800 leading-relaxed font-medium flex items-start gap-2.5 shadow-[2px_2px_0px_0px_#09090b]">
          <Sparkles className="h-4 w-4 text-amber-600 stroke-[2.5] shrink-0 mt-0.5" />
          <div>
            <strong className="font-black text-zinc-950">Pedoman Taktis: </strong>
            {efficiencyAnalysis.executiveSummary}
          </div>
        </div>

        {/* Interactive Gradient Explorer */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-4 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-zinc-950 flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-zinc-950 stroke-[2.5]" />
                Simulasi Kemiringan Tanjakan / Turunan Real-Time
              </span>
              <p className="text-[11px] text-zinc-600 font-medium">
                Geser slider untuk melihat apakah lebih cepat & hemat lari atau power-hiking di kemiringan ini
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-white border-2 border-zinc-950 font-mono font-black text-sm text-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                {selectedGradient > 0 ? `+${selectedGradient}%` : `${selectedGradient}%`} Gradient
              </span>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-black border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] ${
                  activePoint.optimalStrategy === "run"
                    ? "bg-emerald-300 text-zinc-950"
                    : activePoint.optimalStrategy === "transition"
                    ? "bg-amber-300 text-zinc-950"
                    : activePoint.optimalStrategy === "power_hike" || activePoint.optimalStrategy === "poles_mandatory"
                    ? "bg-orange-300 text-zinc-950"
                    : "bg-cyan-300 text-zinc-950"
                }`}
              >
                {activePoint.strategyLabel}
              </span>
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min={-25}
              max={35}
              step={1}
              value={selectedGradient}
              onChange={(e) => setSelectedGradient(Number(e.target.value))}
              className="w-full accent-amber-600 cursor-pointer h-2.5 bg-zinc-200 rounded-lg border border-zinc-950"
            />
            {/* Desktop slider tick labels */}
            <div className="hidden sm:flex justify-between text-[10px] font-mono text-zinc-500 font-bold px-1">
              <span>-25% (Turunan Curam)</span>
              <span>-10%</span>
              <span className="text-zinc-950 font-black">0% (Datar)</span>
              <span className="text-amber-700 font-black">+{efficiencyAnalysis.breakevenGradientPct}% (Breakeven)</span>
              <span>+20%</span>
              <span>+35% (Ekstrem)</span>
            </div>
            {/* Mobile compact slider tick labels */}
            <div className="flex sm:hidden justify-between text-[10px] font-mono text-zinc-500 font-bold px-1">
              <span>-25% (Curam)</span>
              <span className="text-zinc-950 font-black">0% (Datar)</span>
              <span className="text-amber-700 font-black">+{efficiencyAnalysis.breakevenGradientPct}% (Hike)</span>
              <span>+35%</span>
            </div>
          </div>

          {/* Real-time Metric Cards for Selected Gradient */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-0.5">
              <span className="text-[10px] text-zinc-600 block font-bold">Kecepatan Vertikal (VAM)</span>
              <div className="text-base font-black text-zinc-950 font-mono">
                {selectedGradient >= 0 ? `${activePoint.hikeVam} m/h` : `${Math.abs(activePoint.runVam)} m/h (D-)`}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                {selectedGradient >= 0 ? `Lari: ${activePoint.runVam} m/h` : "Laju penurunan"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-0.5">
              <span className="text-[10px] text-zinc-600 block font-bold">Kecepatan & Pace Datar</span>
              <div className="text-base font-black text-zinc-950 font-mono">
                {selectedGradient >= 0 ? activePoint.hikePaceStr : activePoint.runPaceStr}
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                {selectedGradient >= 0 ? `${activePoint.hikeSpeedKmh} km/h` : `${activePoint.runSpeedKmh} km/h`}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-0.5">
              <span className="text-[10px] text-zinc-600 block font-bold">Grade-Adjusted Pace (GAP)</span>
              <div className="text-base font-black text-cyan-700 font-mono">
                {activePoint.gapPaceStr}
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">Usaha setara flat</p>
            </div>

            <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] space-y-0.5">
              <span className="text-[10px] text-zinc-600 block font-bold">Efisiensi / Hemat Glikogen</span>
              <div className="text-base font-black text-amber-700 font-mono">
                {activePoint.glycogenSavingsPct > 0 ? `+${activePoint.glycogenSavingsPct}% Lebih Hemat` : "Netral"}
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">
                {activePoint.glycogenSavingsPct > 0 ? "Bila power-hiking" : "Lari efisien"}
              </p>
            </div>
          </div>

          {/* Live Tactical Tip for Selected Gradient */}
          <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 text-xs text-zinc-800 font-medium flex items-start gap-2 shadow-[1px_1px_0px_0px_#09090b]">
            <Info className="h-4 w-4 text-zinc-950 shrink-0 mt-0.5" />
            <div>
              <span className="font-black text-zinc-950">Rekomendasi Taktis ({selectedGradient}%): </span>
              <span>{activePoint.tacticalTip}</span>
            </div>
          </div>
        </div>

        {/* Dual-Curve Chart: Running VAM vs Power-Hiking VAM */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-zinc-950 stroke-[2.5]" />
              <span className="text-xs font-black text-zinc-950">
                Kurva Efisiensi: Lari vs Power-Hiking (0% s/d 35% Tanjakan)
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-600 inline-block border-t-2 border-emerald-600"></span>
                <span>Lari (Run VAM)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-600 inline-block border-t-2 border-amber-600"></span>
                <span>Power-Hike VAM</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-amber-100 border border-amber-400 inline-block rounded"></span>
                <span>Zona Transisi</span>
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis
                  dataKey="gradient"
                  tick={{ fontSize: 11, fontWeight: 700, fill: "#27272a" }}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fontWeight: 700, fill: "#27272a" }}
                  unit=" m/h"
                  domain={[0, "auto"]}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-white border-2 border-zinc-950 rounded-xl shadow-[3px_3px_0px_0px_#09090b] text-xs space-y-1 font-mono">
                          <div className="font-black text-zinc-950 border-b border-zinc-200 pb-1 flex justify-between gap-4">
                            <span>Kemiringan: {data.gradient}</span>
                            <span className="text-amber-600">{data.strategy}</span>
                          </div>
                          <div className="text-emerald-700 font-bold">
                            🏃 Running VAM: {data.runVam} m/h ({data.runPace})
                          </div>
                          <div className="text-amber-700 font-bold">
                            🥾 Hiking VAM: {data.hikeVam} m/h ({data.hikePace})
                          </div>
                          {data.savingsPct > 0 && (
                            <div className="text-zinc-700 text-[10px] font-sans font-bold pt-0.5">
                              ⚡ Hemat Glikogen: +{data.savingsPct}% dengan jalan
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Highlight Walk-Run Transition Zone (9% to 15%) */}
                <ReferenceArea
                  x1="9%"
                  x2="15%"
                  fill="#fef3c7"
                  fillOpacity={0.6}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                />
                <ReferenceLine
                  x="12%"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: "Breakeven (~11.5%)",
                    position: "top",
                    fill: "#92400e",
                    fontSize: 10,
                    fontWeight: "bold",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="runVam"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#059669", stroke: "#09090b", strokeWidth: 1 }}
                  name="Run VAM"
                />
                <Line
                  type="monotone"
                  dataKey="hikeVam"
                  stroke="#d97706"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#d97706", stroke: "#09090b", strokeWidth: 1 }}
                  name="Hike VAM"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tactical Decision Matrix (4 Core Gradient Rules) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Card 1: 0-8% */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1.5 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-emerald-200 text-emerald-950 border border-zinc-950">
                0% s/d 8% Tanjakan
              </span>
              <span className="text-[10px] font-bold text-zinc-500">Pure Run</span>
            </div>
            <div className="text-xs font-black text-zinc-950">Lari Aerobik Mengalir</div>
            <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
              Manfaatkan elastisitas tendon achilles. Lari menghasilkan VAM lebih tinggi (350–500 m/h) dibanding jalan santai.
            </p>
          </div>

          {/* Card 2: 9-14% */}
          <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-zinc-950 space-y-1.5 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-amber-300 text-zinc-950 border border-zinc-950">
                9% s/d 14% Tanjakan
              </span>
              <span className="text-[10px] font-bold text-amber-700 font-mono">Breakeven</span>
            </div>
            <div className="text-xs font-black text-zinc-950">Zona Transisi Kritis</div>
            <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
              Kecepatan lari dan power-hiking setara (~540 m/h), tapi power-hiking menghemat <strong>~18% glikogen</strong> dan menurunkan detak jantung 10 bpm!
            </p>
          </div>

          {/* Card 3: 15-30% */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1.5 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-orange-200 text-orange-950 border border-zinc-950">
                15% s/d 30%+ Tanjakan
              </span>
              <span className="text-[10px] font-bold text-orange-700 font-mono">Poles Mode</span>
            </div>
            <div className="text-xs font-black text-zinc-950">Power-Hiking & Poles</div>
            <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
              Jangan paksakan lari! Dorong tangan di paha (hands-on-knees) atau trekking pole. Otot gluteus & hamstring menghasilkan torsi pendakian tertinggi.
            </p>
          </div>

          {/* Card 4: Descents */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1.5 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-cyan-200 text-cyan-950 border border-zinc-950">
                -10% s/d -25% Turunan
              </span>
              <span className="text-[10px] font-bold text-rose-700 font-mono">Quad Armor</span>
            </div>
            <div className="text-xs font-black text-zinc-950">Rem Paha & Kecepatan</div>
            <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
              Turunan terjal memberi beban eksentrik berat. Pendekkan langkah kaki, hindari over-striding, dan gunakan pole untuk menyerap tumbukan lutut.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Kilian Jornet Weekly Vertical Accumulator & Mountain Specificity */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 space-y-4 shadow-[4px_4px_0px_0px_#09090b]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-700 stroke-[2.5]" />
            <div>
              <h4 className="text-sm font-black text-zinc-950">Weekly Vertical Accumulator & Mountain Specificity</h4>
              <p className="text-[11px] font-medium text-zinc-600">
                {vertWindow === "this_week"
                  ? "Minggu ini (Senin s/d Sekarang): 2 sesi road di Lombok Tengah (+120m D+)"
                  : "7 Hari Bergulir: Termasuk 2 sesi Lombok Barat Trail (+1.152m D+)"}
              </p>
            </div>
          </div>

          {/* Time Window Switcher */}
          <div className="flex items-center bg-zinc-200 p-1 rounded-xl border-2 border-zinc-950 self-start sm:self-auto">
            <button
              onClick={() => setVertWindow("this_week")}
              className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                vertWindow === "this_week"
                  ? "bg-emerald-400 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  : "text-zinc-700 hover:text-zinc-950"
              }`}
            >
              Minggu Ini (Senin-Kms)
            </button>
            <button
              onClick={() => setVertWindow("rolling_7d")}
              className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                vertWindow === "rolling_7d"
                  ? "bg-cyan-400 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  : "text-zinc-700 hover:text-zinc-950"
              }`}
            >
              7 Hari Terakhir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-700 font-bold">Vertical Gain Terkumpul</span>
              <span className="font-mono font-black text-zinc-950">
                +{currentGain}m / {weeklyVertTarget}m target ({currentDist} km)
              </span>
            </div>
            <div className="h-4 w-full bg-zinc-100 rounded-full overflow-hidden border-2 border-zinc-950">
              <div
                className="h-full bg-emerald-400 border-r-2 border-zinc-950 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (currentGain / weeklyVertTarget) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 pt-0.5 font-mono font-bold">
              <span>{Math.round((currentGain / weeklyVertTarget) * 100)}% of target tercapai</span>
              <span>Target: {weeklyVertTarget}m D+</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center justify-between text-[10px] text-zinc-600 font-bold">
              <span>Mountain Specificity</span>
              <span className="font-black text-cyan-800">
                {vertWindow === "this_week" ? "Road Base" : "Trail & Road"}
              </span>
            </div>
            <div className="text-2xl font-black text-zinc-950 font-mono">
              {currentDensity} <span className="text-xs font-normal text-zinc-500">m D+ / km</span>
            </div>
            <p className="text-[10px] text-zinc-600 font-medium">
              {vertWindow === "this_week"
                ? "Dominan lari aspal datar (6 m/km). Khusus rute trail: 85 m/km."
                : "Kombinasi lari aspal dan 2 sesi trail Lombok Barat (+972m D+)."}
            </p>
          </div>
        </div>

        {/* Target Slider */}
        <div className="pt-3 border-t-2 border-zinc-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-700 font-bold">Atur Target D+ Mingguan:</span>
            <button
              onClick={() => setWeeklyVertTarget(prepTargets.minWeeklyVertTarget)}
              className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold font-mono underline cursor-pointer"
            >
              Samakan dengan Rekomendasi Race (+{prepTargets.minWeeklyVertTarget}m)
            </button>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={250}
              max={3500}
              step={250}
              value={weeklyVertTarget}
              onChange={(e) => setWeeklyVertTarget(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-zinc-200 rounded-lg border border-zinc-950"
            />
            <span className="text-xs font-mono font-black text-zinc-950 shrink-0">{weeklyVertTarget}m</span>
          </div>
        </div>
      </div>

      {/* 2. Mountain Muscular Endurance (ME) & Quad Armor Matrix (Kilian Jornet Chapter 8) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 space-y-3 shadow-[4px_4px_0px_0px_#09090b]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-orange-600 stroke-[2.5]" />
            <h4 className="text-sm font-black text-zinc-950">Mountain Muscular Endurance & Quad Armor Matrix</h4>
          </div>
          <span className="text-[10px] text-zinc-600 font-mono font-bold">Uphill Athlete Chap. 8</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center gap-1.5 text-xs font-black text-orange-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-orange-600 stroke-[2.5]" />
              <span>Uphill Weighted ME</span>
            </div>
            <p className="text-[11px] text-zinc-700 font-medium">Hill hike with 8-10% bodyweight pack on 20% slope (4x6 min).</p>
            <span className="text-[10px] text-zinc-500 block font-mono font-bold pt-1">Builds climbing torque</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 stroke-[2.5]" />
              <span>Downhill Quad Armor</span>
            </div>
            <p className="text-[11px] text-zinc-700 font-medium">Box step-downs, reverse Nordics, & tempo downhill bounding.</p>
            <span className="text-[10px] text-zinc-500 block font-mono font-bold pt-1">Prevents quad blowouts</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center gap-1.5 text-xs font-black text-cyan-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-600 stroke-[2.5]" />
              <span>Power-Hiking Drive</span>
            </div>
            <p className="text-[11px] text-zinc-700 font-medium">Hand-to-knee or trekking pole drive at &gt;16% gradient (Joubert 2022).</p>
            <span className="text-[10px] text-zinc-500 block font-mono font-bold pt-1">Saves 18% glycogen</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 stroke-[2.5]" />
              <span>Vertical KM (VK) Test</span>
            </div>
            <p className="text-[11px] text-zinc-700 font-medium">Time-trial 1,000m D+ ascent every 6 weeks to calibrate real VAM.</p>
            <span className="text-[10px] text-zinc-500 block font-mono font-bold pt-1">Current VAM: {avgVam} m/h</span>
          </div>
        </div>
      </div>

      {/* 3. Launch Dedicated GPX Course & COT Simulator CTA Banner */}
      <Link
        href="/trail-planner"
        className="p-5 rounded-2xl bg-cyan-100 border-2 border-zinc-950 hover:bg-cyan-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all shadow-[4px_4px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_#09090b]"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-zinc-950 font-black text-sm">
            <Compass className="h-4 w-4 stroke-[2.5] shrink-0" />
            <span>Dedicated GPX Course & Checkpoint Cut-Off Time (COT) Simulator</span>
            <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-white text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
              Interactive Tool
            </span>
          </div>
          <p className="text-xs text-zinc-800 font-medium leading-relaxed">
            Unggah file .gpx rute Anda atau pilih profil lomba gunung Indonesia (Rinjani 100, Siksorogo Lawu, MesaStila, Goat Run). Analisis elevasi, estimasi tiba di setiap pos/Water Station (WS), dan buffer Cut-Off Time (COT) berdasarkan VAM nyata Anda!
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-400 border-2 border-zinc-950 text-zinc-950 font-black text-xs shrink-0 transition-all group-hover:bg-cyan-300 shadow-[2px_2px_0px_0px_#09090b]">
          <span>Buka GPX Planner</span>
          <ArrowRight className="h-4 w-4 stroke-[2.5]" />
        </div>
      </Link>
    </div>
  );
};
