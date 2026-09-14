"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Activity,
  Zap,
  RefreshCw,
  ArrowLeft,
  Server,
  Database,
  Calendar,
  Clock,
  Search,
  Copy,
  Check,
  Lock,
  Compass,
  TrendingUp,
} from "lucide-react";

interface AthleteRecord {
  athleteId: string;
  isOwner: boolean;
  firstConnectedAt: number;
  lastUpdatedAt: number;
  activityCount: number;
  totalDistanceKm: number;
  totalElevationGainM: number;
  latestActivityTime: number | null;
  athleteInfo: any;
}

interface TelemetryData {
  totalRegisteredAthletes: number;
  activeAthletes7d: number;
  recentActivities7d: number;
  totalActivities: number;
  totalDistanceKm: number;
  totalElevationGain: number;
  activeSessions: number;
  databaseMode: string;
  pingLatencyMs: number;
  serverTimestamp: number;
}

interface ApiResponse {
  success: boolean;
  currentViewer: {
    athleteId: string | null;
    isOwner: boolean;
  };
  telemetry: TelemetryData;
  athletes: AthleteRecord[];
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return new Intl.DateTimeFormat("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(ts);
  }
}

function formatRelative(ts: number | null): string {
  if (!ts) return "Never";
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Baru saja";
  if (diffMin < 60) return `${diffMin}m lalu`;
  if (diffHour < 24) return `${diffHour}j lalu`;
  if (diffDay === 1) return "Kemarin";
  if (diffDay < 30) return `${diffDay} hari lalu`;
  return formatDate(ts);
}

