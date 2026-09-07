"use client";

import React from "react";
import Link from "next/link";
import { Footprints, Mountain, ArrowRight, Star, AlertTriangle, ShieldCheck } from "lucide-react";
import { useGearData } from "@/lib/queries";

export const GearWidget: React.FC = () => {
  const { data: gearData, isLoading } = useGearData();

  const shoes = gearData?.shoes || [];
  const activeShoes = shoes.filter((s: any) => !s.isRetired).slice(0, 2);

  if (isLoading || activeShoes.length === 0) return null;

  return (
    <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
            <Footprints className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wide">
              Active Footwear & Lug Wear
            </h3>
            <span className="text-[10px] text-zinc-500 font-sans font-medium">
              Mileage & Outsole D+ tracking
            </span>
          </div>
        </div>

        <Link
          href="/gear"
          className="text-[11px] font-black font-mono text-orange-600 hover:text-orange-700 flex items-center gap-1 group"
        >
          <span>Manage Gear</span>
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {activeShoes.map((shoe: any) => {
          const isTrail = shoe.sportType === "trail" || shoe.sportType === "all-terrain";

          return (
            <Link
              key={shoe.id}
              href="/gear"
              className="p-3 rounded-xl bg-[#FAF9F5] hover:bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] hover:-translate-y-0.5 transition-all space-y-2.5 block group"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-black border border-zinc-950 bg-white">
                      {shoe.sportType.toUpperCase()}
                    </span>
                    {shoe.isDefault && (
                      <span className="text-[9px] font-black text-amber-600 flex items-center gap-0.5">
                        <Star className="h-2.5 w-2.5 fill-current" /> Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-black text-zinc-950 group-hover:text-orange-600 transition-colors mt-0.5">
                    {shoe.name}
                  </div>
                </div>

                <span
                  className={`text-[9px] px-2 py-0.5 rounded font-mono font-black border shrink-0 ${
                    shoe.wearStatus === "critical"
                      ? "bg-rose-100 text-rose-950 border-rose-300"
                      : shoe.wearStatus === "warning"
                      ? "bg-amber-100 text-amber-950 border-amber-300"
                      : "bg-emerald-100 text-emerald-950 border-emerald-300"
                  }`}
                >
                  {shoe.wearStatus === "critical" ? "Replace" : `${shoe.overallWearPct}% Wear`}
                </span>
              </div>

              {/* Dual Progress Bars */}
              <div className="space-y-1.5 font-mono text-[10px]">
                {/* Distance Bar */}
                <div>
                  <div className="flex justify-between text-zinc-600 mb-0.5">
                    <span>Distance:</span>
                    <span className="font-bold text-zinc-900">
                      {shoe.totalDistanceKm} / {shoe.maxDistanceKm}k
                    </span>
                  </div>
                  <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden border border-zinc-950">
                    <div
                      className={`h-full ${
                        shoe.distanceProgressPct >= 90
                          ? "bg-rose-500"
                          : shoe.distanceProgressPct >= 75
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, shoe.distanceProgressPct)}%` }}
                    />
                  </div>
                </div>

                {/* Elevation D+ Bar for Trail */}
                {isTrail && (
                  <div>
                    <div className="flex justify-between text-cyan-900 mb-0.5">
                      <span className="flex items-center gap-0.5">
                        <Mountain className="h-2.5 w-2.5" /> D+ Vert:
                      </span>
                      <span className="font-bold">
                        +{shoe.totalElevationM.toLocaleString()} / +{shoe.maxElevationM.toLocaleString()}m
                      </span>
                    </div>
                    <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden border border-zinc-950">
                      <div
                        className="h-full bg-cyan-500"
                        style={{ width: `${Math.min(100, shoe.elevationProgressPct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
