"use client";

import React from "react";
import { Trophy, Timer, Flame, Award, Medal, ArrowUpRight, CheckCircle2, Sparkles, Footprints } from "lucide-react";
import { formatPace, PersonalRecordItem, PersonalRecordsMap } from "@/lib/analytics";
import { useTranslation } from "@/lib/i18n/context";

interface EvoLabProps {
  racePredictor: {
    fiveKmSeconds: number;
    tenKmSeconds: number;
    halfMarathonSeconds: number;
    marathonSeconds: number;
    runningFitness: number;
    marathonLevel: number;
  };
  personalRecords?: PersonalRecordsMap | null;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDelta(seconds: number): string {
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${s}s`;
}

function formatDateDisplay(dateStr?: string, language?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export const EvoLabSuite: React.FC<EvoLabProps> = ({ racePredictor, personalRecords }) => {
  const { language } = useTranslation();

  const standardDistances = [
    {
      key: "fiveKm",
      name: "5K",
      distanceKm: 5,
      targetDistanceLabel: "5.0 km",
      predictorSeconds: racePredictor.fiveKmSeconds,
      predictorPace: formatPace(racePredictor.fiveKmSeconds / 5),
      pr: personalRecords?.fiveKm || null,
    },
    {
      key: "tenKm",
      name: "10K",
      distanceKm: 10,
      targetDistanceLabel: "10.0 km",
      predictorSeconds: racePredictor.tenKmSeconds,
      predictorPace: formatPace(racePredictor.tenKmSeconds / 10),
      pr: personalRecords?.tenKm || null,
    },
    {
      key: "halfMarathon",
      name: "Half Marathon",
      distanceKm: 21.0975,
      targetDistanceLabel: "21.1 km",
      predictorSeconds: racePredictor.halfMarathonSeconds,
      predictorPace: formatPace(racePredictor.halfMarathonSeconds / 21.0975),
      pr: personalRecords?.halfMarathon || null,
    },
    {
      key: "marathon",
      name: "Marathon",
      distanceKm: 42.195,
      targetDistanceLabel: "42.2 km",
      predictorSeconds: racePredictor.marathonSeconds,
      predictorPace: formatPace(racePredictor.marathonSeconds / 42.195),
      pr: personalRecords?.marathon || null,
    },
  ];

  const loggedPrCount = standardDistances.filter((d) => d.pr !== null).length;

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* CARD 1: COROS EVOLAB RACE PREDICTOR                                       */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-5 shadow-[4px_4px_0px_0px_#09090b]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Trophy className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-950 tracking-tight flex items-center gap-2">
                <span>{language === "en" ? "COROS EvoLab Race Predictor" : "Proyeksi Race COROS EvoLab"}</span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-orange-200 text-orange-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                  COROS Official
                </span>
              </h3>
              <p className="text-xs font-medium text-zinc-600">
                {language === "en"
                  ? "Algorithmic benchmark projections calculated from your current running fitness and lactate threshold"
                  : "Estimasi waktu finish lomba jalan raya berdasarkan Running Fitness dan ambang laktat saat ini"}
              </p>
            </div>
          </div>

          {/* Scores */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
              <Award className="h-3.5 w-3.5 text-amber-600 stroke-[2.5]" />
              <span className="text-xs font-bold text-zinc-700">Fitness:</span>
              <span className="text-xs font-black font-mono text-zinc-950">{racePredictor.runningFitness}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
              <Flame className="h-3.5 w-3.5 text-orange-600 stroke-[2.5]" />
              <span className="text-xs font-bold text-zinc-700">Marathon:</span>
              <span className="text-xs font-black font-mono text-zinc-950">{racePredictor.marathonLevel}</span>
            </div>
          </div>
        </div>

        {/* 4-Distance Predictor Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {standardDistances.map((r) => (
            <div
              key={r.name}
              className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-2 shadow-[2px_2px_0px_0px_#09090b] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-zinc-950">{r.name}</span>
                  <span className="text-[10px] font-mono font-bold text-zinc-500">
                    ({r.targetDistanceLabel})
                  </span>
                </div>
                <Timer className="h-3.5 w-3.5 text-zinc-700 stroke-[2.5]" />
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-orange-600 font-mono tracking-tight leading-none">
                  {formatDuration(r.predictorSeconds)}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-zinc-200">
                <span className="text-zinc-600 font-bold">{language === "en" ? "Est. Pace" : "Pace Proyeksi"}</span>
                <span className="text-zinc-950 font-black">{r.predictorPace}/km</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARD 2: ALL-TIME PERSONAL RECORDS (PR) HALL OF FAME                        */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-5 shadow-[4px_4px_0px_0px_#09090b]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Medal className="h-4 w-4 text-amber-700 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-950 tracking-tight flex items-center gap-2">
                <span>{language === "en" ? "All-Time Personal Records (PR)" : "Rekor Terbaik Pribadi (PR)"}</span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                  Verified Best Efforts
                </span>
              </h3>
              <p className="text-xs font-medium text-zinc-600">
                {language === "en"
                  ? "Fastest verified performances across standard road distances from your recorded running activities"
                  : "Catatan waktu tercepat yang pernah Anda capai berdasarkan data aktivitas lari di database"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#FAF9F5] border-2 border-zinc-950 font-mono text-[11px] font-black text-zinc-900 shadow-[1.5px_1.5px_0px_0px_#09090b] flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{loggedPrCount} / 4 {language === "en" ? "Records Logged" : "Jarak Tercatat"}</span>
            </span>
          </div>
        </div>

        {/* 4-Distance Personal Records Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {standardDistances.map((r) => {
            const diff = r.pr ? r.pr.seconds - r.predictorSeconds : null;
            return (
              <div
                key={r.name}
                className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-3 shadow-[2px_2px_0px_0px_#09090b] flex flex-col justify-between"
              >
                {/* Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-zinc-950">{r.name}</span>
                    <span className="text-[10px] font-mono font-bold text-zinc-500">
                      ({r.targetDistanceLabel})
                    </span>
                  </div>
                  <Medal className="h-3.5 w-3.5 text-amber-500 stroke-[2.5]" />
                </div>

                {/* PR Time & Pace */}
                {r.pr ? (
                  <div className="space-y-1">
                    <div className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight leading-none">
                      {formatDuration(r.pr.seconds)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-600">
                      <span className="font-bold">Pace: {r.pr.pace}/km</span>
                      <span className="font-bold text-zinc-500">{formatDateDisplay(r.pr.date, language)}</span>
                    </div>
                    <p className="text-[10.5px] font-mono text-zinc-500 truncate pt-0.5" title={r.pr.activityName}>
                      {r.pr.activityName}
                    </p>
                  </div>
                ) : (
                  <div className="py-2 space-y-1">
                    <div className="text-xl font-bold font-mono text-zinc-400 italic">
                      --:--
                    </div>
                    <p className="text-[11px] text-zinc-400 font-medium">
                      {language === "en" ? "No qualifying run recorded yet" : "Belum ada sesi lari di jarak ini"}
                    </p>
                  </div>
                )}

                {/* Delta / Comparison Pill against Predictor */}
                <div className="pt-2 border-t border-zinc-200">
                  {diff !== null ? (
                    diff > 10 ? (
                      <div className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-bold flex items-center justify-between text-[10px]">
                        <span>{language === "en" ? "Predictor Potential:" : "Potensi PR:"}</span>
                        <span className="font-black">-{formatDelta(diff)}</span>
                      </div>
                    ) : diff < -10 ? (
                      <div className="px-2 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-300 font-mono font-bold flex items-center justify-between text-[10px]">
                        <span>{language === "en" ? "PR vs Predictor:" : "Rekor vs Prediksi:"}</span>
                        <span className="font-black">+{formatDelta(Math.abs(diff))}</span>
                      </div>
                    ) : (
                      <div className="px-2 py-1 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-300 font-mono font-bold flex items-center justify-between text-[10px]">
                        <span>{language === "en" ? "Comparison:" : "Komparasi:"}</span>
                        <span className="font-black">🎯 {language === "en" ? "Matches PR (±10s)" : "Setara Rekor (±10s)"}</span>
                      </div>
                    )
                  ) : (
                    <div className="px-2 py-1 rounded-lg bg-zinc-100 text-zinc-400 border border-zinc-200 font-mono text-[10px] text-center">
                      {language === "en" ? "Awaiting your first effort" : "Menunggu sesi perdana"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
