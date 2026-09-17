"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Share2,
  Check,
  Lock,
  Activity,
  Zap,
  Mountain,
  Compass,
  TrendingUp,
  Heart,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Footprints,
  Bike,
  Dumbbell,
} from "lucide-react";
import { PublicProfileData, PublicActivityItem } from "@/lib/public-profile";

interface PublicProfileViewProps {
  data: PublicProfileData;
}

function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return "--:--";
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs} /km`;
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getSportIcon(sport: string) {
  const s = (sport || "").toLowerCase();
  if (s.includes("trail")) {
    return <Mountain className="h-4 w-4 text-emerald-600" />;
  } else if (s.includes("bike") || s.includes("cycle")) {
    return <Bike className="h-4 w-4 text-cyan-600" />;
  } else if (s.includes("gym") || s.includes("strength")) {
    return <Dumbbell className="h-4 w-4 text-purple-600" />;
  }
  return <Footprints className="h-4 w-4 text-orange-600" />;
}

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);

  // If profile not found or private
  if (!data.found || !data.isPublic) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] text-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-white border-2 border-zinc-950 shadow-[6px_6px_0px_0px_#09090b] text-center space-y-5">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-zinc-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[3px_3px_0px_0px_#09090b]">
            <Lock className="h-8 w-8 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Profil Bersifat Privat
            </h1>
            <p className="text-xs sm:text-sm font-medium text-zinc-600 leading-relaxed">
              Atlet <span className="font-mono font-bold text-zinc-900">@{data.nickname}</span> belum mengaktifkan profil publik atau membatasi akses telemetrinya.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <span>Buka ALLTERRAIN</span>
              <ChevronRight className="h-4 w-4 stroke-[3]" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${data.nickname} — Athletic Profile | ALLTERRAIN`,
          text: `Lihat profil kebugaran dan telemetri latihan @${data.nickname} di ALLTERRAIN.`,
          url,
        });
        return;
      } catch {}
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const initials = (data.nickname || "AT").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-zinc-950 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#F6F4EE]/90 backdrop-blur-md border-b-2 border-zinc-950 px-4 sm:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="h-7 w-7 rounded-lg bg-zinc-950 text-orange-400 font-mono font-black text-xs flex items-center justify-center border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] group-hover:bg-orange-500 group-hover:text-white transition-colors">
              ▲LT
            </span>
            <span className="font-black text-sm tracking-wider uppercase">ALLTERRAIN</span>
          </Link>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-black text-xs border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copied ? "Tersalin!" : "Bagikan"}</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 sm:py-8 space-y-6">
        {/* 1. Athlete Hero Card */}
        <section className="p-5 sm:p-7 rounded-2xl bg-white border-2 border-zinc-950 shadow-[5px_5px_0px_0px_#09090b] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            {/* Neo-brutalist Initial Monogram */}
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-orange-500 text-white font-mono font-black text-2xl sm:text-3xl flex items-center justify-center border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] shrink-0">
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-zinc-950 truncate font-mono">
                  @{data.nickname}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-400 text-emerald-900 text-[10px] font-black uppercase tracking-wider">
                  <ShieldCheck className="h-3 w-3 text-emerald-700" />
                  COROS Verified
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-zinc-600 mt-1">
                Endurance & Mountain Telemetry Passport
              </p>
            </div>
          </div>

          {/* Quick Share Pill */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleShare}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs flex items-center justify-center gap-2 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{copied ? "Tautan Berhasil Disalin!" : "Salin Profil"}</span>
            </button>
          </div>
        </section>

        {/* 2. PMC Fitness & Readiness Snapshot (Conditional) */}
        {data.settings.showPmc && data.pmc && (
          <section className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[5px_5px_0px_0px_#09090b] space-y-4">
            <div className="flex items-center justify-between border-b-2 border-dashed border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-100 border-2 border-zinc-950 text-zinc-950">
                  <Activity className="h-4 w-4 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                    Kebugaran & Kesiapan (PMC Engine)
                  </h2>
                  <p className="text-[11px] text-zinc-500 font-medium">Bannister Impulse-Response Model</p>
                </div>
              </div>

              <div className={`px-2.5 py-1 rounded-lg text-xs font-black border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] ${data.pmc.formZone.color}`}>
                {data.pmc.formZone.label}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Fitness CTL */}
              <div className="p-3.5 rounded-xl bg-orange-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-orange-800 block">
                  Fitness (CTL)
                </span>
                <span className="text-2xl font-black text-orange-950 font-mono mt-0.5 block">
                  {data.pmc.ctl}
                </span>
                <span className="text-[10px] text-orange-700 font-medium block mt-0.5">
                  Beban 42 Hari
                </span>
              </div>

              {/* Fatigue ATL */}
              <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-800 block">
                  Fatigue (ATL)
                </span>
                <span className="text-2xl font-black text-rose-950 font-mono mt-0.5 block">
                  {data.pmc.atl}
                </span>
                <span className="text-[10px] text-rose-700 font-medium block mt-0.5">
                  Beban 7 Hari
                </span>
              </div>

              {/* Form TSB */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 block">
                  Form (TSB)
                </span>
                <span className="text-2xl font-black text-emerald-950 font-mono mt-0.5 block">
                  {data.pmc.tsb > 0 ? `+${data.pmc.tsb}` : data.pmc.tsb}
                </span>
                <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
                  Kesiapan Lomba
                </span>
              </div>

              {/* Ramp Rate */}
              <div className="p-3.5 rounded-xl bg-cyan-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-800 block">
                  Ramp Rate
                </span>
                <span className="text-2xl font-black text-cyan-950 font-mono mt-0.5 block">
                  {data.pmc.rampRate > 0 ? `+${data.pmc.rampRate}` : data.pmc.rampRate}/w
                </span>
                <span className="text-[10px] text-cyan-700 font-medium block mt-0.5">
                  Akselerasi Beban
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 3. Volume & Mileage Aggregates (Conditional) */}
        {data.settings.showVolume && data.volume && (
          <section className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[5px_5px_0px_0px_#09090b] space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-dashed border-zinc-200 pb-3">
              <div className="p-1.5 rounded-lg bg-emerald-100 border-2 border-zinc-950 text-zinc-950">
                <TrendingUp className="h-4 w-4 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  Volume & Akumulasi Latihan
                </h2>
                <p className="text-[11px] text-zinc-500 font-medium">Rekapitulasi Jarak, Elevasi & Konsistensi</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-50 border-2 border-zinc-950">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 block">Total Jarak</span>
                <span className="text-2xl font-black text-zinc-950 font-mono block mt-0.5">
                  {data.volume.totalDistanceKm} <span className="text-xs font-sans text-zinc-500">KM</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 border-2 border-zinc-950">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 block">Elevasi (D+)</span>
                <span className="text-2xl font-black text-zinc-950 font-mono block mt-0.5">
                  {data.volume.totalElevationM.toLocaleString()} <span className="text-xs font-sans text-zinc-500">M</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 border-2 border-zinc-950">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 block">Waktu Latihan</span>
                <span className="text-2xl font-black text-zinc-950 font-mono block mt-0.5">
                  {data.volume.totalDurationHours} <span className="text-xs font-sans text-zinc-500">Jam</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 border-2 border-zinc-950">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 block">Total Sesi</span>
                <span className="text-2xl font-black text-zinc-950 font-mono block mt-0.5">
                  {data.volume.totalWorkouts} <span className="text-xs font-sans text-zinc-500">Workout</span>
                </span>
              </div>
            </div>

            {/* Sport Breakdown Pills */}
            {data.volume.sportBreakdown.length > 0 && (
              <div className="pt-2">
                <div className="text-[10px] font-mono font-bold uppercase text-zinc-500 mb-2">
                  Distribusi Disiplin Olahraga
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.volume.sportBreakdown.map((item) => (
                    <div
                      key={item.sport}
                      className="px-3 py-1.5 rounded-xl bg-zinc-100 border-2 border-zinc-950 text-xs font-black flex items-center gap-1.5"
                    >
                      {getSportIcon(item.sport)}
                      <span>{item.label}:</span>
                      <span className="font-mono text-orange-600">{item.distanceKm} km</span>
                      <span className="text-zinc-500 font-normal">({item.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 4. Trail & Mountain Dynamics (Conditional) */}
        {data.settings.showTrail && data.trail && (
          <section className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[5px_5px_0px_0px_#09090b] space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-dashed border-zinc-200 pb-3">
              <div className="p-1.5 rounded-lg bg-orange-100 border-2 border-zinc-950 text-zinc-950">
                <Mountain className="h-4 w-4 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  Data Trail & Pegunungan (Mountain Dynamics)
                </h2>
                <p className="text-[11px] text-zinc-500 font-medium">Metrik Vertikal & Kapasitas Mendaki</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[10px] font-mono font-bold uppercase text-amber-800 block">
                  Rekor Peak VAM
                </span>
                <span className="text-2xl font-black text-amber-950 font-mono block mt-0.5">
                  {data.trail.maxVam} <span className="text-xs font-sans text-amber-700">m/h</span>
                </span>
                <span className="text-[10px] text-amber-700 font-medium block mt-0.5">
                  Kecepatan Menanjak Maksimal
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 block">
                  Trail Elevation (D+)
                </span>
                <span className="text-2xl font-black text-emerald-950 font-mono block mt-0.5">
                  {data.trail.totalTrailElevM.toLocaleString()} <span className="text-xs font-sans text-emerald-700">M</span>
                </span>
                <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
                  Tanjakan Vertikal Trail
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <span className="text-[10px] font-mono font-bold uppercase text-cyan-800 block">
                  Climb Density
                </span>
                <span className="text-2xl font-black text-cyan-950 font-mono block mt-0.5">
                  {data.trail.climbDensity} <span className="text-xs font-sans text-cyan-700">m D+/km</span>
                </span>
                <span className="text-[10px] text-cyan-700 font-medium block mt-0.5">
                  Rasio Kemiringan Rute
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 5. Recent Activities Feed (Conditional) */}
        {data.settings.showRecent && data.recentActivities && data.recentActivities.length > 0 && (
          <section className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[5px_5px_0px_0px_#09090b] space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-dashed border-zinc-200 pb-3">
              <div className="p-1.5 rounded-lg bg-zinc-100 border-2 border-zinc-950 text-zinc-950">
                <Clock className="h-4 w-4 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  Sesi Latihan Terkini
                </h2>
                <p className="text-[11px] text-zinc-500 font-medium">6 Aktivitas Terakhir (Disaring & Aman)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {data.recentActivities.map((act) => {
                const distKm = Math.round((act.distanceMeters / 1000) * 100) / 100;
                return (
                  <div
                    key={act.id}
                    className="p-4 rounded-xl bg-zinc-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] flex flex-col justify-between gap-3 hover:bg-zinc-100/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-2 rounded-lg bg-white border-2 border-zinc-950 shrink-0">
                          {getSportIcon(act.sportType)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-zinc-950 truncate">{act.name}</h3>
                          <span className="text-[10px] font-mono text-zinc-500 block">
                            {formatDate(act.startTime)}
                          </span>
                        </div>
                      </div>

                      {/* Mini SVG Route Silhouette (Safe, no GPS map) */}
                      {act.svgRoutePath && (
                        <div className="h-10 w-16 shrink-0 rounded border border-zinc-300 bg-white p-0.5 flex items-center justify-center overflow-hidden">
                          <svg viewBox="0 0 120 70" className="h-full w-full stroke-orange-600 fill-none" strokeWidth="2.5">
                            <path d={act.svgRoutePath} />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Metric Pills */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-200 text-center font-mono">
                      <div className="bg-white p-1.5 rounded-lg border border-zinc-200">
                        <span className="text-[9px] text-zinc-500 block font-sans">Jarak</span>
                        <span className="text-xs font-black text-zinc-950">{distKm} km</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-zinc-200">
                        <span className="text-[9px] text-zinc-500 block font-sans">Pace</span>
                        <span className="text-xs font-black text-zinc-950">{formatPace(act.avgPaceSec)}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-zinc-200">
                        <span className="text-[9px] text-zinc-500 block font-sans">D+ Vert</span>
                        <span className="text-xs font-black text-zinc-950">{Math.round(act.elevationGain)}m</span>
                      </div>
                    </div>

                    {/* Optional Heart Rate (Only if enabled by user) */}
                    {data.settings.showHr && act.avgHr && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                        <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                        <span>Rata-rata: {act.avgHr} bpm</span>
                        {act.maxHr ? <span>(Maks: {act.maxHr})</span> : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. Growth & Marketing Footer */}
        <section className="p-6 rounded-2xl bg-zinc-950 text-white border-2 border-zinc-950 shadow-[5px_5px_0px_0px_#09090b] flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
          <div className="space-y-1">
            <h3 className="text-base font-black tracking-tight text-white flex items-center justify-center sm:justify-start gap-2">
              <span>Mau analisis performa COROS seperti ini?</span>
            </h3>
            <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
              Hubungkan jam COROS Anda di ALLTERRAIN untuk melihat kurva PMC Bannister, estimasi VAM, dan analisis pemulihan lengkap.
            </p>
          </div>

          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs border-2 border-white shadow-[2px_2px_0px_0px_#ffffff] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shrink-0"
          >
            Hubungkan Akun COROS
          </Link>
        </section>
      </main>

      {/* Global Minimalist Footer */}
      <footer className="border-t-2 border-zinc-950 bg-white/70 py-4 px-4 text-center text-[11px] font-mono text-zinc-500">
        ALLTERRAIN Athletic Intelligence • Official COROS MCP Telemetry
      </footer>
    </div>
  );
};
