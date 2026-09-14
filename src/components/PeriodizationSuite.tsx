"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Calendar,
  Trophy,
  RefreshCw,
  Layers,
  Flame,
  Mountain,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  ChevronRight,
  Clock,
  Compass,
  BarChart2,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { useTranslation } from "@/lib/i18n/context";
import { useUpdateSettingsMutation } from "@/lib/queries";
import {
  PeriodizationMode,
  DisciplineFocus,
  generatePeriodizationPlan,
  WeeklyPlan,
} from "@/lib/periodization";

interface PeriodizationSuiteProps {
  currentCtl?: number;
  currentAtl?: number;
  currentTsb?: number;
  thisWeekDistanceKm?: number;
  thisWeekGain?: number;
  thisWeekLoad?: number;
  scaleMode?: "coros" | "intervals";
  onToggleScaleMode?: (mode: "coros" | "intervals") => void;
  savedMode?: PeriodizationMode;
  savedFocus?: DisciplineFocus;
  savedRaceDate?: string;
  savedRaceDist?: number;
  savedRaceElev?: number;
}

export const PeriodizationSuite: React.FC<PeriodizationSuiteProps> = ({
  currentCtl = 42,
  currentAtl = 42,
  currentTsb = 0,
  thisWeekDistanceKm = 0,
  thisWeekGain = 0,
  thisWeekLoad = 0,
  scaleMode = "coros",
  onToggleScaleMode,
  savedMode = "continuous",
  savedFocus = "hybrid",
  savedRaceDate = "",
  savedRaceDist = 60,
  savedRaceElev = 5400,
}) => {
  const { language } = useTranslation();
  const updateSettings = useUpdateSettingsMutation();

  const loadUnit = scaleMode === "intervals" ? "rTSS" : "TL";
  const loadScaleTitle = scaleMode === "intervals" ? "Standard rTSS" : "COROS TRIMP";

  const [mode, setMode] = useState<PeriodizationMode>(savedMode);
  const [focus, setFocus] = useState<DisciplineFocus>(savedFocus);
  const [raceDate, setRaceDate] = useState<string>(savedRaceDate);
  const [raceDistInput, setRaceDistInput] = useState<string>(String(savedRaceDist ?? 60));
  const [raceElevInput, setRaceElevInput] = useState<string>(String(savedRaceElev ?? 5400));
  const isDistFocused = useRef<boolean>(false);
  const isElevFocused = useRef<boolean>(false);

  const raceDist = Math.max(0, parseFloat(raceDistInput) || 0);
  const raceElev = Math.max(0, parseFloat(raceElevInput) || 0);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [showWaveChart, setShowWaveChart] = useState<boolean>(true);

  const climbDensity = raceDist > 0 ? raceElev / raceDist : 0;
  const detectedProfile: DisciplineFocus =
    climbDensity < 15 ? "road" : climbDensity > 35 ? "trail" : "hybrid";

  // Sync from props on mount if prop arrives late
  useEffect(() => {
    if (savedMode) setMode(savedMode);
    if (savedFocus) setFocus(savedFocus);
    if (savedRaceDate) setRaceDate(savedRaceDate);
    if (savedRaceDist !== undefined && !isDistFocused.current) {
      setRaceDistInput(String(savedRaceDist));
    }
    if (savedRaceElev !== undefined && !isElevFocused.current) {
      setRaceElevInput(String(savedRaceElev));
    }
  }, [savedMode, savedFocus, savedRaceDate, savedRaceDist, savedRaceElev]);

  // Debounced save to database
  useEffect(() => {
    const timer = setTimeout(() => {
      updateSettings.mutate({
        periodizationMode: mode,
        periodizationFocus: focus,
        periodizationRaceDate: raceDate,
        periodizationRaceDist: raceDist,
        periodizationRaceElev: raceElev,
      } as any);
    }, 600);
    return () => clearTimeout(timer);
  }, [mode, focus, raceDate, raceDist, raceElev]);

  // Generate scientific periodization plan
  const plan = useMemo(() => {
    return generatePeriodizationPlan({
      mode,
      focus,
      targetRaceDate: mode === "target_race" ? raceDate : undefined,
      targetRaceDist: raceDist,
      targetRaceElev: raceElev,
      currentCtl,
      avgWeeklyKm: thisWeekDistanceKm > 10 ? thisWeekDistanceKm : 48,
      avgWeeklyGain: thisWeekGain > 200 ? thisWeekGain : 1600,
    });
  }, [mode, focus, raceDate, raceDist, raceElev, currentCtl, thisWeekDistanceKm, thisWeekGain]);

  const chartData = useMemo(() => {
    return plan.weeksInCycle.slice(0, 12).map((w, idx) => ({
      weekNum: w.weekNumber,
      weekLabel: `W${w.weekNumber}`,
      dateRange: w.weekDateStr,
      distanceKm: w.targetDistanceKm,
      elevationGain: w.targetElevationGain,
      trainingLoad: w.targetTrainingLoad,
      isDeload: w.isDeload,
      isCurrentWeek: w.isCurrentWeek,
      isRaceWeek: w.isRaceWeek,
      mesoType: w.mesoType,
      phaseName: language === "en" ? w.phaseLabel.en : w.phaseLabel.id,
      mesoName: language === "en" ? w.mesoLabel.en : w.mesoLabel.id,
      idx,
    }));
  }, [plan.weeksInCycle, language]);

  const currentPlanWeek = plan.currentWeek;
  const inspectedWeek: WeeklyPlan = plan.weeksInCycle[selectedWeekIndex] || currentPlanWeek;

  // Percentage progress against current targets
  const distPct = Math.min(150, Math.round((thisWeekDistanceKm / Math.max(1, currentPlanWeek.targetDistanceKm)) * 100));
  const gainPct = Math.min(150, Math.round((thisWeekGain / Math.max(1, currentPlanWeek.targetElevationGain)) * 100));
  const loadPct = Math.min(150, Math.round((thisWeekLoad / Math.max(1, currentPlanWeek.targetTrainingLoad)) * 100));

  return (
    <div className="p-5 sm:p-7 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-7 text-zinc-950">
      {/* Top Header & Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-zinc-950 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border border-zinc-950 bg-amber-300 text-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
              PERIODIZATION & MESOCYCLE 3:1
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase font-mono border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] ${
              scaleMode === "intervals" ? "bg-purple-300 text-purple-950" : "bg-cyan-300 text-cyan-950"
            }`}>
              {loadScaleTitle} ({loadUnit})
            </span>
            <span className="text-[10px] font-bold font-mono text-zinc-500">
              Bompa, Koop & Friel Methodology
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950">
            {language === "en"
              ? "Training Periodization & Mesocycle Engine"
              : "Periodisasi Latihan & Arsitektur Siklus 3:1"}
          </h2>
          <p className="text-xs text-zinc-600 font-medium mt-0.5">
            {language === "en"
              ? "Scientific 3-weeks progressive loading followed by 1-week structured supercompensation deload."
              : "Model gelombang progresif 3 minggu beban latihan diikuti 1 pekan deload superkompensasi terstruktur."}
          </p>
        </div>

        {/* Mode Selector & Scale Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {onToggleScaleMode && (
            <div className="inline-flex rounded-xl border-2 border-zinc-950 p-0.5 bg-zinc-100 text-xs font-mono font-bold shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <button
                type="button"
                onClick={() => onToggleScaleMode("coros")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  scaleMode === "coros"
                    ? "bg-amber-400 text-zinc-950 border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                    : "text-zinc-600 hover:text-zinc-950"
                }`}
                title={language === "en" ? "Scale: COROS TRIMP load" : "Skala: Beban TRIMP COROS"}
              >
                <span>COROS Load</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleScaleMode("intervals")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  scaleMode === "intervals"
                    ? "bg-purple-400 text-zinc-950 border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                    : "text-zinc-600 hover:text-zinc-950"
                }`}
                title={language === "en" ? "Scale: Standard rTSS (Coggan)" : "Skala: Standard rTSS (Coggan)"}
              >
                <span>rTSS</span>
              </button>
            </div>
          )}

          <div className="inline-flex rounded-xl border-2 border-zinc-950 p-0.5 bg-zinc-100 text-xs font-mono font-bold shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <button
              type="button"
              onClick={() => {
                setMode("continuous");
                setSelectedWeekIndex(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                mode === "continuous"
                  ? "bg-amber-400 text-zinc-950 border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{language === "en" ? "Continuous Base (No Race)" : "Pondasi Berkelanjutan (Tanpa Lomba)"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("target_race");
                if (!raceDate) {
                  // Default to 12 weeks from today if empty
                  const d = new Date();
                  d.setDate(d.getDate() + 84);
                  setRaceDate(d.toISOString().split("T")[0]);
                }
                setSelectedWeekIndex(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                mode === "target_race"
                  ? "bg-cyan-400 text-zinc-950 border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>{language === "en" ? "Target Race Countdown" : "Target Lomba (Countdown)"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Controls Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-xs font-mono shadow-[2px_2px_0px_0px_#09090b]">
        {/* Discipline Focus */}
        <div>
          <span className="text-[10px] text-zinc-500 font-sans font-bold uppercase block mb-1.5">
            {language === "en" ? "Discipline Focus:" : "Fokus Disiplin:"}
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setFocus("hybrid")}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-bold border transition-all ${
                focus === "hybrid"
                  ? "bg-white text-zinc-950 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                  : "border-zinc-300 text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <Layers className="h-3 w-3" />
              <span>Hybrid</span>
            </button>
            <button
              type="button"
              onClick={() => setFocus("road")}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-bold border transition-all ${
                focus === "road"
                  ? "bg-white text-zinc-950 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                  : "border-zinc-300 text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <Flame className="h-3 w-3" />
              <span>Road</span>
            </button>
            <button
              type="button"
              onClick={() => setFocus("trail")}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-bold border transition-all ${
                focus === "trail"
                  ? "bg-white text-zinc-950 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                  : "border-zinc-300 text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <Mountain className="h-3 w-3" />
              <span>Trail</span>
            </button>
          </div>
        </div>

        {/* Target Race Inputs (if mode === target_race) or Cycle Focus */}
        {mode === "target_race" ? (
          <>
            <div>
              <span className="text-[10px] text-zinc-500 font-sans font-bold uppercase block mb-1.5">
                {language === "en" ? "Target Race Date:" : "Tanggal Hari H Lomba:"}
              </span>
              <input
                type="date"
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
                className="w-full bg-white border border-zinc-400 focus:border-zinc-950 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-zinc-950 shadow-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-zinc-500 font-sans font-bold uppercase">
                  {language === "en" ? "Race Specifications:" : "Spesifikasi Lomba:"}
                </span>
                <span className="text-[9px] font-mono font-bold text-zinc-600 bg-zinc-200 px-1.5 py-0.2 rounded">
                  {climbDensity.toFixed(1)} m/km
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1 bg-white border border-zinc-400 focus-within:border-zinc-950 focus-within:ring-1 focus-within:ring-zinc-950 rounded-lg px-2.5 py-1.5 shadow-sm">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={raceDistInput}
                    onFocus={() => {
                      isDistFocused.current = true;
                    }}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      if (/^\d*\.?\d*$/.test(valStr)) {
                        setRaceDistInput(valStr);
                        const valNum = parseFloat(valStr) || 0;
                        const currentElev = parseFloat(raceElevInput) || 0;
                        if (valNum > 0 && currentElev >= 0) {
                          const d = currentElev / valNum;
                          if (d < 15 && focus !== "road") setFocus("road");
                          else if (d > 35 && focus !== "trail") setFocus("trail");
                          else if (d >= 15 && d <= 35 && focus !== "hybrid") setFocus("hybrid");
                        }
                      }
                    }}
                    onBlur={() => {
                      isDistFocused.current = false;
                      if (!raceDistInput.trim() || parseFloat(raceDistInput) <= 0) {
                        setRaceDistInput("42");
                      }
                    }}
                    placeholder="42"
                    className="w-full min-w-0 text-xs font-mono font-bold text-zinc-950 outline-none bg-transparent"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono font-semibold shrink-0">km</span>
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1 bg-white border border-zinc-400 focus-within:border-zinc-950 focus-within:ring-1 focus-within:ring-zinc-950 rounded-lg px-2.5 py-1.5 shadow-sm">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={raceElevInput}
                    onFocus={() => {
                      isElevFocused.current = true;
                    }}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      if (/^\d*$/.test(valStr)) {
                        setRaceElevInput(valStr);
                        const valNum = parseInt(valStr, 10);
                        const currentDist = parseFloat(raceDistInput) || 0;
                        if (currentDist > 0 && !isNaN(valNum)) {
                          const d = valNum / currentDist;
                          if (d < 15 && focus !== "road") setFocus("road");
                          else if (d > 35 && focus !== "trail") setFocus("trail");
                          else if (d >= 15 && d <= 35 && focus !== "hybrid") setFocus("hybrid");
                        }
                      }
                    }}
                    onBlur={() => {
                      isElevFocused.current = false;
                      if (!raceElevInput.trim() || parseInt(raceElevInput, 10) < 0) {
                        setRaceElevInput("0");
                      }
                    }}
                    placeholder="0"
                    className="w-full min-w-0 text-xs font-mono font-bold text-zinc-950 outline-none bg-transparent"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono font-semibold shrink-0">m D+</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-1.5">
                <span>{language === "en" ? "Auto Profile:" : "Profil Terdeteksi:"}</span>
                <button
                  type="button"
                  onClick={() => setFocus(detectedProfile)}
                  title={language === "en" ? "Click to lock focus to detected profile" : "Klik untuk sesuaikan fokus"}
                  className={`font-black underline transition-colors ${
                    focus === detectedProfile ? "text-emerald-700" : "text-amber-700 hover:text-amber-950"
                  }`}
                >
                  {detectedProfile === "road"
                    ? (language === "en" ? "Road (<15 m/km)" : "Road (<15 m/km)")
                    : detectedProfile === "trail"
                    ? (language === "en" ? "Mountain Trail (>35 m/km)" : "Trail Gunung (>35 m/km)")
                    : (language === "en" ? "Hybrid/Rolling (15-35 m/km)" : "Hybrid (15-35 m/km)")}
                  {focus !== detectedProfile && (language === "en" ? " • Sync" : " • Terapkan")}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-2 flex items-center justify-between p-2.5 rounded-lg bg-white border border-zinc-300">
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                {language === "en" ? "Continuous Fitness Strategy" : "Strategi Kebugaran Berkelanjutan"}
              </span>
              <span className="text-xs font-bold text-zinc-900">
                {language === "en"
                  ? "Stable CTL progression via repeating 4-week mesocycles (3 loading : 1 deload)."
                  : "Kenaikan CTL stabil & aman via siklus 4 pekan berulang (3 minggu naik : 1 minggu deload)."}
              </span>
            </div>
            <div className="text-right shrink-0 pl-3">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                Baseline CTL ({loadUnit})
              </span>
              <span className="text-base font-black font-mono text-cyan-800">
                {currentCtl} {loadUnit}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1 (OPSI A): Current Week Operational HUD */}
      <div className="p-5 sm:p-6 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-5 shadow-[3px_3px_0px_0px_#09090b]">
        {/* HUD Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-zinc-200">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans font-bold text-zinc-500 uppercase tracking-wider">
                {language === "en" ? "CURRENT OPERATIONAL WEEK" : "STATUS MINGGU BERJALAN"}
              </span>
              <span className="px-2 py-0.2 rounded border border-zinc-950 text-[9px] font-black uppercase font-mono bg-zinc-900 text-white">
                {currentPlanWeek.weekDateStr}
              </span>
            </div>
            <div className="flex items-center gap-2 text-lg sm:text-xl font-black text-zinc-950">
              <span>{language === "en" ? currentPlanWeek.phaseLabel.en : currentPlanWeek.phaseLabel.id}</span>
              <span className="text-zinc-400 font-normal">/</span>
              <span className="text-cyan-900">{language === "en" ? currentPlanWeek.mesoLabel.en : currentPlanWeek.mesoLabel.id}</span>
            </div>
          </div>

          {/* Deload Status Countdown Pill */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-zinc-950 font-mono text-xs font-bold shadow-[1.5px_1.5px_0px_0px_#09090b] ${
            currentPlanWeek.isDeload
              ? "bg-emerald-300 text-emerald-950"
              : plan.nextDeloadInWeeks === 1
              ? "bg-amber-300 text-amber-950"
              : "bg-white text-zinc-950"
          }`}>
            {currentPlanWeek.isDeload ? (
              <>
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-950" />
                <span>{language === "en" ? "Deload Week Active (-32% Volume)" : "Pekan Deload Sedang Berjalan (-32%)"}</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 shrink-0 text-zinc-700" />
                <span>
                  {language === "en"
                    ? `${plan.nextDeloadInWeeks} week${plan.nextDeloadInWeeks > 1 ? "s" : ""} until Deload Week`
                    : `Sisa ${plan.nextDeloadInWeeks} minggu menuju Pekan Deload`}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 3 Live Targets Progress Bars: Distance, Vert, Training Load */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Distance Quota */}
          <div className="p-3.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-zinc-500 font-bold uppercase">{language === "en" ? "Weekly Distance" : "Jarak Mingguan"}</span>
              <span className="font-black text-zinc-950">{distPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black font-mono text-zinc-950">
                {thisWeekDistanceKm}{" "}
                <span className="text-xs font-normal text-zinc-500">/ {currentPlanWeek.targetDistanceKm} km</span>
              </div>
            </div>
            <div className="w-full bg-zinc-100 border border-zinc-950 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, distPct)}%` }}
              />
            </div>
          </div>

          {/* Elevation Vert Quota */}
          <div className="p-3.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-zinc-500 font-bold uppercase">{language === "en" ? "Vertical Ascent" : "Tanjakan Vertikal"}</span>
              <span className="font-black text-cyan-900">{gainPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black font-mono text-zinc-950">
                +{thisWeekGain}m{" "}
                <span className="text-xs font-normal text-zinc-500">/ +{currentPlanWeek.targetElevationGain}m D+</span>
              </div>
            </div>
            <div className="w-full bg-zinc-100 border border-zinc-950 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, gainPct)}%` }}
              />
            </div>
          </div>

          {/* Training Load Quota */}
          <div className="p-3.5 rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-zinc-500 font-bold uppercase">
                {language === "en" ? `Training Load (${loadUnit})` : `Beban Latihan (${loadUnit})`}
              </span>
              <span className="font-black text-purple-900">{loadPct}%</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black font-mono text-zinc-950">
                {thisWeekLoad}{" "}
                <span className="text-xs font-normal text-zinc-500">/ {currentPlanWeek.targetTrainingLoad} {loadUnit}</span>
              </div>
            </div>
            <div className="w-full bg-zinc-100 border border-zinc-950 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-purple-400 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, loadPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Key Workout & Sports Science Prescription for the Week */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-white border border-zinc-300 space-y-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase block">
              {language === "en" ? "Key Workout of the Week:" : "Sesi Kunci Minggu Ini:"}
            </span>
            <div className="font-bold text-zinc-950 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>{language === "en" ? currentPlanWeek.keyWorkoutFocus.en : currentPlanWeek.keyWorkoutFocus.id}</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white border border-zinc-300 space-y-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase block">
              {language === "en" ? "Sports Science Directive:" : "Petunjuk Fisiologis Sains:"}
            </span>
            <div className="text-zinc-700 font-medium">
              {language === "en" ? currentPlanWeek.prescriptionTip.en : currentPlanWeek.prescriptionTip.id}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 (OPSI B): Interactive 3:1 Mesocycle Wave Chart & Timeline */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-zinc-950 flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-800" />
              <span>
                {mode === "target_race"
                  ? (language === "en" ? "Macrocycle Wave Roadmap to Race Day" : "Roadmap Gelombang Makrosiklus Menuju Lomba")
                  : (language === "en" ? "Mesocycle 3:1 Rolling Wave Architecture" : "Arsitektur Gelombang Mesosiklus 3:1")}
              </span>
            </h3>
            <p className="text-xs text-zinc-600 font-medium">
              {language === "en"
                ? "Click any week below to inspect target workloads, vertical quotas, and workout focus."
                : "Klik salah satu pekan di bawah untuk membedah target kuota elevasi, jarak, dan fokus latihannya."}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowWaveChart(!showWaveChart)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-zinc-950 font-mono text-xs font-bold shadow-[1.5px_1.5px_0px_0px_#09090b] transition-all cursor-pointer ${
                showWaveChart
                  ? "bg-cyan-300 text-zinc-950"
                  : "bg-white text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>
                {showWaveChart
                  ? (language === "en" ? "Wave Chart: ON" : "Grafik: ON")
                  : (language === "en" ? "Wave Chart: OFF" : "Grafik: OFF")}
              </span>
            </button>
            {mode === "target_race" && plan.daysUntilRace !== undefined && (
              <div className="px-3 py-1.5 rounded-lg border-2 border-zinc-950 bg-amber-300 text-zinc-950 text-xs font-mono font-black shadow-[1.5px_1.5px_0px_0px_#09090b]">
                {plan.weeksUntilRace} {language === "en" ? "Weeks" : "Minggu"} ({plan.daysUntilRace} {language === "en" ? "Days" : "Hari"})
              </div>
            )}
          </div>
        </div>

        {/* Interactive 3:1 Mesocycle Wave Chart */}
        {showWaveChart && (
          <div className="p-4 rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono border-b border-zinc-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-black text-zinc-950 uppercase">
                  {language === "en" ? "3:1 Wave Progression Visualizer" : "Visualisasi Gelombang Siklus 3:1"}
                </span>
                <span className="text-zinc-500 font-medium hidden sm:inline">
                  {language === "en" ? "(Left: Distance km • Right: Vert m D+)" : "(Kiri: Jarak km • Kanan: Elevasi m D+)"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold flex-wrap">
                <span className="flex items-center gap-1 text-cyan-900">
                  <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500 border border-zinc-950 inline-block" />
                  <span>Loading</span>
                </span>
                <span className="flex items-center gap-1 text-rose-900">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500 border border-zinc-950 inline-block" />
                  <span>Peak</span>
                </span>
                <span className="flex items-center gap-1 text-emerald-900">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400 border border-zinc-950 inline-block" />
                  <span>Deload</span>
                </span>
                <span className="flex items-center gap-1 text-amber-900">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-400 border border-zinc-950 inline-block" />
                  <span>Race</span>
                </span>
                <span className="flex items-center gap-1 text-orange-700">
                  <span className="h-0.5 w-3 bg-orange-600 inline-block" />
                  <span>Vert D+</span>
                </span>
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  onClick={(state) => {
                    if (state && typeof state.activeTooltipIndex === "number") {
                      setSelectedWeekIndex(state.activeTooltipIndex);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fontSize: 11, fontFamily: "monospace", fill: "#52525b" }}
                    tickLine={false}
                    axisLine={{ stroke: "#09090b", strokeWidth: 1.5 }}
                  />
                  <YAxis
                    yAxisId="km"
                    tick={{ fontSize: 10, fontFamily: "monospace", fill: "#52525b" }}
                    tickLine={false}
                    axisLine={false}
                    unit="k"
                  />
                  <YAxis
                    yAxisId="elev"
                    orientation="right"
                    tick={{ fontSize: 10, fontFamily: "monospace", fill: "#52525b" }}
                    tickLine={false}
                    axisLine={false}
                    unit="m"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as (typeof chartData)[0];
                        return (
                          <div className="rounded-xl bg-white border-2 border-zinc-950 p-2.5 shadow-[3px_3px_0px_0px_#09090b] text-xs font-mono space-y-1 z-50">
                            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-1">
                              <span className="font-black text-zinc-950">W{d.weekNum} ({d.dateRange})</span>
                              {d.isDeload && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-300 text-emerald-950 font-black text-[9px] uppercase border border-zinc-950">
                                  Deload
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold text-zinc-700">
                              {d.phaseName} • {d.mesoName}
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                              <div>
                                <span className="text-[9px] text-zinc-500 block uppercase">Target Dist</span>
                                <span className="font-black text-cyan-800">{d.distanceKm} km</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-zinc-500 block uppercase">Target Vert</span>
                                <span className="font-black text-amber-700">+{d.elevationGain}m</span>
                              </div>
                            </div>
                            <div className="text-[10px] text-zinc-500 pt-0.5 border-t border-zinc-100">
                              Load: <span className="font-bold text-purple-900">{d.trainingLoad} {loadUnit}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    yAxisId="km"
                    dataKey="distanceKm"
                    radius={[4, 4, 0, 0]}
                    stroke="#09090b"
                    strokeWidth={1.5}
                    cursor="pointer"
                  >
                    {chartData.map((entry, index) => {
                      let fill = "#06b6d4";
                      if (entry.isRaceWeek) fill = "#f59e0b";
                      else if (entry.isDeload) fill = "#34d399";
                      else if (entry.mesoType === "load_peak") fill = "#f43f5e";
                      const isSelected = selectedWeekIndex === index;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={fill}
                          opacity={isSelected ? 1 : 0.85}
                          stroke={isSelected ? "#09090b" : "#09090b"}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />
                      );
                    })}
                  </Bar>
                  <Line
                    yAxisId="elev"
                    type="monotone"
                    dataKey="elevationGain"
                    stroke="#ea580c"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#ea580c", stroke: "#09090b", strokeWidth: 1 }}
                    activeDot={{ r: 5, fill: "#ea580c", stroke: "#09090b", strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Horizontal Week Cards / Wave Representation */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {plan.weeksInCycle.slice(0, 8).map((week, idx) => {
            const isSelected = selectedWeekIndex === idx;
            return (
              <button
                key={week.weekNumber}
                type="button"
                onClick={() => setSelectedWeekIndex(idx)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? "border-zinc-950 bg-white ring-2 ring-zinc-950 shadow-[3px_3px_0px_0px_#09090b] -translate-y-0.5"
                    : "border-zinc-300 bg-[#FAF9F5] hover:border-zinc-950 hover:bg-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                }`}
              >
                {/* Week Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-black text-zinc-500 uppercase">
                    W{week.weekNumber} • {week.weekDateStr}
                  </span>
                  {week.isCurrentWeek && (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-amber-400 text-zinc-950 border border-zinc-950">
                      LIVE
                    </span>
                  )}
                </div>

                {/* Phase & Meso Tag */}
                <div className="space-y-0.5 mb-3">
                  <span className={`text-[9px] font-mono font-bold uppercase block px-1.5 py-0.5 rounded w-fit border border-zinc-950 ${
                    week.isRaceWeek
                      ? "bg-amber-300 text-zinc-950"
                      : week.phase === "taper"
                      ? "bg-emerald-200 text-emerald-950"
                      : week.isDeload
                      ? "bg-emerald-300 text-emerald-950"
                      : week.mesoType === "load_peak"
                      ? "bg-rose-200 text-rose-950"
                      : "bg-cyan-200 text-cyan-950"
                  }`}>
                    {language === "en" ? week.mesoLabel.en : week.mesoLabel.id}
                  </span>
                </div>

                {/* Simulated Volume Wave Height Visual Bar */}
                <div className="my-2 space-y-1">
                  <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden border border-zinc-400">
                    <div
                      className={`h-full transition-all ${
                        week.isDeload
                          ? "bg-emerald-500"
                          : week.mesoType === "load_peak"
                          ? "bg-rose-500"
                          : "bg-cyan-600"
                      }`}
                      style={{ width: `${Math.round(week.volumeMultiplier * 75)}%` }}
                    />
                  </div>
                </div>

                {/* Targets Summary */}
                <div className="pt-1 text-[11px] font-mono flex items-center justify-between text-zinc-900 font-bold border-t border-zinc-200">
                  <span>{week.targetDistanceKm} km</span>
                  <span className="text-cyan-800">+{week.targetElevationGain}m</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Inspected Week Deep Dive Panel */}
        <div className="p-4 sm:p-5 rounded-xl bg-white border-2 border-zinc-950 space-y-3 shadow-[2px_2px_0px_0px_#09090b] text-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-zinc-950 text-white">
                W{inspectedWeek.weekNumber} PLAN
              </span>
              <span className="font-bold text-sm text-zinc-950">
                {inspectedWeek.weekDateStr} — {language === "en" ? inspectedWeek.mesoLabel.en : inspectedWeek.mesoLabel.id}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-zinc-800">
              <span>Target: <strong className="text-zinc-950 font-black">{inspectedWeek.targetDistanceKm} km</strong></span>
              <span>•</span>
              <span>Vert: <strong className="text-cyan-900 font-black">+{inspectedWeek.targetElevationGain}m D+</strong></span>
              <span>•</span>
              <span>Load: <strong className="text-purple-900 font-black">{inspectedWeek.targetTrainingLoad} {loadUnit}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">
                {language === "en" ? "Key Workout Focus:" : "Fokus Menu Latihan:"}
              </span>
              <p className="font-bold text-zinc-900 leading-snug">
                {language === "en" ? inspectedWeek.keyWorkoutFocus.en : inspectedWeek.keyWorkoutFocus.id}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">
                {language === "en" ? "Physiological Rationale:" : "Rasional Sains Olahraga:"}
              </span>
              <p className="text-zinc-600 font-medium leading-snug">
                {language === "en" ? inspectedWeek.prescriptionTip.en : inspectedWeek.prescriptionTip.id}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
