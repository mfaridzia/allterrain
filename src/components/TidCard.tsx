"use client";

import React from "react";
import { PieChart, Heart, CheckCircle, AlertTriangle } from "lucide-react";
import { MetricTooltip } from "@/components/MetricTooltip";

interface TidCardProps {
  z1z2Pct: number;
  z3Pct: number;
  z4z5Pct: number;
  isPolarized: boolean;
  avgDecoupling: number;
}

export const TidCard: React.FC<TidCardProps> = ({
  z1z2Pct,
  z3Pct,
  z4z5Pct,
  isPolarized,
  avgDecoupling,
}) => {
  const isDecouplingSolid = avgDecoupling <= 5.0;

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-4 shadow-xl backdrop-blur-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <PieChart className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Intensity & Drift</h3>
            <p className="text-[11px] text-zinc-400">80/20 Rule • Decoupling</p>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 whitespace-nowrap ${
            isPolarized
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
              : "text-amber-400 bg-amber-500/10 border-amber-500/30"
          }`}
        >
          {isPolarized ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          <span>{isPolarized ? "Polarized (80/20)" : "Pyramidal (Z3)"}</span>
        </div>
      </div>

      {/* 3-Zone Multi-Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <MetricTooltip term="tid">
            <span className="font-medium">Intensity Distribution (TID)</span>
          </MetricTooltip>
          <span className="font-mono text-zinc-200 font-bold">{z1z2Pct}% / {z3Pct}% / {z4z5Pct}%</span>
        </div>

        <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden flex">
          <div
            style={{ width: `${z1z2Pct}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
            title={`Zone 1-2 (Easy): ${z1z2Pct}%`}
          />
          <div
            style={{ width: `${z3Pct}%` }}
            className="h-full bg-amber-500 transition-all duration-500"
            title={`Zone 3 (Tempo/Grey): ${z3Pct}%`}
          />
          <div
            style={{ width: `${z4z5Pct}%` }}
            className="h-full bg-red-500 transition-all duration-500"
            title={`Zone 4-5 (Hard): ${z4z5Pct}%`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">Z1-2 ({z1z2Pct}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            <span className="truncate">Z3 ({z3Pct}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            <span className="truncate">Z4-5 ({z4z5Pct}%)</span>
          </div>
        </div>
      </div>

      {/* Aerobic Decoupling Card */}
      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/90 flex items-center justify-between mt-auto">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <Heart className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <MetricTooltip term="decoupling">
              <span>Aerobic Decoupling (Pa:HR)</span>
            </MetricTooltip>
          </div>
          <p className="text-[10px] text-zinc-400">Cardiac drift in 2nd half</p>
        </div>

        <div className="text-right shrink-0">
          <div className={`text-base font-black ${isDecouplingSolid ? "text-emerald-400" : "text-amber-400"}`}>
            {avgDecoupling}%
          </div>
          <span className="text-[10px] text-zinc-400 font-medium block">
            {isDecouplingSolid ? "Solid Base (<5%)" : "Drift (>5%)"}
          </span>
        </div>
      </div>
    </div>
  );
};
