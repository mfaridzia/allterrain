"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Activity, Mountain, Bike, Footprints, Flame, Heart, ArrowUpRight, ArrowDownRight, Compass, ChevronRight, X } from "lucide-react";
import { formatPace, calculateKmEffort, calculateGapPace } from "@/lib/analytics";

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

  const PAGE_SIZE = 20;

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const filtered = activities.filter((a) => {
    if (filter === "all") return true;
    if (filter === "trail") return a.sportType === "trail_run" || a.elevationGain > 200;
    if (filter === "road") return a.sportType === "run" && a.elevationGain <= 200;
    return a.sportType.toLowerCase().includes(filter);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const itemsToDisplay = compact
    ? filtered.slice(0, maxCompactItems)
    : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getSportIcon = (sportType: string, elevGain: number) => {
    if (sportType === "trail_run" || elevGain > 200) {
      return <Mountain className="h-4 w-4 text-cyan-400" />;
    }
    if (sportType === "bike" || sportType === "cycling") {
      return <Bike className="h-4 w-4 text-emerald-400" />;
    }
    return <Footprints className="h-4 w-4 text-orange-400" />;
  };

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-4 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Recent Workouts & Sessions</h3>
            <p className="text-[11px] text-zinc-400">Pace • HR Zones • Training Load • VAM</p>
          </div>
        </div>

        {/* Header Right: Filter buttons & Logbook link */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {compact && (
            <Link
              href="/activities"
              className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 transition-colors mr-1"
            >
              <span>Logbook ({activities.length})</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}

          {/* Filter buttons */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {[
              { id: "all", label: "All" },
              { id: "road", label: "Road" },
              { id: "trail", label: "Trail" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleFilterChange(item.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  filter === item.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
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
        <div className="p-8 text-center text-xs text-zinc-500">
          No workouts found for this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {itemsToDisplay.map((act) => {
            const isTrail = act.sportType === "trail_run" || act.elevationGain > 200;
            const dateStr = new Date(act.startTime).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            });

            return (
              <div
                key={act.id}
                onClick={() => setSelectedActivity(act)}
                className="p-3 rounded-xl bg-zinc-950/70 hover:bg-zinc-800/60 border border-zinc-800/80 cursor-pointer transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    {getSportIcon(act.sportType, act.elevationGain)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-200 truncate group-hover:text-orange-400 transition-colors">
                        {act.name}
                      </span>
                      {isTrail && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                          TRAIL
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span>{act.durationMin}m</span>
                      <span>•</span>
                      <span>{formatPace(act.avgPaceSec)}/km</span>
                      <span>•</span>
                      <span>HR {act.avgHr} bpm</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <div className="text-sm font-extrabold text-white font-mono">
                      {act.distanceKm} <span className="text-[10px] font-normal text-zinc-400">km</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      Load {act.trainingLoad}
                    </div>
                  </div>

                  {isTrail && act.elevationGain > 0 && (
                    <div className="hidden sm:block text-right">
                      <div className="text-xs font-bold text-cyan-400 font-mono">
                        +{act.elevationGain}m • {calculateKmEffort(parseFloat(act.distanceKm), act.elevationGain)} <span className="text-[9px] font-normal text-zinc-400">km-eff</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        GAP {formatPace(calculateGapPace(act.avgPaceSec, parseFloat(act.distanceKm) * 1000, act.elevationGain))}/km
                      </div>
                    </div>
                  )}

                  <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: Compact mode CTA or Full Pagination Controls */}
      {compact ? (
        <div className="pt-2 border-t border-zinc-800/80">
          <Link
            href="/activities"
            className="w-full py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-900 text-xs font-bold text-orange-400 flex items-center justify-center gap-2 transition-all shadow-sm group"
          >
            <span>Buka Logbook Lengkap ({activities.length} Aktivitas Tersimpan)</span>
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      ) : (
        totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-800/80 text-xs">
            <div className="text-zinc-400 font-mono text-[11px]">
              Menampilkan <strong className="text-white font-bold">{(currentPage - 1) * PAGE_SIZE + 1}</strong> -{" "}
              <strong className="text-white font-bold">{Math.min(currentPage * PAGE_SIZE, filtered.length)}</strong> dari{" "}
              <strong className="text-white font-bold">{filtered.length}</strong> aktivitas
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg font-mono text-xs font-bold transition-colors ${
                    currentPage === pageNum
                      ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )
      )}

      {/* Activity Detail Modal / Inspector */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  {getSportIcon(selectedActivity.sportType, selectedActivity.elevationGain)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedActivity.name}</h3>
                  <p className="text-xs text-zinc-400">
                    {new Date(selectedActivity.startTime).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedActivity(null)}
                className="p-1 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">Distance</span>
                <div className="text-xl font-bold text-white font-mono">{selectedActivity.distanceKm} km</div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">Moving Time</span>
                <div className="text-xl font-bold text-white font-mono">{selectedActivity.durationMin} min</div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">Avg Pace</span>
                <div className="text-xl font-bold text-orange-400 font-mono">
                  {formatPace(selectedActivity.avgPaceSec)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">Avg / Max HR</span>
                <div className="text-sm font-bold text-white font-mono">
                  {selectedActivity.avgHr} / {selectedActivity.maxHr} bpm
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">Training Load</span>
                <div className="text-xl font-bold text-amber-400 font-mono">{selectedActivity.trainingLoad}</div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400">Training Effect</span>
                <div className="text-sm font-bold text-emerald-400 font-mono">
                  A: {selectedActivity.aerobicTe} | An: {selectedActivity.anaerobicTe}
                </div>
              </div>
            </div>

            {/* Trail / Mountain Uphill Athlete Section */}
            {(selectedActivity.elevationGain > 0 || selectedActivity.sportType === "trail_run") && (
              <div className="p-4 rounded-xl bg-zinc-900/90 border border-cyan-900/40 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-cyan-300">
                    <Mountain className="h-4 w-4 text-cyan-400" />
                    Mountain Dynamics (Uphill Athlete & ITRA)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">Minetti Model</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block">ITRA Km-Effort</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {calculateKmEffort(parseFloat(selectedActivity.distanceKm), selectedActivity.elevationGain)} km-eff
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block">Effort Pace (GAP)</span>
                    <span className="text-orange-400 font-bold text-sm">
                      {formatPace(calculateGapPace(selectedActivity.avgPaceSec, parseFloat(selectedActivity.distanceKm) * 1000, selectedActivity.elevationGain))} /km
                    </span>
                  </div>
                </div>

                <div className="flex justify-between text-zinc-300 pt-1">
                  <span className="text-zinc-400">Elevation Profile</span>
                  <span className="font-mono font-bold text-white">
                    +{selectedActivity.elevationGain}m / -{selectedActivity.elevationLoss}m
                  </span>
                </div>
                {selectedActivity.vam > 0 && (
                  <div className="flex justify-between text-zinc-300">
                    <span className="text-zinc-400">Ascent Speed (VAM)</span>
                    <span className="font-mono font-bold text-cyan-300">{selectedActivity.vam} m/h</span>
                  </div>
                )}
                {selectedActivity.decouplingPct > 0 && (
                  <div className="flex justify-between text-zinc-300">
                    <span className="text-zinc-400">Aerobic Decoupling (Cardiac Drift)</span>
                    <span className="font-mono font-bold text-rose-400">{selectedActivity.decouplingPct}%</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setSelectedActivity(null)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
