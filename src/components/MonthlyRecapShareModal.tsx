"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  X,
  Download,
  Copy,
  Check,
  Share2,
  Mountain,
  Footprints,
  Bike,
  Dumbbell,
  Heart,
  Zap,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Camera,
  Trash2,
  SlidersHorizontal,
  Move,
  ZoomIn,
  RotateCcw,
  Calendar,
  Flame,
  Award,
  Compass,
} from "lucide-react";
import { ActivityItem } from "./ActivityFeed";
import { formatPace, formatDurationReadable } from "@/lib/analytics";
import { toPng } from "html-to-image";
import { useTranslation } from "@/lib/i18n/context";

interface MonthlyRecapShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number; // 0-indexed: 0 = Jan, 11 = Dec
  activities: ActivityItem[];
}

export type RecapTemplateId = "cockpit" | "minimal" | "poster" | "journal";

export const MonthlyRecapShareModal: React.FC<MonthlyRecapShareModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  activities,
}) => {
  const { t, language } = useTranslation();

  const [template, setTemplate] = useState<RecapTemplateId>("cockpit");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1">("9:16");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [overlayDim, setOverlayDim] = useState<"subtle" | "balanced" | "deep">("balanced");
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Photo drag & zoom
  const [photoPos, setPhotoPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [photoScale, setPhotoScale] = useState<number>(1);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Date metadata
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  const isPastMonth =
    year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

  const monthDateObj = new Date(year, month, 1);
  const monthName = monthDateObj.toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
    month: "long",
  });
  const monthShort = monthDateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

  // Filter activities for this month
  const monthActivities = useMemo(() => {
    return activities.filter((act) => {
      const d = new Date(act.startTime);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [activities, year, month]);

  // Aggregate monthly statistics
  const stats = useMemo(() => {
    let totalDist = 0;
    let totalGain = 0;
    let totalDurationMin = 0;
    let totalLoad = 0;

    let roadCount = 0;
    let roadDist = 0;
    let roadDurationMin = 0;
    let roadGain = 0;

    let trailCount = 0;
    let trailDist = 0;
    let trailGain = 0;
    let trailDurationMin = 0;

    let bikeCount = 0;
    let strengthCount = 0;
    let otherCount = 0;

    let longestRun: ActivityItem | null = null;
    let highestVert: ActivityItem | null = null;
    let highestLoad: ActivityItem | null = null;

    const activeDaysSet = new Set<number>();
    const dayMap = new Map<number, { count: number; dist: number; isTrail: boolean }>();

    for (const act of monthActivities) {
      const dist = parseFloat(act.distanceKm || "0");
      const gain = act.elevationGain || 0;
      const dur = act.durationMin || Math.round((act.durationSeconds || 0) / 60);
      const load = act.trainingLoad || 0;

      totalDist += dist;
      totalGain += gain;
      totalDurationMin += dur;
      totalLoad += load;

      const actDate = new Date(act.startTime);
      const dayNum = actDate.getDate();
      activeDaysSet.add(dayNum);

      const isTrail = act.sportType === "trail_run" || act.elevationGain > 200;
      const isRoad =
        (act.sportType === "run" || act.sportType === "track_run" || act.sportType === "indoor_run") &&
        act.elevationGain <= 200;
      const isBike = act.sportType === "bike" || act.sportType === "cycling";
      const isStrength =
        act.sportType === "strength" || act.sportType === "gym" || act.sportType === "weight";

      if (isTrail) {
        trailCount++;
        trailDist += dist;
        trailGain += gain;
        trailDurationMin += dur;
      } else if (isRoad) {
        roadCount++;
        roadDist += dist;
        roadGain += gain;
        roadDurationMin += dur;
      } else if (isBike) {
        bikeCount++;
      } else if (isStrength) {
        strengthCount++;
      } else {
        otherCount++;
      }

      // Map day representation
      const prevDay = dayMap.get(dayNum) || { count: 0, dist: 0, isTrail: false };
      dayMap.set(dayNum, {
        count: prevDay.count + 1,
        dist: prevDay.dist + dist,
        isTrail: prevDay.isTrail || isTrail,
      });

      // Highlights
      if (!longestRun || dist > parseFloat(longestRun.distanceKm || "0")) {
        longestRun = act;
      }
      if (!highestVert || gain > (highestVert.elevationGain || 0)) {
        highestVert = act;
      }
      if (!highestLoad || load > (highestLoad.trainingLoad || 0)) {
        highestLoad = act;
      }
    }

    const roadAvgPaceSec = roadDist > 0 ? Math.round((roadDurationMin * 60) / roadDist) : 0;
    const trailVertDensity = trailDist > 0 ? Math.round(trailGain / trailDist) : 0;

    return {
      count: monthActivities.length,
      totalDistKm: totalDist.toFixed(1),
      totalGainM: Math.round(totalGain),
      totalHours: (totalDurationMin / 60).toFixed(1),
      totalLoad: Math.round(totalLoad),
      activeDays: activeDaysSet.size,
      road: {
        count: roadCount,
        distKm: roadDist.toFixed(1),
        durationMin: roadDurationMin,
        gainM: Math.round(roadGain),
        avgPaceSec: roadAvgPaceSec,
      },
      trail: {
        count: trailCount,
        distKm: trailDist.toFixed(1),
        durationMin: trailDurationMin,
        gainM: Math.round(trailGain),
        vertDensity: trailVertDensity,
      },
      bikeCount,
      strengthCount,
      otherCount,
      longestRun,
      highestVert,
      highestLoad,
      dayMap,
    };
  }, [monthActivities]);

  // Calendar Day Dots Matrix (1 to daysInMonth)
  const calendarDays = useMemo(() => {
    const list: { day: number; hasActivity: boolean; isTrail: boolean; isFuture: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const isFuture = isCurrentMonth && d > daysElapsed;
      const dayData = stats.dayMap.get(d);
      list.push({
        day: d,
        hasActivity: !!dayData,
        isTrail: dayData?.isTrail || false,
        isFuture,
      });
    }
    return list;
  }, [daysInMonth, daysElapsed, isCurrentMonth, stats.dayMap]);

  // Handle Photo Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!bgImage) return;
    e.preventDefault();
    setIsDraggingPhoto(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: photoPos.x,
      initY: photoPos.y,
    };
  };

  useEffect(() => {
    if (!isDraggingPhoto) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setPhotoPos({
        x: Math.round(dragStartRef.current.initX + dx),
        y: Math.round(dragStartRef.current.initY + dy),
      });
    };

    const handleMouseUp = () => {
      setIsDraggingPhoto(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPhoto]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!bgImage || e.touches.length === 0) return;
    setIsDraggingPhoto(true);
    dragStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initX: photoPos.x,
      initY: photoPos.y,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingPhoto || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - dragStartRef.current.startX;
    const dy = e.touches[0].clientY - dragStartRef.current.startY;
    setPhotoPos({
      x: Math.round(dragStartRef.current.initX + dx),
      y: Math.round(dragStartRef.current.initY + dy),
    });
  };

  const handleTouchEnd = () => {
    setIsDraggingPhoto(false);
  };

  const handleResetPhotoPosition = () => {
    setPhotoPos({ x: 0, y: 0 });
    setPhotoScale(1);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBgImage(reader.result);
        setPhotoPos({ x: 0, y: 0 });
        setPhotoScale(1);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setBgImage(null);
    setPhotoPos({ x: 0, y: 0 });
    setPhotoScale(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3, // Retina 3x export
        quality: 1,
        cacheBust: true,
        backgroundColor: bgImage ? undefined : theme === "dark" ? "#0B0D10" : "#FAF8F5",
      });

      const cleanMonth = monthName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const link = document.createElement("a");
      link.download = `allterrain-recap-${cleanMonth}-${year}-${aspectRatio === "9:16" ? "story" : "post"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download monthly recap:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!cardRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2.5,
        quality: 1,
        backgroundColor: bgImage ? undefined : theme === "dark" ? "#0B0D10" : "#FAF8F5",
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy image to clipboard:", err);
      handleDownload();
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const isDarkCanvas = bgImage || theme === "dark";
  const dateSpanLabel = `1 – ${daysElapsed} ${monthShort}`;
  const statusLabel = isCurrentMonth
    ? language === "en"
      ? "MONTH-TO-DATE"
      : "BULAN BERJALAN"
    : language === "en"
    ? "FULL MONTH"
    : "REKAP SEBULAN";

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-xl w-full bg-white rounded-3xl border-2 border-zinc-950 p-4 sm:p-6 space-y-4 shadow-[8px_8px_0px_0px_#09090b] my-auto max-h-[94dvh] overflow-y-auto">
        {/* Header Controls */}
        <div className="flex items-center justify-between border-b-2 border-zinc-200 pb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Award className="h-4 w-4 stroke-[2.5] text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-black text-zinc-950 leading-tight truncate flex items-center gap-2">
                <span>{language === "en" ? "Monthly Recap Card" : "Kartu Rekap Bulanan"}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-orange-500 text-white font-black">
                  {monthShort} {year}
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 truncate">
                {language === "en"
                  ? isCurrentMonth
                    ? "In-progress Month-to-Date recap (Road + Trail combined)"
                    : "Completed monthly training recap (Road + Trail combined)"
                  : isCurrentMonth
                  ? "Rekap berjalan Month-to-Date (Road + Trail digabung)"
                  : "Rekap performa 1 bulan penuh (Road + Trail digabung)"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b] transition-all"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Template Presets Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-wider text-zinc-500">
              {language === "en" ? "Recap Style:" : "Gaya Desain:"}
            </span>
            {isCurrentMonth ? (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                MTD ({daysElapsed} days)
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                ✓ Full Month
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTemplate("cockpit")}
              className={`py-1.5 px-3 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "cockpit"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Cockpit Dual-Engine</span>
            </button>

            <button
              onClick={() => setTemplate("minimal")}
              className={`py-1.5 px-3 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "minimal"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Minimal Volume</span>
            </button>

            <button
              onClick={() => setTemplate("poster")}
              className={`py-1.5 px-3 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "poster"
                  ? "bg-rose-600 text-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <span className="font-mono text-xs font-black">POSTER</span>
              <span>Condensed</span>
            </button>

            <button
              onClick={() => setTemplate("journal")}
              className={`py-1.5 px-3 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "journal"
                  ? "bg-amber-300 text-zinc-950 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <Award className="h-3.5 w-3.5 text-amber-700" />
              <span>Editorial Journal</span>
            </button>
          </div>
        </div>

        {/* Custom Photo Management Strip */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-orange-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-zinc-950 text-zinc-950 font-bold hover:bg-zinc-100 shadow-sm"
            >
              <Camera className="h-3.5 w-3.5 text-orange-600" />
              <span>
                {bgImage
                  ? language === "en"
                    ? "Change Photo"
                    : "Ganti Foto"
                  : language === "en"
                  ? "Upload Background Photo"
                  : "Pasang Foto Latar"}
              </span>
            </button>

            {bgImage && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 border border-rose-400 text-rose-700 font-bold hover:bg-rose-100"
                title="Remove Photo"
              >
                <Trash2 className="h-3 w-3" />
                <span className="text-[10px]">Hapus</span>
              </button>
            )}
          </div>

          {bgImage && (
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <span className="text-zinc-600 font-bold">Dim:</span>
              {(["subtle", "balanced", "deep"] as const).map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setOverlayDim(dim)}
                  className={`px-2 py-0.5 rounded capitalize font-bold ${
                    overlayDim === dim
                      ? "bg-zinc-950 text-white"
                      : "bg-white text-zinc-700 border border-zinc-300"
                  }`}
                >
                  {dim}
                </button>
              ))}
            </div>
          )}

          {bgImage && (
            <div className="w-full pt-2 mt-0.5 border-t border-orange-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-600">
                  <Move className="w-3.5 h-3.5 text-orange-600" />
                  <span className="font-semibold">Drag preview foto untuk geser</span>
                </div>
                {(photoPos.x !== 0 || photoPos.y !== 0 || photoScale !== 1) && (
                  <button
                    type="button"
                    onClick={handleResetPhotoPosition}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 text-[10px] font-mono font-bold shadow-xs transition-colors"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-orange-600" />
                    Reset
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-zinc-600 font-bold flex items-center gap-1">
                  <ZoomIn className="w-3 h-3 text-zinc-500" />
                  Zoom:
                </span>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  value={photoScale}
                  onChange={(e) => setPhotoScale(parseFloat(e.target.value))}
                  className="w-20 sm:w-24 h-1.5 bg-zinc-300 rounded-lg appearance-none cursor-pointer accent-orange-600"
                />
                <span className="w-9 text-right font-black text-zinc-800">
                  {Math.round(photoScale * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Customization Toolbar: Ratio & Theme */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#FAF9F5] p-2 sm:p-2.5 rounded-2xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
          {/* Ratio Toggle */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase font-black text-zinc-500 mr-0.5">Ratio:</span>
            <button
              onClick={() => setAspectRatio("9:16")}
              className={`px-2.5 sm:px-3 py-1 text-xs font-black rounded-xl border transition-all ${
                aspectRatio === "9:16"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  : "border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200"
              }`}
            >
              📱 9:16 Story
            </button>
            <button
              onClick={() => setAspectRatio("1:1")}
              className={`px-2.5 sm:px-3 py-1 text-xs font-black rounded-xl border transition-all ${
                aspectRatio === "1:1"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  : "border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200"
              }`}
            >
              ⏹️ 1:1 Square
            </button>
          </div>

          {/* Theme Toggle */}
          {!bgImage && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-black text-zinc-500 mr-0.5">Tone:</span>
              <button
                onClick={() => setTheme("dark")}
                className={`px-2.5 py-1 text-xs font-black rounded-lg border transition-all ${
                  theme === "dark"
                    ? "bg-zinc-900 text-white border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                    : "border-zinc-300 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100"
                }`}
              >
                🌙 Onyx
              </button>
              <button
                onClick={() => setTheme("light")}
                className={`px-2.5 py-1 text-xs font-black rounded-lg border transition-all ${
                  theme === "light"
                    ? "bg-amber-300 text-zinc-950 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                    : "border-zinc-300 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100"
                }`}
              >
                ☀️ Chalk
              </button>
            </div>
          )}
        </div>

        {/* Live Card Preview Box */}
        <div className="w-full flex justify-center items-center py-2 bg-zinc-200/60 rounded-2xl p-2 sm:p-4 overflow-x-auto max-w-full">
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`relative rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_#09090b] border-2 border-zinc-950 shrink-0 group ${
              bgImage
                ? isDraggingPhoto
                  ? "cursor-grabbing select-none"
                  : "cursor-grab"
                : ""
            }`}
          >
            {bgImage && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/60 backdrop-blur-md text-white/90 text-[10px] font-mono font-medium px-2.5 py-1 rounded-full border border-white/20 shadow-md flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                <Move className="w-3 h-3 text-orange-400" />
                <span>Drag foto untuk atur posisi</span>
              </div>
            )}

            {/* TARGET CAPTURE ELEMENT */}
            <div
              ref={cardRef}
              style={{
                width: aspectRatio === "9:16" ? "360px" : "380px",
                height: aspectRatio === "9:16" ? "640px" : "380px",
                backgroundColor: bgImage ? "#000000" : theme === "dark" ? "#0B0D10" : "#FAF8F5",
              }}
              className={`relative flex flex-col justify-between p-5 sm:p-6 transition-all select-none overflow-hidden ${
                isDarkCanvas ? "text-zinc-100" : "text-zinc-950"
              }`}
            >
              {/* Optional Custom Background Photo */}
              {bgImage ? (
                <>
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <img
                      src={bgImage}
                      alt="Monthly recap background"
                      style={{
                        transform: `translate3d(${photoPos.x}px, ${photoPos.y}px, 0) scale(${photoScale})`,
                        transformOrigin: "center center",
                      }}
                      className="w-full h-full object-cover select-none pointer-events-none"
                      draggable={false}
                    />
                  </div>
                  <div
                    className={`absolute inset-0 z-0 pointer-events-none ${
                      overlayDim === "subtle"
                        ? "bg-black/40"
                        : overlayDim === "deep"
                        ? "bg-black/80"
                        : "bg-black/65"
                    }`}
                  />
                  <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/85 to-transparent z-0 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-0 pointer-events-none" />
                </>
              ) : theme === "dark" ? (
                <div className="absolute top-0 right-0 w-48 h-48 bg-orange-600/10 blur-3xl pointer-events-none rounded-full" />
              ) : null}

              {/* ========================================================= */}
              {/* 1. COCKPIT DUAL-ENGINE TEMPLATE                          */}
              {/* ========================================================= */}
              {template === "cockpit" && (
                <>
                  {/* Top Branding Header */}
                  <div className="relative z-10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center border font-black text-xs ${
                            isDarkCanvas
                              ? "bg-orange-600 text-zinc-950 border-orange-500 shadow-[1px_1px_0px_0px_#ff5500]"
                              : "bg-zinc-950 text-white border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                          }`}
                        >
                          ▲LT
                        </div>
                        <div className="leading-none">
                          <span className="text-[11px] font-black tracking-widest block font-sans">
                            ALLTERRAIN
                          </span>
                          <span
                            className={`text-[8px] font-mono uppercase ${
                              isDarkCanvas ? "text-zinc-400" : "text-zinc-500"
                            }`}
                          >
                            MONTHLY RECAP
                          </span>
                        </div>
                      </div>

                      {/* Status badge: MTD vs Full */}
                      <div
                        className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                          isCurrentMonth
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isCurrentMonth ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                          }`}
                        />
                        <span>{statusLabel}</span>
                      </div>
                    </div>

                    <div className="pt-0.5 flex items-baseline justify-between">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-none uppercase font-sans">
                          {monthName} {year}
                        </h3>
                        <p
                          className={`text-[10px] font-mono ${
                            isDarkCanvas ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {dateSpanLabel} • {stats.activeDays} {language === "en" ? "active days" : "hari aktif"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hero Metric Banner (Total Distance & Elevation) */}
                  <div className="relative z-10 my-auto space-y-2.5">
                    <div
                      className={`p-3 rounded-2xl border ${
                        isDarkCanvas
                          ? "bg-zinc-900/80 border-zinc-800 backdrop-blur-md"
                          : "bg-white border-zinc-300 shadow-sm"
                      }`}
                    >
                      <div className="grid grid-cols-2 gap-3 divide-x divide-zinc-700/30">
                        <div>
                          <span className="text-[9px] font-mono font-bold uppercase block text-zinc-400">
                            Total Volume
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight leading-none">
                              {stats.totalDistKm}
                            </span>
                            <span className="text-xs font-black text-orange-500">KM</span>
                          </div>
                        </div>

                        <div className="pl-3">
                          <span className="text-[9px] font-mono font-bold uppercase block text-zinc-400 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3 stroke-[3] text-emerald-500" />
                            Total Vert D+
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight leading-none text-emerald-500">
                              +{stats.totalGainM.toLocaleString()}
                            </span>
                            <span className="text-xs font-black text-zinc-400">M</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dual-Terrain Split Box: ROAD vs TRAIL */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* ROAD ENGINE */}
                      <div
                        className={`p-2.5 rounded-xl border ${
                          isDarkCanvas
                            ? "bg-zinc-900/70 border-orange-500/30"
                            : "bg-orange-50/70 border-orange-300"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-black text-orange-500 mb-1">
                          <div className="flex items-center gap-1">
                            <Footprints className="h-3 w-3 stroke-[2.5]" />
                            <span>ROAD</span>
                          </div>
                          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-orange-500/20">
                            {stats.road.count} {language === "en" ? "runs" : "sesi"}
                          </span>
                        </div>
                        <div className="space-y-0.5 font-mono">
                          <div className="text-base font-black leading-none">
                            {stats.road.distKm} <span className="text-[9px] text-zinc-400">km</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                            <span>Pace:</span>
                            <span className="font-bold text-zinc-200">
                              {stats.road.avgPaceSec > 0 ? `${formatPace(stats.road.avgPaceSec)}/km` : "--"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* TRAIL ENGINE */}
                      <div
                        className={`p-2.5 rounded-xl border ${
                          isDarkCanvas
                            ? "bg-zinc-900/70 border-cyan-500/30"
                            : "bg-cyan-50/70 border-cyan-300"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-black text-cyan-400 mb-1">
                          <div className="flex items-center gap-1">
                            <Mountain className="h-3 w-3 stroke-[2.5]" />
                            <span>TRAIL</span>
                          </div>
                          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20">
                            {stats.trail.count} {language === "en" ? "runs" : "sesi"}
                          </span>
                        </div>
                        <div className="space-y-0.5 font-mono">
                          <div className="text-base font-black leading-none text-cyan-300">
                            {stats.trail.distKm} <span className="text-[9px] text-zinc-400">km</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                            <span>D+:</span>
                            <span className="font-bold text-emerald-400">
                              +{stats.trail.gainM.toLocaleString()}m
                            </span>
                            {stats.trail.vertDensity > 0 && (
                              <span className="text-[8px] opacity-75">
                                ({stats.trail.vertDensity}m/k)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Highlights: Longest Run & Peak Elevation */}
                    {aspectRatio === "9:16" && (stats.longestRun || stats.highestVert) && (
                      <div
                        className={`p-2 rounded-xl border text-[10px] font-mono space-y-1 ${
                          isDarkCanvas
                            ? "bg-zinc-900/60 border-zinc-800/80"
                            : "bg-white/80 border-zinc-200"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[8px] font-bold text-zinc-400 uppercase tracking-wider">
                          <span>Monthly Milestones</span>
                          <span>EvoLab</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {stats.longestRun && (
                            <div className="truncate">
                              <span className="text-[8px] text-orange-400 block">
                                🏃 Longest Run
                              </span>
                              <span className="font-bold text-zinc-200 truncate block">
                                {stats.longestRun.distanceKm} km
                              </span>
                            </div>
                          )}

                          {stats.highestVert && (
                            <div className="truncate">
                              <span className="text-[8px] text-emerald-400 block">
                                ⛰️ Peak Elevation
                              </span>
                              <span className="font-bold text-zinc-200 truncate block">
                                +{stats.highestVert.elevationGain}m D+
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Active Days Dot Heatmap Strip (Shows on 9:16) */}
                    {aspectRatio === "9:16" && (
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400 mb-1">
                          <span>ACTIVITY HEATMAP</span>
                          <span>
                            {stats.activeDays}/{daysElapsed} DAYS
                          </span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.slice(0, daysInMonth).map((d) => (
                            <div
                              key={d.day}
                              className={`h-3.5 rounded-sm flex items-center justify-center text-[7px] font-mono font-bold transition-all ${
                                d.isFuture
                                  ? "bg-zinc-800/30 text-zinc-600 border border-zinc-800/20"
                                  : d.hasActivity
                                  ? d.isTrail
                                    ? "bg-cyan-500 text-zinc-950 font-black shadow-[0_0_6px_rgba(6,182,212,0.6)]"
                                    : "bg-orange-500 text-zinc-950 font-black shadow-[0_0_6px_rgba(249,115,22,0.6)]"
                                  : isDarkCanvas
                                  ? "bg-zinc-800/60 text-zinc-500"
                                  : "bg-zinc-200 text-zinc-400"
                              }`}
                            >
                              {d.day}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Footer Telemetry */}
                  <div className="relative z-10 pt-2 border-t border-zinc-700/40">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-zinc-400" />
                        <span>{stats.totalHours} hrs on feet</span>
                      </div>
                      <div className="flex items-center gap-1 text-orange-500 font-bold">
                        <Zap className="h-3 w-3 fill-current" />
                        <span>TL {stats.totalLoad}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 2. MINIMAL VOLUME TEMPLATE                                */}
              {/* ========================================================= */}
              {template === "minimal" && (
                <>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black font-sans tracking-widest text-orange-500">
                        ▲
                      </span>
                      <span className="text-xs font-black tracking-widest font-sans">
                        ALLTERRAIN
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                        isDarkCanvas
                          ? "bg-zinc-900/60 border-zinc-700 text-zinc-300"
                          : "bg-zinc-100 border-zinc-300 text-zinc-700"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="relative z-10 my-auto text-center space-y-2 py-3">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-orange-500 font-black">
                      {monthName} {year}
                    </span>

                    <div className="text-6xl sm:text-7xl font-black font-mono tracking-tighter leading-none flex items-baseline justify-center">
                      <span>{stats.totalDistKm}</span>
                      <span className="text-xl sm:text-2xl font-black text-orange-500 ml-1 font-sans">
                        KM
                      </span>
                    </div>

                    <div className="text-xl sm:text-2xl font-black font-mono text-emerald-500 flex items-center justify-center gap-1">
                      <ArrowUpRight className="h-5 w-5 stroke-[3]" />
                      <span>+{stats.totalGainM.toLocaleString()} M D+</span>
                    </div>

                    {/* Dual terrain bar */}
                    <div className="pt-2 max-w-xs mx-auto space-y-1">
                      <div className="h-2 rounded-full overflow-hidden bg-zinc-800 flex">
                        <div
                          style={{
                            width: `${
                              parseFloat(stats.totalDistKm) > 0
                                ? (parseFloat(stats.road.distKm) / parseFloat(stats.totalDistKm)) *
                                  100
                                : 50
                            }%`,
                          }}
                          className="bg-orange-500 h-full"
                          title="Road"
                        />
                        <div
                          style={{
                            width: `${
                              parseFloat(stats.totalDistKm) > 0
                                ? (parseFloat(stats.trail.distKm) / parseFloat(stats.totalDistKm)) *
                                  100
                                : 50
                            }%`,
                          }}
                          className="bg-cyan-500 h-full"
                          title="Trail"
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-zinc-400 font-bold px-1">
                        <span className="text-orange-400">Road: {stats.road.distKm} km</span>
                        <span className="text-cyan-400">Trail: {stats.trail.distKm} km</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10">
                    <div
                      className={`p-3 rounded-2xl border grid grid-cols-4 font-mono text-center text-xs ${
                        isDarkCanvas
                          ? "bg-zinc-900/80 border-zinc-800 backdrop-blur-md"
                          : "bg-white border-zinc-300 shadow-sm"
                      }`}
                    >
                      <div>
                        <span className="text-[8px] font-bold text-zinc-400 block uppercase">
                          Runs
                        </span>
                        <span className="text-sm font-black">{stats.count}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-zinc-400 block uppercase">
                          Time
                        </span>
                        <span className="text-sm font-black">{stats.totalHours}h</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-zinc-400 block uppercase">
                          Load
                        </span>
                        <span className="text-sm font-black text-orange-500">
                          {stats.totalLoad}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-zinc-400 block uppercase">
                          Active
                        </span>
                        <span className="text-sm font-black text-emerald-500">
                          {stats.activeDays}d
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 3. POSTER CONDENSED TEMPLATE                              */}
              {/* ========================================================= */}
              {template === "poster" && (
                <>
                  <div className="relative z-10 flex items-start justify-between border-b-2 border-rose-600 pb-2">
                    <div>
                      <span className="text-[9px] font-mono font-black text-rose-500 tracking-widest block">
                        ALLTERRAIN ATHLETICS // RECAP
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter leading-none font-sans">
                        {monthShort} {year}
                      </h2>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black font-mono text-rose-500 block">
                        {statusLabel}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400">{dateSpanLabel}</span>
                    </div>
                  </div>

                  <div className="relative z-10 my-auto space-y-3 py-2">
                    <div className="border-l-4 border-rose-600 pl-3">
                      <span className="text-[9px] font-mono uppercase text-zinc-400 block">
                        Total Distance
                      </span>
                      <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight leading-none">
                        {stats.totalDistKm}
                        <span className="text-lg font-black text-rose-500 ml-1">KM</span>
                      </div>
                    </div>

                    <div className="border-l-4 border-cyan-500 pl-3">
                      <span className="text-[9px] font-mono uppercase text-zinc-400 block">
                        Total Elevation Gain
                      </span>
                      <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight leading-none text-cyan-400">
                        +{stats.totalGainM.toLocaleString()}
                        <span className="text-sm font-black text-zinc-400 ml-1">M D+</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="p-2 bg-zinc-900/80 border border-zinc-800 rounded-lg">
                        <span className="text-[8px] font-mono text-orange-400 block">
                          ROAD MILEAGE
                        </span>
                        <span className="text-sm font-black font-mono">{stats.road.distKm} km</span>
                        <span className="text-[9px] text-zinc-400 block">
                          {stats.road.count} sessions
                        </span>
                      </div>
                      <div className="p-2 bg-zinc-900/80 border border-zinc-800 rounded-lg">
                        <span className="text-[8px] font-mono text-cyan-400 block">
                          TRAIL MILEAGE
                        </span>
                        <span className="text-sm font-black font-mono">
                          {stats.trail.distKm} km
                        </span>
                        <span className="text-[9px] text-zinc-400 block">
                          {stats.trail.count} sessions
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 border-t-2 border-zinc-800 pt-2 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>{stats.totalHours} TOTAL HOURS</span>
                    <span>{stats.count} WORKOUTS</span>
                    <span className="text-rose-500 font-bold">COROS EVOLAB</span>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 4. EDITORIAL JOURNAL TEMPLATE                             */}
              {/* ========================================================= */}
              {template === "journal" && (
                <>
                  <div className="relative z-10 space-y-1 border-b border-amber-500/40 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold tracking-widest text-amber-500 uppercase">
                        Endurance Journal
                      </span>
                      <span className="text-[8px] font-mono bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                        {statusLabel}
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-none uppercase">
                      {monthName} {year}
                    </h3>
                    <p className="text-[9px] font-mono text-zinc-400">{dateSpanLabel}</p>
                  </div>

                  <div className="relative z-10 my-auto space-y-3 py-2">
                    <div
                      className={`p-3 rounded-2xl border ${
                        isDarkCanvas ? "bg-zinc-900/80 border-zinc-800" : "bg-white border-zinc-300"
                      }`}
                    >
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-xs font-mono font-bold uppercase text-zinc-400">
                          Total Mileage
                        </span>
                        <span className="text-2xl font-black font-mono text-amber-400">
                          {stats.totalDistKm} km
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-mono font-bold uppercase text-zinc-400">
                          Total Elevation
                        </span>
                        <span className="text-xl font-black font-mono text-emerald-400">
                          +{stats.totalGainM.toLocaleString()} m
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs font-mono">
                      <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 flex justify-between items-center">
                        <span className="text-orange-400 font-bold flex items-center gap-1">
                          <Footprints className="h-3 w-3" /> Road Engine:
                        </span>
                        <span>
                          {stats.road.distKm} km • {stats.road.count} sesi
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 flex justify-between items-center">
                        <span className="text-cyan-400 font-bold flex items-center gap-1">
                          <Mountain className="h-3 w-3" /> Trail Vert:
                        </span>
                        <span>
                          {stats.trail.distKm} km • +{stats.trail.gainM}m
                        </span>
                      </div>
                    </div>

                    {stats.longestRun && (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono">
                        <span className="text-amber-400 font-bold block">
                          ⭐ Highlight Session:
                        </span>
                        <span className="truncate block font-semibold text-zinc-200">
                          {stats.longestRun.name} ({stats.longestRun.distanceKm}km)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 pt-2 border-t border-amber-500/30 flex justify-between items-center text-[10px] font-mono text-zinc-400">
                    <span>{stats.activeDays} ACTIVE DAYS</span>
                    <span className="text-amber-400 font-bold">ALLTERRAIN</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions: Download PNG & Copy */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t-2 border-zinc-200">
          <div className="text-[11px] font-mono text-zinc-500">
            <span>{language === "en" ? "Ready for Instagram Stories & Feed" : "Siap untuk IG Story & Feed"}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF9F5] hover:bg-zinc-100 border-2 border-zinc-950 font-black text-xs text-zinc-950 shadow-[2px_2px_0px_0px_#09090b] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                  <span>{language === "en" ? "Copied!" : "Disalin!"}</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>{language === "en" ? "Copy" : "Salin"}</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 border-2 border-zinc-950 font-black text-xs text-white shadow-[2px_2px_0px_0px_#09090b] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            >
              <Download className="h-4 w-4 stroke-[2.5]" />
              <span>
                {isExporting
                  ? language === "en"
                    ? "Generating..."
                    : "Memproses..."
                  : language === "en"
                  ? "Download HD (3x)"
                  : "Unduh HD (3x)"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
