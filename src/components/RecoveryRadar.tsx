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
  let readinessColor = "bg-emerald-300 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]";
  if (recoveryScore < 50) {
    readiness = "Fatigued - Rest";
    readinessColor = "bg-rose-400 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]";
  } else if (recoveryScore < 75) {
    readiness = "Moderate Base";
    readinessColor = "bg-amber-300 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]";
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
    <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 space-y-4 shadow-[4px_4px_0px_0px_#09090b] flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <BatteryCharging className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-950 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Recovery & Health</span>
              {formattedDate && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border-2 border-zinc-950 bg-zinc-100 text-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                  {formattedDate}
                </span>
              )}
            </h3>
            <p className="text-[11px] font-mono text-zinc-600 font-semibold truncate">HRV • Resting HR • Sleep</p>
          </div>
        </div>

        <span className={`self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 whitespace-nowrap ${readinessColor}`}>
          <Sparkles className="h-3 w-3 stroke-[2.5]" />
          <span>{readiness}</span>
        </span>
      </div>

      {/* 2x2 Metric Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Recovery Score */}
        <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b] min-w-0">
          <MetricTooltip term="recovery_score">
            <span className="text-[11px] font-bold text-zinc-700 block truncate">Recovery Index</span>
          </MetricTooltip>
          <div className="text-2xl font-black font-mono text-zinc-950">{recoveryScore}%</div>
          <div className="h-2.5 w-full bg-zinc-200 border-2 border-zinc-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${recoveryScore}%` }}
            />
          </div>
        </div>

        {/* HRV */}
        <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b] min-w-0">
          <div className="flex items-center justify-between gap-1 min-w-0">
            <MetricTooltip term="hrv">
              <span className="text-[11px] font-bold text-zinc-700 truncate">HRV</span>
            </MetricTooltip>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-950 font-black border border-zinc-950 shrink-0 whitespace-nowrap">
              {hrvStatus}
            </span>
          </div>
          <div className="text-2xl font-black text-zinc-950 font-mono">
            {hrvRmssd} <span className="text-xs font-normal text-zinc-500">ms</span>
          </div>
          <p className="text-[10px] text-zinc-600 font-medium truncate">Autonomic balance</p>
        </div>

        {/* Resting HR */}
        <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
          <MetricTooltip term="resting_hr">
            <span className="text-[11px] font-bold text-zinc-700 block truncate">Resting HR</span>
          </MetricTooltip>
          <div className="text-2xl font-black text-zinc-950 font-mono">
            {restingHr} <span className="text-xs font-normal text-zinc-500">bpm</span>
          </div>
          <p className="text-[10px] text-zinc-600 font-medium truncate">Baseline heart rate</p>
        </div>

        {/* Sleep */}
        <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1 shadow-[2px_2px_0px_0px_#09090b]">
          <span className="text-[11px] font-bold text-zinc-700 block truncate">Total Sleep</span>
          <div className="text-2xl font-black text-zinc-950 font-mono">
            {sleepHours} <span className="text-xs font-normal text-zinc-500">hrs</span>
          </div>
          <p className="text-[10px] text-zinc-600 font-medium truncate">
            {(() => {
              const num = parseFloat(sleepHours);
              if (!isNaN(num) && num > 0) {
                const h = Math.floor(num);
                const m = Math.round((num - h) * 60);
                return `${h}h ${m}m • Net duration`;
              }
              return "Recovery duration";
            })()}
          </p>
        </div>
      </div>
    </div>
  );
};
