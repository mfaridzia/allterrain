"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  X,
  Download,
  Copy,
  Check,
  Share2,
  Mountain,
  Bike,
  Footprints,
  Dumbbell,
  Heart,
  Zap,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Camera,
  Upload,
  Trash2,
  SlidersHorizontal,
  Flame,
  Gauge,
  Terminal,
  FileText,
  Flag,
  Sparkle,
} from "lucide-react";
import { ActivityItem } from "./ActivityFeed";
import {
  formatPace,
  calculateKmEffort,
  calculateDecouplingAnalysis,
  formatDurationTime,
} from "@/lib/analytics";
import { toPng } from "html-to-image";
import { useTranslation } from "@/lib/i18n/context";

interface ActivityShareModalProps {
  activity: ActivityItem | null;
  onClose: () => void;
}

interface LatLng {
  lat: number;
  lng: number;
}

export type ShareTemplateId =
  | "cockpit"
  | "minimal"
  | "mountain"
  | "terminal"
  | "trademark"
  | "bib"
  | "journal"
  | "poster";

/**
 * Convert authentic GPS coordinates (lat/lng) into normalized SVG coordinates (x, y)
 * preserving real geographical aspect ratio via equirectangular projection with cosine latitude scaling.
 */
function convertGpsToSvgPath(
  points: LatLng[],
  width: number,
  height: number
) {
  if (!points || points.length < 2) return null;

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const dLat = maxLat - minLat;
  const midLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const cosMidLat = Math.cos(midLatRad);
  const dLng = (maxLng - minLng) * cosMidLat;

  if (dLat < 0.00001 && dLng < 0.00001) return null;

  const padding = 28;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  const scale = Math.min(
    usableW / (dLng || 0.0001),
    usableH / (dLat || 0.0001)
  );

  const actualW = dLng * scale;
  const actualH = dLat * scale;
  const offsetX = padding + (usableW - actualW) / 2;
  const offsetY = padding + (usableH - actualH) / 2;

  const projected = points.map((p) => {
    const normLng = (p.lng - minLng) * cosMidLat;
    const normLat = maxLat - p.lat;
    return {
      x: offsetX + normLng * scale,
      y: offsetY + normLat * scale,
    };
  });

  let pathD = `M ${projected[0].x.toFixed(1)},${projected[0].y.toFixed(1)}`;
  for (let i = 1; i < projected.length; i++) {
    pathD += ` L ${projected[i].x.toFixed(1)},${projected[i].y.toFixed(1)}`;
  }

  return {
    pathD,
    startPoint: projected[0],
    endPoint: projected[projected.length - 1],
    pointCount: projected.length,
  };
}

/**
 * Generate a realistic Heart Rate & Intensity Curve SVG for gym/strength sessions
 */
function generateHeartRateWaveform(
  avgHr: number,
  maxHr: number,
  durationMin: number,
  width: number,
  height: number
) {
  const paddingX = 24;
  const paddingTop = 24;
  const paddingBottom = 20;
  const usableW = width - paddingX * 2;
  const usableH = height - paddingTop - paddingBottom;

  const minHr = Math.max(80, Math.round(avgHr * 0.72));
  const safeMaxHr = Math.max(maxHr, avgHr + 15);
  const hrRange = safeMaxHr - minHr || 1;

  const segments = 24;
  const points: { x: number; y: number; hr: number }[] = [];

  let highestPt = { x: 0, y: height, hr: 0 };

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = paddingX + t * usableW;

    let hrVal: number;
    if (t < 0.12) {
      hrVal = minHr + (avgHr - minHr) * (t / 0.12);
    } else if (t > 0.9) {
      hrVal = avgHr - (avgHr - minHr) * ((t - 0.9) / 0.1);
    } else {
      const wave = Math.sin(t * Math.PI * 8);
      const intensity = Math.sin(t * Math.PI);
      hrVal = avgHr + wave * 16 + intensity * (safeMaxHr - avgHr - 8);
    }

    hrVal = Math.min(safeMaxHr, Math.max(minHr, Math.round(hrVal)));
    const y = paddingTop + (1 - (hrVal - minHr) / hrRange) * usableH;

    const pt = { x, y, hr: hrVal };
    points.push(pt);

    if (hrVal > highestPt.hr) {
      highestPt = pt;
    }
  }

  let lineD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    lineD += ` Q ${prev.x.toFixed(1)},${prev.y.toFixed(1)} ${midX.toFixed(1)},${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  lineD += ` T ${last.x.toFixed(1)},${last.y.toFixed(1)}`;

  const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)},${(height - paddingBottom).toFixed(1)} L ${points[0].x.toFixed(1)},${(height - paddingBottom).toFixed(1)} Z`;
  const avgY = paddingTop + (1 - (avgHr - minHr) / hrRange) * usableH;

  return { lineD, areaD, highestPt, avgY, minHr, safeMaxHr };
}

