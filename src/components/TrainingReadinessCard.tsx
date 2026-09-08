"use client";

import React from "react";
import {
  Compass,
  ShieldCheck,
  Zap,
  Clock,
  Heart,
  Activity,
  CalendarCheck,
} from "lucide-react";
import { MetricTooltip } from "@/components/MetricTooltip";
import { TrainingReadinessResult } from "@/lib/analytics";
import { useTranslation } from "@/lib/i18n/context";

interface TrainingReadinessCardProps {
  readiness?: TrainingReadinessResult;
}

export const TrainingReadinessCard: React.FC<TrainingReadinessCardProps> = ({ readiness }) => {
  const { t } = useTranslation();

  if (!readiness) {
    return null;
  }

  const { score, tier, label, suggestion, governor, factors, targetTiming = "today" } = readiness;

  // Visual accents based on tier
  let badgeColor = "bg-amber-300 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]";
  let scoreBg = "bg-amber-400";

  if (tier === "PRIME") {
    badgeColor = "bg-cyan-300 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]";
    scoreBg = "bg-cyan-400";
  } else if (tier === "OPTIMAL") {
    badgeColor = "bg-emerald-300 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]";
    scoreBg = "bg-emerald-400";
  } else if (tier === "REST") {
    badgeColor = "bg-rose-300 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]";
    scoreBg = "bg-rose-400";
  } else if (tier === "MODERATE") {
    badgeColor = "bg-zinc-200 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]";
    scoreBg = "bg-zinc-300";
  }

  return (
    <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-5 shadow-[4px_4px_0px_0px_#09090b]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-zinc-100">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-xl bg-orange-400 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[2px_2px_0px_0px_#09090b]">
            <Compass className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight leading-tight">
                {t("readiness.title", "Training Readiness & Suggestion")}
              </h3>
              <MetricTooltip term="readiness" />
            </div>
            <p className="text-xs font-mono text-zinc-600 font-semibold mt-0.5">
              <span className="hidden sm:inline">
                {targetTiming === "tomorrow"
                  ? t("readiness.subtitleTomorrow", "Session completed today • Recovery & Tomorrow's Target")
                  : t("readiness.subtitleToday", "Today's Workout Prescription • Workload Governor")}
              </span>
              <span className="sm:hidden">{t("readiness.subtitleMobile", "Workout Prescription & Readiness")}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0">
          {/* Readiness Score Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] flex-1 sm:flex-initial justify-center sm:justify-start">
            <div className="flex flex-col items-end leading-none">
              <span className="text-[10px] uppercase font-black tracking-wider text-zinc-600">
                {t("readiness.readinessPill", "Readiness")}
              </span>
              <span className="text-sm font-mono font-black text-zinc-950">{score}/100</span>
            </div>
            <div className={`h-3 w-3 rounded-full border border-zinc-950 ${scoreBg}`} />
          </div>

          {/* Tier Label Badge */}
          <div className={`px-3 py-2 rounded-xl text-xs font-black shrink-0 flex-1 sm:flex-initial text-center ${badgeColor}`}>
            <span>{label}</span>
          </div>
        </div>
      </div>

      {/* Main Prescription Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Prescribed Workout */}
        <div className="lg:col-span-7 bg-[#FAF9F5] rounded-xl border-2 border-zinc-950 p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-[2px_2px_0px_0px_#09090b]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-600">
                <CalendarCheck className="h-3.5 w-3.5 text-zinc-950" />
                {targetTiming === "tomorrow"
                  ? t("readiness.targetTomorrow", "Target Session for Tomorrow")
                  : t("readiness.targetToday", "Target Session for Today")}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-950 text-white text-[10px] font-mono font-bold tracking-wide">
                {suggestion.category}
              </span>
            </div>

            <h4 className="text-lg font-black text-zinc-950 leading-snug">
              {suggestion.title}
            </h4>

            <p className="text-xs text-zinc-700 mt-2 font-medium leading-relaxed">
              {suggestion.description}
            </p>
          </div>

          {/* Detailed Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-300/80">
            <div className="p-2.5 rounded-lg bg-white border border-zinc-950/20">
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase">
                <Clock className="h-3 w-3 text-zinc-950" />
                <span>{t("readiness.duration", "Duration")}</span>
              </div>
              <p className="text-xs font-black text-zinc-950 mt-1 font-mono">
                {suggestion.durationMinutes}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-zinc-950/20">
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase">
                <Zap className="h-3 w-3 text-amber-500" />
                <span>{t("readiness.suggestedLoad", "Target Load")}</span>
              </div>
              <p className="text-xs font-black text-zinc-950 mt-1 font-mono">
                {suggestion.targetLoad}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-zinc-950/20">
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase">
                <Activity className="h-3 w-3 text-blue-500" />
                <span>{t("readiness.intensity", "Intensity")}</span>
              </div>
              <p className="text-[11px] font-black text-zinc-950 mt-1 truncate" title={suggestion.intensityZone}>
                {suggestion.intensityZone}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-zinc-950/20">
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase">
                <Heart className="h-3 w-3 text-rose-500" />
                <span>{t("readiness.hrTarget", "HR Target")}</span>
              </div>
              <p className="text-[11px] font-black text-zinc-950 mt-1 font-mono truncate" title={suggestion.heartRateGuide}>
                {suggestion.heartRateGuide}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Safety Governor & Diagnostic Factors */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
          {/* Workload Safety Governor */}
          <div className="rounded-xl bg-white border-2 border-zinc-950 p-4 space-y-2.5 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-600">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {t("readiness.workloadSafetyGovernor", "Workload Safety Governor")}
              </span>
              <span className="text-[11px] font-mono font-bold text-zinc-500">Gabbett 2016</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pt-1">
              <div>
                <span className="text-[11px] text-zinc-600 font-semibold block">
                  {targetTiming === "tomorrow"
                    ? t("readiness.maxSafeLoadTomorrow", "Max Safe Load Tomorrow:")
                    : t("readiness.maxSafeLoadToday", "Max Safe Load Today:")}
                </span>
                <div className="text-xl font-black font-mono text-zinc-950">
                  ≤ {governor.maxSafeLoadTomorrow}{" "}
                  <span className="text-xs font-normal text-zinc-500">Load</span>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-[11px] text-zinc-600 font-semibold block">
                  {t("readiness.nextQualityWindow", "Next Quality Window:")}
                </span>
                <div className="text-xs font-black font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-300 w-fit sm:ml-auto">
                  {governor.nextQualityWindow}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-600 leading-relaxed pt-1 border-t border-zinc-100 font-medium">
              {governor.scientificRationale}
            </p>
          </div>

          {/* Tri-factor Telemetry Pills */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className="rounded-lg bg-zinc-50 border border-zinc-950/20 p-1.5 sm:p-2 text-center min-w-0">
              <div className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate">
                {t("readiness.fatigueImpact", "Fatigue Impact")}
              </div>
              <div
                className={`text-[10px] sm:text-xs font-black mt-0.5 truncate ${
                  factors.fatigueImpact === "HIGH"
                    ? "text-rose-600"
                    : factors.fatigueImpact === "MODERATE"
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {factors.fatigueImpact}
              </div>
            </div>

            <div className="rounded-lg bg-zinc-50 border border-zinc-950/20 p-1.5 sm:p-2 text-center min-w-0">
              <div className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate">
                {t("readiness.formState", "Form State")}
              </div>
              <div
                className={`text-[10px] sm:text-xs font-black mt-0.5 truncate ${
                  factors.formReadiness === "OPTIMAL" || factors.formReadiness === "FRESH"
                    ? "text-emerald-600"
                    : factors.formReadiness === "OVERREACHING"
                    ? "text-rose-600"
                    : "text-zinc-700"
                }`}
              >
                {factors.formReadiness}
              </div>
            </div>

            <div className="rounded-lg bg-zinc-50 border border-zinc-950/20 p-1.5 sm:p-2 text-center min-w-0">
              <div className="text-[8px] sm:text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate">
                {t("readiness.injuryRisk", "Injury Risk")}
              </div>
              <div
                className={`text-[10px] sm:text-xs font-black mt-0.5 truncate ${
                  factors.injuryRisk === "CRITICAL"
                    ? "text-rose-600"
                    : factors.injuryRisk === "ELEVATED"
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {factors.injuryRisk}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
