"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Search,
  Mountain,
  Footprints,
  Bike,
  Flame,
  Heart,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  ChevronRight,
  X,
  Zap,
  SlidersHorizontal,
  RefreshCw,
  TrendingUp,
  Clock,
  Calendar,
} from "lucide-react";
import { formatPace, calculateKmEffort, calculateGapPace } from "@/lib/analytics";
import { ActivityItem } from "@/components/ActivityFeed";
import { Header } from "@/components/Header";

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "dist_desc" | "gain_desc" | "load_desc">("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  const PAGE_SIZE = 20;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/api/analytics/dashboard");
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (err) {
        console.error("Failed to load activities:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Career / Logbook Summary Stats
  const stats = useMemo(() => {
    let totalDist = 0;
    let totalGain = 0;
    let totalDurationMin = 0;
    let totalLoad = 0;
    let trailCount = 0;

    for (const a of activities) {
      totalDist += parseFloat(a.distanceKm) || 0;
      totalGain += a.elevationGain || 0;
      totalDurationMin += a.durationMin || 0;
      totalLoad += a.trainingLoad || 0;
      if (a.sportType === "trail_run" || a.elevationGain > 200) trailCount++;
    }

    const totalHours = (totalDurationMin / 60).toFixed(1);

    return {
      totalActivities: activities.length,
      totalDistKm: totalDist.toFixed(1),
      totalGainM: Math.round(totalGain),
      totalHours,
      totalLoad: Math.round(totalLoad),
      trailCount,
      roadCount: activities.length - trailCount,
    };
  }, [activities]);

  // Filter & Search & Sort
  const filteredAndSorted = useMemo(() => {
    let result = activities.filter((a) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = a.name.toLowerCase().includes(q);
        const matchesSport = a.sportType.toLowerCase().includes(q);
        if (!matchesName && !matchesSport) return false;
      }

      // Sport Filter
      if (sportFilter === "trail") {
        return a.sportType === "trail_run" || a.elevationGain > 200;
      }
      if (sportFilter === "road") {
        return a.sportType === "run" && a.elevationGain <= 200;
      }
      if (sportFilter === "bike") {
        return a.sportType === "bike" || a.sportType === "cycling";
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === "date_desc") return b.startTime - a.startTime;
      if (sortBy === "date_asc") return a.startTime - b.startTime;
      if (sortBy === "dist_desc") return parseFloat(b.distanceKm) - parseFloat(a.distanceKm);
      if (sortBy === "gain_desc") return b.elevationGain - a.elevationGain;
      if (sortBy === "load_desc") return b.trainingLoad - a.trainingLoad;
      return 0;
    });

    return result;
  }, [activities, searchQuery, sportFilter, sortBy]);

  const totalPages = Math.ceil(filteredAndSorted.length / PAGE_SIZE);
  const paginatedList = filteredAndSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFilterChange = (filter: string) => {
    setSportFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {/* Universal Global Navigation Shell */}
      <Header
        extraActions={
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30">
            {activities.length} Sesi
          </span>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Title & Context Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-850">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Athlete Workouts & Activity Logbook</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30">
                {activities.length} Total Sesi
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Riwayat lengkap performa lari, metrik fisiologi, tanjakan D+, dan analisis intensitas.
            </p>
          </div>
        </div>
        {/* KPI Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
            <span className="text-[11px] text-zinc-400 font-medium">Total Aktivitas</span>
            <div className="text-2xl font-black text-white">{stats.totalActivities}</div>
            <p className="text-[10px] text-zinc-500">{stats.roadCount} Road • {stats.trailCount} Trail</p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
            <span className="text-[11px] text-zinc-400 font-medium">Total Jarak Lari</span>
            <div className="text-2xl font-black text-white font-mono">
              {stats.totalDistKm} <span className="text-xs font-normal text-zinc-400">km</span>
            </div>
            <p className="text-[10px] text-zinc-500">Akumulasi 90 hari</p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              Total Elevasi (D+)
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              +{stats.totalGainM.toLocaleString()} <span className="text-xs font-normal text-zinc-400">m</span>
            </div>
            <p className="text-[10px] text-zinc-500">Altimeter barometrik</p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
            <span className="text-[11px] text-zinc-400 font-medium">Total Waktu Latihan</span>
            <div className="text-2xl font-black text-white font-mono">
              {stats.totalHours} <span className="text-xs font-normal text-zinc-400">jam</span>
            </div>
            <p className="text-[10px] text-zinc-500">Time on feet</p>
          </div>

          <div className="col-span-2 sm:col-span-1 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
            <span className="text-[11px] text-orange-400 font-medium flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Total Training Load
            </span>
            <div className="text-2xl font-black text-orange-400 font-mono">
              {stats.totalLoad.toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-500">Akumulasi TRIMP</p>
          </div>
        </div>

        {/* Toolbar: Search, Sport Filter, & Sort */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xl">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari sesi latihan (nama, lokasi, rute)..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sport Tabs */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              {[
                { id: "all", label: "Semua" },
                { id: "road", label: "Road" },
                { id: "trail", label: "Trail" },
                { id: "bike", label: "Sepeda" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleFilterChange(item.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    sportFilter === item.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-800 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-zinc-300 text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="date_desc" className="bg-zinc-950 text-white">Terbaru</option>
                <option value="date_asc" className="bg-zinc-950 text-white">Terlama</option>
                <option value="dist_desc" className="bg-zinc-950 text-white">Jarak Terjauh</option>
                <option value="gain_desc" className="bg-zinc-950 text-white">Elevasi (D+) Tertinggi</option>
                <option value="load_desc" className="bg-zinc-950 text-white">Training Load Terbesar</option>
              </select>
            </div>
          </div>
        </div>

        {/* Activities Table / List */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-4 shadow-xl backdrop-blur-sm">
          {loading ? (
            <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-orange-500" />
              <p className="text-xs font-medium">Memuat riwayat latihan COROS...</p>
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-xs space-y-2">
              <p>Tidak ada aktivitas yang cocok dengan filter atau pencarian Anda.</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSportFilter("all");
                }}
                className="text-orange-400 hover:underline font-bold text-xs"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedList.map((act) => {
                const isTrail = act.sportType === "trail_run" || act.elevationGain > 200;
                const dateStr = new Date(act.startTime).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div
                    key={act.id}
                    onClick={() => setSelectedActivity(act)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer group gap-3"
                  >
                    {/* Left: Icon, Name & Date */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 group-hover:border-zinc-700 transition-colors">
                        {getSportIcon(act.sportType, act.elevationGain)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors truncate">
                            {act.name}
                          </h4>
                          {isTrail && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 font-bold shrink-0">
                              TRAIL
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500">{dateStr} • {act.durationMin} menit</p>
                      </div>
                    </div>

                    {/* Right: Metrics row */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 font-mono text-xs shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-850">
                      {/* Distance */}
                      <div className="text-right">
                        <div className="font-extrabold text-white text-sm">{act.distanceKm} <span className="text-[10px] font-normal text-zinc-400">km</span></div>
                        <div className="text-[10px] text-zinc-500 font-sans">Jarak</div>
                      </div>

                      {/* Pace */}
                      <div className="text-right">
                        <div className="font-bold text-zinc-300">{formatPace(act.avgPaceSec)}<span className="text-[10px] text-zinc-500">/km</span></div>
                        <div className="text-[10px] text-zinc-500 font-sans">Pace</div>
                      </div>

                      {/* Heart Rate */}
                      <div className="text-right hidden sm:block">
                        <div className="font-bold text-rose-400 flex items-center justify-end gap-1">
                          <Heart className="h-3 w-3 shrink-0" />
                          <span>{act.avgHr || "--"}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-sans">Avg HR</div>
                      </div>

                      {/* Training Load */}
                      <div className="text-right">
                        <div className="font-bold text-orange-400 flex items-center justify-end gap-1">
                          <Flame className="h-3 w-3 shrink-0" />
                          <span>{act.trainingLoad}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-sans">Load</div>
                      </div>

                      {/* Trail D+ & Km-Effort */}
                      {isTrail ? (
                        <div className="text-right pl-2 border-l border-zinc-800">
                          <div className="font-extrabold text-cyan-400 text-xs">+{act.elevationGain}m</div>
                          <div className="text-[10px] text-emerald-400 font-semibold">
                            {calculateKmEffort(parseFloat(act.distanceKm), act.elevationGain)} km-eff
                          </div>
                        </div>
                      ) : (
                        <div className="text-right pl-2 border-l border-zinc-800 text-zinc-500 text-xs hidden sm:block">
                          <div>+{act.elevationGain}m</div>
                          <div className="text-[10px] text-zinc-600 font-sans">Flat Road</div>
                        </div>
                      )}

                      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800/80 text-xs">
              <div className="text-zinc-400 font-mono text-[11px]">
                Menampilkan <strong className="text-white font-bold">{(currentPage - 1) * PAGE_SIZE + 1}</strong> -{" "}
                <strong className="text-white font-bold">{Math.min(currentPage * PAGE_SIZE, filteredAndSorted.length)}</strong> dari{" "}
                <strong className="text-white font-bold">{filteredAndSorted.length}</strong> aktivitas
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
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
                        : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Activity Detail Modal / Inspector */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
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
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Core Stats 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400 font-sans block">Jarak</span>
                <span className="text-xl font-extrabold text-white">{selectedActivity.distanceKm} km</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400 font-sans block">Durasi</span>
                <span className="text-xl font-extrabold text-white">{selectedActivity.durationMin} m</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400 font-sans block">Pace Rata-Rata</span>
                <span className="text-xl font-extrabold text-zinc-200">{formatPace(selectedActivity.avgPaceSec)}/km</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-400 font-sans block">Detak Jantung</span>
                <span className="text-xl font-extrabold text-rose-400">
                  {selectedActivity.avgHr} <span className="text-xs text-zinc-500 font-normal">/ {selectedActivity.maxHr} max</span>
                </span>
              </div>
            </div>

            {/* Training Effect & Load */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-zinc-300">Training Load:</span>
                <span className="text-orange-400 font-bold font-mono">{selectedActivity.trainingLoad}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-800">
                <div>
                  <span className="text-[10px] text-zinc-400 block">Aerobic TE:</span>
                  <span className="font-bold text-emerald-400">{selectedActivity.aerobicTe || 0} / 5.0</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block">Anaerobic TE:</span>
                  <span className="font-bold text-purple-400">{selectedActivity.anaerobicTe || 0} / 5.0</span>
                </div>
              </div>
            </div>

            {/* Trail / Mountain Dynamics Section */}
            {(selectedActivity.sportType === "trail_run" || selectedActivity.elevationGain > 150) && (
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                  <Mountain className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Mountain & Trail Dynamics</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-sans">Elevasi Tanjakan / Turunan</span>
                    <span className="text-emerald-400 font-bold">+{selectedActivity.elevationGain}m</span>
                    <span className="text-rose-400 font-bold ml-1.5">-{selectedActivity.elevationLoss || 0}m</span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-sans">ITRA Km-Effort</span>
                    <span className="text-cyan-300 font-bold">
                      {calculateKmEffort(parseFloat(selectedActivity.distanceKm), selectedActivity.elevationGain)} km-eff
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-sans">GAP (Grade Adjusted Pace)</span>
                    <span className="text-white font-bold">
                      {formatPace(calculateGapPace(selectedActivity.avgPaceSec, parseFloat(selectedActivity.distanceKm) * 1000, selectedActivity.elevationGain))}/km
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 block font-sans">Kecepatan Tanjak (VAM)</span>
                    <span className="text-amber-300 font-bold">
                      {selectedActivity.vam || Math.round((selectedActivity.elevationGain / (selectedActivity.durationMin / 60)))} m/h
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedActivity(null)}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition-colors"
            >
              Tutup Detail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
