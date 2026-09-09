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
} from "lucide-react";
import { ActivityItem } from "./ActivityFeed";
import { formatPace, calculateKmEffort, calculateDecouplingAnalysis } from "@/lib/analytics";
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

  const padding = 32;
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
    const normLat = maxLat - p.lat; // Latitude increases North, SVG Y increases Down
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
  const paddingTop = 28;
  const paddingBottom = 24;
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
      // Warm-up ramp
      hrVal = minHr + (avgHr - minHr) * (t / 0.12);
    } else if (t > 0.9) {
      // Cool down
      hrVal = avgHr - (avgHr - minHr) * ((t - 0.9) / 0.1);
    } else {
      // Working sets with rest valleys
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

  // Path for the line
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

  // Area under line
  const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)},${(height - paddingBottom).toFixed(1)} L ${points[0].x.toFixed(1)},${(height - paddingBottom).toFixed(1)} Z`;

  // Horizontal average line Y
  const avgY = paddingTop + (1 - (avgHr - minHr) / hrRange) * usableH;

  return { lineD, areaD, highestPt, avgY, minHr, safeMaxHr };
}

export const ActivityShareModal: React.FC<ActivityShareModalProps> = ({
  activity,
  onClose,
}) => {
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1">("9:16");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { language } = useTranslation();

  if (!activity) return null;

  const isStrength =
    activity.sportType === "strength" ||
    activity.sportType === "gym" ||
    activity.sportType === "weight";
  const isBike = activity.sportType === "bike" || activity.sportType === "cycling";
  const isTrail = activity.sportType === "trail_run" || activity.elevationGain > 200;
  const decoupling = calculateDecouplingAnalysis(activity);

  const distKm = parseFloat(activity.distanceKm) || 0;

  const formattedDate = new Date(activity.startTime).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formattedTime = new Date(activity.startTime).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Calculate route or heart rate visual dimensions
  const svgWidth = aspectRatio === "9:16" ? 312 : 340;
  const svgHeight = aspectRatio === "9:16" ? 250 : 150;

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

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3, // Crisp 3x retina export for Instagram
        quality: 1,
        cacheBust: true,
        backgroundColor: theme === "dark" ? "#0B0D10" : "#FAF8F5",
      });

      const cleanName = activity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const link = document.createElement("a");
      link.download = `allterrain-${cleanName}-${aspectRatio === "9:16" ? "story" : "post"}.png`;
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
        backgroundColor: theme === "dark" ? "#0B0D10" : "#FAF8F5",
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
      // Fallback: download instead
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

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-xl w-full bg-white rounded-3xl border-2 border-zinc-950 p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-[8px_8px_0px_0px_#09090b] my-auto max-h-[92dvh] overflow-y-auto">
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
                  ? "Export high-resolution story & feed cards ready for social media"
                  : "Ekspor kartu story & feed resolusi tinggi untuk media sosial"}
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

        {/* Customization Toolbar: Aspect Ratio & Theme */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#FAF9F5] p-2 sm:p-2.5 rounded-2xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
          {/* Ratio Toggle */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase font-black text-zinc-500 mr-0.5">Ratio:</span>
            <button
              onClick={() => setAspectRatio("9:16")}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-black rounded-xl border transition-all ${
                aspectRatio === "9:16"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  : "border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200"
              }`}
            >
              📱 9:16 Story
            </button>
            <button
              onClick={() => setAspectRatio("1:1")}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-black rounded-xl border transition-all ${
                aspectRatio === "1:1"
                  ? "bg-zinc-950 text-white border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  : "border-transparent text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200"
              }`}
            >
              ⏹️ 1:1 Square
            </button>
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase font-black text-zinc-500 mr-0.5">Theme:</span>
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
        </div>

        {/* Live Card Preview Box (Scrollable horizontally on very small viewports) */}
        <div className="w-full flex justify-center items-center py-2 bg-zinc-200/60 rounded-2xl p-2 sm:p-4 overflow-x-auto max-w-full">
          {/* Card Presentation Frame for Modal Preview */}
          <div className="rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_#09090b] border-2 border-zinc-950 shrink-0">
            {/* TARGET CAPTURE ELEMENT - Full-bleed, borderless, seamless background all the way to the edges */}
            <div
              ref={cardRef}
              style={{
                width: aspectRatio === "9:16" ? "360px" : "380px",
                height: aspectRatio === "9:16" ? "640px" : "380px",
                backgroundColor: theme === "dark" ? "#0B0D10" : "#FAF8F5",
              }}
              className={`relative flex flex-col justify-between p-5 sm:p-6 transition-all select-none ${
                theme === "dark"
                  ? "text-zinc-100"
                  : "text-zinc-950"
              }`}
            >
            {/* Ambient Corner Glow in dark mode */}
            {theme === "dark" && (
              <div className="absolute top-0 right-0 w-44 h-44 bg-orange-600/10 blur-3xl pointer-events-none rounded-full" />
            )}

            {/* Top Brand & Activity Header */}
            <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-between">
                {/* Brand Glyph */}
                <div className="flex items-center gap-2">
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center border font-black text-xs ${
                      theme === "dark"
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
                        theme === "dark" ? "text-zinc-500" : "text-zinc-400"
                      }`}
                    >
                      COROS EVOLAB
                    </span>
                  </div>
                </div>

                {/* Sport Badge */}
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

              {/* Title & Timestamp */}
              <div className="pt-1">
                <h3 className="text-base sm:text-lg font-black tracking-tight line-clamp-1 leading-snug">
                  {activity.name}
                </h3>
                <p
                  className={`text-[10px] font-mono ${
                    theme === "dark" ? "text-zinc-400" : "text-zinc-600"
                  }`}
                >
                  {formattedDate} • {formattedTime}
                </p>
              </div>
            </div>

            {/* Center Visual Art: Route Map Line OR Heart Rate Waveform */}
            <div
              className={`relative z-10 flex-1 my-2 flex items-center justify-center rounded-2xl border ${
                theme === "dark"
                  ? "bg-zinc-900/40 border-zinc-800/80"
                  : "bg-white border-zinc-300"
              } overflow-hidden`}
            >
              {/* Subtle background grid pattern */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    theme === "dark"
                      ? "radial-gradient(#ffffff 1px, transparent 1px)"
                      : "radial-gradient(#09090b 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }}
              />

              {isLoadingGps ? (
                /* Loading authentic GPS track */
                <div className="relative w-full h-full flex flex-col items-center justify-center p-4 gap-2.5">
                  <div className="h-6 w-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase font-semibold animate-pulse">
                    Syncing COROS GPS Track...
                  </span>
                </div>
              ) : realRouteData ? (
                /* Run / Bike: Authentic GPS Route Path SVG */
                <div className="relative w-full h-full flex items-center justify-center p-2">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="overflow-visible"
                  >
                    <defs>
                      <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop
                          offset="0%"
                          stopColor={isBike ? "#10B981" : isTrail ? "#06B6D4" : "#F97316"}
                        />
                        <stop
                          offset="100%"
                          stopColor={isBike ? "#34D399" : isTrail ? "#22D3EE" : "#FF5500"}
                        />
                      </linearGradient>
                    </defs>

                    {/* Outer Glow Route Under-stroke (Dark mode) */}
                    {theme === "dark" && (
                      <path
                        d={realRouteData.pathD}
                        fill="none"
                        stroke={isBike ? "#10B981" : isTrail ? "#06B6D4" : "#FF5500"}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.25"
                        style={{ filter: "blur(4px)" }}
                      />
                    )}

                    {/* Main Sharp Route Line */}
                    <path
                      d={realRouteData.pathD}
                      fill="none"
                      stroke={
                        theme === "dark"
                          ? "url(#routeGrad)"
                          : isBike
                          ? "#059669"
                          : isTrail
                          ? "#0891B2"
                          : "#EA580C"
                      }
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Start Dot (Emerald pulse) */}
                    <circle
                      cx={realRouteData.startPoint.x}
                      cy={realRouteData.startPoint.y}
                      r="4.5"
                      fill="#10B981"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />

                    {/* Finish Dot (Orange/White) */}
                    <circle
                      cx={realRouteData.endPoint.x}
                      cy={realRouteData.endPoint.y}
                      r="5"
                      fill="#F97316"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  </svg>

                  {/* Route Legend Pills */}
                  <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[8px] font-mono font-bold">
                    <span className="flex items-center gap-1 text-emerald-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      START
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="flex items-center gap-1 text-orange-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      FINISH
                    </span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-[7.5px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 font-black tracking-wider">
                      📍 COROS GPS
                    </span>
                  </div>

                  {activity.elevationGain > 0 && (
                    <div className="absolute bottom-2 right-3 text-[9px] font-mono font-black text-emerald-500 flex items-center gap-0.5">
                      <ArrowUpRight className="h-3 w-3 stroke-[3]" />
                      +{activity.elevationGain}m D+
                    </div>
                  )}
                </div>
              ) : hrWaveData ? (
                /* Indoor / Gym / Non-GPS: Authentic Pace & HR Intensity Waveform */
                <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="overflow-visible"
                  >
                    <defs>
                      <linearGradient id="hrGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
                        <stop offset="60%" stopColor="#A855F7" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#A855F7" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="hrStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#A855F7" />
                        <stop offset="50%" stopColor="#F97316" />
                        <stop offset="100%" stopColor="#EF4444" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Average Baseline */}
                    <line
                      x1="24"
                      y1={hrWaveData.avgY}
                      x2={svgWidth - 24}
                      y2={hrWaveData.avgY}
                      stroke={theme === "dark" ? "#52525B" : "#A1A1AA"}
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />

                    {/* Area under curve */}
                    <path d={hrWaveData.areaD} fill="url(#hrGrad)" />

                    {/* Curve Line */}
                    <path
                      d={hrWaveData.lineD}
                      fill="none"
                      stroke="url(#hrStroke)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        filter:
                          theme === "dark"
                            ? "drop-shadow(0 0 6px rgba(239, 68, 68, 0.4))"
                            : "none",
                      }}
                    />

                    {/* Peak Marker Dot & Badge */}
                    <circle
                      cx={hrWaveData.highestPt.x}
                      cy={hrWaveData.highestPt.y}
                      r="4"
                      fill="#EF4444"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  </svg>

                  {/* Bottom legend */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[9px] font-mono text-zinc-500">
                    <span>{isStrength ? "Cardio-Strength Waveform" : "Pace & HR Intensity Profile"}</span>
                    <span>Avg {activity.avgHr} bpm</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bottom Hero Metric Blocks */}
            <div className="relative z-10 space-y-2.5">
              {isStrength ? (
                /* Strength Metric Grid */
                <div className="grid grid-cols-3 gap-2">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      theme === "dark"
                        ? "bg-zinc-900/90 border-zinc-800"
                        : "bg-white border-zinc-300"
                    }`}
                  >
                    <span className="text-[9px] font-bold block text-zinc-500 uppercase">
                      Duration
                    </span>
                    <span className="text-lg font-black font-mono leading-none">
                      {activity.durationMin}
                      <span className="text-[10px] ml-0.5 font-normal text-zinc-400">min</span>
                    </span>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border ${
                      theme === "dark"
                        ? "bg-zinc-900/90 border-zinc-800"
                        : "bg-white border-zinc-300"
                    }`}
                  >
                    <span className="text-[9px] font-bold block text-zinc-500 uppercase">
                      Avg HR
                    </span>
                    <span className="text-sm font-black font-mono text-rose-500 leading-none">
                      {activity.avgHr}
                      <span className="text-[10px] font-normal text-zinc-400"> bpm</span>
                    </span>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border ${
                      theme === "dark"
                        ? "bg-zinc-900/90 border-zinc-800"
                        : "bg-white border-zinc-300"
                    }`}
                  >
                    <span className="text-[9px] font-bold block text-zinc-500 uppercase">
                      Load / TE
                    </span>
                    <span className="text-sm font-black font-mono text-amber-500 leading-none">
                      {activity.trainingLoad}{" "}
                      <span className="text-[9px] font-normal text-zinc-400">
                        ({activity.aerobicTe || 0}A)
                      </span>
                    </span>
                  </div>
                </div>
              ) : (
                /* Run / Bike Metric Grid */
                <div className="grid grid-cols-3 gap-2">
                  {/* Distance (Highlight) */}
                  <div
                    className={`p-2.5 rounded-xl border ${
                      theme === "dark"
                        ? "bg-zinc-900/90 border-zinc-800"
                        : "bg-white border-zinc-300"
                    }`}
                  >
                    <span className="text-[9px] font-bold block text-zinc-500 uppercase">
                      Distance
                    </span>
                    <span className="text-lg font-black font-mono leading-none">
                      {activity.distanceKm}
                      <span className="text-[10px] ml-0.5 font-normal text-zinc-400">km</span>
                    </span>
                  </div>

                  {/* Pace / Speed */}
                  <div
                    className={`p-2.5 rounded-xl border ${
                      theme === "dark"
                        ? "bg-zinc-900/90 border-zinc-800"
                        : "bg-white border-zinc-300"
                    }`}
                  >
                    <span className="text-[9px] font-bold block text-zinc-500 uppercase">
                      {isBike ? "Avg Speed" : "Avg Pace"}
                    </span>
                    <span className="text-base font-black font-mono text-orange-500 leading-none">
                      {isBike
                        ? activity.avgPaceSec > 0
                          ? `${Math.round((3600 / activity.avgPaceSec) * 10) / 10}k/h`
                          : "--"
                        : `${formatPace(activity.avgPaceSec)}`}
                      <span className="text-[9px] font-normal text-zinc-400">
                        {isBike ? "" : "/km"}
                      </span>
                    </span>
                  </div>

                  {/* Moving Time */}
                  <div
                    className={`p-2.5 rounded-xl border ${
                      theme === "dark"
                        ? "bg-zinc-900/90 border-zinc-800"
                        : "bg-white border-zinc-300"
                    }`}
                  >
                    <span className="text-[9px] font-bold block text-zinc-500 uppercase">
                      Duration
                    </span>
                    <span className="text-base font-black font-mono leading-none">
                      {activity.durationMin}
                      <span className="text-[10px] ml-0.5 font-normal text-zinc-400">min</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Mini Footer: Avg HR & Elevation / Load */}
              <div
                className={`flex items-center justify-between text-[10px] font-mono px-1.5 pt-2 border-t ${
                  theme === "dark"
                    ? "text-zinc-400 border-zinc-800/80"
                    : "text-zinc-600 border-zinc-200"
                }`}
              >
                <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                  <Heart className="h-3 w-3 text-rose-500 fill-current shrink-0" />
                  <span className="whitespace-nowrap">
                    Avg {activity.avgHr} bpm
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-bold shrink-0">
                  {decoupling.isApplicable && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border font-mono whitespace-nowrap ${
                        theme === "dark"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-emerald-50 text-emerald-900 border-emerald-300"
                      }`}
                    >
                      Pa:HR {decoupling.decouplingPct > 0 ? `+${decoupling.decouplingPct}%` : `${decoupling.decouplingPct}%`}
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-orange-500 whitespace-nowrap">
                    <Zap className="h-3 w-3 fill-current shrink-0" />
                    <span>TL {activity.trainingLoad}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Action Buttons: Download PNG & Copy to Clipboard */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={handleDownload}
            disabled={isExporting || isLoadingGps}
            className="flex-1 w-full py-3 px-4 rounded-2xl bg-zinc-950 hover:bg-zinc-850 text-white font-black text-xs sm:text-sm border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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
