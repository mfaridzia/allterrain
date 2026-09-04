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
  Dumbbell,
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
  Check,
  Filter,
  Share2,
} from "lucide-react";
import { formatPace, calculateKmEffort, calculateGapPace } from "@/lib/analytics";
import { ActivityItem } from "@/components/ActivityFeed";
import { Header } from "@/components/Header";
import { ActivityShareModal } from "@/components/ActivityShareModal";

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [selectedSports, setSelectedSports] = useState<string[]>(["all"]);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "dist_desc" | "gain_desc" | "load_desc">("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [sharingActivity, setSharingActivity] = useState<ActivityItem | null>(null);

  const PAGE_SIZE = 20;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/api/analytics/dashboard");
        if (res.ok) {
          const data = await res.json();
          if (!data.connected) {
            window.location.href = "/";
            return;
          }
          setActivities(data.activities || []);
        } else {
          window.location.href = "/";
        }
      } catch (err) {
        console.error("Failed to load activities:", err);
        window.location.href = "/";
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Extract distinct available months from activities (sorted descending)
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activities) {
      const d = new Date(a.startTime);
      if (isNaN(d.getTime())) continue;
      const yyyy = d.getFullYear();
      const mm = (d.getMonth() + 1).toString().padStart(2, "0");
      const key = `${yyyy}-${mm}`;
      if (!map.has(key)) {
        const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
        map.set(key, label);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [activities]);

  const timeRangeLabel = useMemo(() => {
    if (timeFilter === "all") return "Semua Waktu";
    if (timeFilter === "180d") return "6 Bulan Terakhir";
    if (timeFilter === "365d") return "1 Tahun Terakhir";
    if (timeFilter.startsWith("month:")) {
      const ym = timeFilter.replace("month:", "");
      const [year, month] = ym.split("-");
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return `Bulan ${d.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`;
    }
    return "Periode Kustom";
  }, [timeFilter]);

  const toggleSport = (sportId: string) => {
    setCurrentPage(1);
    if (sportId === "all") {
      setSelectedSports(["all"]);
      return;
    }

    let next = selectedSports.filter((s) => s !== "all");
    if (next.includes(sportId)) {
      next = next.filter((s) => s !== sportId);
    } else {
      next = [...next, sportId];
    }

    if (next.length === 0) {
      setSelectedSports(["all"]);
    } else {
      setSelectedSports(next);
    }
  };

  // Filter & Search & Sort
  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const result = activities.filter((a) => {
      // 1. Time range filter (Specific calendar month OR relative range)
      if (timeFilter.startsWith("month:")) {
        const targetYm = timeFilter.replace("month:", "");
        const d = new Date(a.startTime);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = (d.getMonth() + 1).toString().padStart(2, "0");
          if (`${yyyy}-${mm}` !== targetYm) return false;
        }
      } else if (timeFilter === "180d") {
        const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
        const actTime = new Date(a.startTime).getTime();
        if (actTime < cutoff) return false;
      } else if (timeFilter === "365d") {
        const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
        const actTime = new Date(a.startTime).getTime();
        if (actTime < cutoff) return false;
      }

      // 2. Search query filter
      if (q) {
        const matchesName = a.name.toLowerCase().includes(q);
        const matchesSport = a.sportType.toLowerCase().includes(q);
        if (!matchesName && !matchesSport) return false;
      }

      // 3. Multi-select Sport Filter
      if (selectedSports.includes("all")) return true;

      const isTrail = a.sportType === "trail_run" || a.elevationGain > 200;
      const isRoad =
        (a.sportType === "run" || a.sportType === "track_run" || a.sportType === "indoor_run") &&
        a.elevationGain <= 200;
      const isBike = a.sportType === "bike" || a.sportType === "cycling";
      const isStrength =
        a.sportType === "strength" || a.sportType === "gym" || a.sportType === "weight";

      if (selectedSports.includes("road") && isRoad) return true;
      if (selectedSports.includes("trail") && isTrail) return true;
      if (selectedSports.includes("bike") && isBike) return true;
      if (selectedSports.includes("strength") && isStrength) return true;

      return false;
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
  }, [activities, searchQuery, selectedSports, timeFilter, sortBy]);

  // Dynamic Summary Stats based on filtered activities
  const stats = useMemo(() => {
    let totalDist = 0;
    let totalGain = 0;
    let totalDurationMin = 0;
    let totalLoad = 0;
    let trailCount = 0;
    let roadCount = 0;
    let bikeCount = 0;
    let strengthCount = 0;

    for (const a of filteredAndSorted) {
      totalDist += parseFloat(a.distanceKm) || 0;
      totalGain += a.elevationGain || 0;
      totalDurationMin += a.durationMin || 0;
      totalLoad += a.trainingLoad || 0;

      const isTrail = a.sportType === "trail_run" || a.elevationGain > 200;
      const isBike = a.sportType === "bike" || a.sportType === "cycling";
      const isStrength = a.sportType === "strength" || a.sportType === "gym" || a.sportType === "weight";

      if (isTrail) trailCount++;
      else if (isBike) bikeCount++;
      else if (isStrength) strengthCount++;
      else roadCount++;
    }

    const totalHours = (totalDurationMin / 60).toFixed(1);

    return {
      totalActivities: filteredAndSorted.length,
      totalDistKm: totalDist.toFixed(1),
      totalGainM: Math.round(totalGain),
      totalHours,
      totalLoad: Math.round(totalLoad),
      trailCount,
      roadCount,
      bikeCount,
      strengthCount,
    };
  }, [filteredAndSorted]);

  const totalPages = Math.ceil(filteredAndSorted.length / PAGE_SIZE);
  const paginatedList = filteredAndSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

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

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-zinc-950 antialiased">
      {/* Universal Global Navigation Shell */}
      <Header
        extraActions={
          <span className="text-[10px] uppercase font-mono font-black px-2.5 py-1 rounded-full border-2 border-zinc-950 bg-orange-100 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            {activities.length} Sesi
          </span>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Title & Context Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b-2 border-zinc-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2.5">
              <span>Athlete Workouts & Activity Logbook</span>
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-orange-200 text-orange-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                {filteredAndSorted.length} dari {activities.length} Sesi
              </span>
            </h1>
            <p className="text-xs font-medium text-zinc-600 mt-1">
              Filter periode & jenis olahraga untuk melihat akumulasi statistik dan riwayat sesi latihan.
            </p>
          </div>

          {/* Time Range & Calendar Month Filter */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white rounded-xl border-2 border-zinc-950 self-start lg:self-auto shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center gap-1 px-2 text-[10px] font-black uppercase text-zinc-500">
              <Calendar className="h-3.5 w-3.5 text-zinc-950" />
              <span>Periode:</span>
            </div>

            {/* Quick Preset: Semua */}
            <button
              onClick={() => {
                setTimeFilter("all");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                timeFilter === "all"
                  ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
              }`}
            >
              Semua
            </button>

            {/* Month Picker Dropdown */}
            <div className="relative inline-flex items-center">
              <select
                value={timeFilter.startsWith("month:") ? timeFilter : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setTimeFilter(e.target.value);
                    setCurrentPage(1);
                  }
                }}
                className={`text-xs font-black rounded-lg pl-2.5 pr-7 py-1.5 appearance-none cursor-pointer transition-all border ${
                  timeFilter.startsWith("month:")
                    ? "bg-amber-300 text-zinc-950 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                    : "bg-[#FAF9F5] text-zinc-700 border-zinc-300 hover:border-zinc-950 hover:text-zinc-950"
                }`}
              >
                <option value="" disabled>
                  🗓️ Pilih Bulan...
                </option>
                {availableMonths.map(([ym, label]) => (
                  <option key={ym} value={`month:${ym}`}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2 text-zinc-700 text-[9px] font-black">
                ▼
              </div>
            </div>

            {/* Quick Preset: 6 Bulan */}
            <button
              onClick={() => {
                setTimeFilter("180d");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                timeFilter === "180d"
                  ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
              }`}
            >
              6 Bulan
            </button>

            {/* Quick Preset: 1 Tahun */}
            <button
              onClick={() => {
                setTimeFilter("365d");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                timeFilter === "365d"
                  ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
              }`}
            >
              1 Tahun
            </button>
          </div>
        </div>

        {/* KPI Stats Overview (Dynamically Reflects Filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-1 shadow-[3px_3px_0px_0px_#09090b]">
            <span className="text-[11px] text-zinc-700 font-bold">Total Aktivitas</span>
            <div className="text-2xl font-black text-zinc-950 font-mono">{stats.totalActivities}</div>
            <p className="text-[10px] font-medium text-zinc-600 truncate">
              {stats.roadCount} Road • {stats.trailCount} Trail
              {stats.bikeCount > 0 ? ` • ${stats.bikeCount} Bike` : ""}
              {stats.strengthCount > 0 ? ` • ${stats.strengthCount} Gym` : ""}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-1 shadow-[3px_3px_0px_0px_#09090b]">
            <span className="text-[11px] text-zinc-700 font-bold">Total Jarak</span>
            <div className="text-2xl font-black text-zinc-950 font-mono">
              {stats.totalDistKm} <span className="text-xs font-normal text-zinc-500">km</span>
            </div>
            <p className="text-[10px] font-medium text-zinc-600">{timeRangeLabel}</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-1 shadow-[3px_3px_0px_0px_#09090b]">
            <span className="text-[11px] text-emerald-800 font-black flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
              Total Elevasi (D+)
            </span>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              +{stats.totalGainM.toLocaleString()} <span className="text-xs font-normal text-zinc-500">m</span>
            </div>
            <p className="text-[10px] font-medium text-zinc-600">Altimeter barometrik</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-1 shadow-[3px_3px_0px_0px_#09090b]">
            <span className="text-[11px] text-zinc-700 font-bold">Total Waktu Latihan</span>
            <div className="text-2xl font-black text-zinc-950 font-mono">
              {stats.totalHours} <span className="text-xs font-normal text-zinc-500">jam</span>
            </div>
            <p className="text-[10px] font-medium text-zinc-600">Time on feet & gym</p>
          </div>

          <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-1 shadow-[3px_3px_0px_0px_#09090b]">
            <span className="text-[11px] text-orange-800 font-black flex items-center gap-1">
              <Zap className="h-3 w-3 stroke-[2.5]" />
              Training Load
            </span>
            <div className="text-2xl font-black text-orange-600 font-mono">
              {stats.totalLoad.toLocaleString()}
            </div>
            <p className="text-[10px] font-medium text-zinc-600">Akumulasi TRIMP</p>
          </div>
        </div>

        {/* Toolbar: Search, Multi-Select Sport Filter, & Sort */}
        <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-3 shadow-[4px_4px_0px_0px_#09090b]">
          {/* Top Row: Search & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 stroke-[2.5]" />
              <input
                type="text"
                placeholder="Cari sesi latihan (nama, lokasi, rute)..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-[#FAF9F5] border-2 border-zinc-950 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-950 placeholder-zinc-500 focus:outline-none focus:bg-white font-medium shadow-[1.5px_1.5px_0px_0px_#09090b]"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-950"
                >
                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-[#FAF9F5] px-3 py-2 rounded-xl border-2 border-zinc-950 text-xs font-bold text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] self-start sm:self-auto">
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-600 stroke-[2.5]" />
              <span className="text-[11px] text-zinc-500 font-sans">Urutan:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-zinc-950 text-xs font-black focus:outline-none cursor-pointer pr-1"
              >
                <option value="date_desc">Terbaru</option>
                <option value="date_asc">Terlama</option>
                <option value="dist_desc">Jarak Terjauh</option>
                <option value="gain_desc">Elevasi (D+) Tertinggi</option>
                <option value="load_desc">Training Load Terbesar</option>
              </select>
            </div>
          </div>

          {/* Bottom Row: Multi-Select Sport Filter Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-1 mr-1">
                <Filter className="h-3 w-3 text-zinc-950" />
                Jenis Sesi:
              </span>

              {/* All Sports Pill */}
              <button
                type="button"
                onClick={() => toggleSport("all")}
                className={`px-3 py-1.5 text-xs font-black rounded-xl border-2 border-zinc-950 transition-all ${
                  selectedSports.includes("all")
                    ? "bg-zinc-950 text-white shadow-[2px_2px_0px_0px_#09090b]"
                    : "bg-[#FAF9F5] text-zinc-700 hover:text-zinc-950 hover:bg-white"
                }`}
              >
                Semua Jenis
              </button>

              {/* Road Run Pill */}
              <button
                type="button"
                onClick={() => toggleSport("road")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl border-2 border-zinc-950 transition-all ${
                  selectedSports.includes("road")
                    ? "bg-orange-400 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                    : "bg-[#FAF9F5] text-zinc-700 hover:text-zinc-950 hover:bg-white"
                }`}
              >
                <Footprints className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Road Run</span>
                {selectedSports.includes("road") && <Check className="h-3 w-3 stroke-[3]" />}
              </button>

              {/* Trail Run Pill */}
              <button
                type="button"
                onClick={() => toggleSport("trail")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl border-2 border-zinc-950 transition-all ${
                  selectedSports.includes("trail")
                    ? "bg-cyan-300 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                    : "bg-[#FAF9F5] text-zinc-700 hover:text-zinc-950 hover:bg-white"
                }`}
              >
                <Mountain className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Trail Run</span>
                {selectedSports.includes("trail") && <Check className="h-3 w-3 stroke-[3]" />}
              </button>

              {/* Bike Pill */}
              <button
                type="button"
                onClick={() => toggleSport("bike")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl border-2 border-zinc-950 transition-all ${
                  selectedSports.includes("bike")
                    ? "bg-emerald-300 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                    : "bg-[#FAF9F5] text-zinc-700 hover:text-zinc-950 hover:bg-white"
                }`}
              >
                <Bike className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Sepeda</span>
                {selectedSports.includes("bike") && <Check className="h-3 w-3 stroke-[3]" />}
              </button>

              {/* Strength Pill */}
              <button
                type="button"
                onClick={() => toggleSport("strength")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl border-2 border-zinc-950 transition-all ${
                  selectedSports.includes("strength")
                    ? "bg-purple-300 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                    : "bg-[#FAF9F5] text-zinc-700 hover:text-zinc-950 hover:bg-white"
                }`}
              >
                <Dumbbell className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Gym / Strength</span>
                {selectedSports.includes("strength") && <Check className="h-3 w-3 stroke-[3]" />}
              </button>
            </div>

            {/* Reset Filter Button if active */}
            {(!selectedSports.includes("all") || timeFilter !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSports(["all"]);
                  setTimeFilter("all");
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="text-[11px] font-black text-rose-700 hover:text-rose-900 underline cursor-pointer"
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        </div>

        {/* Activities Table / List */}
        <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-4 shadow-[4px_4px_0px_0px_#09090b]">
          {loading ? (
            <div className="py-16 text-center text-zinc-600 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-orange-600 stroke-[2.5]" />
              <p className="text-xs font-black font-mono">Memuat riwayat latihan COROS...</p>
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="py-16 text-center text-zinc-600 text-xs space-y-2 font-medium">
              <p>Tidak ada aktivitas yang cocok dengan filter atau pencarian Anda.</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSports(["all"]);
                  setTimeFilter("all");
                  setCurrentPage(1);
                }}
                className="text-orange-600 hover:underline font-black text-xs cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
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
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-[#FAF9F5] hover:bg-white border-2 border-zinc-950 hover:shadow-[3px_3px_0px_0px_#09090b] hover:-translate-y-0.5 transition-all cursor-pointer group gap-3 shadow-[2px_2px_0px_0px_#09090b]"
                  >
                    {/* Left: Icon, Name & Date */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-white border-2 border-zinc-950 flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                        {getSportIcon(act.sportType, act.elevationGain)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-zinc-950 group-hover:text-orange-600 transition-colors truncate">
                            {act.name}
                          </h4>
                          {isTrail && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-200 text-cyan-950 border border-zinc-950 font-black shrink-0">
                              TRAIL
                            </span>
                          )}
                          {(act.sportType === "bike" || act.sportType === "cycling") && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-950 border border-zinc-950 font-black shrink-0">
                              BIKE
                            </span>
                          )}
                          {(act.sportType === "strength" || act.sportType === "gym") && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-200 text-purple-950 border border-zinc-950 font-black shrink-0">
                              STRENGTH
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono font-medium text-zinc-600">
                          {dateStr} • {act.durationMin} menit
                        </p>
                      </div>
                    </div>

                    {/* Right: Metrics row */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 font-mono text-xs shrink-0 pt-2 sm:pt-0 border-t-2 sm:border-t-0 border-zinc-200">
                      {/* Distance or Duration for Strength */}
                      <div className="text-right">
                        {act.sportType === "strength" || act.sportType === "gym" ? (
                          <>
                            <div className="font-black text-purple-700 text-sm">
                              {act.durationMin} <span className="text-[10px] font-normal text-zinc-500">min</span>
                            </div>
                            <div className="text-[10px] text-zinc-600 font-sans font-bold">Durasi Gym</div>
                          </>
                        ) : (
                          <>
                            <div className="font-black text-zinc-950 text-sm">
                              {act.distanceKm} <span className="text-[10px] font-normal text-zinc-500">km</span>
                            </div>
                            <div className="text-[10px] text-zinc-600 font-sans font-bold">Jarak</div>
                          </>
                        )}
                      </div>

                      {/* Pace or Speed */}
                      <div className="text-right">
                        <div className="font-black text-zinc-900">{formatSpeedOrPace(act)}</div>
                        <div className="text-[10px] text-zinc-600 font-sans font-bold">
                          {act.sportType === "bike" || act.sportType === "cycling"
                            ? "Kecepatan"
                            : act.sportType === "strength" || act.sportType === "gym"
                            ? "Kategori"
                            : "Pace"}
                        </div>
                      </div>

                      {/* Heart Rate */}
                      <div className="text-right hidden sm:block">
                        <div className="font-black text-rose-700 flex items-center justify-end gap-1">
                          <Heart className="h-3 w-3 shrink-0 stroke-[2.5]" />
                          <span>{act.avgHr || "--"}</span>
                        </div>
                        <div className="text-[10px] text-zinc-600 font-sans font-bold">Avg HR</div>
                      </div>

                      {/* Training Load */}
                      <div className="text-right">
                        <div className="font-black text-orange-600 flex items-center justify-end gap-1">
                          <Flame className="h-3 w-3 shrink-0 stroke-[2.5]" />
                          <span>{act.trainingLoad}</span>
                        </div>
                        <div className="text-[10px] text-zinc-600 font-sans font-bold">Load</div>
                      </div>

                      {/* Trail D+ & Km-Effort */}
                      {isTrail ? (
                        <div className="text-right pl-2 border-l-2 border-zinc-200">
                          <div className="font-black text-cyan-800 text-xs">+{act.elevationGain}m</div>
                          <div className="text-[10px] text-emerald-700 font-black">
                            {calculateKmEffort(parseFloat(act.distanceKm), act.elevationGain)} km-eff
                          </div>
                        </div>
                      ) : (
                        <div className="text-right pl-2 border-l-2 border-zinc-200 text-zinc-500 text-xs hidden sm:block">
                          <div className="font-black text-zinc-800">+{act.elevationGain}m</div>
                          <div className="text-[10px] text-zinc-500 font-sans">Flat Road</div>
                        </div>
                      )}

                      <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-950 transition-colors stroke-[2.5] shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t-2 border-zinc-100 text-xs">
              <div className="text-zinc-600 font-mono text-[11px] font-medium">
                Menampilkan <strong className="text-zinc-950 font-black">{(currentPage - 1) * PAGE_SIZE + 1}</strong> -{" "}
                <strong className="text-zinc-950 font-black">{Math.min(currentPage * PAGE_SIZE, filteredAndSorted.length)}</strong> dari{" "}
                <strong className="text-zinc-950 font-black">{filteredAndSorted.length}</strong> aktivitas
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
          )}
        </div>
      </main>

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
                  className="p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] transition-colors"
                >
                  <X className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Core Stats 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[11px] text-zinc-700 font-sans font-bold block">
                  {selectedActivity.sportType === "strength" || selectedActivity.sportType === "gym"
                    ? "Fokus Sesi"
                    : "Jarak"}
                </span>
                <span className="text-xl font-black text-zinc-950">
                  {selectedActivity.sportType === "strength" || selectedActivity.sportType === "gym"
                    ? "Gym / Strength"
                    : `${selectedActivity.distanceKm} km`}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[11px] text-zinc-700 font-sans font-bold block">Durasi</span>
                <span className="text-xl font-black text-zinc-950">{selectedActivity.durationMin} m</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[11px] text-zinc-700 font-sans font-bold block">
                  {selectedActivity.sportType === "bike" || selectedActivity.sportType === "cycling"
                    ? "Kecepatan Rata-Rata"
                    : selectedActivity.sportType === "strength" || selectedActivity.sportType === "gym"
                    ? "Kategori Sesi"
                    : "Pace Rata-Rata"}
                </span>
                <span className="text-xl font-black text-orange-600">
                  {formatSpeedOrPace(selectedActivity)}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[11px] text-zinc-700 font-sans font-bold block">Detak Jantung</span>
                <span className="text-xl font-black text-rose-700">
                  {selectedActivity.avgHr} <span className="text-xs text-zinc-500 font-normal">/ {selectedActivity.maxHr} max</span>
                </span>
              </div>
            </div>

            {/* Training Effect & Load */}
            <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-2 shadow-[2px_2px_0px_0px_#09090b]">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-zinc-900">Training Load:</span>
                <span className="text-orange-600 font-mono text-sm">{selectedActivity.trainingLoad}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-zinc-200">
                <div>
                  <span className="text-[10px] text-zinc-600 block font-bold">Aerobic TE:</span>
                  <span className="font-black text-emerald-700 font-mono">{selectedActivity.aerobicTe || 0} / 5.0</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-600 block font-bold">Anaerobic TE:</span>
                  <span className="font-black text-purple-700 font-mono">{selectedActivity.anaerobicTe || 0} / 5.0</span>
                </div>
              </div>
            </div>

            {/* Trail / Mountain Dynamics Section */}
            {(selectedActivity.sportType === "trail_run" || selectedActivity.elevationGain > 150) && (
              <div className="p-4 rounded-xl bg-cyan-50 border-2 border-zinc-950 space-y-2.5 shadow-[2px_2px_0px_0px_#09090b]">
                <div className="flex items-center gap-1.5 text-xs font-black text-zinc-950">
                  <Mountain className="h-4 w-4 stroke-[2.5]" />
                  <span>Mountain & Trail Dynamics</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                    <span className="text-[10px] text-zinc-600 block font-sans font-bold">Elevasi Naik / Turun</span>
                    <span className="text-emerald-700 font-black">+{selectedActivity.elevationGain}m</span>
                    <span className="text-rose-700 font-black ml-1.5">-{selectedActivity.elevationLoss || 0}m</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                    <span className="text-[10px] text-zinc-600 block font-sans font-bold">ITRA Km-Effort</span>
                    <span className="text-cyan-800 font-black">
                      {calculateKmEffort(parseFloat(selectedActivity.distanceKm), selectedActivity.elevationGain)} km-eff
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                    <span className="text-[10px] text-zinc-600 block font-sans font-bold">Effort Pace (GAP)</span>
                    <span className="text-orange-600 font-black">
                      {formatPace(calculateGapPace(selectedActivity.avgPaceSec, parseFloat(selectedActivity.distanceKm) * 1000, selectedActivity.elevationGain))}/km
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                    <span className="text-[10px] text-zinc-600 block font-sans font-bold">Kecepatan Tanjak (VAM)</span>
                    <span className="text-amber-800 font-black">
                      {selectedActivity.vam || Math.round((selectedActivity.elevationGain / (selectedActivity.durationMin / 60)))} m/h
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={() => setSharingActivity(selectedActivity)}
                className="flex-1 py-2.5 text-xs font-black rounded-xl bg-amber-300 hover:bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Bagikan Kartu Latihan (Story / Feed)</span>
              </button>
              <button
                onClick={() => setSelectedActivity(null)}
                className="px-4 py-2.5 text-xs font-black rounded-xl bg-zinc-950 hover:bg-zinc-850 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] transition-all cursor-pointer"
              >
                Tutup
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
}
