"use client";

import React, { useMemo, useState } from "react";
import {
  Mountain,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n/context";
import type { UphillScoreResult } from "@/lib/analytics";

interface UphillScoreCardProps {
  uphill?: (UphillScoreResult & { vo2max?: number | null }) | null;
}

function getSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const session = localStorage.getItem("allterrain_session");
    if (session) headers["x-allterrain-session"] = session;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) headers["x-timezone"] = tz;
    } catch {}
  }
  return headers;
}

const BAND_STYLES: Record<
  UphillScoreResult["band"],
  { chip: string; bar: string; text: string }
> = {
  elite: { chip: "bg-rose-200 text-rose-950", bar: "bg-rose-500", text: "text-rose-700" },
  advanced: { chip: "bg-orange-200 text-orange-950", bar: "bg-orange-500", text: "text-orange-700" },
  trained: { chip: "bg-lime-200 text-lime-950", bar: "bg-lime-500", text: "text-lime-700" },
  developing: { chip: "bg-amber-200 text-amber-950", bar: "bg-amber-500", text: "text-amber-700" },
  recreational: { chip: "bg-zinc-200 text-zinc-900", bar: "bg-zinc-500", text: "text-zinc-600" },
};

export const UphillScoreCard: React.FC<UphillScoreCardProps> = ({ uphill }) => {
  const { language } = useTranslation();
  const isEn = language === "en";
  const queryClient = useQueryClient();

  const [showFormula, setShowFormula] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  const status = uphill?.status || "insufficient";
  const hasScore = status !== "insufficient" && uphill?.score != null;
  const band = uphill?.band || "recreational";
  const styles = BAND_STYLES[band];

  const bandLabel = useMemo(() => {
    const labels = isEn
      ? {
          recreational: "Recreational",
          developing: "Developing",
          trained: "Trained",
          advanced: "Advanced",
          elite: "Elite",
        }
      : {
          recreational: "Rekreasi",
          developing: "Berkembang",
          trained: "Terlatih",
          advanced: "Mahir",
          elite: "Elite",
        };
    return labels[band];
  }, [band, isEn]);

  const statusLabel =
    status === "established"
      ? isEn
        ? "Data sufficient"
        : "Data memadai"
      : status === "provisional"
        ? isEn
          ? "Provisional"
          : "Provisional"
        : isEn
          ? "Needs data"
          : "Butuh data";

  const trendPoints = useMemo(() => {
    const values = (uphill?.trend || []).filter((t) => t.score != null) as Array<{
      weekStart: string;
      score: number;
    }>;
    if (values.length < 2) return [];
    return values;
  }, [uphill?.trend]);

  const sparkline = useMemo(() => {
    if (trendPoints.length < 2) return null;
    const width = 120;
    const height = 34;
    const scores = trendPoints.map((p) => Number(p.score));
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const span = Math.max(1, max - min);
    const coords = trendPoints.map((p, index) => {
      const x = (index / (trendPoints.length - 1)) * width;
      const y = height - 4 - ((Number(p.score) - min) / span) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { width, height, coords: coords.join(" "), min, max };
  }, [trendPoints]);

  const runBackfill = async () => {
    setIsBackfilling(true);
    setBackfillError(null);
    setBackfillMessage(null);

    let totalAnalyzed = 0;
    let totalClimbs = 0;
    let remaining = 1;
    let failed = 0;

    try {
      for (let attempt = 0; attempt < 8 && remaining > 0; attempt++) {
        const res = await fetch("/api/activities/backfill-climbs", {
          method: "POST",
          headers: getSessionHeaders(),
          body: JSON.stringify({ limit: 5 }),
        });
        const data = await res.json();

        if (!res.ok && res.status !== 429) {
          throw new Error(data?.error || `Backfill failed (${res.status})`);
        }
        if (res.status === 429) break;

        totalAnalyzed += Number(data?.succeeded || 0);
        totalClimbs += Number(data?.climbsFound || 0);
        failed += Number(data?.failed || 0);
        remaining = Number(data?.remaining || 0);

        setBackfillMessage(
          isEn
            ? `${totalAnalyzed} activities analysed · ${totalClimbs} climbs found`
            : `${totalAnalyzed} aktivitas dianalisis · ${totalClimbs} tanjakan ditemukan`
        );

        if (Number(data?.succeeded || 0) === 0) break;
      }

      if (failed > 0) {
        setBackfillError(
          isEn
            ? `${failed} activities could not be analysed (FIT file unavailable).`
            : `${failed} aktivitas gagal dianalisis (file FIT tidak tersedia).`
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      setBackfillError(
        err instanceof Error
          ? err.message
          : isEn
            ? "Backfill failed"
            : "Backfill gagal"
      );
    } finally {
      setIsBackfilling(false);
    }
  };

  const formattedLastClimb = uphill?.lastClimbAt
    ? new Date(uphill.lastClimbAt).toLocaleDateString(isEn ? "en-US" : "id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const formattedVolume =
    uphill?.volumeGainM && uphill.volumeGainM > 0
      ? `${Math.round(uphill.volumeGainM).toLocaleString(isEn ? "en-US" : "id-ID")} m`
      : null;

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 space-y-4 shadow-[4px_4px_0px_0px_#09090b]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-lime-100 border-2 border-zinc-950 flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <Mountain className="h-4 w-4 text-lime-700 stroke-[2.5]" />
          </div>
          <div>
            <h4 className="text-sm font-black text-zinc-950 tracking-tight">
              {isEn ? "Uphill Score" : "Uphill Score"}{" "}
              <span className="text-[10px] font-mono font-bold text-zinc-500">
                {isEn ? "Hill Strength & Endurance" : "Hill Strength & Endurance"}
              </span>
            </h4>
            <p className="text-[11px] font-medium text-zinc-600">
              {isEn
                ? "Climb-segment model · 90-day rolling window"
                : "Model segmen tanjakan · window bergulir 90 hari"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full border-2 border-zinc-950 text-[10px] font-black ${
              status === "established"
                ? "bg-emerald-200 text-emerald-950"
                : status === "provisional"
                  ? "bg-amber-200 text-amber-950"
                  : "bg-zinc-200 text-zinc-800"
            }`}
          >
            {statusLabel} · {uphill?.confidence ?? 0}%
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#FAF9F5] border-2 border-zinc-950 text-[10px] font-mono font-bold text-zinc-700">
            v{uphill?.formulaVersion || "1.2.0"}
          </span>
        </div>
      </div>

      {hasScore ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
            {/* Score block */}
            <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                  {isEn ? "Hill Score" : "Skor Tanjakan"}
                </span>
                <BarChart3 className="h-3.5 w-3.5 text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black font-mono text-zinc-950 leading-none">
                  {uphill?.score}
                </span>
                <span className="text-sm font-bold text-zinc-400">/100</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black border-2 border-zinc-950 ${styles.chip}`}
                >
                  {bandLabel}
                </span>
                {uphill?.delta28d != null && (
                  <span
                    className={`flex items-center gap-0.5 text-[11px] font-bold ${
                      uphill.delta28d > 0
                        ? "text-emerald-700"
                        : uphill.delta28d < 0
                          ? "text-rose-700"
                          : "text-zinc-500"
                    }`}
                  >
                    {uphill.delta28d > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : uphill.delta28d < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {uphill.delta28d > 0 ? "+" : ""}
                    {uphill.delta28d}
                    <span className="text-zinc-400 font-medium">
                      {isEn ? "vs 28d" : "vs 28h"}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Sub-scores */}
            <div className="p-4 rounded-xl bg-white border-2 border-zinc-950 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-zinc-900">
                    {isEn ? "Hill Strength" : "Kekuatan Tanjakan"}
                    <span className="ml-1.5 font-mono font-medium text-zinc-400">
                      2–15 min · ≥6%
                    </span>
                  </span>
                  <span className="text-sm font-black font-mono text-zinc-950">
                    {uphill?.strength ?? "—"}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-zinc-100 border border-zinc-300 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${styles.bar}`}
                    style={{ width: `${uphill?.strength ?? 0}%` }}
                    role="progressbar"
                    aria-label={isEn ? "Hill Strength" : "Kekuatan Tanjakan"}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={uphill?.strength ?? 0}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-zinc-900">
                    {isEn ? "Hill Endurance" : "Ketahanan Tanjakan"}
                    <span className="ml-1.5 font-mono font-medium text-zinc-400">
                      ≥15 min
                    </span>
                  </span>
                  <span className="text-sm font-black font-mono text-zinc-950">
                    {uphill?.endurance ?? "—"}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-zinc-100 border border-zinc-300 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${styles.bar}`}
                    style={{ width: `${uphill?.endurance ?? 0}%` }}
                    role="progressbar"
                    aria-label={isEn ? "Hill Endurance" : "Ketahanan Tanjakan"}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={uphill?.endurance ?? 0}
                  />
                </div>
              </div>

              {sparkline && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase">
                    {isEn ? "8-week trend" : "Tren 8 minggu"}
                  </span>
                  <svg
                    width={sparkline.width}
                    height={sparkline.height}
                    viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                    role="img"
                    aria-label={isEn ? "Uphill score trend" : "Tren skor tanjakan"}
                  >
                    <polyline
                      points={sparkline.coords}
                      fill="none"
                      stroke="#65a30d"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Best climbs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                {isEn ? "Best climbs (90d)" : "Tanjakan terbaik (90h)"}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {uphill?.sampleClimbs ?? 0} {isEn ? "climbs" : "tanjakan"}
                {formattedVolume ? ` · ${formattedVolume} ${isEn ? "gain" : "D+"}` : ""}
                {formattedLastClimb ? ` · ${formattedLastClimb}` : ""}
              </span>
            </div>
            <div className="divide-y-2 divide-zinc-100 border-2 border-zinc-950 rounded-lg overflow-hidden">
              {(uphill?.bestClimbs || []).slice(0, 3).map((climb, index) => (
                <div
                  key={`${climb.activityId}-${index}`}
                  className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2 bg-white"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-zinc-900 truncate">
                      {climb.activityName}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500">
                      {new Date(climb.startTime).toLocaleDateString(isEn ? "en-US" : "id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                      {" · "}
                      {(climb.distanceM / 1000).toFixed(1)} km
                      {" · "}
                      {climb.avgGradePct.toFixed(1)}%
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-black text-zinc-950">
                    +{climb.gainM} m
                  </span>
                  <span className="hidden sm:inline text-[11px] font-mono font-bold text-cyan-700">
                    {climb.vamMh} m/h
                  </span>
                  <span className="hidden sm:inline text-[11px] font-mono text-zinc-500">
                    GAP {Math.floor(climb.gapPaceSecPerKm / 60)}:
                    {String(climb.gapPaceSecPerKm % 60).padStart(2, "0")}/km
                  </span>
                </div>
              ))}
              {(uphill?.bestClimbs || []).length === 0 && (
                <div className="px-3 py-2 text-[11px] text-zinc-500">
                  {isEn ? "No climb segments yet." : "Belum ada segmen tanjakan."}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-[10px] font-mono text-zinc-500">
              {uphill?.vo2max
                ? `${isEn ? "Aerobic context" : "Konteks aerobik"}: VO2max ${uphill.vo2max} ml/kg/min`
                : isEn
                  ? "Aerobic context: VO2max unavailable"
                  : "Konteks aerobik: VO2max belum tersedia"}
            </div>
            <button
              type="button"
              onClick={() => setShowFormula((prev) => !prev)}
              className="flex items-center gap-1 text-[10px] font-mono font-bold text-zinc-700 hover:text-zinc-950 py-1 px-2 rounded border-2 border-zinc-950 bg-white hover:bg-zinc-100 shadow-[1px_1px_0px_0px_#09090b] cursor-pointer"
            >
              <Info className="h-3 w-3" />
              {isEn ? "How it is calculated" : "Cara dihitung"}
              {showFormula ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-dashed border-zinc-400 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-white border-2 border-zinc-950 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black text-zinc-950">
                {isEn ? "Not enough climb data yet" : "Data tanjakan belum cukup"}
              </p>
              <p className="text-[11px] font-medium text-zinc-600 max-w-xl">
                {isEn
                  ? "The Uphill Score needs at least 3 sustained climbs (≥30 m gain, ≥300 m distance, ≥3% grade) in the last 90 days. Analyse your existing activities to extract climb segments."
                  : "Uphill Score butuh minimal 3 tanjakan kontinu (gain ≥30 m, jarak ≥300 m, grade ≥3%) dalam 90 hari terakhir. Analisis aktivitas lama untuk mengekstrak segmen tanjakan."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runBackfill}
              disabled={isBackfilling}
              className="flex items-center gap-1.5 text-[11px] font-black py-1.5 px-3 rounded-lg border-2 border-zinc-950 bg-lime-200 hover:bg-lime-300 disabled:opacity-60 shadow-[1.5px_1.5px_0px_0px_#09090b] cursor-pointer"
            >
              {isBackfilling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mountain className="h-3.5 w-3.5" />
              )}
              {isBackfilling
                ? isEn
                  ? "Analysing climbs..."
                  : "Menganalisis tanjakan..."
                : isEn
                  ? "Analyse my activities"
                  : "Analisis aktivitas saya"}
            </button>

            {backfillMessage && (
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {backfillMessage}
              </span>
            )}
          </div>

          {backfillError && (
            <p className="text-[10px] font-mono font-bold text-rose-700">{backfillError}</p>
          )}
        </div>
      )}

      {showFormula && (
        <div className="p-3 rounded-lg bg-white border-2 border-zinc-950 space-y-2 text-[11px] font-medium text-zinc-600 shadow-[2px_2px_0px_0px_#09090b]">
          <p className="font-black text-zinc-950">
            {isEn ? "Model summary" : "Ringkasan model"}
          </p>
          <p>
            {isEn
              ? "Hill Strength = P80 of grade-10%-normalised VAM at threshold HR from 2–15 min climbs (≥6% grade; easy climbs below 75% LTHR are excluded). Hill Endurance = P75 from climbs ≥15 min, adjusted by HR-drift retention. Combined = 0.55 × Strength + 0.45 × Endurance, then a 0.92–1.00 volume-sufficiency factor (low 90-day climb gain is discounted, never inflated)."
              : "Hill Strength = P80 VAM ternormalisasi ke HR ambang dan grade 10% dari tanjakan 2–15 menit (grade ≥6%; climb easy di bawah 75% LTHR dikecualikan). Hill Endurance = P75 dari tanjakan ≥15 menit, disesuaikan retensi HR-drift. Gabungan = 0.55 × Strength + 0.45 × Endurance, lalu faktor volume 0.92–1.00 (volume tanjakan rendah didiskon, tidak pernah dinaikkan)."}
          </p>
          <p className="text-[10px] text-zinc-500">
            {isEn
              ? "Grade cost follows Minetti et al. (2002); HR normalisation follows the %HRR–%VO2R relationship (Swain et al. 1994). Anchors, weights and thresholds are internal calibration — this is not Garmin's proprietary Hill Score."
              : "Biaya gradien mengacu Minetti et al. (2002); normalisasi HR mengikuti hubungan %HRR–%VO2R (Swain et al. 1994). Anchor, bobot, dan ambang adalah kalibrasi internal — ini bukan Hill Score proprietary Garmin."}
          </p>
          <p className="text-[10px] font-mono text-zinc-400">
            {isEn ? "Provisional status means confidence is below 60% (sample size, recency, or altitude quality)." : "Status provisional berarti confidence di bawah 60% (jumlah sampel, kebaruan, atau kualitas altitude)."}
          </p>
        </div>
      )}
    </div>
  );
};
