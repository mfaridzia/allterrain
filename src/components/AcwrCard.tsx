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
  let badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  let icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;

  if (status === "danger") {
    badgeColor = "text-red-400 bg-red-500/10 border-red-500/30";
    icon = <ShieldAlert className="h-3.5 w-3.5 text-red-400" />;
  } else if (status === "moderate") {
    badgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/30";
    icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  }

  // Calculate pointer position on 0.5 -> 2.0 scale
  const gaugePercent = Math.min(100, Math.max(0, ((acwr - 0.5) / 1.5) * 100));

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-4 shadow-xl backdrop-blur-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Injury Risk & Load</h3>
            <p className="text-[11px] text-zinc-400">ACWR • Monotony • Strain</p>
          </div>
        </div>

        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 whitespace-nowrap ${badgeColor}`}>
          {icon}
          <span>{label}</span>
        </div>
      </div>

      {/* Main ACWR Value & Gauge */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <MetricTooltip term="acwr">
            <span className="text-xs text-zinc-400 font-medium">Acute:Chronic Ratio (ACWR)</span>
          </MetricTooltip>
          <span className="text-2xl font-black text-white">{acwr.toFixed(2)}</span>
        </div>

        {/* Visual Multi-Zone Gauge */}
        <div className="relative pt-2">
          <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden flex">
            {/* Under-training (0.5 - 0.8) -> 20% */}
            <div className="h-full bg-blue-500/50 w-[20%]" title="Under-training (<0.8)" />
            {/* Sweet Spot (0.8 - 1.3) -> 33.3% */}
            <div className="h-full bg-emerald-500 w-[33.3%]" title="Sweet Spot (0.8 - 1.3)" />
            {/* Warning Zone (1.3 - 1.5) -> 13.3% */}
            <div className="h-full bg-amber-500 w-[13.3%]" title="Warning (1.3 - 1.5)" />
            {/* Danger Zone (> 1.5) -> 33.4% */}
            <div className="h-full bg-red-500 w-[33.4%]" title="Danger Zone (>1.5)" />
          </div>

          {/* Gauge Arrow Marker */}
          <div
            className="absolute top-0 transform -translate-x-1/2 transition-all duration-500"
            style={{ left: `${gaugePercent}%` }}
          >
            <div className="w-3 h-3 bg-white rounded-full border-2 border-zinc-950 shadow-md" />
          </div>

          <div className="flex justify-between text-[10px] text-zinc-400 pt-1 font-mono">
            <span>0.5</span>
            <span className="text-emerald-400 font-bold">Sweet Spot (0.8-1.3)</span>
            <span>1.5</span>
            <span className="text-red-400">2.0+</span>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed pt-1 line-clamp-2">{description}</p>
      </div>

      {/* Monotony & Strain Sub-Grid */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-0.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <MetricTooltip term="monotony">
              <span>Monotony</span>
            </MetricTooltip>
            {monotonyAlert && <span className="text-red-400 text-[10px] font-bold">High</span>}
          </div>
          <div className="text-lg font-bold text-zinc-200">{monotony}</div>
          <p className="text-[10px] text-zinc-400 truncate">Weekly load variation</p>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-0.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <MetricTooltip term="strain">
              <span>Training Strain</span>
            </MetricTooltip>
          </div>
          <div className="text-lg font-bold text-zinc-200">{strain}</div>
          <p className="text-[10px] text-zinc-400 truncate">Load × Monotony</p>
        </div>
      </div>
    </div>
  );
};
