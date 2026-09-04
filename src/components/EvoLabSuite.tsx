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
    <div className="rounded-2xl bg-white border-2 border-zinc-950 p-5 sm:p-6 space-y-5 shadow-[4px_4px_0px_0px_#09090b]">
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
            </h3>
            <p className="text-xs font-medium text-zinc-600">
              Benchmark projections for standard road distances based on running fitness
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

      {/* Race Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {races.map((r) => (
          <div key={r.name} className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-1.5 shadow-[2px_2px_0px_0px_#09090b]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-zinc-950">{r.name}</span>
              <Timer className="h-3.5 w-3.5 text-zinc-700 stroke-[2.5]" />
            </div>
            <div className="text-2xl font-black text-orange-600 font-mono tracking-tight">
              {formatDuration(r.seconds)}
            </div>
            <div className="flex justify-between text-[11px] font-mono pt-0.5 border-t border-zinc-200">
              <span className="text-zinc-600 font-bold">Avg Pace</span>
              <span className="text-zinc-950 font-black">{r.pace}/km</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