export default function OpsTelemetryPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [secretKeyInput, setSecretKeyInput] = useState<string>("");

  const fetchTelemetry = async (overrideKey?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/ops/stats", window.location.origin);
      const keyToUse = overrideKey || secretKeyInput;
      if (keyToUse) {
        url.searchParams.set("key", keyToUse);
      }

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: keyToUse ? { "x-ops-key": keyToUse } : {},
      });

      if (!res.ok) {
        if (res.status === 404 || res.status === 401) {
          throw new Error("UNAUTHORIZED");
        }
        throw new Error(`HTTP Error ${res.status}`);
      }

      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load telemetry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qKey = params.get("key");
    if (qKey) {
      setSecretKeyInput(qKey);
      fetchTelemetry(qKey);
    } else {
      fetchTelemetry();
    }
  }, []);

  const filteredAthletes = useMemo(() => {
    if (!data?.athletes) return [];
    if (!searchQuery.trim()) return data.athletes;
    const q = searchQuery.toLowerCase();
    return data.athletes.filter((a) =>
      a.athleteId.toLowerCase().includes(q)
    );
  }, [data?.athletes, searchQuery]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Unauthorized Gate Screen (Neo-brutalist AllTerrain Theme)
  if (error === "UNAUTHORIZED") {
    return (
      <div className="min-h-screen bg-[#F4F2EB] text-zinc-950 flex items-center justify-center p-6 font-mono">
        <div className="w-full max-w-md bg-white border-2 border-zinc-950 rounded-2xl p-6 sm:p-8 space-y-6 shadow-[6px_6px_0px_0px_#09090b]">
          <div className="flex items-center gap-3 border-b-2 border-zinc-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-rose-400 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
              <Lock className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider uppercase text-zinc-950">
                OPS ACCESS GATE
              </h1>
              <p className="text-[11px] text-zinc-500 font-bold">Restricted Owner Terminal</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-700 leading-relaxed font-sans font-medium">
              Terminal ini khusus untuk akun pemilik AllTerrain. Jika Anda membuka dari perangkat lain atau mode penyamaran (*incognito*), masukkan Passkey Akses di bawah ini.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchTelemetry();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-1.5">
                Passkey / Secret Key
              </label>
              <input
                type="password"
                value={secretKeyInput}
                onChange={(e) => setSecretKeyInput(e.target.value)}
                placeholder="Masukkan secret key..."
                className="w-full bg-[#FAF9F5] border-2 border-zinc-950 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-950 outline-none font-mono font-bold shadow-[2px_2px_0px_0px_#09090b]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 border-2 border-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-[3px_3px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? "Memverifikasi..." : "Masuk ke Ops Terminal"}
            </button>
          </form>

          <div className="pt-2 border-t-2 border-zinc-100 flex items-center justify-between text-[11px]">
            <Link
              href="/"
              className="text-zinc-600 hover:text-zinc-950 font-bold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali ke AllTerrain</span>
            </Link>
            <span className="text-[10px] text-zinc-400 font-bold">Node Terenkripsi</span>
          </div>
        </div>
      </div>
    );
  }

  const tel = data?.telemetry;

  return (
    <div className="min-h-screen bg-[#F4F2EB] text-zinc-950 font-mono selection:bg-cyan-300 selection:text-zinc-950">
      {/* Top Standalone Header Bar (Neo-brutalist AllTerrain Theme) */}
      <header className="border-b-2 border-zinc-950 bg-white sticky top-0 z-40 shadow-[0_2px_0px_0px_#09090b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-cyan-400 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 font-black shrink-0 shadow-[2px_2px_0px_0px_#09090b]">
              <Server className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black tracking-tight uppercase text-zinc-950 truncate">
                  ALLTERRAIN // OPS TELEMETRY
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-300 text-zinc-950 border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-700 animate-pulse" />
                  <span>ONLINE</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-semibold truncate mt-0.5">
                <span>{tel?.databaseMode || "Checking database..."}</span>
                {tel?.pingLatencyMs !== undefined && (
                  <span>• {tel.pingLatencyMs}ms latency</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {data?.currentViewer?.athleteId && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-50 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] text-[11px] text-zinc-800">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                <span>
                  Owner:{" "}
                  <strong className="text-zinc-950">
                    {data.currentViewer.athleteId.slice(0, 8)}...
                    {data.currentViewer.athleteId.slice(-4)}
                  </strong>
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => fetchTelemetry()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-950 border-2 border-zinc-950 text-xs font-black shadow-[2px_2px_0px_0px_#09090b] transition-all cursor-pointer disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5"
              title="Perbarui data telemetri"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs transition-all border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ke Aplikasi</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
        {/* Top 4 KPI Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total Registered Athletes */}
          <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 space-y-3 shadow-[4px_4px_0px_0px_#09090b]">
            <div className="flex items-center justify-between text-zinc-600 text-xs font-black uppercase tracking-wider">
              <span>Total Atlet Konek</span>
              <div className="h-9 w-9 rounded-xl bg-emerald-300 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                <Users className="h-4 w-4 stroke-[2.5]" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-zinc-950 font-mono">
                {tel?.totalRegisteredAthletes ?? "—"}
              </div>
              <p className="text-[11px] text-zinc-600 font-sans font-medium mt-1">
                Akun unik yang pernah login via COROS OAuth2
              </p>
            </div>
            <div className="pt-2 border-t-2 border-zinc-100 flex items-center justify-between text-[10px] text-zinc-600 font-bold">
              <span>Status Persistensi</span>
              <span className="text-emerald-700 font-black">100% Tersimpan</span>
            </div>
          </div>

          {/* KPI 2: Active Athletes This Week */}
          <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 space-y-3 shadow-[4px_4px_0px_0px_#09090b]">
            <div className="flex items-center justify-between text-zinc-600 text-xs font-black uppercase tracking-wider">
              <span>Aktif Pekan Ini (7d)</span>
              <div className="h-9 w-9 rounded-xl bg-cyan-300 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                <Zap className="h-4 w-4 stroke-[2.5]" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-cyan-900 font-mono">
                {tel?.activeAthletes7d ?? "—"}
              </div>
              <p className="text-[11px] text-zinc-600 font-sans font-medium mt-1">
                {tel?.recentActivities7d ?? 0} workout disinkronkan 7 hari terakhir
              </p>
            </div>
            <div className="pt-2 border-t-2 border-zinc-100 flex items-center justify-between text-[10px] text-zinc-600 font-bold">
              <span>Sesi Login Aktif</span>
              <span className="text-cyan-800 font-black">{tel?.activeSessions ?? 0} sesi browser</span>
            </div>
          </div>

          {/* KPI 3: Global Synced Workouts */}
          <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 space-y-3 shadow-[4px_4px_0px_0px_#09090b]">
            <div className="flex items-center justify-between text-zinc-600 text-xs font-black uppercase tracking-wider">
              <span>Total Aktivitas Global</span>
              <div className="h-9 w-9 rounded-xl bg-violet-300 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                <Activity className="h-4 w-4 stroke-[2.5]" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-purple-950 font-mono">
                {tel?.totalActivities ?? "—"}
              </div>
              <p className="text-[11px] text-zinc-600 font-sans font-medium mt-1">
                {tel?.totalDistanceKm?.toLocaleString() ?? 0} km akumulasi jarak lari
              </p>
            </div>
            <div className="pt-2 border-t-2 border-zinc-100 flex items-center justify-between text-[10px] text-zinc-600 font-bold">
              <span>Total Elevasi Global</span>
              <span className="text-purple-800 font-black">+{tel?.totalElevationGain?.toLocaleString() ?? 0}m D+</span>
            </div>
          </div>

          {/* KPI 4: Infrastructure Status */}
          <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 space-y-3 shadow-[4px_4px_0px_0px_#09090b]">
            <div className="flex items-center justify-between text-zinc-600 text-xs font-black uppercase tracking-wider">
              <span>Mesin Database</span>
              <div className="h-9 w-9 rounded-xl bg-orange-300 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                <Database className="h-4 w-4 stroke-[2.5]" />
              </div>
            </div>
            <div>
              <div className="text-lg font-black text-zinc-950 font-mono truncate">
                {process.env.NODE_ENV === "production" ? "Turso LibSQL Edge" : "Local SQLite"}
              </div>
              <p className="text-[11px] text-zinc-500 font-sans font-medium mt-1 truncate">
                {tel?.databaseMode}
              </p>
            </div>
            <div className="pt-2 border-t-2 border-zinc-100 flex items-center justify-between text-[10px] text-zinc-600 font-bold">
              <span>Respon Ping</span>
              <span className="text-emerald-700 font-black">{tel?.pingLatencyMs ?? 0} ms</span>
            </div>
          </div>
        </section>

        {/* Detailed Athletes List Table */}
        <section className="bg-white border-2 border-zinc-950 rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_#09090b]">
          {/* Table Header & Search Filter */}
          <div className="p-4 sm:p-5 border-b-2 border-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF9F5]">
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-zinc-950 flex items-center gap-2">
                <span>Daftar Akun Atlet Terdaftar</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] bg-zinc-200 text-zinc-950 font-black border border-zinc-400">
                  {filteredAthletes.length} Atlet
                </span>
              </h2>
              <p className="text-[11px] text-zinc-600 font-sans font-medium mt-0.5">
                Rincian ID atlet, waktu pertama login, keaktifan terakhir, dan akumulasi volume latihan
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari ID Atlet..."
                className="w-full bg-white border-2 border-zinc-950 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-950 placeholder:text-zinc-400 outline-none font-mono font-bold shadow-[2px_2px_0px_0px_#09090b]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 text-[10px] uppercase font-black text-zinc-700 tracking-wider border-b-2 border-zinc-950">
                <tr>
                  <th className="py-3 px-4">Athlete ID</th>
                  <th className="py-3 px-4">Pertama Konek</th>
                  <th className="py-3 px-4">Aktif Terakhir</th>
                  <th className="py-3 px-4 text-center">Workouts</th>
                  <th className="py-3 px-4 text-right">Jarak</th>
                  <th className="py-3 px-4 text-right">Elevasi D+</th>
                  <th className="py-3 px-4">Workout Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 font-mono">
                {filteredAthletes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-zinc-500 text-xs">
                      {loading ? "Memuat data telemetri..." : "Tidak ada catatan akun yang cocok."}
                    </td>
                  </tr>
                ) : (
                  filteredAthletes.map((a) => (
                    <tr
                      key={a.athleteId}
                      className="hover:bg-amber-50/70 transition-colors"
                    >
                      {/* Athlete ID & Tag */}
                      <td className="py-3.5 px-4 font-bold text-zinc-950">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[140px] sm:max-w-[200px]">
                            {a.athleteId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(a.athleteId)}
                            className="text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
                            title="Salin Athlete ID"
                          >
                            {copiedId === a.athleteId ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          {a.isOwner ? (
                            <span className="px-2 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-300 text-zinc-950 border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b] shrink-0">
                              OWNER
                            </span>
                          ) : (
                            <span className="px-2 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-300 shrink-0">
                              ATLET
                            </span>
                          )}
                        </div>
                      </td>

                      {/* First Connected */}
                      <td className="py-3.5 px-4 text-zinc-700 text-[11px]">
                        <div title={formatDate(a.firstConnectedAt)}>
                          {formatRelative(a.firstConnectedAt)}
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4 text-zinc-700 text-[11px]">
                        <div title={formatDate(a.lastUpdatedAt)} className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-600" />
                          <span>{formatRelative(a.lastUpdatedAt)}</span>
                        </div>
                      </td>

                      {/* Workouts */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-950 font-black text-xs border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]">
                          {a.activityCount}
                        </span>
                      </td>

                      {/* Distance */}
                      <td className="py-3.5 px-4 text-right font-black text-zinc-950">
                        {a.totalDistanceKm.toFixed(1)} km
                      </td>

                      {/* Elevation */}
                      <td className="py-3.5 px-4 text-right font-black text-cyan-900">
                        +{a.totalElevationGainM.toLocaleString()}m
                      </td>

                      {/* Latest Workout */}
                      <td className="py-3.5 px-4 text-zinc-700 text-[11px]">
                        {a.latestActivityTime ? (
                          <span title={formatDate(a.latestActivityTime)}>
                            {formatRelative(a.latestActivityTime)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">Belum ada workout</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 bg-[#FAF9F5] border-t-2 border-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-600 font-mono">
            <div>
              Sinkronisasi Server: {formatDate(tel?.serverTimestamp ?? Date.now())}
            </div>
            <div className="font-sans font-medium">
              Data dibaca langsung secara real-time dari database AllTerrain.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
