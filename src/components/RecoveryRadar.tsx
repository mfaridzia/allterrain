"use client";

import React from "react";
import { BatteryCharging, Sparkles } from "lucide-react";
import { MetricTooltip } from "@/components/MetricTooltip";

interface RecoveryProps {
  recoveryScore: number;
  hrvRmssd: number;
  hrvStatus: string;
  restingHr: number;
  sleepHours: string;
  date?: string;
}

export const RecoveryRadar: React.FC<RecoveryProps> = ({
  recoveryScore,
  hrvRmssd,
  hrvStatus,
  restingHr,
  sleepHours,
  date,
}) => {
  let readiness = "Fully Recovered";
  let readinessColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (recoveryScore < 50) {
    readiness = "Fatigued - Rest";
    readinessColor = "text-red-400 border-red-500/30 bg-red-500/10";
  } else if (recoveryScore < 75) {
    readiness = "Moderate Base";
    readinessColor = "text-amber-400 border-amber-500/30 bg-amber-500/10";
  }

  // Format date display (e.g. 2026-09-04 -> "4 Sep")
  let formattedDate = "";
  if (date) {
    try {
      const parts = date.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        formattedDate = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      }
    } catch {}
  }

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-4 shadow-xl backdrop-blur-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <BatteryCharging className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Recovery & Health</span>
              {formattedDate && (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                  {formattedDate}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-zinc-400">HRV • Resting HR • Sleep</p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 whitespace-nowrap ${readinessColor}`}>
          <Sparkles className="h-3 w-3" />
          <span>{readiness}</span>
        </span>
      </div>

      {/* 2x2 Metric Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Recovery Score */}
        <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <MetricTooltip term="recovery_score">
            <span className="text-[11px] text-zinc-400 block truncate">Recovery Index</span>
          </MetricTooltip>
          <div className="text-2xl font-black text-emerald-400">{recoveryScore}%</div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${recoveryScore}%` }}
            />
          </div>
        </div>

        {/* HRV */}
        <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <MetricTooltip term="hrv">
              <span className="text-[11px] text-zinc-400 truncate">HRV (rMSSD)</span>
            </MetricTooltip>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 font-bold border border-emerald-800/40 shrink-0">
              {hrvStatus}
            </span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {hrvRmssd} <span className="text-xs font-normal text-zinc-400">ms</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">Autonomic balance</p>
        </div>

        {/* Resting HR */}
        <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <MetricTooltip term="resting_hr">
            <span className="text-[11px] text-zinc-400 block truncate">Resting HR</span>
          </MetricTooltip>
          <div className="text-2xl font-black text-white font-mono">
            {restingHr} <span className="text-xs font-normal text-zinc-400">bpm</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">Baseline heart rate</p>
        </div>

        {/* Sleep */}
        <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <span className="text-[11px] text-zinc-400 block truncate">Total Sleep</span>
          <div className="text-2xl font-black text-white font-mono">
            {sleepHours} <span className="text-xs font-normal text-zinc-400">hrs</span>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">Recovery duration</p>
        </div>
      </div>
    </div>
  );
};
