"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  ArrowRight,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Heart,
  Mountain,
  Flame,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { ActivityItem } from "./ActivityFeed";
import {
  formatPace,
  generateActivityComparison,
  ActivityComparisonAnalysis,
} from "@/lib/analytics";

interface ActivityCompareModalProps {
  activityA: ActivityItem;
  activityB: ActivityItem;
  allActivities?: ActivityItem[];
  onSelectActivityB?: (act: ActivityItem) => void;
  onClose: () => void;
}

export const ActivityCompareModal: React.FC<ActivityCompareModalProps> = ({
  activityA,
  activityB,
  allActivities = [],
  onSelectActivityB,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"pace" | "hr" | "elevation">("pace");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Analysis result
  const analysis: ActivityComparisonAnalysis = useMemo(() => {
    return generateActivityComparison(activityA, activityB);
  }, [activityA, activityB]);

  // Candidates to swap Activity B with
  const candidateActivities = useMemo(() => {
    return allActivities
      .filter((a) => a.id !== activityA.id)
      .slice(0, 15);
  }, [allActivities, activityA.id]);

  const dateA = new Date(activityA.startTime).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dateB = new Date(activityB.startTime).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border-2 border-zinc-950 rounded-2xl shadow-[6px_6px_0px_0px_#09090b] max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-2 border-zinc-950 flex items-center justify-between bg-[#FAF9F5] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-orange-400 border-2 border-zinc-950 flex items-center justify-center text-black shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-zinc-950">
                  Activity Head-to-Head Comparison
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-950 border border-zinc-950">
                  Overlaid Analysis
                </span>
              </div>
              <p className="text-xs text-zinc-600 mt-0.5">
                Compare physiological adaptations, pacing splits, and cardiovascular economy between sessions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] transition-all"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Head-to-Head Card Header / Swap Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
            {/* Activity A (Reference / Primary) */}
            <div className="p-3.5 rounded-xl border-2 border-sky-600 bg-sky-50/50 shadow-[2px_2px_0px_0px_#0284c7] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-600 text-white">
                  Current Session (A)
                </span>
                <span className="text-zinc-500">{dateA}</span>
              </div>
              <h3 className="text-sm font-black text-zinc-950 truncate" title={activityA.name}>
                {activityA.name}
              </h3>
              <div className="flex items-center gap-3 text-xs font-mono font-bold text-zinc-700">
                <span>{activityA.distanceKm} km</span>
                <span>•</span>
                <span>{activityA.durationMin}m</span>
                <span>•</span>
                <span className="text-sky-700 font-black">{formatPace(activityA.avgPaceSec)}/km</span>
                <span>•</span>
                <span className="text-rose-600 font-black">{activityA.avgHr} bpm</span>
              </div>
            </div>

            {/* Activity B (Benchmark / Comparison target) */}
            <div className="p-3.5 rounded-xl border-2 border-amber-500 bg-amber-50/40 shadow-[2px_2px_0px_0px_#f59e0b] space-y-1.5 relative">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500 text-black">
                  Benchmark Session (B)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">{dateB}</span>
                  {allActivities.length > 2 && onSelectActivityB && (
                    <button
                      type="button"
                      onClick={() => setIsPickerOpen(!isPickerOpen)}
                      className="text-[10px] uppercase px-1.5 py-0.5 rounded border border-zinc-950 bg-white hover:bg-zinc-100 text-zinc-900 font-black flex items-center gap-1 shadow-[1px_1px_0px_0px_#09090b]"
                    >
                      <span>Swap</span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <h3 className="text-sm font-black text-zinc-950 truncate" title={activityB.name}>
                {activityB.name}
              </h3>
              <div className="flex items-center gap-3 text-xs font-mono font-bold text-zinc-700">
                <span>{activityB.distanceKm} km</span>
                <span>•</span>
                <span>{activityB.durationMin}m</span>
                <span>•</span>
                <span className="text-amber-700 font-black">{formatPace(activityB.avgPaceSec)}/km</span>
                <span>•</span>
                <span className="text-rose-600 font-black">{activityB.avgHr} bpm</span>
              </div>

              {/* Swap Activity B Dropdown */}
              {isPickerOpen && onSelectActivityB && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border-2 border-zinc-950 rounded-xl shadow-[4px_4px_0px_0px_#09090b] max-h-48 overflow-y-auto p-1.5 space-y-1">
                  <div className="text-[10px] font-black uppercase text-zinc-500 px-2 py-1">
                    Select benchmark activity:
                  </div>
                  {candidateActivities.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectActivityB(c);
                        setIsPickerOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${
                        c.id === activityB.id ? "bg-amber-100 text-zinc-950" : "hover:bg-zinc-100 text-zinc-800"
                      }`}
                    >
                      <span className="truncate max-w-[200px]">{c.name}</span>
                      <span className="font-mono text-[11px] text-zinc-500 shrink-0">
                        {c.distanceKm}km ({formatPace(c.avgPaceSec)})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Verdict Banner */}
          <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center text-white shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-black text-zinc-950">
                {analysis.summaryVerdict.headline}
              </div>
              <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                {analysis.summaryVerdict.description}
              </p>
            </div>
          </div>

          {/* Delta Scorecard 4-column Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1. Pace Delta */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-500">Pace Delta</span>
              <div
                className={`text-xl font-mono font-black ${
                  analysis.paceDiffSec < 0 ? "text-emerald-600" : analysis.paceDiffSec > 0 ? "text-rose-600" : "text-zinc-950"
                }`}
              >
                {analysis.paceDiffSec < 0
                  ? `-${Math.abs(analysis.paceDiffSec)}s /km`
                  : analysis.paceDiffSec > 0
                  ? `+${analysis.paceDiffSec}s /km`
                  : "Identical"}
              </div>
              <span className="text-[10px] text-zinc-600 font-bold block">
                {analysis.paceDiffSec < 0 ? "Faster in Session A ⚡" : analysis.paceDiffSec > 0 ? "Slower in Session A" : "Same pace"}
              </span>
            </div>

            {/* 2. Heart Rate Delta */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-500">Avg Heart Rate</span>
              <div
                className={`text-xl font-mono font-black ${
                  analysis.hrDiff < 0 ? "text-emerald-600" : analysis.hrDiff > 0 ? "text-rose-600" : "text-zinc-950"
                }`}
              >
                {analysis.hrDiff < 0
                  ? `${analysis.hrDiff} bpm`
                  : analysis.hrDiff > 0
                  ? `+${analysis.hrDiff} bpm`
                  : "Identical"}
              </div>
              <span className="text-[10px] text-zinc-600 font-bold block">
                {analysis.hrDiff < 0 ? "Lower Cardiac Cost 💚" : analysis.hrDiff > 0 ? "Higher Cardiac Stress" : "Equivalent HR"}
              </span>
            </div>

            {/* 3. Aerobic Efficiency Gain */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-500">Efficiency Index</span>
              <div
                className={`text-xl font-mono font-black ${
                  analysis.efficiencyGainPct > 0
                    ? "text-emerald-600"
                    : analysis.efficiencyGainPct < 0
                    ? "text-rose-600"
                    : "text-zinc-950"
                }`}
              >
                {analysis.efficiencyGainPct > 0
                  ? `+${analysis.efficiencyGainPct}%`
                  : `${analysis.efficiencyGainPct}%`}
              </div>
              <span className="text-[10px] text-zinc-600 font-bold block">
                Speed / HR Ratio ({analysis.efficiencyFactorA} vs {analysis.efficiencyFactorB})
              </span>
            </div>

            {/* 4. Cardiac Decoupling (Pa:HR) */}
            <div className="p-3 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-500">Cardiac Drift</span>
              <div className="text-xl font-mono font-black text-zinc-950">
                {activityA.decouplingPct || 0}%{" "}
                <span className="text-xs text-zinc-500 font-normal">vs {activityB.decouplingPct || 0}%</span>
              </div>
              <span className="text-[10px] text-zinc-600 font-bold block">
                {analysis.decouplingDiff <= 0 ? "Stable fatigue curve 👍" : "Mild late-session drift"}
              </span>
            </div>
          </div>

          {/* Synchronized Overlaid Chart Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-4">
            {/* Chart Control Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-zinc-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-zinc-900">Overlaid Metric:</span>
                <div className="flex items-center gap-1 bg-[#F0EDE4] p-1 rounded-xl border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                  <button
                    type="button"
                    onClick={() => setActiveTab("pace")}
                    className={`px-3 py-1 text-xs rounded-lg transition-all font-black ${
                      activeTab === "pace"
                        ? "bg-white text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                        : "text-zinc-600 hover:text-zinc-950 border-2 border-transparent"
                    }`}
                  >
                    Pace Progression
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("hr")}
                    className={`px-3 py-1 text-xs rounded-lg transition-all font-black ${
                      activeTab === "hr"
                        ? "bg-white text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                        : "text-zinc-600 hover:text-zinc-950 border-2 border-transparent"
                    }`}
                  >
                    Heart Rate Drift
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("elevation")}
                    className={`px-3 py-1 text-xs rounded-lg transition-all font-black ${
                      activeTab === "elevation"
                        ? "bg-white text-zinc-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                        : "text-zinc-600 hover:text-zinc-950 border-2 border-transparent"
                    }`}
                  >
                    Elevation Profile
                  </button>
                </div>
              </div>

              {/* Curve Color Legend */}
              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-sky-600 border border-zinc-950" />
                  <span className="text-zinc-900">Session A ({dateA})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-amber-500 border border-zinc-950" />
                  <span className="text-zinc-900">Session B ({dateB})</span>
                </div>
              </div>
            </div>

            {/* Recharts Canvas */}
            <div className="h-[280px] sm:h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={analysis.splits}
                  margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                >
                  <XAxis
                    dataKey="km"
                    tickFormatter={(km) => `KM ${km}`}
                    tick={{ fill: "#09090b", fontSize: 11, fontWeight: 700 }}
                    stroke="#a1a1aa"
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 11, fontWeight: 700 }}
                    stroke="#e4e4e7"
                    domain={
                      activeTab === "pace"
                        ? ["auto", "auto"]
                        : activeTab === "hr"
                        ? [110, 195]
                        : [0, "auto"]
                    }
                    tickFormatter={(val) => {
                      if (activeTab === "pace") return formatPace(val);
                      if (activeTab === "hr") return `${val}`;
                      return `${val}m`;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const pt = payload[0]?.payload;
                      if (!pt) return null;

                      return (
                        <div className="bg-white border-2 border-zinc-950 p-3 rounded-xl shadow-[3px_3px_0px_0px_#09090b] text-xs font-bold space-y-1.5 min-w-[200px]">
                          <div className="font-black text-zinc-950 pb-1 border-b border-zinc-100 flex items-center justify-between">
                            <span>Kilometer {pt.km}</span>
                            {pt.paceDiffSec !== undefined && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                  pt.paceDiffSec < 0
                                    ? "bg-emerald-100 text-emerald-950"
                                    : "bg-rose-100 text-rose-950"
                                }`}
                              >
                                {pt.paceDiffSec < 0
                                  ? `${Math.abs(pt.paceDiffSec)}s faster`
                                  : `${pt.paceDiffSec}s slower`}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 pt-0.5">
                            <div className="flex items-center justify-between text-sky-700">
                              <span>Session A:</span>
                              <span className="font-mono font-black">
                                {activeTab === "pace"
                                  ? `${pt.formattedPaceA} /km`
                                  : activeTab === "hr"
                                  ? `${pt.hrA} bpm`
                                  : `${pt.elevA}m D+`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-amber-700">
                              <span>Session B:</span>
                              <span className="font-mono font-black">
                                {activeTab === "pace"
                                  ? `${pt.formattedPaceB} /km`
                                  : activeTab === "hr"
                                  ? `${pt.hrB} bpm`
                                  : `${pt.elevB}m D+`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* Overlaid Curves by Tab */}
                  {activeTab === "pace" && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="paceSecA"
                        name="Session A Pace"
                        stroke="#0284c7"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#0284c7" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="paceSecB"
                        name="Session B Pace"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={{ r: 3, fill: "#f59e0b" }}
                      />
                    </>
                  )}

                  {activeTab === "hr" && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="hrA"
                        name="Session A HR"
                        stroke="#0284c7"
                        strokeWidth={3}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="hrB"
                        name="Session B HR"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </>
                  )}

                  {activeTab === "elevation" && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="elevA"
                        name="Session A Elevation"
                        stroke="#0284c7"
                        fill="#0284c7"
                        fillOpacity={0.2}
                        strokeWidth={2.5}
                      />
                      <Line
                        type="monotone"
                        dataKey="elevB"
                        name="Session B Elevation"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Split-by-Split Comparison Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-zinc-700 tracking-wider">
                KM-by-KM Split Matrix
              </h4>
              <span className="text-[11px] text-zinc-500 font-medium">
                Negative delta (green) indicates faster / lower HR in Session A
              </span>
            </div>
            <div className="border-2 border-zinc-950 rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_#09090b]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F5] border-b-2 border-zinc-950 font-black text-zinc-800">
                  <tr>
                    <th className="p-2.5">Split</th>
                    <th className="p-2.5 text-sky-800">Pace (A)</th>
                    <th className="p-2.5 text-amber-800">Pace (B)</th>
                    <th className="p-2.5">Pace Diff</th>
                    <th className="p-2.5 text-sky-800">HR (A)</th>
                    <th className="p-2.5 text-amber-800">HR (B)</th>
                    <th className="p-2.5">HR Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-mono font-bold">
                  {analysis.splits.slice(0, 12).map((s) => (
                    <tr key={s.km} className="hover:bg-zinc-50/80">
                      <td className="p-2.5 font-black text-zinc-950">KM {s.km}</td>
                      <td className="p-2.5 text-sky-700">{s.formattedPaceA || "-"}</td>
                      <td className="p-2.5 text-amber-700">{s.formattedPaceB || "-"}</td>
                      <td className="p-2.5">
                        {s.paceDiffSec !== undefined ? (
                          <span
                            className={
                              s.paceDiffSec < 0
                                ? "text-emerald-600 font-black"
                                : s.paceDiffSec > 0
                                ? "text-rose-600"
                                : "text-zinc-600"
                            }
                          >
                            {s.paceDiffSec < 0
                              ? `-${Math.abs(s.paceDiffSec)}s`
                              : s.paceDiffSec > 0
                              ? `+${s.paceDiffSec}s`
                              : "0s"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-2.5 text-sky-700">{s.hrA ? `${s.hrA} bpm` : "-"}</td>
                      <td className="p-2.5 text-amber-700">{s.hrB ? `${s.hrB} bpm` : "-"}</td>
                      <td className="p-2.5">
                        {s.hrDiff !== undefined ? (
                          <span
                            className={
                              s.hrDiff < 0
                                ? "text-emerald-600 font-black"
                                : s.hrDiff > 0
                                ? "text-rose-600"
                                : "text-zinc-600"
                            }
                          >
                            {s.hrDiff < 0 ? `${s.hrDiff} bpm` : s.hrDiff > 0 ? `+${s.hrDiff} bpm` : "0"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-zinc-950 bg-[#FAF9F5] flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500 font-medium">
            Pro Tip: Compare your long runs or tempo intervals over a 4–8 week cycle to monitor stroke volume adaptations.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border-2 border-zinc-950 bg-white hover:bg-zinc-100 text-zinc-950 font-black text-xs shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
