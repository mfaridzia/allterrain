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
} from "lucide-react";
import { MetricTooltip } from "@/components/MetricTooltip";
import {
  estimateTrailRaceFinishTime,
  calculateKmEffort,
  calculateTrailFuelingPlan,
  classifyClimbDensity,
  calculateRacePreparationVolume,
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
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trailTargetRaceDist: raceDistance,
          trailTargetRaceElev: raceElevation,
          trailWeeklyVertTarget: weeklyVertTarget,
          trailTrainingTier: trainingTier,
        }),
      }).catch(() => {});
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

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-6 shadow-xl backdrop-blur-sm">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Mountain className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Trail & Mountain Running Suite
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-700/60">
                Uphill Athlete & ITRA
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              VAM Climbing Efficiency • ITRA Km-Effort • Kilian Jornet Vertical Metrics • Ultra Fueling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 font-mono text-[11px]">
            {trailActivitiesCount} Trail sessions logged
          </span>
        </div>
      </div>

      {/* Mountain KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* VAM Card */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="vam">
              <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5" />
                Ascent Rate (VAM)
              </span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-400">Average</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {avgVam} <span className="text-xs font-normal text-zinc-400">m/h</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            {avgVam > 700 ? "Elite Mountain Climbing" : avgVam > 500 ? "Strong Uphill Base" : "Moderate Uphill"}
          </p>
        </div>

        {/* Total Elevation Gain D+ */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="cumulative_gain">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Cumulative Gain (D+)
              </span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-400 font-mono">90 Hari</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            +{totalGain.toLocaleString()} <span className="text-xs font-normal text-zinc-400">m</span>
          </div>
          <p className="text-[11px] text-zinc-400">Altimeter barometrik seluruh aktivitas</p>
        </div>

        {/* Total Elevation Loss D- */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="cumulative_loss">
              <span className="text-xs font-semibold text-rose-400 flex items-center gap-1">
                <ArrowDownRight className="h-3.5 w-3.5" />
                Cumulative Loss (D-)
              </span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-400 font-mono">90 Hari</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            -{totalLoss.toLocaleString()} <span className="text-xs font-normal text-zinc-400">m</span>
          </div>
          <p className="text-[11px] text-zinc-400">Beban eksentrik turunan (Quad Armor)</p>
        </div>
      </div>

      {/* Interactive Custom Trail Race Predictor & ITRA Km-Effort */}
      <div className="p-5 rounded-xl bg-zinc-950/80 border border-cyan-900/40 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-zinc-200">Custom Trail Race Finish Estimator & ITRA Calculator</h4>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            VAM ({avgVam} m/h) • Minetti Energetic Model
          </span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400 font-medium">Race Distance</span>
              <span className="font-bold text-white font-mono text-sm">{raceDistance} km</span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={1}
              value={raceDistance}
              onChange={(e) => setRaceDistance(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-zinc-800 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400 font-medium">Total Elevation Gain (D+)</span>
              <span className="font-bold text-white font-mono text-sm">+{raceElevation} m</span>
            </div>
            <input
              type="range"
              min={100}
              max={6000}
              step={50}
              value={raceElevation}
              onChange={(e) => setRaceElevation(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-zinc-800 rounded-lg"
            />
          </div>
        </div>

        {/* Prediction Results Banner */}
        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] text-zinc-400 block font-medium">Estimated Finish Time</span>
              <div className="text-2xl font-black text-cyan-300 font-mono tracking-tight">
                {prediction.formattedTime}
              </div>
            </div>
          </div>

          {/* ITRA & Climb Profile Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono pt-2 lg:pt-0 border-t lg:border-t-0 lg:border-l border-zinc-800 lg:pl-5">
            <div className="flex flex-col justify-between">
              <MetricTooltip term="km_effort" className="w-fit mb-1">
                <span className="text-[10px] text-zinc-400">ITRA Km-Effort</span>
              </MetricTooltip>
              <div className="text-emerald-400 font-extrabold text-sm">
                {kmEffort} <span className="text-[10px] font-normal">km-eff</span>
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <span className="text-[10px] text-zinc-400 mb-1 block">Avg Trail Pace</span>
              <div className="text-zinc-200 font-bold text-sm">{prediction.avgPaceMinPerKm}</div>
            </div>
            <div className="flex flex-col justify-between">
              <span className="text-[10px] text-zinc-400 mb-1 block">Climb Split</span>
              <div className="text-zinc-200 font-bold text-sm">{prediction.uphillHours} hrs</div>
            </div>
            <div className="flex flex-col justify-between">
              <MetricTooltip term="climb_density" className="w-fit mb-1">
                <span className="text-[10px] text-zinc-400">Climb Density</span>
              </MetricTooltip>
              <div className="text-amber-300 font-bold text-sm">
                {climbDensity.density} <span className="text-[10px] font-normal">m/km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Climb Density Badge & Desc */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2">
            <Mountain className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="text-zinc-300 font-medium">{climbDensity.description}</span>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 whitespace-nowrap ${climbDensity.badgeColor}`}>
            {climbDensity.category}
          </span>
        </div>

        {/* Recommended Training Mileage & Vert Targets (Jason Koop & Kilian Jornet) */}
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-emerald-900/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <Calendar className="h-4 w-4 text-emerald-400" />
              <span>Target Latihan Persiapan Lomba ({raceDistance}k / +{raceElevation}m D+)</span>
            </div>

            {/* Tier Switcher: Finisher vs Elite */}
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto text-[11px]">
              <button
                onClick={() => setTrainingTier("finisher")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  trainingTier === "finisher"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                🏃 Finisher (Realistis)
              </button>
              <button
                onClick={() => setTrainingTier("elite")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  trainingTier === "elite"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                🏔️ Elite / Pro Podium
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
            {/* Weekly Mileage */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-0.5">
              <span className="text-[10px] text-zinc-400 block font-sans">Target Weekly Mileage</span>
              <div className="text-base font-extrabold text-white">
                {prepTargets.peakWeeklyKmRange}
              </div>
              <p className="text-[10px] text-zinc-400 font-sans">
                {trainingTier === "finisher" ? "Volume aman pelari pekerja" : "Volume puncak atlet pro"}
              </p>
            </div>

            {/* Weekly Elevation */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-0.5">
              <span className="text-[10px] text-zinc-400 block font-sans">Target Weekly Vert (D+)</span>
              <div className="text-base font-extrabold text-emerald-400">
                {prepTargets.peakWeeklyVertRange}
              </div>
              <p className="text-[10px] text-zinc-400 font-sans">
                {trainingTier === "finisher" ? "Fokus Back-to-Back weekend" : "75% - 110% dari total D+ race"}
              </p>
            </div>

            {/* Monthly Elevation */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-0.5">
              <span className="text-[10px] text-zinc-400 block font-sans">Target Monthly Vert (D+)</span>
              <div className="text-base font-extrabold text-cyan-400">
                {prepTargets.monthlyVertRange}
              </div>
              <p className="text-[10px] text-zinc-400 font-sans">Beban vertikal per bulan</p>
            </div>

            {/* Key Long Run Simulation */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-0.5">
              <span className="text-[10px] text-zinc-400 block font-sans">Key Long Run Simulation</span>
              <div className="text-base font-extrabold text-amber-300">
                {prepTargets.keyLongRunKm}k (+{prepTargets.keyLongRunVertM}m)
              </div>
              <p className="text-[10px] text-zinc-400 font-sans">Lari simulasi terpanjang</p>
            </div>
          </div>

          {/* Coaching Methodology Tip */}
          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-[11px] text-zinc-300 leading-relaxed flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{prepTargets.methodologyTip}</span>
          </div>
        </div>

        {/* Interactive Ultra Fueling & Hydration Plan (Jeukendrup / Costa 2019) */}
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <Apple className="h-4 w-4 text-orange-400" />
              <span>Scientific Trail Fueling & Hydration Plan</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">Jeukendrup (2014) & Costa (2019)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Carbohydrates / Gels */}
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/90 space-y-1">
              <div className="flex items-center justify-between text-xs text-orange-400 font-medium">
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Carbs Strategy</span>
                <span className="text-[10px] text-zinc-400 font-mono">{fuelingPlan.carbsPerHourGrams}g/hr</span>
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {fuelingPlan.totalCarbsGrams}g <span className="text-xs font-normal text-zinc-400">total</span>
              </div>
              <p className="text-[10px] text-zinc-400">Target: ~{fuelingPlan.energyGelsCount} Energy Gels ({Math.round(fuelingPlan.totalHours * 10) / 10} hrs)</p>
            </div>

            {/* Hydration / Water */}
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/90 space-y-1">
              <div className="flex items-center justify-between text-xs text-blue-400 font-medium">
                <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> Fluid Volume</span>
                <span className="text-[10px] text-zinc-400 font-mono">{fuelingPlan.waterPerHourMl}ml/hr</span>
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {fuelingPlan.totalWaterLiters}L <span className="text-xs font-normal text-zinc-400">hydration</span>
              </div>
              <p className="text-[10px] text-zinc-400">Sip 150ml every 15 mins to maintain plasma volume</p>
            </div>

            {/* Electrolytes / Sodium */}
            <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/90 space-y-1">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
                <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Sodium / Salt</span>
                <span className="text-[10px] text-zinc-400 font-mono">{fuelingPlan.sodiumPerHourMg}mg/hr</span>
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {fuelingPlan.totalSodiumMg}mg <span className="text-xs font-normal text-zinc-400">sodium</span>
              </div>
              <p className="text-[10px] text-zinc-400">~{fuelingPlan.saltCapsulesCount} Salt capsules (Prevents cramp & hyponatremia)</p>
            </div>
          </div>
        </div>

        {/* Kilian Jornet & Uphill Athlete Aerobic Deficiency Syndrome (ADS) Diagnostic */}
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span>Training for the Uphill Athlete: Aerobic Base Diagnostic</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              No ADS Detected • Robust FatMax Base
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Scott Johnston & Kilian Jornet Field Test: With historical <strong className="text-emerald-400">Decoupling at 2.5%</strong> (&lt;3.5% drift threshold), your fat oxidation metabolism is fully developed. Your aerobic threshold (AeT) operates close to your lactate threshold, allowing sustained power-hiking on steep ascents without depleting glycogen stores prematurely.
          </p>
        </div>

        {hasHighDescentPenalty && (
          <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-950/30 border border-amber-800/40 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              <strong>High Descent Muscle Trauma ({raceElevation}m D-):</strong> As shown by Millet et al. (UTMB neuromuscular study), downhill slopes &gt;1,500m cause significant eccentric sarcolemma micro-damage. Moderate early downhill speed to preserve quads for the final climbs.
            </span>
          </div>
        )}
      </div>

      {/* 1. Kilian Jornet Weekly Vertical Accumulator & Mountain Specificity */}
      <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-400" />
            <div>
              <h4 className="text-sm font-bold text-white">Weekly Vertical Accumulator & Mountain Specificity</h4>
              <p className="text-[11px] text-zinc-400">
                {vertWindow === "this_week"
                  ? "Minggu ini (Senin s/d Sekarang): 2 sesi road di Lombok Tengah (+120m D+)"
                  : "7 Hari Bergulir: Termasuk 2 sesi Lombok Barat Trail (+1.152m D+)"}
              </p>
            </div>
          </div>

          {/* Time Window Switcher */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
            <button
              onClick={() => setVertWindow("this_week")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                vertWindow === "this_week"
                  ? "bg-emerald-600 text-white font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Minggu Ini (Senin-Kms)
            </button>
            <button
              onClick={() => setVertWindow("rolling_7d")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                vertWindow === "rolling_7d"
                  ? "bg-cyan-600 text-white font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              7 Hari Terakhir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1 sm:col-span-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Vertical Gain Terkumpul</span>
              <span className="font-mono font-bold text-white">
                +{currentGain}m / {weeklyVertTarget}m target ({currentDist} km)
              </span>
            </div>
            <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (currentGain / weeklyVertTarget) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-400 pt-0.5 font-mono">
              <span>{Math.round((currentGain / weeklyVertTarget) * 100)}% of target tercapai</span>
              <span>Target: {weeklyVertTarget}m D+</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>Mountain Specificity</span>
              <span className="font-bold text-cyan-400">
                {vertWindow === "this_week" ? "Road Base" : "Trail & Road"}
              </span>
            </div>
            <div className="text-xl font-black text-white font-mono">
              {currentDensity} <span className="text-xs font-normal text-zinc-400">m D+ / km</span>
            </div>
            <p className="text-[10px] text-zinc-400">
              {vertWindow === "this_week"
                ? "Dominan lari aspal datar (6 m/km). Khusus rute trail gunung: 85 m/km."
                : "Kombinasi lari aspal dan 2 sesi trail Lombok Barat (+972m D+)."}
            </p>
          </div>
        </div>

        {/* Target Slider */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Atur Target D+ Mingguan:</span>
            <button
              onClick={() => setWeeklyVertTarget(prepTargets.minWeeklyVertTarget)}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-mono cursor-pointer"
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
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
            <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">{weeklyVertTarget}m</span>
          </div>
        </div>
      </div>

      {/* 2. Mountain Muscular Endurance (ME) & Quad Armor Matrix (Kilian Jornet Chapter 8) */}
      <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-orange-400" />
            <h4 className="text-sm font-bold text-white">Mountain Muscular Endurance & Quad Armor Matrix</h4>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">Uphill Athlete Chap. 8</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-orange-400" />
              <span>Uphill Weighted ME</span>
            </div>
            <p className="text-[11px] text-zinc-300">Hill hike with 8-10% bodyweight pack on 20% slope (4x6 min).</p>
            <span className="text-[10px] text-zinc-400 block font-mono pt-1">Builds climbing torque</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Downhill Quad Armor</span>
            </div>
            <p className="text-[11px] text-zinc-300">Box step-downs, reverse Nordics, & tempo downhill bounding.</p>
            <span className="text-[10px] text-zinc-400 block font-mono pt-1">Prevents quad blowouts</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
              <span>Power-Hiking Drive</span>
            </div>
            <p className="text-[11px] text-zinc-300">Hand-to-knee or trekking pole drive at &gt;16% gradient (Joubert 2022).</p>
            <span className="text-[10px] text-zinc-400 block font-mono pt-1">Saves 18% glycogen</span>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
              <span>Vertical KM (VK) Test</span>
            </div>
            <p className="text-[11px] text-zinc-300">Time-trial 1,000m D+ ascent every 6 weeks to calibrate real VAM.</p>
            <span className="text-[10px] text-zinc-400 block font-mono pt-1">Current VAM: {avgVam} m/h</span>
          </div>
        </div>
      </div>

      {/* 3. Launch Dedicated GPX Course & COT Simulator CTA Banner */}
      <Link
        href="/trail-planner"
        className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/80 via-zinc-900 to-zinc-950 border border-cyan-500/40 hover:border-cyan-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all shadow-lg hover:shadow-cyan-500/10"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
            <Compass className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>Dedicated GPX Course & Checkpoint Cut-Off Time (COT) Simulator</span>
            <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded bg-cyan-900/80 text-cyan-300 border border-cyan-700">
              Separate Page
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Unggah file .gpx rute Anda atau pilih profil lomba gunung Indonesia (Rinjani 100, Siksorogo Lawu, MesaStila, Goat Run). Analisis elevasi, estimasi tiba di setiap pos/Water Station (WS), dan buffer Cut-Off Time (COT) berdasarkan VAM nyata Anda!
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs shrink-0 transition-all group-hover:translate-x-1 shadow-md shadow-cyan-500/20">
          <span>Buka GPX Planner</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </Link>
    </div>
  );
};
