"use client";

import React from "react";
import { Zap, Trophy, Timer, Flame, Award } from "lucide-react";
import { formatPace } from "@/lib/analytics";

interface EvoLabProps {
  racePredictor: {
    fiveKmSeconds: number;
    tenKmSeconds: number;
    halfMarathonSeconds: number;
    marathonSeconds: number;
    runningFitness: number;
    marathonLevel: number;
  };
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

export const EvoLabSuite: React.FC<EvoLabProps> = ({ racePredictor }) => {
  const races = [
    {
      name: "5K",
      distanceKm: 5,
      seconds: racePredictor.fiveKmSeconds,
      pace: formatPace(racePredictor.fiveKmSeconds / 5),
    },
    {
      name: "10K",
      distanceKm: 10,
      seconds: racePredictor.tenKmSeconds,
      pace: formatPace(racePredictor.tenKmSeconds / 10),
    },
    {
      name: "Half Marathon",
      distanceKm: 21.0975,
      seconds: racePredictor.halfMarathonSeconds,
      pace: formatPace(racePredictor.halfMarathonSeconds / 21.0975),
    },
    {
      name: "Marathon",
      distanceKm: 42.195,
      seconds: racePredictor.marathonSeconds,
      pace: formatPace(racePredictor.marathonSeconds / 42.195),
    },
  ];

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-5 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Road EvoLab Suite & Race Predictor
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-orange-950 text-orange-400 border border-orange-700/60">
                COROS Official
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Benchmark projections for standard road distances based on running fitness
            </p>
          </div>
        </div>

        {/* Scores */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
            <Award className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-zinc-400">Running Fitness:</span>
            <span className="text-xs font-bold text-white">{racePredictor.runningFitness}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-xs text-zinc-400">Marathon Level:</span>
            <span className="text-xs font-bold text-white">{racePredictor.marathonLevel}</span>
          </div>
        </div>
      </div>

      {/* Race Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {races.map((r) => (
          <div key={r.name} className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-300">{r.name}</span>
              <Timer className="h-3.5 w-3.5 text-zinc-400" />
            </div>
            <div className="text-xl font-black text-orange-400 font-mono">
              {formatDuration(r.seconds)}
            </div>
            <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
              <span>Avg Pace</span>
              <span className="text-zinc-300 font-semibold">{r.pace}/km</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
