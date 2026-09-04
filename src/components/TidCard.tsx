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
    <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 space-y-4 shadow-[4px_4px_0px_0px_#09090b] flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <PieChart className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-zinc-950 tracking-tight">Intensity & Drift</h3>
            <p className="text-[11px] font-mono text-zinc-600 font-semibold">80/20 Rule • Decoupling</p>
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 whitespace-nowrap ${
            isPolarized
              ? "bg-emerald-300 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
              : "bg-amber-300 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
          }`}
        >
          {isPolarized ? <CheckCircle className="h-3.5 w-3.5 stroke-[2.5]" /> : <AlertTriangle className="h-3.5 w-3.5 stroke-[2.5]" />}
          <span>{isPolarized ? "Polarized (80/20)" : "Pyramidal (Z3)"}</span>
        </div>
      </div>

      {/* 3-Zone Multi-Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-700">
          <MetricTooltip term="tid">
            <span className="font-bold">Intensity Distribution (TID)</span>
          </MetricTooltip>
          <span className="font-mono text-zinc-950 font-black">{z1z2Pct}% / {z3Pct}% / {z4z5Pct}%</span>
        </div>

        <div className="h-3.5 w-full rounded-full bg-zinc-100 border-2 border-zinc-950 overflow-hidden flex">
          <div
            style={{ width: `${z1z2Pct}%` }}
            className="h-full bg-emerald-400 transition-all duration-500"
            title={`Zone 1-2 (Easy): ${z1z2Pct}%`}
          />
          <div
            style={{ width: `${z3Pct}%` }}
            className="h-full bg-amber-400 transition-all duration-500"
            title={`Zone 3 (Tempo/Grey): ${z3Pct}%`}
          />
          <div
            style={{ width: `${z4z5Pct}%` }}
            className="h-full bg-rose-400 transition-all duration-500"
            title={`Zone 4-5 (Hard): ${z4z5Pct}%`}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-[11px] text-zinc-700 font-mono font-bold pt-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 border border-zinc-950 shrink-0" />
            <span className="truncate">Z1-2 ({z1z2Pct}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 border border-zinc-950 shrink-0" />
            <span className="truncate">Z3 ({z3Pct}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400 border border-zinc-950 shrink-0" />
            <span className="truncate">Z4-5 ({z4z5Pct}%)</span>
          </div>
        </div>
      </div>

      {/* Aerobic Decoupling Card */}
      <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 flex items-center justify-between mt-auto shadow-[2px_2px_0px_0px_#09090b]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
            <Heart className="h-3.5 w-3.5 text-rose-600 fill-rose-100 stroke-[2.5] shrink-0" />
            <MetricTooltip term="decoupling">
              <span>Aerobic Decoupling (Pa:HR)</span>
            </MetricTooltip>
          </div>
          <p className="text-[10px] text-zinc-600 font-medium">Cardiac drift in 2nd half</p>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xl font-black font-mono text-zinc-950">
            {avgDecoupling}%
          </div>
          <span className={`text-[10px] font-mono font-bold block ${isDecouplingSolid ? "text-emerald-700" : "text-amber-700"}`}>
            {isDecouplingSolid ? "Solid Base (<5%)" : "Drift (>5%)"}
          </span>
        </div>
      </div>
    </div>
  );
};
