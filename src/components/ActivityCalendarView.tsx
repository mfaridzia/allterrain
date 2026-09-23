"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Mountain,
  Bike,
  Dumbbell,
  ArrowUpRight,
  Flame,
  Zap,
  Clock,
  Heart,
  CalendarDays,
  Layers,
  Check,
  Share2,
  Scale,
  Sparkles,
  Info,
} from "lucide-react";
import { ActivityItem } from "./ActivityFeed";
import { formatPace, formatDurationReadable } from "@/lib/analytics";
import { useTranslation } from "@/lib/i18n/context";
import dynamic from "next/dynamic";

const MonthlyRecapShareModal = dynamic(
  () => import("@/components/MonthlyRecapShareModal").then((mod) => mod.MonthlyRecapShareModal),
  { ssr: false }
);

interface ActivityCalendarViewProps {
  activities: ActivityItem[];
  onSelectActivity: (activity: ActivityItem) => void;
  onToggleCompare?: (activityId: string, e?: React.MouseEvent) => void;
  compareIds?: string[];
  onShareActivity?: (activity: ActivityItem) => void;
}

export function ActivityCalendarView({
  activities,
  onSelectActivity,
  onToggleCompare,
  compareIds = [],
  onShareActivity,
}: ActivityCalendarViewProps) {
  const { t, language } = useTranslation();

  // Determine initial year and month from the latest activity or today
  const initialDate = useMemo(() => {
    if (activities.length > 0) {
      const latestTime = Math.max(...activities.map((a) => a.startTime));
      return new Date(latestTime);
    }
    return new Date();
  }, [activities]);

  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth()); // 0-indexed (0 = Jan, 8 = Sep)
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [isSharingMonthlyRecap, setIsSharingMonthlyRecap] = useState(false);
  
  // For week view: state for the selected week anchor date (defaults to today or latest activity)
  const [selectedWeekAnchor, setSelectedWeekAnchor] = useState<Date>(() => {
    const d = new Date(initialDate);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Extract all available months from activities for dropdown jump
  const availableMonths = useMemo(() => {
    const map = new Map<string, { year: number; month: number; label: string }>();
    for (const a of activities) {
      const d = new Date(a.startTime);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${(m + 1).toString().padStart(2, "0")}`;
      if (!map.has(key)) {
        const label = d.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
          month: "long",
          year: "numeric",
        });
        map.set(key, { year: y, month: m, label });
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [activities, language]);

  // Navigate to previous month
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  // Navigate to next month
  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Jump to today
  const handleJumpToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    const weekNow = new Date(now);
    weekNow.setHours(0, 0, 0, 0);
    setSelectedWeekAnchor(weekNow);
  };

  // Month formatted title
  const monthTitle = useMemo(() => {
    const d = new Date(currentYear, currentMonth, 1);
    return d.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
      month: "long",
      year: "numeric",
    });
  }, [currentYear, currentMonth, language]);

  // Index activities by YYYY-MM-DD
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const act of activities) {
      const d = new Date(act.startTime);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, "0");
      const day = d.getDate().toString().padStart(2, "0");
      const dateKey = `${y}-${m}-${day}`;
      const list = map.get(dateKey) || [];
      list.push(act);
      map.set(dateKey, list);
    }
    return map;
  }, [activities]);

  // Calculate monthly stats for the active displayed month
  const monthlyStats = useMemo(() => {
    let totalDist = 0;
    let totalGain = 0;
    let totalDurationMin = 0;
    let totalLoad = 0;
    let count = 0;
    let roadCount = 0;
    let trailCount = 0;
    let bikeCount = 0;
    let strengthCount = 0;

    for (const act of activities) {
      const d = new Date(act.startTime);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        count++;
        totalDist += parseFloat(act.distanceKm || "0");
        totalGain += act.elevationGain || 0;
        totalDurationMin += act.durationMin || Math.round((act.durationSeconds || 0) / 60);
        totalLoad += act.trainingLoad || 0;

        const isTrail = act.sportType === "trail_run" || act.elevationGain > 200;
        const isRoad =
          (act.sportType === "run" || act.sportType === "track_run" || act.sportType === "indoor_run") &&
          act.elevationGain <= 200;
        const isBike = act.sportType === "bike" || act.sportType === "cycling";
        const isStrength = act.sportType === "strength" || act.sportType === "gym" || act.sportType === "weight";

        if (isTrail) trailCount++;
        else if (isRoad) roadCount++;
        else if (isBike) bikeCount++;
        else if (isStrength) strengthCount++;
      }
    }

    return {
      count,
      totalDistKm: totalDist.toFixed(1),
      totalGainM: Math.round(totalGain),
      totalHours: (totalDurationMin / 60).toFixed(1),
      totalLoad: Math.round(totalLoad),
      roadCount,
      trailCount,
      bikeCount,
      strengthCount,
    };
  }, [activities, currentYear, currentMonth]);

  // Construct Calendar Grid (Monday to Sunday athletic ISO week)
  interface DayCell {
    date: Date;
    dateKey: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    activities: ActivityItem[];
  }

  interface WeekRow {
    weekNumber: number;
    days: DayCell[];
    totalDistKm: number;
    totalGainM: number;
    totalDurationMin: number;
    totalLoad: number;
    workoutCount: number;
  }

  const calendarWeeks = useMemo(() => {
    const weeks: WeekRow[] = [];
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Monday-based day of week for the 1st of month: 0=Mon, 1=Tue, ..., 6=Sun
    const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Start date of the first grid cell (could be in previous month)
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayIndex);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today
      .getDate()
      .toString()
      .padStart(2, "0")}`;

    // Loop through weeks until we cover all days of the month (standard 4-6 weeks)
    let iterDate = new Date(startDate);
    let weekCount = 0;

    while (weekCount < 6) {
      const days: DayCell[] = [];
      let weekDist = 0;
      let weekGain = 0;
      let weekDuration = 0;
      let weekLoad = 0;
      let weekWorkouts = 0;
      let hasCurrentMonthDay = false;

      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(iterDate);
        const y = cellDate.getFullYear();
        const m = (cellDate.getMonth() + 1).toString().padStart(2, "0");
        const day = cellDate.getDate().toString().padStart(2, "0");
        const dateKey = `${y}-${m}-${day}`;
        const isCurrentMonth = cellDate.getMonth() === currentMonth;
        if (isCurrentMonth) hasCurrentMonthDay = true;

        const dayActs = activitiesByDate.get(dateKey) || [];
        for (const a of dayActs) {
          weekDist += parseFloat(a.distanceKm || "0");
          weekGain += a.elevationGain || 0;
          weekDuration += a.durationMin || Math.round((a.durationSeconds || 0) / 60);
          weekLoad += a.trainingLoad || 0;
          weekWorkouts++;
        }

        days.push({
          date: cellDate,
          dateKey,
          dayNumber: cellDate.getDate(),
          isCurrentMonth,
          isToday: dateKey === todayKey,
          activities: dayActs,
        });

        iterDate.setDate(iterDate.getDate() + 1);
      }

      // Stop adding weeks if we've completely moved into the next month
      if (weekCount >= 4 && !hasCurrentMonthDay) {
        break;
      }

      // Calculate athletic ISO week number
      const dForWeek = new Date(days[0].date);
      dForWeek.setDate(dForWeek.getDate() + 3); // Thursday
      const firstThursday = new Date(dForWeek.getFullYear(), 0, 4);
      const weekNum = Math.round(
        ((dForWeek.getTime() - firstThursday.getTime()) / 86400000 + ((firstThursday.getDay() + 6) % 7)) / 7
      );

      weeks.push({
        weekNumber: Math.max(1, weekNum),
        days,
        totalDistKm: Math.round(weekDist * 10) / 10,
        totalGainM: Math.round(weekGain),
        totalDurationMin: weekDuration,
        totalLoad: Math.round(weekLoad),
        workoutCount: weekWorkouts,
      });

      weekCount++;
    }

    return weeks;
  }, [currentYear, currentMonth, activitiesByDate]);

  // Weekdays header labels
  const weekdayLabels = useMemo(() => {
    return [
      t("activities.mon", "Mon"),
      t("activities.tue", "Tue"),
      t("activities.wed", "Wed"),
      t("activities.thu", "Thu"),
      t("activities.fri", "Fri"),
      t("activities.sat", "Sat"),
      t("activities.sun", "Sun"),
    ];
  }, [t]);

  // Week Focus Data (7 days around selectedWeekAnchor)
  const currentWeekDays = useMemo(() => {
    const monday = new Date(selectedWeekAnchor);
    const dayOfWeek = (monday.getDay() + 6) % 7; // 0=Mon
    monday.setDate(monday.getDate() - dayOfWeek);

    const days: DayCell[] = [];
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today
      .getDate()
      .toString()
      .padStart(2, "0")}`;

    for (let i = 0; i < 7; i++) {
      const cellDate = new Date(monday);
      cellDate.setDate(cellDate.getDate() + i);
      const y = cellDate.getFullYear();
      const m = (cellDate.getMonth() + 1).toString().padStart(2, "0");
      const day = cellDate.getDate().toString().padStart(2, "0");
      const dateKey = `${y}-${m}-${day}`;
      const dayActs = activitiesByDate.get(dateKey) || [];

      days.push({
        date: cellDate,
        dateKey,
        dayNumber: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === currentMonth,
        isToday: dateKey === todayKey,
        activities: dayActs,
      });
    }

    // Week stats
    let totalDist = 0;
    let totalGain = 0;
    let totalDuration = 0;
    let totalLoad = 0;
    for (const d of days) {
      for (const a of d.activities) {
        totalDist += parseFloat(a.distanceKm || "0");
        totalGain += a.elevationGain || 0;
        totalDuration += a.durationMin || Math.round((a.durationSeconds || 0) / 60);
        totalLoad += a.trainingLoad || 0;
      }
    }

    const startLabel = days[0].date.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
    });
    const endLabel = days[6].date.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return {
      days,
      startLabel,
      endLabel,
      totalDistKm: totalDist.toFixed(1),
      totalGainM: Math.round(totalGain),
      totalDurationMin: totalDuration,
      totalLoad: Math.round(totalLoad),
    };
  }, [selectedWeekAnchor, activitiesByDate, currentMonth, language]);

  const handlePrevWeek = () => {
    setSelectedWeekAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const handleNextWeek = () => {
    setSelectedWeekAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const getSportStyling = (sportType: string, elevGain: number) => {
    const isTrail = sportType === "trail_run" || elevGain > 200;
    const isBike = sportType === "bike" || sportType === "cycling";
    const isStrength = sportType === "strength" || sportType === "gym" || sportType === "weight";

    if (isTrail) {
      return {
        bg: "bg-cyan-300 hover:bg-cyan-200 text-zinc-950 border-zinc-950",
        icon: <Mountain className="h-3 w-3 stroke-[2.5]" />,
        name: "Trail",
      };
    }
    if (isBike) {
      return {
        bg: "bg-emerald-300 hover:bg-emerald-200 text-zinc-950 border-zinc-950",
        icon: <Bike className="h-3 w-3 stroke-[2.5]" />,
        name: "Bike",
      };
    }
    if (isStrength) {
      return {
        bg: "bg-purple-300 hover:bg-purple-200 text-zinc-950 border-zinc-950",
        icon: <Dumbbell className="h-3 w-3 stroke-[2.5]" />,
        name: "Gym",
      };
    }
    return {
      bg: "bg-orange-400 hover:bg-orange-300 text-zinc-950 border-zinc-950",
      icon: <Footprints className="h-3 w-3 stroke-[2.5]" />,
      name: "Road",
    };
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header Navigation & Controls */}
      <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Navigation Buttons & Month Title */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={viewMode === "month" ? handlePrevMonth : handlePrevWeek}
              className="h-9 w-9 rounded-xl bg-white hover:bg-zinc-100 border-2 border-zinc-950 flex items-center justify-center shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              title={viewMode === "month" ? t("activities.prevMonth", "Previous Month") : t("activities.prevWeek", "Previous Week")}
            >
              <ChevronLeft className="h-4 w-4 stroke-[3]" />
            </button>
            <button
              type="button"
              onClick={viewMode === "month" ? handleNextMonth : handleNextWeek}
              className="h-9 w-9 rounded-xl bg-white hover:bg-zinc-100 border-2 border-zinc-950 flex items-center justify-center shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              title={viewMode === "month" ? t("activities.nextMonth", "Next Month") : t("activities.nextWeek", "Next Week")}
            >
              <ChevronRight className="h-4 w-4 stroke-[3]" />
            </button>
          </div>

          {/* Month Title & Month Quick Jump Dropdown */}
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight flex items-center gap-1.5">
              <CalendarIcon className="h-5 w-5 text-amber-500 stroke-[2.5]" />
              <span>{viewMode === "month" ? monthTitle : `${currentWeekDays.startLabel} – ${currentWeekDays.endLabel}`}</span>
            </h2>

            {/* Quick jump month selector */}
            <select
              value={`${currentYear}-${(currentMonth + 1).toString().padStart(2, "0")}`}
              onChange={(e) => {
                const [yStr, mStr] = e.target.value.split("-");
                const y = parseInt(yStr, 10);
                const m = parseInt(mStr, 10) - 1;
                setCurrentYear(y);
                setCurrentMonth(m);
                const anchor = new Date(y, m, 1);
                setSelectedWeekAnchor(anchor);
              }}
              className="text-xs font-black rounded-lg px-2 py-1 bg-[#FAF9F5] text-zinc-900 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] cursor-pointer hover:bg-amber-100 transition-all"
            >
              {availableMonths.map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={handleJumpToday}
            className="px-2.5 py-1 text-xs font-black rounded-lg bg-amber-400 text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] hover:bg-amber-300 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            {t("activities.today", "Today")}
          </button>
        </div>

        {/* Right: View Switcher (Month Grid vs Week Focus) */}
        <div className="flex items-center gap-1.5 self-start md:self-auto bg-[#FAF9F5] p-1 rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={`px-3 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all ${
              viewMode === "month"
                ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                : "text-zinc-700 hover:text-zinc-950"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{t("activities.monthView", "Month Grid")}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`px-3 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all ${
              viewMode === "week"
                ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                : "text-zinc-700 hover:text-zinc-950"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{t("activities.weekView", "Week Focus")}</span>
          </button>
        </div>
      </div>

      {/* Monthly Summary Telemetry Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                {t("activities.monthlyVolume", "Monthly Volume")}
              </span>
              <span className="text-lg font-black text-zinc-950 font-mono">
                {monthlyStats.totalDistKm} <span className="text-xs font-bold text-zinc-500">km</span>
              </span>
            </div>

            <div className="h-7 w-[2px] bg-zinc-200 hidden sm:block" />

            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Total Elevation D+
              </span>
              <span className="text-lg font-black text-emerald-700 font-mono flex items-center gap-0.5">
                <ArrowUpRight className="h-3.5 w-3.5 stroke-[3]" />
                +{monthlyStats.totalGainM.toLocaleString()}{" "}
                <span className="text-xs font-bold text-zinc-500">m</span>
              </span>
            </div>

            <div className="h-7 w-[2px] bg-zinc-200 hidden sm:block" />

            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Training Time
              </span>
              <span className="text-lg font-black text-zinc-950 font-mono">
                {monthlyStats.totalHours} <span className="text-xs font-bold text-zinc-500">hrs</span>
              </span>
            </div>

            <div className="h-7 w-[2px] bg-zinc-200 hidden sm:block" />

            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Training Load
              </span>
              <span className="text-lg font-black text-orange-600 font-mono flex items-center gap-0.5">
                <Zap className="h-3.5 w-3.5 stroke-[2.5]" />
                {monthlyStats.totalLoad.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Sport Breakdown Pills & Share Monthly Recap Button */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full lg:w-auto">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black">
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 border border-zinc-300">
                {monthlyStats.count} {t("activities.sessions", "sessions")}
              </span>
              {monthlyStats.roadCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 border border-orange-300">
                  {monthlyStats.roadCount} Road
                </span>
              )}
              {monthlyStats.trailCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 border border-cyan-300">
                  {monthlyStats.trailCount} Trail
                </span>
              )}
              {monthlyStats.bikeCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {monthlyStats.bikeCount} Bike
                </span>
              )}
              {monthlyStats.strengthCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300">
                  {monthlyStats.strengthCount} Gym
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSharingMonthlyRecap(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] active:translate-x-[1px] active:translate-y-[1px] transition-all ml-auto sm:ml-2 cursor-pointer"
              title={t("activities.shareRecap", "Share Monthly Recap")}
            >
              <Share2 className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>{t("activities.shareRecap", "Share Recap")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: MONTH GRID VIEW */}
      {viewMode === "month" && (
        <div className="rounded-2xl bg-white border-2 border-zinc-950 p-3 sm:p-5 shadow-[4px_4px_0px_0px_#09090b] overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Weekday Header Row + Weekly Summary Header */}
            <div className="grid grid-cols-8 gap-2 pb-2 mb-2 border-b-2 border-zinc-950">
              {weekdayLabels.map((dayLabel, idx) => (
                <div key={dayLabel} className="text-center font-black text-xs text-zinc-900 py-1">
                  <span className={idx >= 5 ? "text-orange-700" : ""}>{dayLabel}</span>
                </div>
              ))}
              <div className="text-center font-black text-xs text-amber-900 bg-amber-100 py-1 rounded-lg border border-amber-300">
                {t("activities.weeklySummary", "Weekly Total")}
              </div>
            </div>

            {/* Weeks and Days Grid */}
            <div className="space-y-2">
              {calendarWeeks.map((week) => (
                <div key={`week-${week.weekNumber}-${week.days[0].dateKey}`} className="grid grid-cols-8 gap-2">
                  {/* 7 Days of this week */}
                  {week.days.map((day) => {
                    const hasWorkouts = day.activities.length > 0;

                    return (
                      <div
                        key={day.dateKey}
                        className={`min-h-[110px] p-1.5 sm:p-2 rounded-xl border-2 transition-all flex flex-col justify-between ${
                          day.isToday
                            ? "bg-amber-50/70 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] ring-2 ring-amber-400"
                            : day.isCurrentMonth
                            ? "bg-[#FAF9F5] border-zinc-950 hover:bg-white hover:shadow-[2px_2px_0px_0px_#09090b]"
                            : "bg-zinc-50/50 border-zinc-300 opacity-40 hover:opacity-90"
                        }`}
                      >
                        {/* Day Header: Date number & Today badge */}
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-black font-mono inline-flex items-center justify-center rounded-md ${
                              day.isToday
                                ? "bg-amber-400 text-zinc-950 px-1.5 py-0.5 border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                                : "text-zinc-700"
                            }`}
                          >
                            {day.dayNumber}
                          </span>

                          {hasWorkouts && day.activities.length > 1 && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-zinc-900 text-white font-mono">
                              {day.activities.length}x
                            </span>
                          )}
                        </div>

                        {/* Activities on this day */}
                        <div className="space-y-1.5 flex-1">
                          {hasWorkouts ? (
                            day.activities.map((act) => {
                              const style = getSportStyling(act.sportType, act.elevationGain);
                              const isStrength = act.sportType === "strength" || act.sportType === "gym";

                              return (
                                <div
                                  key={act.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectActivity(act);
                                  }}
                                  className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all shadow-[1px_1px_0px_0px_#09090b] hover:-translate-y-0.5 active:translate-y-0 ${style.bg}`}
                                  title={`${act.name} • ${act.distanceKm}km • ${act.trainingLoad} Load`}
                                >
                                  {/* Top line: Icon + Distance/Duration */}
                                  <div className="flex items-center justify-between gap-1 leading-none">
                                    <span className="flex items-center gap-1 font-black text-[11px] truncate">
                                      {style.icon}
                                      {isStrength ? `${act.durationMin}m` : `${act.distanceKm}k`}
                                    </span>

                                    {act.elevationGain > 30 && (
                                      <span className="text-[9px] font-mono font-bold text-zinc-800 shrink-0">
                                        +{act.elevationGain}m
                                      </span>
                                    )}
                                  </div>

                                  {/* Bottom line: Pace / HR */}
                                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-800 font-bold mt-1 pt-0.5 border-t border-black/10">
                                    <span>
                                      {isStrength
                                        ? "Gym"
                                        : act.avgPaceSec > 0
                                        ? `${formatPace(act.avgPaceSec)}/k`
                                        : "--"}
                                    </span>
                                    {act.avgHr > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Heart className="h-2.5 w-2.5 text-rose-700 fill-rose-700" />
                                        {act.avgHr}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="h-full flex items-center justify-center py-2">
                              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                                {day.isCurrentMonth ? t("activities.restDay", "Rest") : ""}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Day Total summary if multiple workouts */}
                        {hasWorkouts && day.activities.length > 1 && (
                          <div className="mt-1 pt-1 border-t border-zinc-200 text-[8px] font-mono font-black text-zinc-600 text-right">
                            {day.activities
                              .reduce((acc, curr) => acc + parseFloat(curr.distanceKm || "0"), 0)
                              .toFixed(1)}
                            k total
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 8th Column: Weekly Total Summary */}
                  <div className="min-h-[110px] p-2 rounded-xl bg-amber-50/50 border-2 border-amber-300 flex flex-col justify-between text-xs shadow-[2px_2px_0px_0px_#09090b]">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-1">
                      <span className="text-[9px] font-black text-amber-900 uppercase">
                        {t("activities.weekNumber", "Week")} {week.weekNumber}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 font-mono">
                        {week.workoutCount}x
                      </span>
                    </div>

                    <div className="space-y-1 font-mono my-auto py-1">
                      <div className="text-zinc-950 font-black text-sm">
                        {week.totalDistKm} <span className="text-[10px] font-normal text-zinc-600">km</span>
                      </div>
                      {week.totalGainM > 0 && (
                        <div className="text-[10px] font-bold text-emerald-800 flex items-center gap-0.5">
                          <ArrowUpRight className="h-2.5 w-2.5 stroke-[3]" />
                          +{week.totalGainM}m D+
                        </div>
                      )}
                      <div className="text-[10px] font-medium text-zinc-600 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {Math.floor(week.totalDurationMin / 60)}h {week.totalDurationMin % 60}m
                      </div>
                    </div>

                    <div className="text-[9px] font-mono font-black text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200 flex items-center justify-between">
                      <span>TRIMP</span>
                      <span>{week.totalLoad}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: WEEK FOCUS VIEW */}
      {viewMode === "week" && (
        <div className="space-y-4">
          {/* Week Overview Card */}
          <div className="p-4 rounded-2xl bg-amber-100/70 border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                Microcycle Focused View
              </span>
              <h3 className="text-base font-black text-zinc-950">
                {currentWeekDays.startLabel} – {currentWeekDays.endLabel}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono font-black">
              <div>
                <span className="text-[10px] font-bold text-zinc-600 block">Total Distance</span>
                <span className="text-base text-zinc-950">{currentWeekDays.totalDistKm} km</span>
              </div>
              <div className="h-6 w-[1px] bg-zinc-300" />
              <div>
                <span className="text-[10px] font-bold text-zinc-600 block">Total D+</span>
                <span className="text-base text-emerald-800">+{currentWeekDays.totalGainM} m</span>
              </div>
              <div className="h-6 w-[1px] bg-zinc-300" />
              <div>
                <span className="text-[10px] font-bold text-zinc-600 block">Total Load</span>
                <span className="text-base text-orange-700">{currentWeekDays.totalLoad} Load</span>
              </div>
            </div>
          </div>

          {/* 7 Vertical Day Columns */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {currentWeekDays.days.map((day, idx) => {
              const hasWorkouts = day.activities.length > 0;
              const dayName = weekdayLabels[idx];

              return (
                <div
                  key={day.dateKey}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                    day.isToday
                      ? "bg-amber-50/80 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] ring-2 ring-amber-400"
                      : "bg-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  }`}
                >
                  {/* Day Column Header */}
                  <div className="border-b-2 border-zinc-950 pb-2 mb-2 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-zinc-900 block">{dayName}</span>
                      <span className="text-[11px] font-mono font-bold text-zinc-600">
                        {day.date.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    {day.isToday && (
                      <span className="text-[9px] font-black bg-amber-400 text-zinc-950 px-1.5 py-0.5 rounded border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                        TODAY
                      </span>
                    )}
                  </div>

                  {/* Day Workouts or Rest */}
                  <div className="space-y-2 flex-1">
                    {hasWorkouts ? (
                      day.activities.map((act) => {
                        const style = getSportStyling(act.sportType, act.elevationGain);
                        const isStrength = act.sportType === "strength" || act.sportType === "gym";

                        return (
                          <div
                            key={act.id}
                            className={`p-2.5 rounded-xl border-2 border-zinc-950 space-y-2 shadow-[2px_2px_0px_0px_#09090b] ${style.bg}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                {style.icon}
                                {style.name}
                              </span>
                              <span className="text-[9px] font-mono font-bold text-zinc-700">
                                {new Date(act.startTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <div>
                              <h4 className="text-xs font-black text-zinc-950 line-clamp-1">{act.name}</h4>
                              <div className="text-lg font-black font-mono text-zinc-950 mt-0.5">
                                {isStrength ? `${act.durationMin} min` : `${act.distanceKm} km`}
                              </div>
                            </div>

                            {/* Secondary Telemetry */}
                            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono font-bold pt-1 border-t border-black/15">
                              <div>
                                <span className="text-zinc-700 block text-[8px] uppercase">
                                  {isStrength ? "Time" : "Pace"}
                                </span>
                                <span>{isStrength ? `${act.durationMin}m` : `${formatPace(act.avgPaceSec)}/k`}</span>
                              </div>
                              <div>
                                <span className="text-zinc-700 block text-[8px] uppercase">Elevation</span>
                                <span>+{act.elevationGain}m</span>
                              </div>
                              <div>
                                <span className="text-zinc-700 block text-[8px] uppercase">Avg HR</span>
                                <span>{act.avgHr > 0 ? `${act.avgHr} bpm` : "--"}</span>
                              </div>
                              <div>
                                <span className="text-zinc-700 block text-[8px] uppercase">Load</span>
                                <span>{act.trainingLoad}</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between pt-1 gap-1">
                              <button
                                type="button"
                                onClick={() => onSelectActivity(act)}
                                className="w-full text-center py-1 text-[10px] font-black bg-white hover:bg-zinc-100 text-zinc-950 rounded border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] cursor-pointer"
                              >
                                Details ↗
                              </button>
                              {onShareActivity && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onShareActivity(act);
                                  }}
                                  className="p-1 rounded bg-white hover:bg-zinc-100 border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] cursor-pointer"
                                  title="Share Story"
                                >
                                  <Share2 className="h-3 w-3" />
                                </button>
                              )}
                              {onToggleCompare && (
                                <button
                                  type="button"
                                  onClick={(e) => onToggleCompare(act.id, e)}
                                  className={`p-1 rounded border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] cursor-pointer ${
                                    compareIds.includes(act.id) ? "bg-amber-400" : "bg-white hover:bg-zinc-100"
                                  }`}
                                  title="Compare"
                                >
                                  <Scale className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-zinc-400 text-xs flex flex-col items-center justify-center space-y-1">
                        <span className="text-xs font-black text-zinc-400">REST DAY</span>
                        <p className="text-[9px] text-zinc-400">Recovery & Adaptation</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Monthly Recap Share Modal */}
      {isSharingMonthlyRecap && (
        <MonthlyRecapShareModal
          isOpen={isSharingMonthlyRecap}
          onClose={() => setIsSharingMonthlyRecap(false)}
          year={currentYear}
          month={currentMonth}
          activities={activities}
        />
      )}
    </div>
  );
}