export const ActivityShareModal: React.FC<ActivityShareModalProps> = ({
  activity,
  onClose,
}) => {
  const [template, setTemplate] = useState<ShareTemplateId>("cockpit");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1">("9:16");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [overlayDim, setOverlayDim] = useState<"subtle" | "balanced" | "deep">("balanced");
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language } = useTranslation();

  if (!activity) return null;

  const isStrength =
    activity.sportType === "strength" ||
    activity.sportType === "gym" ||
    activity.sportType === "weight";
  const isBike = activity.sportType === "bike" || activity.sportType === "cycling";
  const isTrail = activity.sportType === "trail_run" || activity.elevationGain > 200;
  const decoupling = calculateDecouplingAnalysis(activity);

  const activityDate = new Date(activity.startTime);
  const dayName = activityDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const dayNameFull = activityDate.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const formattedDate = activityDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formattedTime = activityDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Calculate route or heart rate visual dimensions
  const svgWidth = aspectRatio === "9:16" ? 312 : 340;
  const svgHeight = aspectRatio === "9:16"
    ? template === "minimal" || template === "trademark" ? 220 : template === "mountain" ? 240 : 250
    : 140;

  const [gpsPoints, setGpsPoints] = useState<LatLng[] | null>(null);
  const [isLoadingGps, setIsLoadingGps] = useState(false);

  useEffect(() => {
    if (!activity) return;

    let isMounted = true;
    setIsLoadingGps(true);

    fetch(`/api/activities/track?id=${activity.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.isRealGps && Array.isArray(data.points) && data.points.length > 1) {
          setGpsPoints(data.points);
        } else {
          setGpsPoints(null);
        }
      })
      .catch((err) => {
        console.warn("Could not load GPS track:", err);
        if (isMounted) setGpsPoints(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingGps(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activity?.id]);

  const realRouteData = useMemo(() => {
    if (isStrength || !gpsPoints || gpsPoints.length < 2) return null;
    return convertGpsToSvgPath(gpsPoints, svgWidth, svgHeight);
  }, [gpsPoints, svgWidth, svgHeight, isStrength]);

  const hrWaveData = useMemo(() => {
    return generateHeartRateWaveform(
      activity.avgHr || 135,
      activity.maxHr || 165,
      activity.durationMin || 45,
      svgWidth,
      svgHeight
    );
  }, [activity.avgHr, activity.maxHr, activity.durationMin, svgWidth, svgHeight]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBgImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setBgImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3, // Crisp 3x retina export for Instagram
        quality: 1,
        cacheBust: true,
        backgroundColor: bgImage ? undefined : theme === "dark" ? "#0B0D10" : "#FAF8F5",
      });

      const cleanName = activity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const link = document.createElement("a");
      link.download = `allterrain-${cleanName}-${template}-${aspectRatio === "9:16" ? "story" : "post"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download share image:", err);
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

  const sportBadgeLabel = isStrength
    ? "GYM / STRENGTH"
    : isBike
    ? "CYCLING"
    : isTrail
    ? "TRAIL RUN"
    : "ROAD RUN";

  const durationFormatted = formatDurationTime(
    activity.durationSeconds ?? activity.durationMin * 60
  );

  const speedOrPace = isBike
    ? activity.avgPaceSec > 0
      ? `${Math.round((3600 / activity.avgPaceSec) * 10) / 10} km/h`
      : "--"
    : `${formatPace(activity.avgPaceSec)} /km`;

  const isDarkCanvas = bgImage || theme === "dark";

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-xl w-full bg-white rounded-3xl border-2 border-zinc-950 p-4 sm:p-6 space-y-4 shadow-[8px_8px_0px_0px_#09090b] my-auto max-h-[94dvh] overflow-y-auto">
        {/* Header Controls */}
        <div className="flex items-center justify-between border-b-2 border-zinc-200 pb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Share2 className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-black text-zinc-950 leading-tight truncate">
                {language === "en" ? "Share Workout Card" : "Bagikan Kartu Latihan"}
              </h2>
              <p className="text-[10px] sm:text-[11px] font-medium text-zinc-500 truncate">
                {language === "en"
                  ? "Pick from 8 curated styles or overlay onto your running photo"
                  : "Pilih 8 gaya visual unik atau pasang foto lari kamu"}
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-wider text-zinc-500">
              {language === "en" ? "Style & Tags Presets:" : "Pilihan Style & Tag:"}
            </span>
            {bgImage && (
              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Custom Photo
              </span>
            )}
          </div>

          {/* Group 1: Telemetry Layouts */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTemplate("cockpit")}
              className={`py-1.5 px-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "cockpit"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Cockpit</span>
            </button>

            <button
              onClick={() => setTemplate("minimal")}
              className={`py-1.5 px-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "minimal"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Minimal</span>
            </button>

            <button
              onClick={() => setTemplate("mountain")}
              className={`py-1.5 px-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "mountain"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <Mountain className="h-3.5 w-3.5 text-cyan-500" />
              <span>Mountain</span>
            </button>
          </div>

          {/* Group 2: Aesthetic / Creative Tags */}
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-zinc-100">
            <button
              onClick={() => setTemplate("terminal")}
              className={`py-1.5 px-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "terminal"
                  ? "bg-zinc-950 text-emerald-400 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <Terminal className="h-3.5 w-3.5 text-emerald-500" />
              <span>JSON 200</span>
            </button>

            <button
              onClick={() => setTemplate("trademark")}
              className={`py-1.5 px-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "trademark"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <span className="font-mono text-xs font-black">KM®</span>
              <span>Streetwear</span>
            </button>

            <button
              onClick={() => setTemplate("bib")}
              className={`py-1.5 px-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "bib"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <Flag className="h-3.5 w-3.5 text-orange-500" />
              <span>Finish Arch</span>
            </button>

            <button
              onClick={() => setTemplate("journal")}
              className={`py-1.5 px-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "journal"
                  ? "bg-amber-300 text-zinc-950 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-amber-600" />
              <span>Highlighter</span>
            </button>

            <button
              onClick={() => setTemplate("poster")}
              className={`py-1.5 px-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                template === "poster"
                  ? "bg-rose-600 text-white border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                  : "bg-[#FAF9F5] border-zinc-300 text-zinc-700 hover:border-zinc-950"
              }`}
            >
              <span className="text-[10px] font-mono font-black text-rose-500">POSTER</span>
              <span>Condensed</span>
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
              <span>{bgImage ? (language === "en" ? "Change Photo" : "Ganti Foto") : (language === "en" ? "Upload Photo" : "Pasang Foto Latar")}</span>
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
          {/* Card Presentation Frame */}
          <div className="rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_#09090b] border-2 border-zinc-950 shrink-0">
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
              {/* Optional Custom Runner Photo Background */}
              {bgImage ? (
                <>
                  <img
                    src={bgImage}
                    alt="Workout background"
                    className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
                  />
                  <div
                    className={`absolute inset-0 z-0 pointer-events-none ${
                      overlayDim === "subtle"
                        ? "bg-black/35"
                        : overlayDim === "deep"
                        ? "bg-black/75"
                        : "bg-black/55"
                    }`}
                  />
                  <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/85 to-transparent z-0 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-0 pointer-events-none" />
                </>
              ) : theme === "dark" ? (
                <div className="absolute top-0 right-0 w-44 h-44 bg-orange-600/10 blur-3xl pointer-events-none rounded-full" />
              ) : null}

              {/* ========================================================= */}
              {/* 1. COCKPIT TEMPLATE (Classic Telemetry Grid)             */}
              {/* ========================================================= */}
              {template === "cockpit" && (
                <>
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
                            COROS EVOLAB
                          </span>
                        </div>
                      </div>

                      <div
                        className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                          isStrength
                            ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                            : isBike
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : isTrail
                            ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                            : "bg-orange-500/20 text-orange-400 border-orange-500/40"
                        }`}
                      >
                        {isStrength ? (
                          <Dumbbell className="h-3 w-3 stroke-[2.5]" />
                        ) : isBike ? (
                          <Bike className="h-3 w-3 stroke-[2.5]" />
                        ) : isTrail ? (
                          <Mountain className="h-3 w-3 stroke-[2.5]" />
                        ) : (
                          <Footprints className="h-3 w-3 stroke-[2.5]" />
                        )}
                        <span>{sportBadgeLabel}</span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <h3 className="text-base sm:text-lg font-black tracking-tight line-clamp-1 leading-snug">
                        {activity.name}
                      </h3>
                      <p
                        className={`text-[10px] font-mono ${
                          isDarkCanvas ? "text-zinc-300" : "text-zinc-600"
                        }`}
                      >
                        {formattedDate} • {formattedTime}
                      </p>
                    </div>
                  </div>

                  {/* Center Visual Art */}
                  <div
                    className={`relative z-10 flex-1 my-2 flex items-center justify-center rounded-2xl border ${
                      isDarkCanvas
                        ? "bg-zinc-900/50 border-zinc-800/80 backdrop-blur-sm"
                        : "bg-white border-zinc-300"
                    } overflow-hidden`}
                  >
                    {realRouteData ? (
                      <div className="relative w-full h-full flex items-center justify-center p-2">
                        <svg
                          width="100%"
                          height="100%"
                          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                          className="overflow-visible"
                        >
                          <path
                            d={realRouteData.pathD}
                            fill="none"
                            stroke={isDarkCanvas ? "#FF5500" : "#EA580C"}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx={realRouteData.startPoint.x} cy={realRouteData.startPoint.y} r="4.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
                          <circle cx={realRouteData.endPoint.x} cy={realRouteData.endPoint.y} r="5" fill="#F97316" stroke="#FFFFFF" strokeWidth="2" />
                        </svg>

                        <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[8px] font-mono font-bold">
                          <span className="text-emerald-500">● START</span>
                          <span className="text-zinc-500">•</span>
                          <span className="text-orange-500">● FINISH</span>
                        </div>

                        {activity.elevationGain > 0 && (
                          <div className="absolute bottom-2 right-3 text-[9px] font-mono font-black text-emerald-500 flex items-center gap-0.5">
                            <ArrowUpRight className="h-3 w-3 stroke-[3]" />
                            +{activity.elevationGain}m D+
                          </div>
                        )}
                      </div>
                    ) : hrWaveData ? (
                      <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
                        <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
                          <path d={hrWaveData.areaD} fill="rgba(239, 68, 68, 0.2)" />
                          <path d={hrWaveData.lineD} fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
                          <circle cx={hrWaveData.highestPt.x} cy={hrWaveData.highestPt.y} r="4" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
                        </svg>
                      </div>
                    ) : null}
                  </div>

                  {/* Bottom Metrics */}
                  <div className="relative z-10 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className={`p-2.5 rounded-xl border ${isDarkCanvas ? "bg-zinc-900/80 border-zinc-800" : "bg-white border-zinc-300"}`}>
                        <span className="text-[9px] font-bold block text-zinc-400 uppercase">Distance</span>
                        <span className="text-lg font-black font-mono leading-none">{activity.distanceKm}<span className="text-[10px] ml-0.5 font-normal text-zinc-400">km</span></span>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${isDarkCanvas ? "bg-zinc-900/80 border-zinc-800" : "bg-white border-zinc-300"}`}>
                        <span className="text-[9px] font-bold block text-zinc-400 uppercase">{isBike ? "Speed" : "Pace"}</span>
                        <span className="text-base font-black font-mono text-orange-500 leading-none">{speedOrPace}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${isDarkCanvas ? "bg-zinc-900/80 border-zinc-800" : "bg-white border-zinc-300"}`}>
                        <span className="text-[9px] font-bold block text-zinc-400 uppercase">Duration</span>
                        <span className="text-base font-black font-mono leading-none">{durationFormatted}</span>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between text-[10px] font-mono px-1.5 pt-1.5 border-t ${isDarkCanvas ? "text-zinc-400 border-zinc-800/80" : "text-zinc-600 border-zinc-200"}`}>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Heart className="h-3 w-3 text-rose-500 fill-current shrink-0" />
                        <span>Avg {activity.avgHr} bpm</span>
                      </div>
                      <div className="flex items-center gap-1 text-orange-500 font-bold shrink-0">
                        <Zap className="h-3 w-3 fill-current shrink-0" />
                        <span>TL {activity.trainingLoad}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 2. MINIMAL TEMPLATE (Hero Bold Numbers)                   */}
              {/* ========================================================= */}
              {template === "minimal" && (
                <>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black font-sans tracking-widest text-orange-500">▲</span>
                      <span className="text-xs font-black tracking-widest font-sans">ALLTERRAIN</span>
                    </div>
                    <span className={`text-[10px] font-mono ${isDarkCanvas ? "text-zinc-400" : "text-zinc-500"}`}>
                      {formattedDate}
                    </span>
                  </div>

                  <div className="relative z-10 my-auto text-center space-y-1 py-3">
                    <div className="text-6xl sm:text-7xl font-black font-mono tracking-tighter leading-none flex items-baseline justify-center">
                      <span>{activity.distanceKm}</span>
                      <span className="text-xl sm:text-2xl font-black text-orange-500 ml-1.5 font-sans">KM</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black tracking-tight line-clamp-1 opacity-90">
                      {activity.name}
                    </h3>
                  </div>

                  <div className="relative z-10 flex-1 my-1 flex items-center justify-center overflow-hidden">
                    {realRouteData && (
                      <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible opacity-90">
                        <path d={realRouteData.pathD} fill="none" stroke={isDarkCanvas ? "#FF5500" : "#EA580C"} strokeWidth="3.5" strokeLinecap="round" />
                        <circle cx={realRouteData.startPoint.x} cy={realRouteData.startPoint.y} r="4" fill="#10B981" />
                        <circle cx={realRouteData.endPoint.x} cy={realRouteData.endPoint.y} r="4" fill="#FF5500" />
                      </svg>
                    )}
                  </div>

                  <div className="relative z-10">
                    <div className={`p-3 rounded-2xl border flex items-center justify-around font-mono text-center ${isDarkCanvas ? "bg-zinc-900/80 border-zinc-800 backdrop-blur-md" : "bg-white border-zinc-300 shadow-sm"}`}>
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 block uppercase">Pace</span>
                        <span className="text-sm font-black text-orange-500">{speedOrPace}</span>
                      </div>
                      <div className="h-6 w-px bg-zinc-700/40" />
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 block uppercase">Time</span>
                        <span className="text-sm font-black">{durationFormatted}</span>
                      </div>
                      <div className="h-6 w-px bg-zinc-700/40" />
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 block uppercase">HR</span>
                        <span className="text-sm font-black text-rose-500">{activity.avgHr} bpm</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 3. MOUNTAIN TEMPLATE (Trail & Vert Beast)                */}
              {/* ========================================================= */}
              {template === "mountain" && (
                <>
                  <div className="relative z-10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black tracking-widest text-cyan-500">
                        <Mountain className="h-4 w-4 stroke-[2.5]" />
                        <span>TRAIL TELEMETRY</span>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
                        MINETTI MODEL
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className={`p-2.5 rounded-xl border ${isDarkCanvas ? "bg-zinc-900/80 border-cyan-500/30" : "bg-white border-cyan-600/30"}`}>
                        <span className="text-[9px] font-bold text-cyan-400 uppercase flex items-center gap-1">
                          <ArrowUpRight className="h-3 w-3 stroke-[3]" />
                          Elevation Gain
                        </span>
                        <div className="text-2xl font-black font-mono text-cyan-400 leading-tight mt-0.5">
                          +{activity.elevationGain}m
                        </div>
                      </div>

                      <div className={`p-2.5 rounded-xl border ${isDarkCanvas ? "bg-zinc-900/80 border-zinc-800" : "bg-white border-zinc-300"}`}>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1">
                          <Gauge className="h-3 w-3" />
                          VAM Speed
                        </span>
                        <div className="text-2xl font-black font-mono leading-tight mt-0.5">
                          {activity.vam || Math.round(activity.elevationGain / ((activity.durationSeconds || 3600) / 3600))} <span className="text-xs font-normal text-zinc-400">m/h</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`relative z-10 flex-1 my-2 flex items-center justify-center rounded-2xl border ${isDarkCanvas ? "bg-zinc-900/50 border-cyan-500/20" : "bg-cyan-50/50 border-cyan-200"} overflow-hidden`}>
                    {realRouteData && (
                      <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
                        <path d={realRouteData.pathD} fill="none" stroke="#06B6D4" strokeWidth="4" strokeLinecap="round" />
                        <circle cx={realRouteData.startPoint.x} cy={realRouteData.startPoint.y} r="5" fill="#10B981" />
                        <circle cx={realRouteData.endPoint.x} cy={realRouteData.endPoint.y} r="5" fill="#F97316" />
                      </svg>
                    )}
                  </div>

                  <div className="relative z-10 grid grid-cols-3 gap-2">
                    <div className={`p-2 rounded-xl border text-center ${isDarkCanvas ? "bg-zinc-900/80 border-zinc-800" : "bg-white border-zinc-300"}`}>
                      <span className="text-[8px] font-bold text-zinc-400 block uppercase">Distance</span>
                      <span className="text-base font-black font-mono">{activity.distanceKm} km</span>
                    </div>
                    <div className={`p-2 rounded-xl border text-center ${isDarkCanvas ? "bg-zinc-900/80 border-zinc-800" : "bg-white border-zinc-300"}`}>
                      <span className="text-[8px] font-bold text-zinc-400 block uppercase">Time</span>
                      <span className="text-base font-black font-mono">{durationFormatted}</span>
                    </div>
                    <div className={`p-2 rounded-xl border text-center ${isDarkCanvas ? "bg-zinc-900/80 border-zinc-800" : "bg-white border-zinc-300"}`}>
                      <span className="text-[8px] font-bold text-zinc-400 block uppercase">Pace</span>
                      <span className="text-base font-black font-mono text-cyan-400">{speedOrPace}</span>
                    </div>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 4. TERMINAL TEMPLATE (JSON Hacker / Dev Telemetry)         */}
              {/* ========================================================= */}
              {template === "terminal" && (
                <>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-400 font-mono">▲LT:~$</span>
                      <span className="text-xs font-mono font-bold text-zinc-300">curl /api/workout/latest</span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                      HTTP 200 OK
                    </span>
                  </div>

                  {/* Code Editor Window */}
                  <div className="relative z-10 flex-1 my-3 p-4 rounded-2xl bg-[#0F1117]/95 border-2 border-zinc-800 font-mono text-xs shadow-2xl flex flex-col justify-between overflow-hidden">
                    {/* Window Controls */}
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[10px] text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                      </div>
                      <span>allterrain-run.json</span>
                    </div>

                    {/* JSON Body */}
                    <div className="space-y-1 py-2 leading-relaxed text-zinc-300">
                      <div><span className="text-zinc-600">&#123;</span></div>
                      <div className="pl-4">
                        <span className="text-sky-400">&quot;activity&quot;</span>: <span className="text-emerald-400">&quot;{activity.name}&quot;</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">&quot;distance_km&quot;</span>: <span className="text-amber-400 font-bold">{activity.distanceKm}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">&quot;avg_pace&quot;</span>: <span className="text-emerald-400">&quot;{speedOrPace}&quot;</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">&quot;moving_time&quot;</span>: <span className="text-emerald-400">&quot;{durationFormatted}&quot;</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">&quot;avg_hr&quot;</span>: <span className="text-amber-400 font-bold">{activity.avgHr}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">&quot;training_load&quot;</span>: <span className="text-amber-400 font-bold">{activity.trainingLoad}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-sky-400">&quot;day&quot;</span>: <span className="text-emerald-400">&quot;{dayNameFull}&quot;</span>
                      </div>
                      <div><span className="text-zinc-600">&#125;</span></div>
                    </div>

                    {/* Route Line overlay in bottom corner of terminal */}
                    {realRouteData && (
                      <div className="h-16 w-full flex items-center justify-end pr-2 pt-1 opacity-70">
                        <svg width="120" height="50" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
                          <path d={realRouteData.pathD} fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-zinc-400 px-1">
                    <span>// ALLTERRAIN TELEMETRY ENGINE</span>
                    <span>{formattedDate}</span>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 5. TRADEMARK TEMPLATE (Streetwear 10.03 KM®)               */}
              {/* ========================================================= */}
              {template === "trademark" && (
                <>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="text-[10px] font-black tracking-widest uppercase font-mono">
                      ALLTERRAIN LABS™
                    </div>
                    <span className="text-[9px] font-mono text-zinc-400">
                      REF: {activity.id.slice(-6).toUpperCase()}
                    </span>
                  </div>

                  {/* Center Hero: 10.03 KM® */}
                  <div className="relative z-10 my-auto space-y-3">
                    <div>
                      <div className="text-5xl sm:text-6xl font-black font-sans tracking-tight leading-none flex items-baseline">
                        <span>{activity.distanceKm}</span>
                        <span className="text-3xl sm:text-4xl font-black ml-1">KM</span>
                        <span className="text-base sm:text-lg font-mono font-bold align-super ml-0.5 text-orange-500">®</span>
                      </div>
                      <div className="text-xs sm:text-sm font-mono uppercase tracking-widest text-zinc-400 mt-1">
                        &quot;{activity.name.toUpperCase()}&quot;
                      </div>
                    </div>

                    {/* Route Line clean stroke */}
                    {realRouteData && (
                      <div className="py-2">
                        <svg width="100%" height="80" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible opacity-90">
                          <path d={realRouteData.pathD} fill="none" stroke={isDarkCanvas ? "#FFFFFF" : "#09090B"} strokeWidth="4" strokeLinecap="round" />
                          <circle cx={realRouteData.startPoint.x} cy={realRouteData.startPoint.y} r="4.5" fill="#10B981" />
                          <circle cx={realRouteData.endPoint.x} cy={realRouteData.endPoint.y} r="5" fill="#F97316" />
                        </svg>
                      </div>
                    )}

                    {/* Industrial Spec Lines */}
                    <div className="space-y-1 text-xs font-mono font-bold border-t-2 border-current pt-2.5">
                      <div className="flex justify-between">
                        <span>AVERAGE PACE</span>
                        <span className="text-orange-500">{speedOrPace}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ELAPSED TIME</span>
                        <span>{durationFormatted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>HEART RATE</span>
                        <span>{activity.avgHr} BPM</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center justify-between text-[8px] font-mono tracking-wider opacity-60">
                    <span>DESIGNED FOR ALLTERRAIN RUNNING COMMUNITY</span>
                    <span>{formattedDate}</span>
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 6. BIB TEMPLATE (Race Bib / Finish Line Arch)              */}
              {/* ========================================================= */}
              {template === "bib" && (
                <>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black tracking-wider">
                      <span>▲LT</span>
                      <span>//</span>
                      <span>RACE DAY</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold">{formattedDate}</span>
                  </div>

                  {/* The Finish Line Arch Block */}
                  <div className="relative z-10 my-auto rounded-2xl overflow-hidden border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b]">
                    {/* Top Black Bar: FINISH */}
                    <div className="bg-zinc-950 text-white text-center py-2 text-xs sm:text-sm font-black tracking-widest uppercase flex items-center justify-center gap-2">
                      <Flag className="h-4 w-4 text-orange-500" />
                      <span>FINISH LINE</span>
                    </div>

                    {/* Center White Bar: 10.03 KM */}
                    <div className="bg-white text-zinc-950 text-center py-6 sm:py-8 px-4">
                      <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight leading-none">
                        {activity.distanceKm} <span className="text-2xl font-sans text-orange-600">KM</span>
                      </div>
                      <p className="text-xs font-bold text-zinc-600 mt-2 font-mono truncate">
                        {activity.name}
                      </p>
                    </div>

                    {/* Bottom Black Bar: Duration & Pace */}
                    <div className="bg-zinc-950 text-white p-3 font-mono text-center grid grid-cols-3 gap-1 text-xs border-t-2 border-zinc-950">
                      <div>
                        <span className="text-[9px] text-zinc-400 block">TIME</span>
                        <span className="font-black text-sm">{durationFormatted}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 block">PACE</span>
                        <span className="font-black text-sm text-orange-400">{speedOrPace}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 block">AVG HR</span>
                        <span className="font-black text-sm text-rose-400">{activity.avgHr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Route Line Silhouette below Arch */}
                  <div className="relative z-10 flex items-center justify-center h-16 overflow-hidden">
                    {realRouteData && (
                      <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible opacity-70">
                        <path d={realRouteData.pathD} fill="none" stroke={isDarkCanvas ? "#FF5500" : "#09090B"} strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 7. JOURNAL TEMPLATE (Editorial & Highlighter)             */}
              {/* ========================================================= */}
              {template === "journal" && (
                <>
                  <div className="relative z-10 flex items-center justify-between border-b-2 border-current pb-2">
                    <span className="font-serif italic font-black text-base sm:text-lg">The Running Dispatch</span>
                    <span className="font-mono text-[10px] uppercase font-bold">{dayName}, {formattedDate}</span>
                  </div>

                  {/* Editorial Text with Highlight Marks */}
                  <div className="relative z-10 my-auto p-4 sm:p-5 rounded-2xl bg-white/90 text-zinc-950 border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-3 font-serif">
                    <p className="text-base sm:text-lg leading-relaxed">
                      Completed{" "}
                      <mark className="bg-amber-300 text-zinc-950 px-1.5 py-0.5 rounded font-black font-mono not-italic text-lg">
                        {activity.distanceKm} km
                      </mark>
                      , averaging a{" "}
                      <mark className="bg-amber-300 text-zinc-950 px-1.5 py-0.5 rounded font-black font-mono not-italic text-lg">
                        {speedOrPace}
                      </mark>{" "}
                      effort across {durationFormatted} of steady running.
                    </p>

                    <p className="text-xs text-zinc-600 font-sans leading-relaxed border-t border-zinc-200 pt-2 font-medium">
                      Workout registered a cardiovascular intensity of{" "}
                      <strong className="text-zinc-950 font-mono">{activity.avgHr} bpm</strong> with{" "}
                      <strong className="text-zinc-950 font-mono">{activity.trainingLoad} Training Load</strong>.
                    </p>

                    <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-zinc-500 font-bold uppercase">
                      <span>— ALLTERRAIN ATHLETIC DEPT.</span>
                      <span>COROS EVOLAB</span>
                    </div>
                  </div>

                  {/* Route Accent */}
                  <div className="relative z-10 flex items-center justify-center h-16">
                    {realRouteData && (
                      <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible opacity-60">
                        <path d={realRouteData.pathD} fill="none" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                </>
              )}

              {/* ========================================================= */}
              {/* 8. POSTER TEMPLATE (Condensed Gig Poster)                 */}
              {/* ========================================================= */}
              {template === "poster" && (
                <>
                  <div className="relative z-10 flex items-center justify-between text-[10px] font-mono font-bold tracking-widest">
                    <span className="text-rose-500">▲ ALLTERRAIN // ISSUE #{activity.id.slice(-4)}</span>
                    <span>{formattedTime}</span>
                  </div>

                  {/* Giant Condensed Text Stack */}
                  <div className="relative z-10 my-auto text-center space-y-0.5 font-black uppercase tracking-tight">
                    <div className="text-2xl sm:text-3xl text-rose-500 leading-none font-mono">
                      {dayNameFull}
                    </div>
                    <div className="text-xl sm:text-2xl leading-none truncate opacity-90 font-sans">
                      {activity.name}
                    </div>
                    <div className="text-6xl sm:text-7xl font-mono tracking-tighter leading-none py-2 text-current">
                      {activity.distanceKm}KM
                    </div>
                    <div className="text-2xl sm:text-3xl font-mono leading-none text-orange-500">
                      {speedOrPace}
                    </div>
                    <div className="text-3xl sm:text-4xl font-mono leading-none pt-1">
                      {durationFormatted}
                    </div>
                    <div className="text-sm font-mono text-zinc-400 pt-1">
                      HEART RATE {activity.avgHr} BPM • LOAD {activity.trainingLoad}
                    </div>
                  </div>

                  {/* Route Outline footer */}
                  <div className="relative z-10 flex items-center justify-center h-14">
                    {realRouteData && (
                      <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible opacity-50">
                        <path d={realRouteData.pathD} fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Download PNG & Copy to Clipboard */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={handleDownload}
            disabled={isExporting || isLoadingGps}
            className="flex-1 w-full py-3 px-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs sm:text-sm border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Download className="h-4 w-4 stroke-[2.5]" />
            <span>
              {isExporting
                ? (language === "en" ? "Rendering Image..." : "Menyiapkan Gambar...")
                : isLoadingGps
                ? (language === "en" ? "Syncing GPS..." : "Sinkronisasi GPS...")
                : (language === "en" ? "Download Image (PNG)" : "Unduh Gambar (PNG)")}
            </span>
          </button>

          <button
            onClick={handleCopy}
            disabled={isExporting || isLoadingGps}
            className="flex-1 w-full py-3 px-4 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-950 font-black text-xs sm:text-sm border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                <span className="text-emerald-700">
                  {language === "en" ? "Copied to Clipboard!" : "Tersalin ke Clipboard!"}
                </span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 stroke-[2.5]" />
                <span>{language === "en" ? "Copy Image" : "Salin Gambar"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
