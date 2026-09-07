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
  Cell,
} from "recharts";
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Percent,
  Timer,
  Flame,
  HelpCircle,
} from "lucide-react";
import { WeeklyZoneData, WeeklyZoneProgressionResult } from "@/lib/analytics";

interface WeeklyZoneProgressionCardProps {
  progression: WeeklyZoneProgressionResult | null | undefined;
}

export const WeeklyZoneProgressionCard: React.FC<WeeklyZoneProgressionCardProps> = ({
  progression,
}) => {
  const [selectedWeeksCount, setSelectedWeeksCount] = useState<number>(8);
  const [metricMode, setMetricMode] = useState<"percentage" | "hours">("percentage");
  const [zoneMode, setZoneMode] = useState<"seiler3" | "zones5">("seiler3");
  const [showExplainer, setShowExplainer] = useState<boolean>(false);
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  const rawWeeks = progression?.weeks || [];

  // Filter weeks by user selected range (latest N weeks, reversed for top-to-bottom or bottom-to-top display)
  const chartData = useMemo(() => {
    if (!rawWeeks.length) return [];
    const sliced = rawWeeks.slice(-selectedWeeksCount);
    // Reverse so the most recent week is at the top of the horizontal bar chart
    return [...sliced].reverse();
  }, [rawWeeks, selectedWeeksCount]);

  const currentWeek = progression?.currentWeek || rawWeeks[rawWeeks.length - 1] || null;
  const overallAvg = progression?.overallAverage;

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
              Weekly Hours in Zones (Polarized vs Grey Zone)
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
    const data: WeeklyZoneData = payload[0].payload;

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
            {data.totalHours} jam ({data.activityCount} sesi)
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
                {data.lowIntensityHours} jam ({data.lowIntensityPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-amber-700 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 border border-zinc-950 shrink-0" />
                Grey Zone (Z3 Tempo):
              </span>
              <span className="font-black text-zinc-950">
                {data.greyZoneHours} jam ({data.greyZonePct}%)
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-rose-700 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 border border-zinc-950 shrink-0" />
                High (Z4-5 Hard):
              </span>
              <span className="font-black text-zinc-950">
                {data.highIntensityHours} jam ({data.highIntensityPct}%)
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1 pt-1 border-t border-zinc-100 font-mono text-[10px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-blue-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Z1 Recovery:
              </span>
              <span>{data.z1Hours}h ({data.z1Pct}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Z2 Aerobic Base:
              </span>
              <span>{data.z2Hours}h ({data.z2Pct}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Z3 Tempo/Grey:
              </span>
              <span>{data.z3Hours}h ({data.z3Pct}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-orange-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-orange-500" /> Z4 Threshold:
              </span>
              <span>{data.z4Hours}h ({data.z4Pct}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-rose-600 font-bold">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Z5 VO2Max:
              </span>
              <span>{data.z5Hours}h ({data.z5Pct}%)</span>
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
                Seiler 80/20 vs Grey Zone
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-600 mt-0.5">
              Distribusi jam latihan per minggu • Deteksi jebakan Zone 3 (Grey Zone)
            </p>
          </div>
        </div>

        {/* Controls: Range Selector, Metric Toggle, Zone Mode */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          {/* 3-Zone vs 5-Zone */}
          <div className="flex items-center p-0.5 bg-zinc-100 rounded-lg border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <button
              onClick={() => setZoneMode("seiler3")}
              className={`px-2.5 py-1 rounded text-[11px] font-black transition-all ${
                zoneMode === "seiler3"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              3 Kategori (80/20)
            </button>
            <button
              onClick={() => setZoneMode("zones5")}
              className={`px-2.5 py-1 rounded text-[11px] font-black transition-all ${
                zoneMode === "zones5"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              5 Zona HR
            </button>
          </div>

          {/* Unit: Percent vs Hours */}
          <div className="flex items-center p-0.5 bg-zinc-100 rounded-lg border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <button
              onClick={() => setMetricMode("percentage")}
              className={`px-2 py-1 rounded text-[11px] font-black flex items-center gap-1 transition-all ${
                metricMode === "percentage"
                  ? "bg-emerald-300 text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
              title="Tampilkan proporsi persentase (100% stacked)"
            >
              <Percent className="h-3 w-3" />
              <span>Rasio %</span>
            </button>
            <button
              onClick={() => setMetricMode("hours")}
              className={`px-2 py-1 rounded text-[11px] font-black flex items-center gap-1 transition-all ${
                metricMode === "hours"
                  ? "bg-emerald-300 text-zinc-950 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
              title="Tampilkan total jam latihan absolut"
            >
              <Timer className="h-3 w-3" />
              <span>Jam</span>
            </button>
          </div>

          {/* Weeks Count Selector */}
          <div className="flex items-center p-0.5 bg-zinc-100 rounded-lg border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
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

      {/* Snapshot Cards for Current Week & Multi-week Average */}
      {currentWeek && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Status Badge & Week Indicator */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] flex flex-col justify-between">
            <span className="text-[10px] font-black font-mono text-zinc-500 uppercase">
              Status Minggu Ini ({currentWeek.weekLabel})
            </span>
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
            <p className="text-[11px] text-zinc-600 line-clamp-1 font-medium">
              {currentWeek.classificationDescription}
            </p>
          </div>

          {/* Low Intensity KPI */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black font-mono text-emerald-800 uppercase">
                Zone 1-2 (Easy Aerobic)
              </span>
              <span className="text-[10px] font-bold text-emerald-700">Target ≥ 75-80%</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-emerald-950">
                {currentWeek.lowIntensityPct}%
              </span>
              <span className="text-xs font-mono font-bold text-emerald-800">
                ({currentWeek.lowIntensityHours} jam)
              </span>
            </div>
            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
              Pondasi mitokondria & endurance base
            </p>
          </div>

          {/* Grey Zone KPI */}
          <div
            className={`p-3.5 rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] ${
              currentWeek.greyZonePct > 20
                ? "bg-rose-50 border-rose-950"
                : "bg-amber-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black font-mono text-amber-900 uppercase">
                Zone 3 (Grey / Tempo)
              </span>
              <span
                className={`text-[10px] font-bold ${
                  currentWeek.greyZonePct > 20 ? "text-rose-700 font-black" : "text-amber-700"
                }`}
              >
                {currentWeek.greyZonePct > 20 ? "⚠️ Waspada (>20%)" : "Optimal ≤ 15%"}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-zinc-950">
                {currentWeek.greyZonePct}%
              </span>
              <span className="text-xs font-mono font-bold text-zinc-700">
                ({currentWeek.greyZoneHours} jam)
              </span>
            </div>
            <p className="text-[10px] text-zinc-600 font-medium mt-0.5">
              {currentWeek.greyZonePct > 20
                ? "Terlalu lelah untuk recovery, kurang keras untuk VO2Max"
                : "Terkontrol dengan baik minggu ini"}
            </p>
          </div>

          {/* High Intensity KPI */}
          <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black font-mono text-rose-800 uppercase">
                Zone 4-5 (Hard / VO2)
              </span>
              <span className="text-[10px] font-bold text-rose-700">Target 5-20%</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-rose-950">
                {currentWeek.highIntensityPct}%
              </span>
              <span className="text-xs font-mono font-bold text-rose-800">
                ({currentWeek.highIntensityHours} jam)
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
                  <span className="font-black text-zinc-900">Grey Zone (Z3 Tempo)</span>
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
            <div className="hidden sm:flex items-center gap-1.5 text-zinc-500">
              <span className="border-b-2 border-dashed border-zinc-950 w-5 h-0" />
              <span className="font-bold">Garis Acuan 80%</span>
            </div>
          )}
        </div>

        <div
          className="w-full bg-[#FAF9F5] border-2 border-zinc-950 rounded-xl p-3 shadow-[2px_2px_0px_0px_#09090b] overflow-x-auto"
          style={{ height: Math.max(260, chartData.length * 44 + 60) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 10, right: 24, left: 16, bottom: 10 }}
              barCategoryGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
              <XAxis
                type="number"
                domain={metricMode === "percentage" ? [0, 100] : [0, "auto"]}
                tickFormatter={(val) => `${val}${metricMode === "percentage" ? "%" : "h"}`}
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

              {/* 80% Threshold reference line when in percentage mode */}
              {metricMode === "percentage" && (
                <ReferenceLine
                  x={80}
                  stroke="#09090b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: "Target 80%",
                    position: "top",
                    fill: "#09090b",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                />
              )}

              {/* Stacked Bars depending on zone mode and metric mode */}
              {zoneMode === "seiler3" ? (
                <>
                  <Bar
                    dataKey={metricMode === "percentage" ? "lowIntensityPct" : "lowIntensityHours"}
                    name="Low Intensity (Z1-2)"
                    stackId="a"
                    fill="#10b981"
                    stroke="#09090b"
                    strokeWidth={1.5}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey={metricMode === "percentage" ? "greyZonePct" : "greyZoneHours"}
                    name="Grey Zone (Z3)"
                    stackId="a"
                    fill="#fbbf24"
                    stroke="#09090b"
                    strokeWidth={1.5}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey={metricMode === "percentage" ? "highIntensityPct" : "highIntensityHours"}
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
                    dataKey={metricMode === "percentage" ? "z1Pct" : "z1Hours"}
                    name="Z1 Recovery"
                    stackId="a"
                    fill="#3b82f6"
                    stroke="#09090b"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey={metricMode === "percentage" ? "z2Pct" : "z2Hours"}
                    name="Z2 Aerobic"
                    stackId="a"
                    fill="#10b981"
                    stroke="#09090b"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey={metricMode === "percentage" ? "z3Pct" : "z3Hours"}
                    name="Z3 Tempo"
                    stackId="a"
                    fill="#fbbf24"
                    stroke="#09090b"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey={metricMode === "percentage" ? "z4Pct" : "z4Hours"}
                    name="Z4 Threshold"
                    stackId="a"
                    fill="#f97316"
                    stroke="#09090b"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey={metricMode === "percentage" ? "z5Pct" : "z5Hours"}
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

      {/* Educational Collapsible: "Kenapa Menghindari Grey Zone?" */}
      <div className="border-2 border-zinc-950 rounded-xl bg-amber-50/70 p-4 space-y-3">
        <button
          onClick={() => setShowExplainer(!showExplainer)}
          className="w-full flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-900 stroke-[2.5]" />
            <span className="text-xs font-black text-zinc-950 group-hover:text-orange-600 transition-colors">
              Mengapa Jebakan Zone 3 (&ldquo;Grey Zone&rdquo;) Merugikan Pelari?
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-600">
            <span>{showExplainer ? "Sembunyikan" : "Pelajari Sains 80/20"}</span>
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
                  <span>Zone 1 & 2 (80% Volume)</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Intensitas aerobik murni. Membangun densitas kapiler, mitokondria, dan efisiensi
                  oksidasi lemak tanpa menumpuk kelelahan otonomik (HRV tetap terjaga).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-zinc-950/20 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Zone 3 &ldquo;Grey Zone&rdquo; (&le;15%)</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Terlalu keras untuk pemulihan, namun terlalu lambat untuk memicu adaptasi
                  enzimatis VO2Max. Sering disebut <em>&ldquo;Junk Miles&rdquo;</em> yang menyebabkan
                  kelelahan kronis.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white border border-zinc-950/20 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-rose-800">
                  <Flame className="h-3.5 w-3.5" />
                  <span>Zone 4 & 5 (20% Volume)</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Interval di ambang laktat dan VO2Max. Menstimulasi cardiac output maksimal,
                  kinerja neuromuskular, dan kecepatan lomba.
                </p>
              </div>
            </div>

            <p className="text-[11px] font-mono text-zinc-600 italic bg-amber-100/50 p-2.5 rounded-lg border border-amber-300">
              💡 <strong>Rekomendasi Coach:</strong> Jaga lari santai tetap santai (di Z1/Z2, Anda
              bisa berbicara dalam kalimat lengkap), sehingga saat hari latihan interval keras (Z4/Z5),
              tubuh Anda segar dan mampu mengerahkan performa 100%.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
