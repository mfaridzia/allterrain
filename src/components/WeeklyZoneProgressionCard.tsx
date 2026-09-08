"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Percent,
  Timer,
  Flame,
  HelpCircle,
  Hourglass,
  Info,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { WeeklyZoneData, WeeklyZoneProgressionResult } from "@/lib/analytics";

interface WeeklyZoneProgressionCardProps {
  progression: WeeklyZoneProgressionResult | null | undefined;
}

/**
 * Format hours to human readable minutes & hours
 * e.g. 0.5 -> "30 mnt"
 * e.g. 0.6 -> "36 mnt"
 * e.g. 4.4 -> "4j 24m (264 mnt)"
 */
function formatDurationReadable(hours: number): string {
  const totalMin = Math.round((hours || 0) * 60);
  if (totalMin === 0) return "0 mnt";
  if (totalMin < 60) return `${totalMin} mnt`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}j ${m}m (${totalMin} mnt)` : `${h} jam (${totalMin} mnt)`;
}

function formatMinutesOnly(hours: number, lang: string = "id"): string {
  const totalMin = Math.round((hours || 0) * 60);
  return `${totalMin} ${lang === "en" ? "min" : "mnt"}`;
}

export const WeeklyZoneProgressionCard: React.FC<WeeklyZoneProgressionCardProps> = ({
  progression,
}) => {
  const { language } = useTranslation();
  const [selectedWeeksCount, setSelectedWeeksCount] = useState<number>(8);
  const [metricMode, setMetricMode] = useState<"percentage" | "minutes" | "hours">("percentage");
  const [zoneMode, setZoneMode] = useState<"seiler3" | "zones5">("seiler3");
  const [showExplainer, setShowExplainer] = useState<boolean>(false);

  const rawWeeks = progression?.weeks || [];

  // Filter weeks by user selected range and augment with exact integer minutes
  const chartData = useMemo(() => {
    if (!rawWeeks.length) return [];
    const sliced = rawWeeks.slice(-selectedWeeksCount);
    // Reverse so the most recent week is at the top of the horizontal bar chart
    return [...sliced].reverse().map((wk) => ({
      ...wk,
      lowIntensityMinutes: Math.round(wk.lowIntensityHours * 60),
      greyZoneMinutes: Math.round(wk.greyZoneHours * 60),
      highIntensityMinutes: Math.round(wk.highIntensityHours * 60),
      z1Minutes: Math.round(wk.z1Hours * 60),
      z2Minutes: Math.round(wk.z2Hours * 60),
      z3Minutes: Math.round(wk.z3Hours * 60),
      z4Minutes: Math.round(wk.z4Hours * 60),
      z5Minutes: Math.round(wk.z5Hours * 60),
    }));
  }, [rawWeeks, selectedWeeksCount]);

  const currentWeek = progression?.currentWeek || rawWeeks[rawWeeks.length - 1] || null;

  if (!progression || rawWeeks.length === 0) {
    return (
      <div
        id="weekly-zone-progression"
        className="rounded-2xl bg-white border-2 border-zinc-950 p-6 shadow-[4px_4px_0px_0px_#09090b] space-y-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950">
            <Layers className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-zinc-950 tracking-tight">
              Weekly Hours in Zones (Intensity Distribution)
            </h3>
            <p className="text-[11px] font-mono text-zinc-600">
              Belum ada data aktivitas yang cukup untuk analisis zona mingguan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-white border-2 border-zinc-950 p-3.5 rounded-xl shadow-[4px_4px_0px_0px_#09090b] text-xs space-y-2.5 max-w-xs z-50">
        <div className="flex items-center justify-between border-b-2 border-zinc-100 pb-2">
          <div>
            <span className="font-black text-zinc-950 text-sm">{data.weekLabel}</span>
            <span className="block text-[10px] font-mono text-zinc-500">{data.weekRange}</span>
          </div>
          <span
            className="px-2 py-0.5 rounded-md text-[10px] font-black border border-zinc-950"
            style={{
              backgroundColor: data.statusBadge.bgColor,
              color: data.statusBadge.textColor,
            }}
          >
            {data.statusBadge.text}
          </span>
        </div>

        <div className="flex items-center justify-between font-mono text-[11px] text-zinc-700">
          <span className="flex items-center gap-1 font-bold">
            <Clock className="h-3 w-3" /> Total Volume:
          </span>
          <span className="font-black text-zinc-950">
            {formatDurationReadable(data.totalHours)} ({data.activityCount} sesi)
          </span>
        </div>

        {zoneMode === "seiler3" ? (
          <div className="space-y-1.5 pt-1 border-t border-zinc-100">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-zinc-950 shrink-0" />
                Low (Z1-2 Easy):
              </span>
              <span className="font-black text-zinc-950">
                {formatDurationReadable(data.lowIntensityHours)} • {data.lowIntensityPct}%
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-amber-700 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 border border-zinc-950 shrink-0" />
                Zone 3 (Tempo / SS):
              </span>
              <span className="font-black text-zinc-950">
                {formatDurationReadable(data.greyZoneHours)} • {data.greyZonePct}%
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-rose-700 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 border border-zinc-950 shrink-0" />
                High (Z4-5 Hard):
              </span>
              <span className="font-black text-zinc-950">
                {formatDurationReadable(data.highIntensityHours)} • {data.highIntensityPct}%
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1 pt-1 border-t border-zinc-100 font-mono text-[10px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-blue-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Z1 Recovery:
              </span>
              <span>{formatMinutesOnly(data.z1Hours)} ({data.z1Pct}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Z2 Aerobic Base:
              </span>
              <span>{formatMinutesOnly(data.z2Hours)} ({data.z2Pct}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Z3 Tempo/Grey:
              </span>
              <span>{formatMinutesOnly(data.z3Hours)} ({data.z3Pct}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-orange-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Z4 Threshold:
              </span>
              <span>{formatMinutesOnly(data.z4Hours)} ({data.z4Pct}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-rose-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Z5 VO2Max:
              </span>
              <span>{formatMinutesOnly(data.z5Hours)} ({data.z5Pct}%)</span>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-zinc-100 text-[10px] text-zinc-600 italic leading-relaxed">
          {data.tacticalAdvice}
        </div>
      </div>
    );
  };

  return (
    <div
      id="weekly-zone-progression"
      className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 shadow-[4px_4px_0px_0px_#09090b] space-y-6 transition-all"
    >
      {/* Top Header & Interactive Toggles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-zinc-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-200 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[2px_2px_0px_0px_#09090b]">
            <Layers className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-zinc-950 tracking-tight">
                Weekly Hours in Zones
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-900 border border-zinc-950">
                Intensity Distribution (TID)
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-600 mt-0.5">
              {language === "en"
                ? "Weekly training volume breakdown • Polarized, Pyramidal & Grey Zone detection"
                : "Distribusi volume latihan mingguan • Deteksi profil Polarized, Pyramidal & Grey Zone"}
            </p>
          </div>
        </div>

        {/* Controls: Range Selector, Metric Toggle, Zone Mode */}
        <div className="w-full md:w-auto flex items-center gap-2 overflow-x-auto max-w-full pb-1 self-start md:self-auto">
          {/* 3-Zone vs 5-Zone */}
          <div className="flex items-center p-0.5 bg-zinc-100 rounded-lg border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] shrink-0">
            <button
              onClick={() => setZoneMode("seiler3")}
              className={`px-2.5 py-1 rounded text-[11px] font-black transition-all ${
                zoneMode === "seiler3"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              {language === "en" ? "3 Categories (80/20)" : "3 Kategori (80/20)"}
            </button>
            <button
              onClick={() => setZoneMode("zones5")}
              className={`px-2.5 py-1 rounded text-[11px] font-black transition-all ${
                zoneMode === "zones5"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              {language === "en" ? "5 HR Zones" : "5 Zona HR"}
            </button>
          </div>

          {/* Unit: Percent vs Minutes vs Hours */}
          <div className="flex items-center p-0.5 bg-zinc-100 rounded-lg border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] shrink-0">
            <button
              onClick={() => setMetricMode("percentage")}
              className={`px-2 py-1 rounded text-[11px] font-black flex items-center gap-1 transition-all ${
                metricMode === "percentage"
                  ? "bg-emerald-300 text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
              title={language === "en" ? "Display percentage ratio (100% stacked)" : "Tampilkan proporsi persentase (100% stacked)"}
            >
              <Percent className="h-3 w-3" />
              <span>{language === "en" ? "% Ratio" : "% Rasio"}</span>
            </button>
            <button
              onClick={() => setMetricMode("minutes")}
              className={`px-2 py-1 rounded text-[11px] font-black flex items-center gap-1 transition-all ${
                metricMode === "minutes"
                  ? "bg-emerald-300 text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
              title={language === "en" ? "Display duration in minutes" : "Tampilkan durasi dalam menit"}
            >
              <Timer className="h-3 w-3" />
              <span>{language === "en" ? "Minutes" : "Menit"}</span>
            </button>
            <button
              onClick={() => setMetricMode("hours")}
              className={`px-2 py-1 rounded text-[11px] font-black flex items-center gap-1 transition-all ${
                metricMode === "hours"
                  ? "bg-emerald-300 text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
              title={language === "en" ? "Display total training hours" : "Tampilkan total jam latihan absolut"}
            >
              <Hourglass className="h-3 w-3" />
              <span>{language === "en" ? "Hours" : "Jam"}</span>
            </button>
          </div>

          {/* Weeks Count Selector */}
          <div className="flex items-center p-0.5 bg-zinc-100 rounded-lg border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] shrink-0">
            {[4, 8, 12].map((num) => (
              <button
                key={num}
                onClick={() => setSelectedWeeksCount(num)}
                className={`px-2 py-1 rounded text-[11px] font-black transition-all ${
                  selectedWeeksCount === num
                    ? "bg-zinc-950 text-white shadow-sm"
                    : "text-zinc-600 hover:text-zinc-950"
                }`}
              >
                {num}W
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Snapshot Cards for Current Week */}
      {currentWeek && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Status Badge & Week Indicator */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] flex flex-col justify-between group min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black font-mono text-zinc-500 uppercase">
                Status Minggu Ini ({currentWeek.weekLabel})
              </span>
              <div
                className="cursor-pointer text-zinc-400 hover:text-zinc-950 transition-colors"
                title={`${currentWeek.classificationLabel}\n${currentWeek.classificationDescription}\n\n💡 Saran Coach: ${currentWeek.tacticalAdvice}`}
              >
                <Info className="h-3.5 w-3.5 stroke-[2.5]" />
              </div>
            </div>
            <div className="my-1.5 flex items-center gap-2">
              <span
                className="px-2.5 py-1 rounded-lg text-xs font-black border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                style={{
                  backgroundColor: currentWeek.statusBadge.bgColor,
                  color: currentWeek.statusBadge.textColor,
                }}
              >
                {currentWeek.statusBadge.text}
              </span>
            </div>
            <p
              className="text-[11px] text-zinc-700 font-medium leading-snug"
              title={currentWeek.classificationDescription}
            >
              {currentWeek.classificationDescription}
            </p>
          </div>

          {/* Low Intensity KPI */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black font-mono text-emerald-800 uppercase truncate">
                Zone 1-2 (Easy Aerobic)
              </span>
              <span className="text-[10px] font-bold text-emerald-700 shrink-0">Target ≥ 75%</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-950">
                {currentWeek.lowIntensityPct}%
              </span>
              <span className="text-xs font-mono font-bold text-emerald-800 break-words">
                ({formatDurationReadable(currentWeek.lowIntensityHours)})
              </span>
            </div>
            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
              Pondasi mitokondria & aerobic base
            </p>
          </div>

          {/* Middle Zone KPI: Zone 3 Tempo / Sweet Spot */}
          <div
            className={`p-3.5 rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] min-w-0 ${
              currentWeek.classification === "grey_zone_trap"
                ? "bg-rose-50 border-rose-950"
                : currentWeek.classification === "pyramidal"
                ? "bg-cyan-50 border-cyan-950"
                : "bg-amber-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black font-mono text-amber-900 uppercase truncate">
                Zone 3 (Tempo / SS)
              </span>
              <span
                className={`text-[10px] font-bold shrink-0 ${
                  currentWeek.classification === "grey_zone_trap"
                    ? "text-rose-700 font-black"
                    : currentWeek.classification === "pyramidal"
                    ? "text-cyan-800 font-black"
                    : "text-amber-700"
                }`}
              >
                {currentWeek.classification === "grey_zone_trap"
                  ? "⚠️ Kebablasan Z3"
                  : currentWeek.classification === "pyramidal"
                  ? "Pyramidal (Tempo/MP)"
                  : "Terkontrol (≤15%)"}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-black font-mono text-zinc-950">
                {currentWeek.greyZonePct}%
              </span>
              <span className="text-xs font-mono font-bold text-zinc-700 break-words">
                ({formatDurationReadable(currentWeek.greyZoneHours)})
              </span>
            </div>
            <p className="text-[10px] text-zinc-600 font-medium mt-0.5 leading-snug">
              {currentWeek.classification === "grey_zone_trap"
                ? "Terlalu lelah untuk recovery, risiko kelelahan kronis"
                : currentWeek.classification === "pyramidal"
                ? "Porsi tempo terencana, baik untuk Half/Full Marathon"
                : "Porsi zona moderat terjaga secara seimbang"}
            </p>
          </div>

          {/* High Intensity KPI */}
          <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black font-mono text-rose-800 uppercase truncate">
                Zone 4-5 (Hard / VO2)
              </span>
              <span className="text-[10px] font-bold text-rose-700 shrink-0">Target 5-20%</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-black font-mono text-rose-950">
                {currentWeek.highIntensityPct}%
              </span>
              <span className="text-xs font-mono font-bold text-rose-800 break-words">
                ({formatDurationReadable(currentWeek.highIntensityHours)})
              </span>
            </div>
            <p className="text-[10px] text-rose-700 font-medium mt-0.5">
              Kualitas interval & batas laktat
            </p>
          </div>
        </div>
      )}

      {/* Main Horizontal Stacked Bar Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-600 pb-1">
          <div className="flex items-center gap-4 flex-wrap">
            {zoneMode === "seiler3" ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 border border-zinc-950" />
                  <span className="font-black text-zinc-900">Low Intensity (Z1-2 Easy)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-amber-400 border border-zinc-950" />
                  <span className="font-black text-zinc-900">Zone 3 (Tempo / Sweet Spot)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500 border border-zinc-950" />
                  <span className="font-black text-zinc-900">High Intensity (Z4-5 Hard)</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="font-bold text-zinc-900">Z1 Rec</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-zinc-900">Z2 Base</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="font-bold text-zinc-900">Z3 Grey</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                  <span className="font-bold text-zinc-900">Z4 Thresh</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span className="font-bold text-zinc-900">Z5 VO2</span>
                </div>
              </>
            )}
          </div>

          {metricMode === "percentage" && (
            <div className="hidden sm:flex items-center gap-1.5 text-zinc-600 font-mono">
              <span className="border-b-2 border-dashed border-zinc-950 w-5 h-0" />
              <span className="font-black text-zinc-950">
                {language === "en" ? "80% Guideline (Seiler Polarized)" : "Garis Acuan 80% (Seiler Polarized)"}
              </span>
            </div>
          )}
        </div>

        <div
          className="w-full bg-[#FAF9F5] border-2 border-zinc-950 rounded-xl p-3 shadow-[2px_2px_0px_0px_#09090b] overflow-x-auto"
          style={{ height: Math.max(280, chartData.length * 44 + 70) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 32, right: 28, left: 16, bottom: 10 }}
              barCategoryGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
              <XAxis
                type="number"
                domain={metricMode === "percentage" ? [0, 100] : [0, "auto"]}
                tickFormatter={(val) => {
                  if (metricMode === "percentage") return `${val}%`;
                  if (metricMode === "minutes") return `${val}m`;
                  return `${val}h`;
                }}
                tick={{ fontSize: 11, fontWeight: 700, fill: "#52525b" }}
                axisLine={{ stroke: "#09090b", strokeWidth: 1.5 }}
              />
              <YAxis
                type="category"
                dataKey="weekLabel"
                tick={{ fontSize: 11, fontWeight: 800, fill: "#09090b" }}
                axisLine={{ stroke: "#09090b", strokeWidth: 1.5 }}
                width={85}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0, 0, 0, 0.04)" }} />

              {/* 80% Threshold reference line when in percentage mode - cleanly positioned above the bars in the top margin */}
              {metricMode === "percentage" && (
                <ReferenceLine
                  x={80}
                  stroke="#09090b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={({ viewBox }: any) => {
                    const x = viewBox?.x ?? 0;
                    const y = viewBox?.y ?? 0;
                    return (
                      <g className="pointer-events-none">
                        <rect
                          x={x - 36}
                          y={y - 24}
                          width={72}
                          height={18}
                          rx={5}
                          fill="#09090b"
                        />
                        <text
                          x={x}
                          y={y - 11}
                          fill="#ffffff"
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={900}
                          letterSpacing="0.02em"
                        >
                          Target 80%
                        </text>
                      </g>
                    );
                  }}
                />
              )}

              {/* Stacked Bars depending on zone mode and metric mode */}
              {zoneMode === "seiler3" ? (
                <>
                  <Bar
                    dataKey={
                      metricMode === "percentage"
                        ? "lowIntensityPct"
                        : metricMode === "minutes"
                        ? "lowIntensityMinutes"
                        : "lowIntensityHours"
                    }
                    name="Low Intensity (Z1-2)"
                    stackId="a"
                    fill="#10b981"
                    stroke="#09090b"
                    strokeWidth={1.5}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey={
                      metricMode === "percentage"
                        ? "greyZonePct"
                        : metricMode === "minutes"
                        ? "greyZoneMinutes"
                        : "greyZoneHours"
                    }
                    name="Zone 3 (Tempo / SS)"
                    stackId="a"
                    fill="#fbbf24"
                    stroke="#09090b"
                    strokeWidth={1.5}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey={
                      metricMode === "percentage"
                        ? "highIntensityPct"
                        : metricMode === "minutes"
                        ? "highIntensityMinutes"
                        : "highIntensityHours"
                    }
                    name="High Intensity (Z4-5)"
                    stackId="a"
                    fill="#f43f5e"
                    stroke="#09090b"
                    strokeWidth={1.5}
                    radius={[0, 4, 4, 0]}
                  />
                </>
              ) : (
                <>
                  <Bar
                    dataKey={
                      metricMode === "percentage"
                        ? "z1Pct"
                        : metricMode === "minutes"
                        ? "z1Minutes"
                        : "z1Hours"
                    }
                    name="Z1 Recovery"
                    stackId="a"
                    fill="#3b82f6"
                    stroke="#09090b"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey={
                      metricMode === "percentage"
                        ? "z2Pct"
                        : metricMode === "minutes"
                        ? "z2Minutes"
                        : "z2Hours"
                    }
                    name="Z2 Aerobic"
                    stackId="a"
                    fill="#10b981"
                    stroke="#09090b"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey={
                      metricMode === "percentage"
                        ? "z3Pct"
                        : metricMode === "minutes"
                        ? "z3Minutes"
                        : "z3Hours"
                    }
                    name="Z3 Tempo"
                    stackId="a"
                    fill="#fbbf24"
                    stroke="#09090b"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey={
                      metricMode === "percentage"
                        ? "z4Pct"
                        : metricMode === "minutes"
                        ? "z4Minutes"
                        : "z4Hours"
                    }
                    name="Z4 Threshold"
                    stackId="a"
                    fill="#f97316"
                    stroke="#09090b"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey={
                      metricMode === "percentage"
                        ? "z5Pct"
                        : metricMode === "minutes"
                        ? "z5Minutes"
                        : "z5Hours"
                    }
                    name="Z5 VO2Max"
                    stackId="a"
                    fill="#ef4444"
                    stroke="#09090b"
                    strokeWidth={1.5}
                    radius={[0, 4, 4, 0]}
                  />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Educational Collapsible: "Kapan Zone 3 Bermanfaat vs Menjadi Jebakan?" */}
      <div className="border-2 border-zinc-950 rounded-xl bg-amber-50/70 p-4 space-y-3">
        <button
          onClick={() => setShowExplainer(!showExplainer)}
          className="w-full flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-900 stroke-[2.5]" />
            <span className="text-xs font-black text-zinc-950 group-hover:text-orange-600 transition-colors">
              Memahami Zone 3: Kapan Bermanfaat (Pyramidal / Sweet Spot) vs Kapan Menjadi Jebakan (Grey Zone)?
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-600">
            <span>{showExplainer ? "Sembunyikan" : "Pelajari Sains Distribusi"}</span>
            {showExplainer ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>

        {showExplainer && (
          <div className="pt-2 border-t border-amber-200/80 text-xs text-zinc-800 space-y-3 leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white border border-zinc-950/20 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Zone 1 & 2 (≥75% Volume)</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Intensitas aerobik murni. Membangun densitas kapiler, mitokondria, dan efisiensi
                  oksidasi lemak tanpa menumpuk kelelahan otonomik (HRV tetap terjaga).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-zinc-950/20 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Zone 3 (Tempo / Sweet Spot)</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Zona moderat di antara LT1 dan LT2. <strong>Sangat bermanfaat</strong> jika terencana untuk Marathon Pace / Sweet Spot (Model Pyramidal). Namun menjadi <em>&ldquo;Junk Miles / Grey Zone&rdquo;</em> jika lari santai (Easy Run) sering kebablasan ke sini tanpa sengaja, memicu kelelahan tanpa adaptasi optimal.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-zinc-950/20 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-rose-800">
                  <Flame className="h-3.5 w-3.5" />
                  <span>Zone 4 & 5 (5-20% Volume)</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Interval di ambang laktat dan VO2Max. Menstimulasi cardiac output maksimal,
                  kinerja neuromuskular, dan kecepatan lomba.
                </p>
              </div>
            </div>

            <p className="text-[11px] font-mono text-zinc-700 italic bg-amber-100/60 p-2.5 rounded-lg border border-amber-300">
              💡 <strong>Rekomendasi Coach:</strong> Zone 3 tidak jelek jika terprogram (misal latihan Marathon Pace atau Sweet Spot). Kuncinya adalah niat: saat jadwalnya lari santai (Easy Run), jaga agar tetap di Z1/Z2 (bisa berbicara kalimat lengkap). Simpan tenaga Anda agar sesi interval keras (Z4/Z5) dapat dieksekusi dengan performa 100%!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
