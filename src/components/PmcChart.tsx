"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { Activity, Flame, ShieldAlert, Zap, TrendingUp, Info } from "lucide-react";
import { MetricTooltip } from "@/components/MetricTooltip";

export interface PmcDataPoint {
  date: string;
  load: number;
  ctl: number;
  atl: number;
  tsb: number;
  formPct?: number;
  rampRate?: number;
}

interface PmcChartProps {
  data: PmcDataPoint[];
  currentCtl: number;
  currentAtl: number;
  currentTsb: number;
  rampRate: number;
  formPct: number;
  mode?: "coros" | "intervals";
  onToggleMode?: (mode: "coros" | "intervals") => void;
  scaleDescription?: string;
}

export const PmcChart: React.FC<PmcChartProps> = ({
  data,
  currentCtl,
  currentAtl,
  currentTsb,
  rampRate,
  formPct,
  mode = "coros",
  onToggleMode,
  scaleDescription,
}) => {
  const [timeRange, setTimeRange] = useState<"30" | "60" | "90" | "180" | "all">("90");

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (timeRange === "all") return data;
    const days = parseInt(timeRange, 10);
    return data.slice(-days);
  }, [data, timeRange]);

  // Form Zone determination
  let formZoneBadge = {
    label: "Optimal Training",
    bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    desc: "Building fitness efficiently (-10 to -30 TSB)",
  };

  if (currentTsb < -30) {
    formZoneBadge = {
      label: "High Injury Risk",
      bg: "bg-red-500/10 text-red-400 border-red-500/30",
      desc: "Excessive fatigue; overreaching (< -30 TSB)",
    };
  } else if (currentTsb > 25) {
    formZoneBadge = {
      label: "Transition / Detraining",
      bg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      desc: "Freshness high, fitness decaying (> +25 TSB)",
    };
  } else if (currentTsb > 5) {
    formZoneBadge = {
      label: "Fresh / Race Ready",
      bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      desc: "Body primed for racing & PRs (+5 to +25 TSB)",
    };
  } else if (currentTsb > -10) {
    formZoneBadge = {
      label: "Grey / Maintenance",
      bg: "bg-slate-500/10 text-slate-400 border-slate-500/30",
      desc: "Holding pattern / recovery week (-10 to +5 TSB)",
    };
  }

  // Ramp rate status
  const isRampDanger = rampRate > 10;
  const isRampOptimal = rampRate >= 4 && rampRate <= 8;

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-6 shadow-xl backdrop-blur-sm">
      {/* Title, Scale Mode Toggle, & Time Range Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-tight">
                Performance Management Chart (PMC)
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {mode === "coros" ? "COROS TRIMP Scale" : "Intervals.icu rTSS Scale"}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {scaleDescription || (mode === "coros"
                ? "Heart-rate TRIMP scale matching your COROS watch screen (Base Fitness ~115)."
                : "Threshold pace/power scale calibrated to Intervals.icu (Threshold: 4:42 /km).")}
            </p>
          </div>
        </div>

        {/* Controls: Scale Toggle + Time Range */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scale Switcher Toggle */}
          {onToggleMode && (
            <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => onToggleMode("coros")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  mode === "coros"
                    ? "bg-orange-600 text-white shadow-sm font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                COROS Load
              </button>
              <button
                type="button"
                onClick={() => onToggleMode("intervals")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  mode === "intervals"
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Intervals.icu rTSS
              </button>
            </div>
          )}

          {/* Time Range filters */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {(["30", "60", "90", "180", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  timeRange === range
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {range === "all" ? "All" : `${range}d`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* CTL Card */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="ctl">
              <span className="text-xs font-semibold text-blue-400">Fitness (CTL)</span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-400 font-mono">42d</span>
          </div>
          <div className="text-2xl font-black text-white">{currentCtl}</div>
          <p className="text-[11px] text-zinc-400 truncate">Chronic Training Load</p>
        </div>

        {/* ATL Card */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="atl">
              <span className="text-xs font-semibold text-purple-400">Fatigue (ATL)</span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-400 font-mono">7d</span>
          </div>
          <div className="text-2xl font-black text-white">{currentAtl}</div>
          <p className="text-[11px] text-zinc-400 truncate">Acute Training Load</p>
        </div>

        {/* TSB Card */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="tsb">
              <span className="text-xs font-semibold text-emerald-400">Form (TSB)</span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-400 font-mono">CTL - ATL</span>
          </div>
          <div className={`text-2xl font-black ${currentTsb >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
            {currentTsb > 0 ? `+${currentTsb}` : currentTsb}
          </div>
          <p className="text-[11px] text-zinc-400 truncate">{formPct}% of CTL</p>
        </div>

        {/* Ramp Rate Card */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="ramp_rate">
              <span className="text-xs font-semibold text-orange-400">Ramp Rate</span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-400 font-mono">7d</span>
          </div>
          <div className={`text-2xl font-black ${isRampDanger ? "text-red-400" : isRampOptimal ? "text-emerald-400" : "text-white"}`}>
            {rampRate > 0 ? `+${rampRate}` : rampRate}
          </div>
          <p className="text-[11px] text-zinc-400 truncate">
            {isRampDanger ? "Danger (>10)" : isRampOptimal ? "Optimal (+5 to +8)" : "Steady"}
          </p>
        </div>

        {/* Form Zone Badge Card */}
        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1 flex flex-col justify-between">
          <div className="text-xs font-semibold text-zinc-400">Training Status</div>
          <div className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-xs font-bold w-fit ${formZoneBadge.bg}`}>
            {formZoneBadge.label}
          </div>
          <p className="text-[10px] text-zinc-400 leading-tight">{formZoneBadge.desc}</p>
        </div>
      </div>

      {/* Chart Visualizer */}
      <div className="h-80 w-full pt-2">
        {filteredData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            No PMC data points available yet. Sync with COROS to populate curves.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ctlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                stroke="#52525b"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickFormatter={(str) => {
                  const parts = str.split("-");
                  return `${parts[1]}/${parts[2]}`;
                }}
              />
              <YAxis
                stroke="#52525b"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
              />

              <Tooltip
                wrapperStyle={{ zIndex: 9999 }}
                contentStyle={{
                  backgroundColor: "#09090b",
                  borderColor: "#27272a",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
                }}
                labelStyle={{ color: "#e4e4e7", fontWeight: "bold", marginBottom: "4px" }}
              />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
              />

              {/* Form Zero Reference Line */}
              <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
              {/* Form Sweet Spot Upper & Lower Boundaries */}
              <ReferenceLine y={25} stroke="#06b6d4" strokeDasharray="2 2" />
              <ReferenceLine y={-10} stroke="#22c55e" strokeDasharray="2 2" />
              <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="2 2" />

              {/* Daily Training Load Bar */}
              <Bar
                dataKey="load"
                name="Daily Load"
                fill="#71717a"
                opacity={0.35}
                radius={[2, 2, 0, 0]}
              />

              {/* CTL - Fitness */}
              <Area
                type="monotone"
                dataKey="ctl"
                name="Fitness (CTL)"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#ctlGradient)"
              />

              {/* ATL - Fatigue */}
              <Line
                type="monotone"
                dataKey="atl"
                name="Fatigue (ATL)"
                stroke="#c084fc"
                strokeWidth={2}
                dot={false}
              />

              {/* TSB - Form */}
              <Line
                type="monotone"
                dataKey="tsb"
                name="Form (TSB)"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Intervals.icu Form Zone Reference Legend */}
      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
          <Info className="h-3.5 w-3.5 text-zinc-400" />
          <span>Intervals.icu Form Zones:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span>High Risk (&lt; -30)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Optimal (-30 to -10)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span>Grey (-10 to +5)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>Fresh (+5 to +25)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Transition (&gt; +25)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
