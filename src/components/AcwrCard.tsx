"use client";

import React from "react";
import { ShieldAlert, CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import { MetricTooltip } from "@/components/MetricTooltip";

interface AcwrCardProps {
  acwr: number;
  status: "sweet_spot" | "moderate" | "danger" | "under_training";
  label: string;
  description: string;
  monotony: number;
  strain: number;
  monotonyAlert: boolean;
}

export const AcwrCard: React.FC<AcwrCardProps> = ({
  acwr,
  status,
  label,
  description,
  monotony,
  strain,
  monotonyAlert,
}) => {
  let badgeColor = "bg-emerald-300 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]";
  let icon = <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />;

  if (status === "danger") {
    badgeColor = "bg-rose-400 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]";
    icon = <ShieldAlert className="h-3.5 w-3.5 stroke-[2.5]" />;
  } else if (status === "moderate") {
    badgeColor = "bg-amber-300 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]";
    icon = <AlertTriangle className="h-3.5 w-3.5 stroke-[2.5]" />;
  }

  // Calculate pointer position on 0.5 -> 2.0 scale
  const gaugePercent = Math.min(100, Math.max(0, ((acwr - 0.5) / 1.5) * 100));

  return (
    <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 space-y-4 shadow-[4px_4px_0px_0px_#09090b] flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <Activity className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-950 tracking-tight truncate">Injury Risk & Load</h3>
            <p className="text-[11px] font-mono text-zinc-600 font-semibold truncate">ACWR • Monotony • Strain</p>
          </div>
        </div>

        <div className={`self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 whitespace-nowrap ${badgeColor}`}>
          {icon}
          <span>{label}</span>
        </div>
      </div>

      {/* Main ACWR Value & Gauge */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <MetricTooltip term="acwr">
            <span className="text-xs font-bold text-zinc-700">Acute:Chronic Ratio (ACWR)</span>
          </MetricTooltip>
          <span className="text-3xl font-black font-mono text-zinc-950">{acwr.toFixed(2)}</span>
        </div>

        {/* Visual Multi-Zone Gauge */}
        <div className="relative pt-2">
          <div className="h-3.5 w-full rounded-full bg-zinc-100 border-2 border-zinc-950 overflow-hidden flex">
            {/* Under-training (0.5 - 0.8) -> 20% */}
            <div className="h-full bg-blue-300 w-[20%]" title="Under-training (<0.8)" />
            {/* Sweet Spot (0.8 - 1.3) -> 33.3% */}
            <div className="h-full bg-emerald-400 w-[33.3%]" title="Sweet Spot (0.8 - 1.3)" />
            {/* Warning Zone (1.3 - 1.5) -> 13.3% */}
            <div className="h-full bg-amber-400 w-[13.3%]" title="Warning (1.3 - 1.5)" />
            {/* Danger Zone (> 1.5) -> 33.4% */}
            <div className="h-full bg-rose-400 w-[33.4%]" title="Danger Zone (>1.5)" />
          </div>

          {/* Gauge Arrow Marker */}
          <div
            className="absolute top-1 transform -translate-x-1/2 transition-all duration-500"
            style={{ left: `${gaugePercent}%` }}
          >
            <div className="w-4 h-4 bg-zinc-950 rounded-full border-2 border-white shadow-md" />
          </div>

          <div className="flex justify-between text-[9px] sm:text-[10px] text-zinc-600 pt-1 font-mono font-bold">
            <span>0.5</span>
            <span className="text-emerald-700 font-black">Sweet Spot (0.8-1.3)</span>
            <span>1.5</span>
            <span className="text-rose-700">2.0+</span>
          </div>
        </div>

        <p className="text-xs text-zinc-600 font-medium leading-relaxed pt-1 line-clamp-2">{description}</p>
      </div>

      {/* Monotony & Strain Sub-Grid */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t-2 border-zinc-100">
        <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-0.5 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
            <MetricTooltip term="monotony">
              <span>Monotony</span>
            </MetricTooltip>
            {monotonyAlert && (
              <span className="bg-rose-200 text-rose-950 border border-zinc-950 text-[9px] font-black px-1.5 py-0.2 rounded">
                High
              </span>
            )}
          </div>
          <div className="text-xl font-black font-mono text-zinc-950">{monotony}</div>
          <p className="text-[10px] text-zinc-600 font-medium truncate">Weekly load variation</p>
        </div>

        <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-0.5 shadow-[2px_2px_0px_0px_#09090b]">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
            <MetricTooltip term="strain">
              <span>Training Strain</span>
            </MetricTooltip>
          </div>
          <div className="text-xl font-black font-mono text-zinc-950">{strain}</div>
          <p className="text-[10px] text-zinc-600 font-medium truncate">Load × Monotony</p>
        </div>
      </div>
    </div>
  );
};
