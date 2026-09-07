"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  Activity,
  Flame,
  ShieldAlert,
  Zap,
  TrendingUp,
  Info,
  Calendar,
  Crosshair,
  Sliders,
  Sparkles,
  Flag,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { MetricTooltip } from "@/components/MetricTooltip";
import { useTheme } from "next-themes";
import { generatePmcForecast, PmcPoint } from "@/lib/analytics";

export interface PmcDataPoint {
  date: string;
  load: number;
  ctl: number;
  atl: number;
  tsb: number;
  formPct?: number;
  rampRate?: number;
  isForecast?: boolean;
  isRaceDay?: boolean;
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

// Helpers for date formatting
function formatChartDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getFormZone(tsb: number) {
  if (tsb < -30) {
    return {
      label: "High Risk",
      zoneName: "Overreaching",
      textColor: "text-rose-600",
      badgeClass: "bg-rose-100 text-rose-950 border-2 border-zinc-950",
      pillClass: "bg-rose-500",
      range: "< -30",
      desc: "Excessive fatigue; high injury / illness danger",
    };
  }
  if (tsb <= -10) {
    return {
      label: "Optimal",
      zoneName: "Optimal Training",
      textColor: "text-emerald-600",
      badgeClass: "bg-emerald-100 text-emerald-950 border-2 border-zinc-950",
      pillClass: "bg-emerald-500",
      range: "-30 to -10",
      desc: "Productive training stimulus & fitness building",
    };
  }
  if (tsb <= 5) {
    return {
      label: "Grey",
      zoneName: "Maintenance",
      textColor: "text-zinc-600",
      badgeClass: "bg-zinc-100 text-zinc-950 border-2 border-zinc-950",
      pillClass: "bg-zinc-400",
      range: "-10 to +5",
      desc: "Holding pattern / recovery period",
    };
  }
  if (tsb <= 25) {
    return {
      label: "Fresh",
      zoneName: "Race Ready",
      textColor: "text-cyan-600",
      badgeClass: "bg-cyan-100 text-cyan-950 border-2 border-zinc-950",
      pillClass: "bg-cyan-500",
      range: "+5 to +25",
      desc: "Peak sharpness & primed for races / PRs",
    };
  }
  return {
    label: "Transition",
    zoneName: "Detraining",
    range: "> +25",
    desc: "Fitness decaying; recovery phase extended",
  };
}

// Interactive Hover Tooltip Component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PmcTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload as PmcDataPoint | undefined;
  if (!point) return null;

  const zone = getFormZone(point.tsb);

