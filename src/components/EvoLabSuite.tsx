"use client";

import React from "react";
import { Zap, Trophy, Timer, Flame, Award, Medal, TrendingUp, Sparkles } from "lucide-react";
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

  const races = [
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

  return (
    <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-5 shadow-[4px_4px_0px_0px_#09090b]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <Trophy className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-950 tracking-tight flex items-center gap-2">
              <span>Road EvoLab Suite & Race Predictor</span>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-orange-200 text-orange-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                COROS Official
              </span>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 border-2 border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] hidden sm:inline-block">
                Personal Records (PR)
              </span>
            </h3>
            <p className="text-xs font-medium text-zinc-600">
              {language === "en"
                ? "Compare official COROS EvoLab projections side-by-side with your all-time recorded personal records."
                : "Bandingkan proyeksi resmi COROS EvoLab secara langsung dengan hasil personal record (PR) terbaik Anda."}
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

      {/* 4-Distance Grid: Predictor vs Personal Record */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {races.map((r) => {
          const diff = r.pr ? r.pr.seconds - r.predictorSeconds : null;
          return (
            <div
              key={r.name}
              className="p-4 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 flex flex-col justify-between space-y-3.5 shadow-[2px_2px_0px_0px_#09090b]"
            >
              {/* Card Header: Category & Distance */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-zinc-950">{r.name}</span>
                  <span className="text-[10px] font-mono font-bold text-zinc-500">
                    ({r.targetDistanceLabel})
                  </span>
                </div>
                <Timer className="h-4 w-4 text-zinc-700 stroke-[2.5]" />
              </div>

              {/* Side-by-side / Stacked Metrics: Predictor vs PR */}
              <div className="space-y-2.5">
                {/* 1. COROS Predictor */}
                <div className="p-2.5 rounded-lg bg-orange-50/70 border border-orange-200 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-orange-800 uppercase tracking-wide">
                    <span>{language === "en" ? "COROS Predictor" : "Proyeksi EvoLab"}</span>
                    <span>{r.predictorPace}/km</span>
                  </div>
                  <div className="text-2xl font-black text-orange-600 font-mono tracking-tight">
                    {formatDuration(r.predictorSeconds)}
                  </div>
                </div>

                {/* 2. Personal Record (PR) */}
                <div className="p-2.5 rounded-lg bg-white border border-zinc-300 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-wide">
                    <span className="flex items-center gap-1">
                      <Medal className="h-3 w-3 text-amber-500 stroke-[2.5]" />
                      <span>{language === "en" ? "Personal Record (PR)" : "Rekor Terbaik (PR)"}</span>
                    </span>
                    {r.pr && <span>{r.pr.pace}/km</span>}
                  </div>
                  {r.pr ? (
                    <div>
                      <div className="text-xl font-black text-zinc-950 font-mono tracking-tight">
                        {formatDuration(r.pr.seconds)}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 truncate pt-0.5" title={`${r.pr.activityName} (${formatDateDisplay(r.pr.date, language)})`}>
                        {formatDateDisplay(r.pr.date, language)} • {r.pr.activityName}
                      </div>
                    </div>
                  ) : (
                    <div className="py-1">
                      <div className="text-xs font-bold text-zinc-400 italic">
                        {language === "en" ? "No record logged" : "Belum ada record"}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {language === "en" ? "Run this distance to record PR" : "Lari jarak ini untuk rekor"}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Comparison Delta Indicator */}
              <div className="pt-2 border-t border-zinc-200/80 text-[11px] font-mono">
                {diff !== null ? (
                  diff > 10 ? (
                    <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold flex items-center justify-between text-[10.5px]">
                      <span>{language === "en" ? "PR Opportunity:" : "Potensi PR:"}</span>
                      <span className="font-black">-{formatDelta(diff)} {language === "en" ? "faster" : "lebih cepat"}</span>
                    </div>
                  ) : diff < -10 ? (
                    <div className="p-1.5 rounded-md bg-sky-50 text-sky-800 border border-sky-300 font-bold flex items-center justify-between text-[10.5px]">
                      <span>{language === "en" ? "PR vs Prediction:" : "Rekor vs Prediksi:"}</span>
                      <span className="font-black">+{formatDelta(Math.abs(diff))} {language === "en" ? "ahead" : "lebih unggul"}</span>
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-300 font-bold flex items-center justify-between text-[10.5px]">
                      <span>{language === "en" ? "Accuracy:" : "Akurasi:"}</span>
                      <span className="font-black">🎯 {language === "en" ? "Matches PR (±10s)" : "Setara Rekor (±10s)"}</span>
                    </div>
                  )
                ) : (
                  <div className="p-1.5 rounded-md bg-zinc-50 text-zinc-400 border border-zinc-200 text-center text-[10px]">
                    {language === "en" ? "Awaiting your first effort" : "Menunggu sesi perdana"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
