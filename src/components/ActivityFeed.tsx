"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Mountain,
  Bike,
  Footprints,
  Dumbbell,
  Flame,
  Heart,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  ChevronRight,
  X,
  Share2,
  HeartPulse,
  Zap,
} from "lucide-react";
import {
  formatPace,
  calculateKmEffort,
  calculateGapPace,
  calculateDecouplingAnalysis,
} from "@/lib/analytics";
import { ActivityShareModal } from "./ActivityShareModal";
import { useGearData, useAssignShoeMutation } from "@/lib/queries";

export interface ActivityItem {
  id: string;
  name: string;
  sportType: string;
  startTime: number;
  distanceKm: string;
  durationMin: number;
  avgPaceSec: number;
  avgHr: number;
  maxHr: number;
  cadence: number;
  trainingLoad: number;
  elevationGain: number;
  elevationLoss: number;
  vam: number;
  decouplingPct: number;
  efficiencyFactor: number;
  aerobicTe: number;
  anaerobicTe: number;
  shoeId?: string | null;
  shoeName?: string | null;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  compact?: boolean;
  maxCompactItems?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  compact = false,
  maxCompactItems = 4,
}) => {
  const [filter, setFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [sharingActivity, setSharingActivity] = useState<ActivityItem | null>(null);

  const { data: gearData } = useGearData();
  const assignShoeMutation = useAssignShoeMutation();
  const shoes = gearData?.shoes || [];
  const shoesMap = React.useMemo(() => {
    const map = new Map<string, any>();
    shoes.forEach((s: any) => map.set(s.id, s));
    return map;
  }, [shoes]);

  const PAGE_SIZE = 20;

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const hasBike = activities.some((a) => a.sportType === "bike" || a.sportType === "cycling");
  const hasStrength = activities.some(
    (a) => a.sportType === "strength" || a.sportType === "gym" || a.sportType === "weight"
  );

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "road", label: "Road" },
    { id: "trail", label: "Trail" },
    ...(hasBike ? [{ id: "bike", label: "Bike" }] : []),
    ...(hasStrength ? [{ id: "strength", label: "Gym" }] : []),
  ];

  const filtered = activities.filter((a) => {
    if (filter === "all") return true;
    if (filter === "trail") return a.sportType === "trail_run" || a.elevationGain > 200;
    if (filter === "road") return a.sportType === "run" && a.elevationGain <= 200;
    if (filter === "bike") return a.sportType === "bike" || a.sportType === "cycling";
    if (filter === "strength") return a.sportType === "strength" || a.sportType === "gym";
    return a.sportType.toLowerCase().includes(filter);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const itemsToDisplay = compact
    ? filtered.slice(0, maxCompactItems)
    : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getSportIcon = (sportType: string, elevGain: number) => {
    if (sportType === "trail_run" || elevGain > 200) {
      return <Mountain className="h-4 w-4 text-cyan-600 stroke-[2.5]" />;
    }
    if (sportType === "bike" || sportType === "cycling") {
      return <Bike className="h-4 w-4 text-emerald-600 stroke-[2.5]" />;
    }
    if (sportType === "strength" || sportType === "gym" || sportType === "weight") {
      return <Dumbbell className="h-4 w-4 text-purple-600 stroke-[2.5]" />;
    }
    return <Footprints className="h-4 w-4 text-orange-600 stroke-[2.5]" />;
  };

  const formatSpeedOrPace = (act: ActivityItem) => {
    if (act.sportType === "strength" || act.sportType === "gym") {
      return "Strength Session";
    }
    if (act.sportType === "bike" || act.sportType === "cycling") {
      if (act.avgPaceSec > 0) {
        const speedKmh = Math.round((3600 / act.avgPaceSec) * 10) / 10;
        return `${speedKmh} km/h`;
      }
      return "-- km/h";
    }
    return `${formatPace(act.avgPaceSec)}/km`;
  };

  const getSportBadge = (act: ActivityItem) => {
    if (act.sportType === "trail_run" || act.elevationGain > 200) {
      return (
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-cyan-200 text-cyan-950 border border-zinc-950">
          TRAIL
        </span>
      );
    }
    if (act.sportType === "bike" || act.sportType === "cycling") {
      return (
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-950 border border-zinc-950">
          BIKE
        </span>
      );
    }
    if (act.sportType === "strength" || act.sportType === "gym") {
      return (
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-200 text-purple-950 border border-zinc-950">
          STRENGTH
        </span>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-4 shadow-[4px_4px_0px_0px_#09090b]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <Activity className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-950 tracking-tight">Recent Workouts & Sessions</h3>
            <p className="text-[11px] font-mono text-zinc-600 font-semibold">Pace • HR Zones • Training Load • VAM</p>
          </div>
        </div>

        {/* Header Right: Filter buttons & Logbook link */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {compact && (
            <Link
              href="/activities"
              className="text-xs font-black text-zinc-950 hover:bg-orange-100 px-3 py-1.5 rounded-xl border-2 border-zinc-950 bg-[#FAF9F5] shadow-[1.5px_1.5px_0px_0px_#09090b] flex items-center gap-1 transition-all mr-1"
            >
              <span>Logbook ({activities.length})</span>
              <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
            </Link>
          )}

          {/* Filter buttons */}
          <div className="flex items-center gap-1 bg-zinc-200 p-1 rounded-xl border-2 border-zinc-950">
            {filterTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => handleFilterChange(item.id)}
                className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                  filter === item.id
                    ? "bg-zinc-950 text-white shadow-[1px_1px_0px_0px_#09090b]"
                    : "text-zinc-700 hover:text-zinc-950"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activities List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-zinc-600 font-bold">
          No workouts found for this filter.
        </div>
      ) : (
        <div className="space-y-2.5">
          {itemsToDisplay.map((act) => {
            const isTrail = act.sportType === "trail_run" || act.elevationGain > 200;
            const decoupling = calculateDecouplingAnalysis(act);
            const dateStr = new Date(act.startTime).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
            });

            return (
              <div
                key={act.id}
                onClick={() => setSelectedActivity(act)}
                className="p-3.5 rounded-xl bg-[#FAF9F5] hover:bg-white border-2 border-zinc-950 cursor-pointer transition-all flex items-center justify-between gap-3 group shadow-[2px_2px_0px_0px_#09090b] hover:shadow-[3px_3px_0px_0px_#09090b] hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-white border-2 border-zinc-950 flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                    {getSportIcon(act.sportType, act.elevationGain)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-zinc-950 truncate group-hover:text-orange-600 transition-colors">
                        {act.name}
                      </span>
                      {getSportBadge(act)}
                      {decoupling.isApplicable && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 border ${
                            decoupling.status === "optimal"
                              ? "bg-emerald-100 text-emerald-900 border-emerald-400"
                              : decoupling.status === "solid"
                              ? "bg-teal-100 text-teal-900 border-teal-400"
                              : decoupling.status === "moderate"
                              ? "bg-amber-100 text-amber-900 border-amber-400"
                              : "bg-rose-100 text-rose-900 border-rose-400"
                          }`}
                          title={`Aerobic Decoupling: ${decoupling.decouplingPct}% • ${decoupling.statusLabel}`}
                        >
                          Pa:HR {decoupling.decouplingPct > 0 ? `+${decoupling.decouplingPct}%` : `${decoupling.decouplingPct}%`}
                        </span>
                      )}
                      {act.shoeId && shoesMap.has(act.shoeId) && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 border bg-amber-100 text-amber-950 border-amber-300 flex items-center gap-1"
                          title={`Footwear: ${shoesMap.get(act.shoeId).name}`}
                        >
                          <Footprints className="h-2.5 w-2.5" />
                          <span className="truncate max-w-[100px]">{shoesMap.get(act.shoeId).name}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-600 font-mono font-semibold flex items-center gap-2 mt-0.5">
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span>{act.durationMin}m</span>
                      <span>•</span>
                      <span>{formatSpeedOrPace(act)}</span>
                      <span>•</span>
                      <span>HR {act.avgHr} bpm</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    {act.sportType === "strength" ? (
                      <div className="text-sm font-black text-purple-700 font-mono">
                        {act.durationMin} <span className="text-[10px] font-normal text-zinc-500">min</span>
                      </div>
                    ) : (
                      <div className="text-sm font-black text-zinc-950 font-mono">
                        {act.distanceKm} <span className="text-[10px] font-normal text-zinc-500">km</span>
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-600 font-mono font-bold">
                      Load {act.trainingLoad}
                    </div>
                  </div>

                  {isTrail && act.elevationGain > 0 && (
                    <div className="hidden sm:block text-right">
                      <div className="text-xs font-black text-cyan-800 font-mono">
                        +{act.elevationGain}m • {calculateKmEffort(parseFloat(act.distanceKm), act.elevationGain)} <span className="text-[9px] font-normal text-zinc-600">km-eff</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 font-mono font-semibold">
                        GAP {formatPace(calculateGapPace(act.avgPaceSec, parseFloat(act.distanceKm) * 1000, act.elevationGain))}/km
                      </div>
                    </div>
                  )}

                  <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-950 transition-colors stroke-[2.5]" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: Compact mode CTA or Full Pagination Controls */}
      {compact ? (
        <div className="pt-2 border-t-2 border-zinc-100">
          <Link
            href="/activities"
            className="w-full py-2.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 hover:bg-orange-100 text-xs font-black text-zinc-950 flex items-center justify-center gap-2 transition-all shadow-[2px_2px_0px_0px_#09090b] group"
          >
            <span>Buka Logbook Lengkap ({activities.length} Aktivitas Tersimpan)</span>
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform stroke-[2.5]" />
          </Link>
        </div>
      ) : (
        totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t-2 border-zinc-100 text-xs">
            <div className="text-zinc-600 font-mono text-[11px] font-medium">
              Menampilkan <strong className="text-zinc-950 font-black">{(currentPage - 1) * PAGE_SIZE + 1}</strong> -{" "}
              <strong className="text-zinc-950 font-black">{Math.min(currentPage * PAGE_SIZE, filtered.length)}</strong> dari{" "}
              <strong className="text-zinc-950 font-black">{filtered.length}</strong> aktivitas
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl bg-white border-2 border-zinc-950 text-zinc-950 font-black hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-[1.5px_1.5px_0px_0px_#09090b]"
              >
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-xl font-mono text-xs font-black transition-all border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] ${
                    currentPage === pageNum
                      ? "bg-orange-400 text-zinc-950"
                      : "bg-white text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl bg-white border-2 border-zinc-950 text-zinc-950 font-black hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-[1.5px_1.5px_0px_0px_#09090b]"
              >
                Next
              </button>
            </div>
          </div>
        )
      )}

      {/* Activity Detail Modal / Inspector */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-white border-2 border-zinc-950 p-6 space-y-5 shadow-[6px_6px_0px_0px_#09090b] max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                  {getSportIcon(selectedActivity.sportType, selectedActivity.elevationGain)}
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-950">{selectedActivity.name}</h3>
                  <p className="text-xs font-mono font-medium text-zinc-600">
                    {new Date(selectedActivity.startTime).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSharingActivity(selectedActivity)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-zinc-950 bg-amber-300 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-[1.5px_1.5px_0px_0px_#09090b] transition-all cursor-pointer"
                  title="Bagikan ke Instagram / Medsos"
                >
                  <Share2 className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Bagikan</span>
                </button>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                >
                  <X className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            {selectedActivity.sportType === "strength" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">Duration</span>
                  <div className="text-lg font-black text-purple-700 font-mono">{selectedActivity.durationMin} min</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">Avg / Max HR</span>
                  <div className="text-xs font-black text-zinc-950 font-mono mt-1">
                    {selectedActivity.avgHr} / {selectedActivity.maxHr} bpm
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">Training Load</span>
                  <div className="text-lg font-black text-amber-600 font-mono">{selectedActivity.trainingLoad}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">Training Effect</span>
                  <div className="text-xs font-black text-emerald-700 font-mono mt-1">
                    A: {selectedActivity.aerobicTe} | An: {selectedActivity.anaerobicTe}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">Distance</span>
                  <div className="text-lg font-black text-zinc-950 font-mono">{selectedActivity.distanceKm} km</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">Moving Time</span>
                  <div className="text-lg font-black text-zinc-950 font-mono">{selectedActivity.durationMin} min</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">
                    {selectedActivity.sportType === "bike" ? "Avg Speed" : "Avg Pace"}
                  </span>
                  <div className="text-lg font-black text-orange-600 font-mono">
                    {formatSpeedOrPace(selectedActivity)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">Avg / Max HR</span>
                  <div className="text-xs font-black text-zinc-950 font-mono">
                    {selectedActivity.avgHr} / {selectedActivity.maxHr} bpm
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">Training Load</span>
                  <div className="text-lg font-black text-amber-600 font-mono">{selectedActivity.trainingLoad}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                  <span className="text-[11px] font-bold text-zinc-700">Training Effect</span>
                  <div className="text-xs font-black text-emerald-700 font-mono">
                    A: {selectedActivity.aerobicTe} | An: {selectedActivity.anaerobicTe}
                  </div>
                </div>
              </div>
            )}

            {/* Footwear & Gear Assignment */}
            <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 flex items-center justify-between gap-3 shadow-[2px_2px_0px_0px_#09090b]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1px_1px_0px_0px_#09090b]">
                  <Footprints className="h-4 w-4 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-sans font-bold text-zinc-500 uppercase block">
                    Footwear & Gear
                  </span>
                  <span className="text-xs font-black text-zinc-950 truncate block">
                    {selectedActivity.shoeId && shoesMap.has(selectedActivity.shoeId)
                      ? `${shoesMap.get(selectedActivity.shoeId).brand} ${shoesMap.get(selectedActivity.shoeId).name}`
                      : "No Shoe Assigned"}
                  </span>
                </div>
              </div>

              <select
                value={selectedActivity.shoeId || ""}
                onChange={async (e) => {
                  const val = e.target.value || null;
                  try {
                    await assignShoeMutation.mutateAsync({
                      activityId: selectedActivity.id,
                      shoeId: val,
                    });
                    setSelectedActivity({ ...selectedActivity, shoeId: val });
                  } catch (err) {
                    console.error("Failed to assign shoe:", err);
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white border-2 border-zinc-950 text-xs font-mono font-bold text-zinc-900 shadow-[1.5px_1.5px_0px_0px_#09090b] cursor-pointer focus:outline-none"
              >
                <option value="">Select Footwear...</option>
                {shoes.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.sportType}) - {s.totalDistanceKm}km
                  </option>
                ))}
              </select>
            </div>

            {/* Aerobic Decoupling & Cardiac Drift (Intervals.icu / Joe Friel Model) */}
            {(() => {
              const decoupling = calculateDecouplingAnalysis(selectedActivity);
              if (!decoupling.isApplicable) return null;

              return (
                <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-3 shadow-[2px_2px_0px_0px_#09090b]">
                  {/* Section Header with Badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-rose-100 border-2 border-zinc-950 flex items-center justify-center text-rose-700 shadow-[1px_1px_0px_0px_#09090b]">
                        <HeartPulse className="h-4 w-4 stroke-[2.5]" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-zinc-950 flex items-center gap-1.5">
                          Aerobic Decoupling & Cardiac Drift (Pa:HR)
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-sans font-medium">
                          Intervals.icu / Joe Friel Aerobic Efficiency Model
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-black font-mono flex items-center gap-1.5 ${decoupling.badgeClass}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${decoupling.dotColor}`} />
                      {decoupling.statusLabel}
                    </span>
                  </div>

                  {/* Primary Metric Grid: Decoupling Rate vs Efficiency Factor */}
                  <div className="grid grid-cols-2 gap-2.5 font-mono">
                    <div className="p-3 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-sans font-bold text-zinc-600 uppercase tracking-wide">
                          Decoupling Rate
                        </span>
                        <span className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-300">
                          Target &lt; 5.0%
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-black ${
                            decoupling.status === "optimal" || decoupling.status === "solid"
                              ? "text-emerald-700"
                              : decoupling.status === "moderate"
                              ? "text-amber-700"
                              : "text-rose-700"
                          }`}
                        >
                          {decoupling.decouplingPct > 0 ? `+${decoupling.decouplingPct}%` : `${decoupling.decouplingPct}%`}
                        </span>
                        <span className="text-[10px] font-medium text-zinc-500 font-sans">drift</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
                        {decoupling.driftDeltaHr > 0 ? `+${decoupling.driftDeltaHr} bpm HR drift` : "Steady heart rate"}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-sans font-bold text-zinc-600 uppercase tracking-wide">
                          Efficiency Factor (EF)
                        </span>
                        <span className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-300">
                          Output/HR
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-zinc-950">
                          {decoupling.efficiencyFactor}
                        </span>
                        <span className="text-[10px] font-medium text-zinc-500 font-sans">m/min/bpm</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
                        Running speed produced per heartbeat
                      </div>
                    </div>
                  </div>

                  {/* Split Half Comparison (1st Half vs 2nd Half) */}
                  <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-300 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-600 font-sans">
                      <span>Workout Split Breakdown</span>
                      <span>1st Half (0–50%) vs 2nd Half (50–100%)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-white border border-zinc-200">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase">1st Half</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-zinc-600">Pace:</span>
                          <span className="font-bold text-zinc-900">{formatPace(decoupling.firstHalf.paceSec)}/km</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-600">HR:</span>
                          <span className="font-bold text-rose-600">{decoupling.firstHalf.avgHr} bpm</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-600">EF:</span>
                          <span className="font-bold text-zinc-900">{decoupling.firstHalf.ef}</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-white border border-zinc-200">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase">2nd Half</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-zinc-600">Pace:</span>
                          <span className="font-bold text-zinc-900">{formatPace(decoupling.secondHalf.paceSec)}/km</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-600">HR:</span>
                          <span className="font-bold text-rose-700 flex items-center gap-1">
                            {decoupling.secondHalf.avgHr} bpm
                            {decoupling.driftDeltaHr > 0 && (
                              <span className="text-[9px] text-rose-600 font-normal">
                                (+{decoupling.driftDeltaHr})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-600">EF:</span>
                          <span className="font-bold text-zinc-900">{decoupling.secondHalf.ef}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coach Physiological Insight */}
                  <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-xs flex items-start gap-2">
                    <Zap className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5 stroke-[2.5]" />
                    <div className="text-[11px] leading-relaxed text-zinc-800">
                      <strong className="text-zinc-950 font-bold block mb-0.5">Physiological Insight:</strong>
                      {decoupling.coachInsight}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Trail / Mountain Section */}
            {(selectedActivity.sportType === "trail_run" || selectedActivity.elevationGain > 150) && (
              <div className="p-4 rounded-xl bg-cyan-50 border-2 border-zinc-950 space-y-2.5 text-xs shadow-[2px_2px_0px_0px_#09090b]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-black text-zinc-950">
                    <Mountain className="h-4 w-4 stroke-[2.5]" />
                    Mountain Dynamics (Uphill Athlete & ITRA)
                  </span>
                  <span className="text-[10px] font-mono font-bold text-zinc-600">Minetti Model</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                  <div className="p-2.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                    <span className="text-[10px] text-zinc-600 block font-bold">ITRA Km-Effort</span>
                    <span className="text-emerald-700 font-black text-sm">
                      {calculateKmEffort(parseFloat(selectedActivity.distanceKm), selectedActivity.elevationGain)} km-eff
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                    <span className="text-[10px] text-zinc-600 block font-bold">Effort Pace (GAP)</span>
                    <span className="text-orange-600 font-black text-sm">
                      {formatPace(calculateGapPace(selectedActivity.avgPaceSec, parseFloat(selectedActivity.distanceKm) * 1000, selectedActivity.elevationGain))} /km
                    </span>
                  </div>
                </div>

                <div className="flex justify-between text-zinc-800 pt-1 font-medium">
                  <span>Elevation Profile</span>
                  <span className="font-mono font-black text-zinc-950">
                    +{selectedActivity.elevationGain}m / -{selectedActivity.elevationLoss}m
                  </span>
                </div>
                {selectedActivity.vam > 0 && (
                  <div className="flex justify-between text-zinc-800 font-medium">
                    <span>Ascent Speed (VAM)</span>
                    <span className="font-mono font-black text-cyan-800">{selectedActivity.vam} m/h</span>
                  </div>
                )}
                {selectedActivity.decouplingPct > 0 && (
                  <div className="flex justify-between text-zinc-800 font-medium">
                    <span>Aerobic Decoupling</span>
                    <span className="font-mono font-black text-rose-700">{selectedActivity.decouplingPct}%</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={() => setSharingActivity(selectedActivity)}
                className="flex-1 py-2.5 text-xs font-black rounded-xl bg-amber-300 hover:bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Share Workout Card (Story / Feed)</span>
              </button>
              <button
                onClick={() => setSelectedActivity(null)}
                className="px-4 py-2.5 text-xs font-black rounded-xl bg-zinc-950 hover:bg-zinc-850 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Social Media Share Modal */}
      {sharingActivity && (
        <ActivityShareModal
          activity={sharingActivity}
          onClose={() => setSharingActivity(null)}
        />
      )}
    </div>
  );
};