  return (
    <div className="bg-white border-2 border-zinc-950 p-3 rounded-xl shadow-[4px_4px_0px_0px_#09090b] text-xs font-bold space-y-2 min-w-[210px] pointer-events-none z-50">
      <div className="font-black text-zinc-950 pb-1.5 border-b-2 border-zinc-100 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-zinc-600" />
          {formatFullDate(point.date)}
        </span>
        {point.isRaceDay ? (
          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400 text-black border border-zinc-950 flex items-center gap-1">
            <Flag className="h-2.5 w-2.5" /> Race
          </span>
        ) : point.isForecast ? (
          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-950 border border-violet-950">
            Projected
          </span>
        ) : null}
      </div>
      <div className="space-y-1 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-sky-700 font-bold">Fitness (CTL):</span>
          <span className="font-mono font-black text-sky-700 text-sm">{point.ctl}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-purple-700 font-bold">Fatigue (ATL):</span>
          <span className="font-mono font-black text-purple-700 text-sm">{point.atl}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-emerald-700 font-bold">Form (TSB):</span>
          <span className="font-mono font-black text-emerald-700 text-sm">
            {point.tsb > 0 ? `+${point.tsb}` : point.tsb}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 font-medium">Zone Status:</span>
          <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${zone.badgeClass}`}>
            {zone.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-orange-700 font-bold">Ramp Rate:</span>
          <span className="font-mono font-black text-zinc-900">
            {(point.rampRate ?? 0) > 0 ? `+${point.rampRate}` : point.rampRate ?? 0}/wk
          </span>
        </div>
        {point.load > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-zinc-700">
            <span>Day Load:</span>
            <span className="font-mono font-black text-zinc-950">{point.load}</span>
          </div>
        )}
      </div>
    </div>
  );
};

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
  const [timeRange, setTimeRange] = useState<"7" | "30" | "60" | "90" | "180" | "all">("90");
  const [hoveredPoint, setHoveredPoint] = useState<PmcDataPoint | null>(null);

  // Future PMC Forecasting ("What-If" Planning) State
  const [isForecastOpen, setIsForecastOpen] = useState(false);
  const [forecastDays, setForecastDays] = useState<number>(21); // 3 weeks default
  const [forecastStrategy, setForecastStrategy] = useState<
    "maintain" | "taper_light" | "taper_aggressive" | "build_conservative" | "custom"
  >("taper_light");
  const [customWeeklyLoad, setCustomWeeklyLoad] = useState<number>(250);
  const [targetRaceDate, setTargetRaceDate] = useState<string>("");

  // Base filtered historical series
  const historicalFiltered = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (timeRange === "all") return data;
    const days = parseInt(timeRange, 10);
    return data.slice(-days);
  }, [data, timeRange]);

  // Baseline load info from recent history
  const baselineWeeklyLoad = useMemo(() => {
    if (!data || data.length === 0) return 250;
    const recent = data.slice(-14);
    const avg = recent.reduce((sum, p) => sum + (p.load || 0), 0) / Math.max(1, recent.length);
    return Math.round(avg * 7);
  }, [data]);

  // Initialize customWeeklyLoad to baseline if not modified
  React.useEffect(() => {
    if (baselineWeeklyLoad > 0 && customWeeklyLoad === 250) {
      setCustomWeeklyLoad(baselineWeeklyLoad);
    }
  }, [baselineWeeklyLoad, customWeeklyLoad]);

  // Forecast points generation
  const forecastSeries = useMemo(() => {
    if (!isForecastOpen || !data || data.length === 0) return [];
    return generatePmcForecast(data as PmcPoint[], {
      forecastDays,
      weeklyLoadStrategy: forecastStrategy,
      customWeeklyLoad,
      raceDate: targetRaceDate || undefined,
    });
  }, [isForecastOpen, data, forecastDays, forecastStrategy, customWeeklyLoad, targetRaceDate]);

  // Combined chart dataset: historical + forecast points
  const filteredData = useMemo(() => {
    if (!isForecastOpen || forecastSeries.length === 0) {
      return historicalFiltered;
    }
    return [...historicalFiltered, ...forecastSeries];
  }, [historicalFiltered, isForecastOpen, forecastSeries]);

  // Race day predicted point (if target date set) or target horizon point
  const targetForecastPoint = useMemo(() => {
    if (!isForecastOpen || forecastSeries.length === 0) return null;
    if (targetRaceDate) {
      const racePt = forecastSeries.find((p) => p.date === targetRaceDate);
      if (racePt) return racePt;
    }
    return forecastSeries[forecastSeries.length - 1];
  }, [isForecastOpen, forecastSeries, targetRaceDate]);

  // Active point: either hovered or latest data point
  const activePoint = useMemo(() => {
    if (hoveredPoint) return hoveredPoint;
    if (filteredData.length > 0) return filteredData[filteredData.length - 1];
    return null;
  }, [hoveredPoint, filteredData]);

  const activeZone = useMemo(() => {
    return getFormZone(activePoint?.tsb ?? currentTsb);
  }, [activePoint, currentTsb]);

  // Dynamic axis boundaries calculated from the filtered dataset
  const { minFitness, maxFitness, maxLoad, minTsb, maxTsb, minRamp, maxRamp } = useMemo(() => {
    if (!filteredData.length) {
      return {
        minFitness: 0,
        maxFitness: 100,
        maxLoad: 100,
        minTsb: -45,
        maxTsb: 35,
        minRamp: -5,
        maxRamp: 10,
      };
    }

    let minF = Infinity;
    let maxF = -Infinity;
    let maxL = 0;
    let minT = Infinity;
    let maxT = -Infinity;
    let minR = Infinity;
    let maxR = -Infinity;

    for (const pt of filteredData) {
      const lowF = Math.min(pt.ctl, pt.atl);
      const highF = Math.max(pt.ctl, pt.atl);
      if (lowF < minF) minF = lowF;
      if (highF > maxF) maxF = highF;
      if (pt.load > maxL) maxL = pt.load;
      if (pt.tsb < minT) minT = pt.tsb;
      if (pt.tsb > maxT) maxT = pt.tsb;
      const r = pt.rampRate ?? 0;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }

    return {
      minFitness: Math.max(0, Math.floor(minF - 5)),
      maxFitness: Math.ceil(maxF + 8),
      maxLoad: Math.max(80, maxL),
      minTsb: Math.min(-45, Math.floor(minT - 5)),
      maxTsb: Math.max(35, Math.ceil(maxT + 5)),
      minRamp: Math.min(-5, Math.floor(minR - 2)),
      maxRamp: Math.max(10, Math.ceil(maxR + 2)),
    };
  }, [filteredData]);

  // Dynamic Form Zone Gradient Stops mapped precisely to the TSB curve's bounding box
  const formGradientStops = useMemo(() => {
    if (!filteredData.length) return null;
    let tsbMin = Infinity;
    let tsbMax = -Infinity;
    for (const pt of filteredData) {
      if (pt.tsb < tsbMin) tsbMin = pt.tsb;
      if (pt.tsb > tsbMax) tsbMax = pt.tsb;
    }
    if (!isFinite(tsbMin) || !isFinite(tsbMax)) return null;

    const range = tsbMax - tsbMin;
    if (range <= 0) return null;

    // In SVG, gradientUnits="objectBoundingBox": 0% is top of the path (tsbMax), 100% is bottom (tsbMin)
    const getPct = (val: number) => {
      const clamped = Math.max(tsbMin, Math.min(tsbMax, val));
      const pct = ((tsbMax - clamped) / range) * 100;
      return `${Math.max(0, Math.min(100, Math.round(pct * 10) / 10))}%`;
    };

    return {
      transition: getPct(25), // > 25 Amber
      fresh: getPct(5),       // 5 to 25 Cyan/Blue
      grey: getPct(-10),      // -10 to 5 Grey
      optimal: getPct(-30),   // -30 to -10 Green
    };
  }, [filteredData]);

  // Ramp rate status flags
  const isRampDanger = (activePoint?.rampRate ?? rampRate) > 10;
  const isRampOptimal =
    (activePoint?.rampRate ?? rampRate) >= 4 && (activePoint?.rampRate ?? rampRate) <= 8;

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Shared tooltip cursor style
  const sharedCursor = {
    stroke: isDark ? "#a1a1aa" : "#09090b",
    strokeWidth: 1.5,
    strokeDasharray: "3 3",
  };

  // Shared mouse move handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartMouseMove = (state: any) => {
    if (state?.activePayload && state.activePayload.length > 0) {
      const pt = state.activePayload[0].payload as PmcDataPoint;
      if (pt) {
        setHoveredPoint(pt);
      }
    }
  };

  return (
    <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-6 shadow-[4px_4px_0px_0px_#09090b]">
      {/* Title, Scale Mode Toggle, & Time Range Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 border-2 border-zinc-950 flex items-center justify-center text-blue-900 shadow-[2px_2px_0px_0px_#09090b]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">
                Performance Management Chart (PMC)
              </h2>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-[#FAF9F5] text-zinc-950 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                {mode === "coros" ? "COROS TRIMP Scale" : "Standard rTSS Scale"}
              </span>
            </div>
            <p className="text-xs text-zinc-600 mt-0.5">
              {scaleDescription ||
                (mode === "coros"
                  ? "Heart-rate TRIMP scale matching your COROS watch screen (Base Fitness ~115)."
                  : "Threshold pace/power scale calibrated to Coggan rTSS model (Threshold: 4:42 /km).")}
            </p>
          </div>
        </div>

        {/* Controls: Scale Toggle + Time Range */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scale Switcher Toggle */}
          {onToggleMode && (
            <div className="flex items-center bg-[#F0EDE4] p-1 rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
              <button
                type="button"
                onClick={() => onToggleMode("coros")}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                  mode === "coros"
                    ? "bg-orange-400 text-black border-2 border-zinc-950 font-black shadow-[1.5px_1.5px_0px_0px_#09090b]"
                    : "text-zinc-600 hover:text-black font-bold border-2 border-transparent"
                }`}
              >
                COROS Load
              </button>
              <button
                type="button"
                onClick={() => onToggleMode("intervals")}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                  mode === "intervals"
                    ? "bg-cyan-400 text-black border-2 border-zinc-950 font-black shadow-[1.5px_1.5px_0px_0px_#09090b]"
                    : "text-zinc-600 hover:text-black font-bold border-2 border-transparent"
                }`}
              >
                Standard rTSS
              </button>
            </div>
          )}

          {/* Time Range filters */}
          <div className="flex items-center gap-1 bg-[#F0EDE4] p-1 rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
            {(["7", "30", "60", "90", "180", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                  timeRange === range
                    ? "bg-white text-zinc-950 border-2 border-zinc-950 font-black shadow-[1.5px_1.5px_0px_0px_#09090b]"
                    : "text-zinc-600 hover:text-zinc-950 font-bold border-2 border-transparent"
                }`}
              >
                {range === "all" ? "All" : `${range}d`}
              </button>
            ))}
          </div>

          {/* What-If Forecast Simulator Toggle */}
          <button
            type="button"
            onClick={() => setIsForecastOpen(!isForecastOpen)}
            className={`px-3 py-1.5 text-xs rounded-xl border-2 border-zinc-950 font-black flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 ${
              isForecastOpen
                ? "bg-violet-600 text-white"
                : "bg-violet-100 text-violet-950 hover:bg-violet-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isForecastOpen ? "Hide Forecast" : "What-If Forecast"}</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards Row (Summary) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* CTL Card */}
        <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="ctl">
              <span className="text-xs font-black text-sky-700">Fitness (CTL)</span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-500 font-mono font-bold">42d</span>
          </div>
          <div className="text-2xl font-black text-zinc-950 font-mono">{currentCtl}</div>
          <p className="text-[11px] text-zinc-600 truncate font-medium">Chronic Training Load</p>
        </div>

        {/* ATL Card */}
        <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="atl">
              <span className="text-xs font-black text-purple-700">Fatigue (ATL)</span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-500 font-mono font-bold">7d</span>
          </div>
          <div className="text-2xl font-black text-zinc-950 font-mono">{currentAtl}</div>
          <p className="text-[11px] text-zinc-600 truncate font-medium">Acute Training Load</p>
        </div>

        {/* TSB Card */}
        <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="tsb">
              <span className="text-xs font-black text-emerald-700">Form (TSB)</span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-500 font-mono font-bold">CTL - ATL</span>
          </div>
          <div
            className={`text-2xl font-black font-mono ${
              currentTsb >= 0 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {currentTsb > 0 ? `+${currentTsb}` : currentTsb}
          </div>
          <p className="text-[11px] text-zinc-600 truncate font-medium">{formPct}% of CTL</p>
        </div>

        {/* Ramp Rate Card */}
        <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] space-y-1">
          <div className="flex items-center justify-between">
            <MetricTooltip term="ramp_rate">
              <span className="text-xs font-black text-orange-700">Ramp Rate</span>
            </MetricTooltip>
            <span className="text-[10px] text-zinc-500 font-mono font-bold">7d</span>
          </div>
          <div
            className={`text-2xl font-black font-mono ${
              rampRate > 10
                ? "text-rose-600"
                : rampRate >= 4 && rampRate <= 8
                ? "text-emerald-600"
                : "text-zinc-950"
            }`}
          >
            {rampRate > 0 ? `+${rampRate}` : rampRate}
          </div>
          <p className="text-[11px] text-zinc-600 truncate font-medium">
            {rampRate > 10 ? "Danger (>10)" : rampRate >= 4 && rampRate <= 8 ? "Optimal (+5 to +8)" : "Steady"}
          </p>
        </div>

        {/* Form Zone Badge Card */}
        <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] space-y-1 flex flex-col justify-between">
          <div className="text-xs font-black text-zinc-700 uppercase tracking-wider">
            Current Status
          </div>
          <div
            className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black w-fit shadow-[1.5px_1.5px_0px_0px_#09090b] ${
              getFormZone(currentTsb).badgeClass
            }`}
          >
            {getFormZone(currentTsb).label}
          </div>
          <p className="text-[10px] text-zinc-600 leading-tight font-medium">
            {getFormZone(currentTsb).desc}
          </p>
        </div>
      </div>

      {/* What-If Future PMC Simulation Control Deck */}
      {isForecastOpen && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-violet-50 via-[#FAF9F5] to-amber-50/50 border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-zinc-200">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-violet-600 border-2 border-zinc-950 flex items-center justify-center text-white shadow-[1.5px_1.5px_0px_0px_#09090b]">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-zinc-950">
                    What-If Forward PMC Simulator
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-200 text-violet-900 border border-violet-950">
                    Bannister Impulse-Response
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Simulate future Fitness (CTL), Fatigue (ATL), and Race-Day Form (TSB) by projecting upcoming training load.
                </p>
              </div>
            </div>

            {/* Target Outcome Preview Badge */}
            {targetForecastPoint && (
              <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <div className="text-right">
                  <div className="text-[9px] font-black uppercase text-zinc-500">
                    {targetForecastPoint.isRaceDay ? "Race Day Outcome" : `Projected at +${forecastDays}d`}
                  </div>
                  <div className="text-xs font-black text-zinc-950">
                    {formatChartDate(targetForecastPoint.date)}
                  </div>
                </div>
                <div className="h-7 w-px bg-zinc-200" />
                <div className="flex items-center gap-2">
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-sky-700 block">CTL</span>
                    <span className="font-mono font-black text-xs text-sky-700">
                      {targetForecastPoint.ctl}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-purple-700 block">ATL</span>
                    <span className="font-mono font-black text-xs text-purple-700">
                      {targetForecastPoint.atl}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-emerald-700 block">TSB</span>
                    <span
                      className={`font-mono font-black text-xs ${
                        targetForecastPoint.tsb >= 0 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {targetForecastPoint.tsb > 0 ? `+${targetForecastPoint.tsb}` : targetForecastPoint.tsb}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded shadow-[1px_1px_0px_0px_#09090b] ${
                    getFormZone(targetForecastPoint.tsb).badgeClass
                  }`}
                >
                  {getFormZone(targetForecastPoint.tsb).label}
                </span>
              </div>
            )}
          </div>

          {/* Interactive Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
            {/* 1. Target Strategy Preset */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[11px] font-black uppercase text-zinc-700 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span>Training Load Strategy</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  {
                    id: "taper_light",
                    label: "Standard Taper",
                    desc: "-15% load/wk (Ideal fresh form)",
                  },
                  {
                    id: "taper_aggressive",
                    label: "Deep Taper",
                    desc: "-25% load/wk (Fast recovery)",
                  },
                  {
                    id: "maintain",
                    label: "Maintain",
                    desc: `~${baselineWeeklyLoad} TL/wk (Holds fitness)`,
                  },
                  {
                    id: "build_conservative",
                    label: "Build Phase",
                    desc: "+8% load/wk (Progressive overload)",
                  },
                ].map((strat) => (
                  <button
                    key={strat.id}
                    type="button"
                    onClick={() => setForecastStrategy(strat.id as any)}
                    className={`p-2 rounded-xl text-left border-2 transition-all text-xs flex flex-col justify-between ${
                      forecastStrategy === strat.id
                        ? "bg-violet-600 text-white border-zinc-950 font-black shadow-[2px_2px_0px_0px_#09090b]"
                        : "bg-white text-zinc-800 border-zinc-950 hover:bg-zinc-100 font-bold shadow-[1px_1px_0px_0px_#09090b]"
                    }`}
                  >
                    <span>{strat.label}</span>
                    <span
                      className={`text-[9px] mt-1 line-clamp-1 ${
                        forecastStrategy === strat.id ? "text-violet-100 font-normal" : "text-zinc-500 font-medium"
                      }`}
                    >
                      {strat.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Forecast Horizon / Days */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase text-zinc-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-violet-600" />
                  <span>Horizon ({forecastDays} Days)</span>
                </label>
                <span className="text-xs font-mono font-black text-zinc-900">
                  {Math.round(forecastDays / 7)} wks
                </span>
              </div>
              <input
                type="range"
                min={7}
                max={56}
                step={7}
                value={forecastDays}
                onChange={(e) => setForecastDays(parseInt(e.target.value, 10))}
                className="w-full accent-violet-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono font-bold">
                <span>1 wk</span>
                <span>2 wks</span>
                <span>3 wks</span>
                <span>4 wks</span>
                <span>8 wks</span>
              </div>
            </div>

            {/* 3. Target Race Day Marker (Optional) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-zinc-700 flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-amber-500" />
                <span>Target Race Date</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={targetRaceDate}
                  onChange={(e) => setTargetRaceDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border-2 border-zinc-950 text-xs font-mono font-bold shadow-[2px_2px_0px_0px_#09090b] focus:outline-none"
                />
                {targetRaceDate && (
                  <button
                    type="button"
                    onClick={() => setTargetRaceDate("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-zinc-950 font-black"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">
                Puts a 🏁 marker on the chart to read exact race day form.
              </p>
            </div>
          </div>

          {/* Quick Explanation Banner */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/80 border border-zinc-950 text-xs font-medium text-zinc-700">
            <Info className="h-4 w-4 text-violet-600 shrink-0" />
            <span>
              The chart now projects forward from today. Notice how tapering brings Form (TSB) into the green/cyan sweet spot (+5 to +25) without crashing your Fitness (CTL).
            </span>
          </div>
        </div>
      )}


      {/* Main Single Unified Chart Container (Matching Intervals.icu Single Canvas) */}
      {filteredData.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-zinc-500 text-sm font-medium">
          No PMC data points available yet. Sync with COROS to populate curves.
        </div>
      ) : (
        <div
          className="rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] overflow-hidden flex flex-col lg:flex-row"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Left / Main: Single Unified ComposedChart with All Curves */}
          <div className="flex-1 min-w-0 p-4 sm:p-5">
            {/* Quick Chart Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs font-bold">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-sky-600 border border-zinc-950" />
                  <span className="text-zinc-900 font-black">Fitness (CTL)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-purple-600 border border-zinc-950" />
                  <span className="text-zinc-900 font-black">Fatigue (ATL)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500 border border-zinc-950" />
                  <span className="text-zinc-900 font-black">Form (TSB: Zones)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-2 rounded-sm bg-zinc-400" />
                  <span className="text-zinc-600 font-medium">Daily Load</span>
                </div>
              </div>
              <div className="text-[11px] text-zinc-500 font-medium hidden sm:block">
                Sweet spot: -30 to -10 TSB
              </div>
            </div>

            {/* Single ComposedChart Container */}
            <div className="h-[360px] sm:h-[400px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={360}>
                <ComposedChart
                  data={filteredData}
                  onMouseMove={handleChartMouseMove}
                  margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="ctlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                    </linearGradient>

                    {/* Intervals.icu Dynamic Form Zone Multi-Color Gradient */}
                    {formGradientStops && (
                      <linearGradient id="formZoneGradient" x1="0" y1="0" x2="0" y2="1">
                        {/* > 25: Amber (Transition / Detraining) */}
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset={formGradientStops.transition} stopColor="#d97706" />
                        {/* 5 to 25: Cyan / Sky Blue (Fresh / Race Ready) */}
                        <stop offset={formGradientStops.transition} stopColor="#0284c7" />
                        <stop offset={formGradientStops.fresh} stopColor="#0284c7" />
                        {/* -10 to 5: Neutral Grey (Maintenance) */}
                        <stop offset={formGradientStops.fresh} stopColor="#71717a" />
                        <stop offset={formGradientStops.grey} stopColor="#71717a" />
                        {/* -30 to -10: Green (Optimal Training) */}
                        <stop offset={formGradientStops.grey} stopColor="#10b981" />
                        <stop offset={formGradientStops.optimal} stopColor="#10b981" />
                        {/* < -30: Red (High Injury Risk) */}
                        <stop offset={formGradientStops.optimal} stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    )}
                  </defs>

                  {/* Primary Y-Axis: Dynamic scale so fitness & fatigue curves have full vertical wave amplitude */}
                  <YAxis
                    yAxisId="primary"
                    domain={[minTsb, maxFitness]}
                    width={38}
                    tick={{ fill: isDark ? "#a1a1aa" : "#71717a", fontSize: 11, fontWeight: 700 }}
                    stroke={isDark ? "#3f3f46" : "#e4e4e7"}
                    tickLine={false}
                  />

                  {/* Secondary Y-Axis for Daily Load: High ceiling so bars stay unobtrusive at bottom ~18% */}
                  <YAxis
                    yAxisId="load"
                    orientation="right"
                    domain={[0, maxLoad * 4]}
                    hide
                  />

                  {/* Formatted Date X-Axis */}
                  <XAxis
                    dataKey="date"
                    stroke={isDark ? "#52525b" : "#a1a1aa"}
                    tick={{ fill: isDark ? "#e4e4e7" : "#18181b", fontSize: 11, fontWeight: 700 }}
                    tickFormatter={formatChartDate}
                    tickLine={false}
                  />

                  {/* Exactly ONE Unified Tooltip on the chart */}
                  <Tooltip
                    cursor={sharedCursor}
                    content={<PmcTooltip />}
                    wrapperStyle={{ zIndex: 9999 }}
                  />

                  {/* Form Zones Colored Horizontal Reference Bands (Matching Intervals.icu) */}
                  {/* Transition (> +25) */}
                  <ReferenceArea
                    yAxisId="primary"
                    y1={25}
                    y2={60}
                    fill="#fef9c3"
                    fillOpacity={isDark ? 0.12 : 0.35}
                  />
                  {/* Fresh / Race Ready (+5 to +25) */}
                  <ReferenceArea
                    yAxisId="primary"
                    y1={5}
                    y2={25}
                    fill="#e0f2fe"
                    fillOpacity={isDark ? 0.15 : 0.45}
                  />
                  {/* Grey / Maintenance (-10 to +5) */}
                  <ReferenceArea
                    yAxisId="primary"
                    y1={-10}
                    y2={5}
                    fill={isDark ? "#27272a" : "#f4f4f5"}
                    fillOpacity={isDark ? 0.3 : 0.5}
                  />
                  {/* Optimal Training (-30 to -10) */}
                  <ReferenceArea
                    yAxisId="primary"
                    y1={-30}
                    y2={-10}
                    fill="#dcfce7"
                    fillOpacity={isDark ? 0.15 : 0.5}
                  />
                  {/* High Risk (< -30) */}
                  <ReferenceArea
                    yAxisId="primary"
                    y1={-80}
                    y2={-30}
                    fill="#fee2e2"
                    fillOpacity={isDark ? 0.15 : 0.5}
                  />

                  {/* Form Zero Reference Line */}
                  <ReferenceLine
                    yAxisId="primary"
                    y={0}
                    stroke={isDark ? "#71717a" : "#09090b"}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                  <ReferenceLine
                    yAxisId="primary"
                    y={-10}
                    stroke="#16a34a"
                    strokeDasharray="2 2"
                    strokeOpacity={0.7}
                  />
                  <ReferenceLine
                    yAxisId="primary"
                    y={-30}
                    stroke="#dc2626"
                    strokeDasharray="2 2"
                    strokeOpacity={0.7}
                  />

                  {/* Forecast Horizon Shading & Reference Lines */}
                  {isForecastOpen && historicalFiltered.length > 0 && (
                    <>
                      {/* Vertical line separating history from forecast */}
                      <ReferenceLine
                        x={historicalFiltered[historicalFiltered.length - 1].date}
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        label={{
                          value: "Today / Now",
                          position: "insideTopRight",
                          fill: "#8b5cf6",
                          fontSize: 10,
                          fontWeight: 800,
                        }}
                      />

                      {/* Race Day Reference Line if specified */}
                      {targetRaceDate && (
                        <ReferenceLine
                          x={targetRaceDate}
                          stroke="#eab308"
                          strokeWidth={2}
                          label={{
                            value: "🏁 Race Day",
                            position: "insideTopLeft",
                            fill: "#ca8a04",
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        />
                      )}
                    </>
                  )}

                  {/* Daily Load Bars (Sitting quietly along the bottom) */}
                  <Bar
                    yAxisId="load"
                    dataKey="load"
                    name="Daily Load"
                    fill="#71717a"
                    opacity={0.22}
                    radius={[2, 2, 0, 0]}
                  />

                  {/* Fitness (CTL) - Sky Blue Line with Soft Area Fill */}
                  <Area
                    yAxisId="primary"
                    type="monotone"
                    dataKey="ctl"
                    name="Fitness (CTL)"
                    stroke="#0284c7"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#ctlGradient)"
                  />

                  {/* Fatigue (ATL) - Purple Line (Intervals.icu color) */}
                  <Line
                    yAxisId="primary"
                    type="monotone"
                    dataKey="atl"
                    name="Fatigue (ATL)"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={false}
                  />

                  {/* Form (TSB) - Dynamic Zone-Colored Line (Intervals.icu Multi-Color) */}
                  <Line
                    yAxisId="primary"
                    type="monotone"
                    dataKey="tsb"
                    name="Form (TSB)"
                    stroke={formGradientStops ? "url(#formZoneGradient)" : "#059669"}
                    strokeWidth={3}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Telemetry Column: Live values for hovered/latest date */}
          <div className="w-full lg:w-48 shrink-0 bg-[#FAF9F5] p-4 sm:p-5 border-t-2 lg:border-t-0 lg:border-l-2 border-zinc-950 flex flex-col justify-between space-y-4">
            {/* Header: Date */}
            <div className="space-y-1 pb-3 border-b-2 border-zinc-200">
              <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center justify-between">
                <span>Telemetry</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    activePoint?.isRaceDay
                      ? "bg-amber-400 text-black border border-zinc-950 font-black"
                      : activePoint?.isForecast
                      ? "bg-violet-200 text-violet-950 font-black"
                      : "bg-zinc-200 text-zinc-800"
                  }`}
                >
                  {activePoint?.isRaceDay
                    ? "🏁 Race Day"
                    : activePoint?.isForecast
                    ? "Projected"
                    : hoveredPoint
                    ? "Hover"
                    : "Latest"}
                </span>
              </div>
              <div className="text-xs font-black text-zinc-950">
                {activePoint?.date ? formatFullDate(activePoint.date) : "N/A"}
              </div>
            </div>

            {/* Metrics Telemetry List */}
            <div className="space-y-3">
              <div>
                <div className="text-[10px] font-black uppercase text-sky-700 tracking-wider">
                  Fitness (CTL)
                </div>
                <div className="text-2xl font-black font-mono text-sky-600">
                  {activePoint?.ctl ?? "-"}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase text-purple-700 tracking-wider">
                  Fatigue (ATL)
                </div>
                <div className="text-2xl font-black font-mono text-purple-600">
                  {activePoint?.atl ?? "-"}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
                  Form (TSB)
                </div>
                <div
                  className={`text-2xl font-black font-mono ${
                    (activePoint?.tsb ?? 0) >= 0 ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {(activePoint?.tsb ?? 0) > 0 ? `+${activePoint?.tsb}` : activePoint?.tsb ?? "-"}
                </div>
                <div
                  className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded w-fit mt-0.5 shadow-[1px_1px_0px_0px_#09090b] ${activeZone.badgeClass}`}
                >
                  {activeZone.label}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase text-orange-700 tracking-wider">
                  Ramp Rate
                </div>
                <div
                  className={`text-lg font-black font-mono ${
                    isRampDanger
                      ? "text-rose-600"
                      : isRampOptimal
                      ? "text-emerald-600"
                      : "text-zinc-900"
                  }`}
                >
                  {(activePoint?.rampRate ?? 0) > 0
                    ? `+${activePoint?.rampRate}`
                    : activePoint?.rampRate ?? 0}
                  /wk
                </div>
              </div>

              {activePoint?.load ? (
                <div>
                  <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Day Load
                  </div>
                  <div className="text-base font-black font-mono text-zinc-950">
                    {activePoint.load} {mode === "coros" ? "TRIMP" : "rTSS"}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Intervals.icu Form Zone Reference Legend */}
            <div className="pt-3 border-t-2 border-zinc-200 text-[10px] font-bold space-y-1">
              <div className="text-[10px] font-black uppercase text-zinc-900 mb-1">
                Form Zones:
              </div>
              <div className="flex items-center gap-1.5 text-rose-600">
                <span className="h-2 w-2 rounded-full bg-rose-500 border border-zinc-950 shrink-0" />
                <span>High Risk (&lt; -30)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 border border-zinc-950 shrink-0" />
                <span>Optimal (-30 to -10)</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-500">
                <span className="h-2 w-2 rounded-full bg-zinc-400 border border-zinc-950 shrink-0" />
                <span>Grey (-10 to +5)</span>
              </div>
              <div className="flex items-center gap-1.5 text-sky-600">
                <span className="h-2 w-2 rounded-full bg-sky-500 border border-zinc-950 shrink-0" />
                <span>Fresh (+5 to +25)</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-500 border border-zinc-950 shrink-0" />
                <span>Transition (&gt; +25)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



