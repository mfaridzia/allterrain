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
  HeartPulse,
  Scale,
} from "lucide-react";
import {
  formatPace,
  calculateKmEffort,
  calculateGapPace,
  calculateDecouplingAnalysis,
} from "@/lib/analytics";
import { ActivityItem } from "@/components/ActivityFeed";
import { Header } from "@/components/Header";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useDashboardData } from "@/lib/queries";

const ActivityShareModal = dynamic(
  () => import("@/components/ActivityShareModal").then((mod) => mod.ActivityShareModal),
  { ssr: false }
);
const ActivityCompareModal = dynamic(
  () => import("@/components/ActivityCompareModal").then((mod) => mod.ActivityCompareModal),
  { ssr: false }
);

export default function ActivitiesPage() {
  const router = useRouter();
  const { data: dashboardData, isLoading: loading } = useDashboardData();
  const activities: ActivityItem[] = dashboardData?.activities || [];

  useEffect(() => {
    if (dashboardData && !dashboardData.connected) {
      router.replace("/");
    }
  }, [dashboardData, router]);

  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [selectedSports, setSelectedSports] = useState<string[]>(["all"]);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "dist_desc" | "gain_desc" | "load_desc">("date_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [sharingActivity, setSharingActivity] = useState<ActivityItem | null>(null);
  // Compare Activities state (Checkbox multi-selection & Active comparison modal pair)
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [activeComparePair, setActiveComparePair] = useState<{
    actA: ActivityItem;
    actB: ActivityItem;
  } | null>(null);

  const PAGE_SIZE = 20;

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
        const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        map.set(key, label);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [activities]);

  const timeRangeLabel = useMemo(() => {
    if (timeFilter === "all") return "All Time";
    if (timeFilter === "180d") return "Past 6 Months";
    if (timeFilter === "365d") return "Past 1 Year";
    if (timeFilter.startsWith("month:")) {
      const ym = timeFilter.replace("month:", "");
      const [year, month] = ym.split("-");
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return "Custom Period";
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

  // Toggle selection for comparison (Max 2 selected)
  const toggleCompare = (actId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompareIds((prev) => {
      if (prev.includes(actId)) {
        return prev.filter((id) => id !== actId);
      }
      if (prev.length >= 2) {
        // Keep the latest selected one and add the new one
        return [prev[1], actId];
      }
      return [...prev, actId];
    });
  };

  // Launch comparison from multi-selected checkboxes
  const handleLaunchCompare = () => {
    if (compareIds.length < 2) return;
    const actA = activities.find((a) => a.id === compareIds[0]);
    const actB = activities.find((a) => a.id === compareIds[1]);
    if (actA && actB) {
      setActiveComparePair({ actA, actB });
    }
  };

  // Launch comparison directly from within drawer
  const handleCompareFromDrawer = (sourceAct: ActivityItem) => {
    // Find best candidate: activity with closest distance and elevation
    const targetDist = parseFloat(sourceAct.distanceKm || "0");
    const otherActs = activities.filter((a) => a.id !== sourceAct.id);
    if (otherActs.length === 0) return;

    // Pick closest match by distance
    const sortedBySimilarity = [...otherActs].sort((a, b) => {
      const diffA = Math.abs(parseFloat(a.distanceKm || "0") - targetDist);
      const diffB = Math.abs(parseFloat(b.distanceKm || "0") - targetDist);
      return diffA - diffB;
    });

    const bestMatch = sortedBySimilarity[0];
    setActiveComparePair({ actA: sourceAct, actB: bestMatch });
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
            {activities.length} Sessions
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
                {filteredAndSorted.length} of {activities.length} Sessions
              </span>
            </h1>
            <p className="text-xs font-medium text-zinc-600 mt-1">
              Filter by time range and activity type to view aggregate performance metrics and workout history.
            </p>
          </div>

          {/* Time Range & Calendar Month Filter */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white rounded-xl border-2 border-zinc-950 self-start lg:self-auto shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center gap-1 px-2 text-[10px] font-black uppercase text-zinc-500">
              <Calendar className="h-3.5 w-3.5 text-zinc-950" />
              <span>Period:</span>
            </div>

            {/* Quick Preset: All */}
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
              All
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
                  🗓️ Select Month...
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

            {/* Quick Preset: 6 Months */}
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
              6 Months
            </button>

            {/* Quick Preset: 1 Year */}
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
              1 Year
            </button>
          </div>
        </div>

        {/* KPI Stats Overview (Dynamically Reflects Filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-1 shadow-[3px_3px_0px_0px_#09090b]">
            <span className="text-[11px] text-zinc-700 font-bold">Total Activities</span>
            <div className="text-2xl font-black text-zinc-950 font-mono">{stats.totalActivities}</div>
            <p className="text-[10px] font-medium text-zinc-600 truncate">
              {stats.roadCount} Road • {stats.trailCount} Trail
              {stats.bikeCount > 0 ? ` • ${stats.bikeCount} Bike` : ""}
              {stats.strengthCount > 0 ? ` • ${stats.strengthCount} Gym` : ""}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-1 shadow-[3px_3px_0px_0px_#09090b]">
            <span className="text-[11px] text-zinc-700 font-bold">Total Distance</span>
            <div className="text-2xl font-black text-zinc-950 font-mono">
              {stats.totalDistKm} <span className="text-xs font-normal text-zinc-500">km</span>
            </div>
            <p className="text-[10px] font-medium text-zinc-600">{timeRangeLabel}</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-1 shadow-[3px_3px_0px_0px_#09090b]">
            <span className="text-[11px] text-emerald-800 font-black flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
              Total Elevation (D+)
            </span>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              +{stats.totalGainM.toLocaleString()} <span className="text-xs font-normal text-zinc-500">m</span>
            </div>
            <p className="text-[10px] font-medium text-zinc-600">Barometric altimeter</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 space-y-1 shadow-[3px_3px_0px_0px_#09090b]">
            <span className="text-[11px] text-zinc-700 font-bold">Total Training Time</span>
            <div className="text-2xl font-black text-zinc-950 font-mono">
              {stats.totalHours} <span className="text-xs font-normal text-zinc-500">hrs</span>
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
            <p className="text-[10px] font-medium text-zinc-600">Cumulative TRIMP</p>
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
                placeholder="Search workouts (name, route, keyword)..."
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
              <span className="text-[11px] text-zinc-500 font-sans">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-zinc-950 text-xs font-black focus:outline-none cursor-pointer pr-1"
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="dist_desc">Longest Distance</option>
                <option value="gain_desc">Highest Elevation (D+)</option>
                <option value="load_desc">Highest Training Load</option>
              </select>
            </div>
          </div>

          {/* Bottom Row: Multi-Select Sport Filter Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-zinc-500 flex items-center gap-1 mr-1">
                <Filter className="h-3 w-3 text-zinc-950" />
                Activity Type:
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
                All Sports
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
                <span>Cycling</span>
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
                Reset All Filters
              </button>
            )}
          </div>
        </div>

        {/* Activities Table / List */}
        <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-4 shadow-[4px_4px_0px_0px_#09090b]">
          {loading ? (
            <div className="py-16 text-center text-zinc-600 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-orange-600 stroke-[2.5]" />
              <p className="text-xs font-black font-mono">Loading COROS workout history...</p>
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="py-16 text-center text-zinc-600 text-xs space-y-2 font-medium">
              <p>No activities match your current filter or search criteria.</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSports(["all"]);
                  setTimeFilter("all");
                  setCurrentPage(1);
                }}
                className="text-orange-600 hover:underline font-black text-xs cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedList.map((act) => {
                const isTrail = act.sportType === "trail_run" || act.elevationGain > 200;
                const decoupling = calculateDecouplingAnalysis(act);
                const dateStr = new Date(act.startTime).toLocaleDateString("en-US", {
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
                    {/* Left: Checkbox, Icon, Name & Date */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Compare Checkbox */}
                      <div
                        onClick={(e) => toggleCompare(act.id, e)}
                        className={`h-5 w-5 rounded-md border-2 border-zinc-950 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          compareIds.includes(act.id)
                            ? "bg-amber-400 shadow-[1px_1px_0px_0px_#09090b]"
                            : "bg-white hover:bg-zinc-100"
                        }`}
                        title={
                          compareIds.includes(act.id)
                            ? "Selected for comparison"
                            : "Click to compare with another activity"
                        }
                      >
                        {compareIds.includes(act.id) && (
                          <Check className="h-3.5 w-3.5 text-black stroke-[3]" />
                        )}
                      </div>

                      <div className="h-10 w-10 rounded-xl bg-white border-2 border-zinc-950 flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                        {getSportIcon(act.sportType, act.elevationGain)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
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
                        </div>
                        <p className="text-[11px] font-mono font-medium text-zinc-600">
                          {dateStr} • {act.durationMin} mins
                        </p>
                      </div>
                    </div>

                    {/* Right: Metrics row */}
                    <div className="grid grid-cols-3 sm:flex sm:items-center sm:justify-end gap-2 sm:gap-6 font-mono text-xs shrink-0 pt-2 sm:pt-0 border-t-2 sm:border-t-0 border-zinc-200 w-full sm:w-auto">
                      {/* Distance or Duration for Strength */}
                      <div className="text-left sm:text-right">
                        {act.sportType === "strength" || act.sportType === "gym" ? (
                          <>
                            <div className="font-black text-purple-700 text-sm">
                              {act.durationMin} <span className="text-[10px] font-normal text-zinc-500">min</span>
                            </div>
                            <div className="text-[10px] text-zinc-600 font-sans font-bold">Gym Duration</div>
                          </>
                        ) : (
                          <>
                            <div className="font-black text-zinc-950 text-sm">
                              {act.distanceKm} <span className="text-[10px] font-normal text-zinc-500">km</span>
                            </div>
                            <div className="text-[10px] text-zinc-600 font-sans font-bold">Distance</div>
                          </>
                        )}
                      </div>

                      {/* Pace or Speed */}
                      <div className="text-center sm:text-right">
                        <div className="font-black text-zinc-900">{formatSpeedOrPace(act)}</div>
                        <div className="text-[10px] text-zinc-600 font-sans font-bold">
                          {act.sportType === "bike" || act.sportType === "cycling"
                            ? "Speed"
                            : act.sportType === "strength" || act.sportType === "gym"
                            ? "Category"
                            : "Pace"}
                        </div>
                      </div>

                      {/* Heart Rate (Desktop only) */}
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
                        <div className="text-right pl-2 border-l-2 border-zinc-200 hidden sm:block">
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

                      <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-950 transition-colors stroke-[2.5] shrink-0 hidden sm:block" />
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
                Showing <strong className="text-zinc-950 font-black">{(currentPage - 1) * PAGE_SIZE + 1}</strong> -{" "}
                <strong className="text-zinc-950 font-black">{Math.min(currentPage * PAGE_SIZE, filteredAndSorted.length)}</strong> of{" "}
                <strong className="text-zinc-950 font-black">{filteredAndSorted.length}</strong> activities
              </div>

              {/* Mobile pagination */}
              <div className="flex sm:hidden items-center justify-between w-full gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl bg-white border-2 border-zinc-950 text-zinc-950 font-black hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-[1.5px_1.5px_0px_0px_#09090b]"
                >
                  Prev
                </button>
                <span className="font-mono text-xs font-black text-zinc-950 px-3 py-1.5 rounded-xl bg-zinc-100 border-2 border-zinc-950">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl bg-white border-2 border-zinc-950 text-zinc-950 font-black hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-[1.5px_1.5px_0px_0px_#09090b]"
                >
                  Next
                </button>
              </div>

              {/* Desktop pagination */}
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl bg-white border-2 border-zinc-950 text-zinc-950 font-black hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-[1.5px_1.5px_0px_0px_#09090b]"
                >
                  Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - currentPage) <= 1;
                  })
                  .map((pageNum, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && pageNum - prev > 1;
                    return (
                      <React.Fragment key={pageNum}>
                        {showEllipsis && (
                          <span className="px-1 text-zinc-400 font-black font-mono">…</span>
                        )}
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
                      </React.Fragment>
                    );
                  })}

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
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="max-w-lg w-full rounded-2xl bg-white border-2 border-zinc-950 p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-[6px_6px_0px_0px_#09090b] max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                  {getSportIcon(selectedActivity.sportType, selectedActivity.elevationGain)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-zinc-950 break-words leading-snug">{selectedActivity.name}</h3>
                  <p className="text-xs font-mono font-medium text-zinc-600 mt-0.5">
                    {new Date(selectedActivity.startTime).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="sm:hidden p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                >
                  <X className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleCompareFromDrawer(selectedActivity)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-zinc-950 bg-sky-200 hover:bg-sky-300 text-zinc-950 font-black text-xs shadow-[1.5px_1.5px_0px_0px_#09090b] transition-all cursor-pointer"
                  title="Compare this run with a benchmark or previous run"
                >
                  <Scale className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Compare</span>
                </button>
                <button
                  onClick={() => setSharingActivity(selectedActivity)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-zinc-950 bg-amber-300 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-[1.5px_1.5px_0px_0px_#09090b] transition-all cursor-pointer"
                  title="Share workout card"
                >
                  <Share2 className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Share</span>
                </button>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="hidden sm:block p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] transition-colors"
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
                    ? "Workout Focus"
                    : "Distance"}
                </span>
                <span className="text-xl font-black text-zinc-950">
                  {selectedActivity.sportType === "strength" || selectedActivity.sportType === "gym"
                    ? "Gym / Strength"
                    : `${selectedActivity.distanceKm} km`}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[11px] text-zinc-700 font-sans font-bold block">Duration</span>
                <span className="text-xl font-black text-zinc-950">{selectedActivity.durationMin} m</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[11px] text-zinc-700 font-sans font-bold block">
                  {selectedActivity.sportType === "bike" || selectedActivity.sportType === "cycling"
                    ? "Average Speed"
                    : selectedActivity.sportType === "strength" || selectedActivity.sportType === "gym"
                    ? "Workout Category"
                    : "Average Pace"}
                </span>
                <span className="text-xl font-black text-orange-600">
                  {formatSpeedOrPace(selectedActivity)}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[11px] text-zinc-700 font-sans font-bold block">Heart Rate</span>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono">
                    <div className="p-3 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-sans font-bold text-zinc-600 uppercase tracking-wide">
                          Decoupling Rate
                        </span>
                        <span className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-300 shrink-0">
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
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-sans font-bold text-zinc-600 uppercase tracking-wide truncate">
                          Efficiency Factor (EF)
                        </span>
                        <span className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-300 shrink-0">
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] font-bold text-zinc-600 font-sans">
                      <span>Workout Split Breakdown</span>
                      <span>1st Half (0–50%) vs 2nd Half (50–100%)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
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

            {/* Trail / Mountain Dynamics Section */}
            {(selectedActivity.sportType === "trail_run" || selectedActivity.elevationGain > 150) && (
              <div className="p-4 rounded-xl bg-cyan-50 border-2 border-zinc-950 space-y-2.5 shadow-[2px_2px_0px_0px_#09090b]">
                <div className="flex items-center gap-1.5 text-xs font-black text-zinc-950">
                  <Mountain className="h-4 w-4 stroke-[2.5]" />
                  <span>Mountain & Trail Dynamics</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                    <span className="text-[10px] text-zinc-600 block font-sans font-bold">Elevation Gain / Loss</span>
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
                    <span className="text-[10px] text-zinc-600 block font-sans font-bold">Climbing Rate (VAM)</span>
                    <span className="text-amber-800 font-black">
                      {selectedActivity.vam || Math.round((selectedActivity.elevationGain / (selectedActivity.durationMin / 60)))} m/h
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                onClick={() => setSharingActivity(selectedActivity)}
                className="w-full sm:flex-1 py-2.5 text-xs font-black rounded-xl bg-amber-300 hover:bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Share Workout Card</span>
              </button>
              <button
                onClick={() => setSelectedActivity(null)}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-black rounded-xl bg-zinc-950 hover:bg-zinc-850 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] transition-all cursor-pointer"
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

      {/* Floating Compare Action Dock (When 1 or 2 activities selected) */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-950 text-white border-2 border-zinc-950 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-[4px_4px_0px_0px_#09090b] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 max-w-[calc(100vw-1.5rem)] w-fit animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-full bg-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center font-mono shrink-0">
              {compareIds.length}
            </div>
            <span className="text-xs font-bold text-zinc-200 truncate">
              {compareIds.length === 1
                ? "Select 1 more to compare"
                : "2 Selected"}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {compareIds.length === 2 && (
              <button
                type="button"
                onClick={handleLaunchCompare}
                className="px-3 py-1.5 rounded-xl bg-orange-400 hover:bg-orange-500 text-zinc-950 font-black text-xs border-2 border-zinc-950 flex items-center gap-1.5 transition-all shadow-[1.5px_1.5px_0px_0px_#ffffff] cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                <Scale className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Compare</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Activity Comparison Modal */}
      {activeComparePair && (
        <ActivityCompareModal
          activityA={activeComparePair.actA}
          activityB={activeComparePair.actB}
          allActivities={activities}
          onSelectActivityB={(newB) =>
            setActiveComparePair((prev) => (prev ? { ...prev, actB: newB } : null))
          }
          onClose={() => setActiveComparePair(null)}
        />
      )}
    </div>
  );
}

