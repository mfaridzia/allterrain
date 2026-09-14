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
  ExternalLink,
  ChevronRight,
  Sparkles,
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

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(ts);
}

export default function AdminTelemetryPage() {
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
      const url = new URL("/api/admin/stats", window.location.origin);
      const keyToUse = overrideKey || secretKeyInput;
      if (keyToUse) {
        url.searchParams.set("key", keyToUse);
      }

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: keyToUse ? { "x-admin-key": keyToUse } : {},
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
    // Check if key is passed in URL query param
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

  // Unauthorized Gate Screen
  if (error === "UNAUTHORIZED") {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-6 font-mono selection:bg-rose-500 selection:text-white">
        <div className="w-full max-w-md bg-[#121215] border-2 border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-[8px_8px_0px_0px_#18181b]">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider uppercase text-zinc-100">
                HQ Telemetry Access Gate
              </h1>
              <p className="text-[11px] text-zinc-500">Restricted internal dashboard</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-400 leading-relaxed">
              This terminal is strictly restricted to the AllTerrain owner account. If you are accessing from an incognito session or separate device, enter your Admin Key below.
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
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Admin Passkey / Secret Key
              </label>
              <input
                type="password"
                value={secretKeyInput}
                onChange={(e) => setSecretKeyInput(e.target.value)}
                placeholder="Enter secret key..."
                className="w-full bg-[#18181b] border border-zinc-700 focus:border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-black text-xs uppercase tracking-wider hover:bg-white transition-all shadow-[2px_2px_0px_0px_#ffffff] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? "Verifying Access..." : "Authenticate Terminal"}
            </button>
          </form>

          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
            <Link
              href="/"
              className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to AllTerrain</span>
            </Link>
            <span className="text-[10px] text-zinc-600">Secure Node</span>
          </div>
        </div>
      </div>
    );
  }

  const tel = data?.telemetry;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-mono selection:bg-cyan-500 selection:text-black">
      {/* Top Standalone Command Bar */}
      <header className="border-b-2 border-zinc-800 bg-[#0d0d10] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-cyan-400 text-zinc-950 flex items-center justify-center font-black shrink-0 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#27272a]">
              <Server className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-zinc-100 truncate">
                  ALLTERRAIN HQ // TELEMETRY
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ONLINE</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 truncate">
                <span>{tel?.databaseMode || "Checking database..."}</span>
                {tel?.pingLatencyMs !== undefined && (
                  <span>• {tel.pingLatencyMs}ms ping</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {data?.currentViewer?.athleteId && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  Admin:{" "}
                  <strong className="text-zinc-200">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Refresh telemetry metrics"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-black text-xs transition-all border border-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to App</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Command Center Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top 4 KPI Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total Registered Athletes */}
          <div className="p-5 rounded-2xl bg-[#121215] border-2 border-zinc-800 space-y-3 shadow-[4px_4px_0px_0px_#18181b]">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <span>Total Users Connected</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-zinc-100 font-mono">
                {tel?.totalRegisteredAthletes ?? "—"}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Unique athletes authenticated via COROS OAuth2
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Permanent Store</span>
              <span className="text-emerald-400 font-bold">100% Persisted</span>
            </div>
          </div>

          {/* KPI 2: Active Athletes This Week */}
          <div className="p-5 rounded-2xl bg-[#121215] border-2 border-zinc-800 space-y-3 shadow-[4px_4px_0px_0px_#18181b]">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <span>Active Athletes (7d)</span>
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-cyan-400 font-mono">
                {tel?.activeAthletes7d ?? "—"}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {tel?.recentActivities7d ?? 0} workouts logged in last 7 days
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Live Sessions Active</span>
              <span className="text-cyan-400 font-bold">{tel?.activeSessions ?? 0} sessions</span>
            </div>
          </div>

          {/* KPI 3: Global Synced Workouts */}
          <div className="p-5 rounded-2xl bg-[#121215] border-2 border-zinc-800 space-y-3 shadow-[4px_4px_0px_0px_#18181b]">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <span>Global Activities</span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-amber-400 font-mono">
                {tel?.totalActivities ?? "—"}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {tel?.totalDistanceKm?.toLocaleString() ?? 0} km total distance logged
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Total Vert Climbed</span>
              <span className="text-amber-400 font-bold">+{tel?.totalElevationGain?.toLocaleString() ?? 0}m D+</span>
            </div>
          </div>

          {/* KPI 4: Infrastructure Status */}
          <div className="p-5 rounded-2xl bg-[#121215] border-2 border-zinc-800 space-y-3 shadow-[4px_4px_0px_0px_#18181b]">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <span>Database Engine</span>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Database className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-lg font-black text-purple-400 font-mono truncate">
                {process.env.NODE_ENV === "production" ? "LibSQL Production" : "LibSQL Local"}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 truncate">
                {tel?.databaseMode}
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Latency Status</span>
              <span className="text-emerald-400 font-bold">{tel?.pingLatencyMs ?? 0} ms response</span>
            </div>
          </div>
        </section>

        {/* Detailed Athletes List Table */}
        <section className="bg-[#121215] border-2 border-zinc-800 rounded-2xl overflow-hidden shadow-[6px_6px_0px_0px_#18181b]">
          {/* Table Header & Controls */}
          <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                <span>Registered Athletes Telemetry</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 font-bold">
                  {filteredAthletes.length} Accounts
                </span>
              </h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Individual athlete accounts, connection timestamps, and workout volume
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by Athlete ID..."
                className="w-full bg-[#18181b] border border-zinc-700 focus:border-zinc-400 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none font-mono"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18181b] text-[10px] uppercase font-bold text-zinc-400 tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Athlete ID</th>
                  <th className="py-3 px-4">First Connected</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-center">Workouts</th>
                  <th className="py-3 px-4 text-right">Distance</th>
                  <th className="py-3 px-4 text-right">Elevation D+</th>
                  <th className="py-3 px-4">Latest Workout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {filteredAthletes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500 text-xs">
                      {loading ? "Loading telemetry records..." : "No matching athlete records found."}
                    </td>
                  </tr>
                ) : (
                  filteredAthletes.map((a, idx) => (
                    <tr
                      key={a.athleteId}
                      className="hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Athlete ID & Tag */}
                      <td className="py-3.5 px-4 font-bold text-zinc-200">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[140px] sm:max-w-[180px]">
                            {a.athleteId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(a.athleteId)}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                            title="Copy Athlete ID"
                          >
                            {copiedId === a.athleteId ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          {a.isOwner && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/30 shrink-0">
                              OWNER
                            </span>
                          )}
                        </div>
                      </td>

                      {/* First Connected */}
                      <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                        <div title={formatDate(a.firstConnectedAt)}>
                          {formatRelative(a.firstConnectedAt)}
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                        <div title={formatDate(a.lastUpdatedAt)} className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                          <span>{formatRelative(a.lastUpdatedAt)}</span>
                        </div>
                      </td>

                      {/* Workouts */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 font-black text-xs border border-zinc-700">
                          {a.activityCount}
                        </span>
                      </td>

                      {/* Distance */}
                      <td className="py-3.5 px-4 text-right font-bold text-zinc-100">
                        {a.totalDistanceKm.toFixed(1)} km
                      </td>

                      {/* Elevation */}
                      <td className="py-3.5 px-4 text-right font-bold text-amber-400">
                        +{a.totalElevationGainM.toLocaleString()}m
                      </td>

                      {/* Latest Workout */}
                      <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                        {a.latestActivityTime ? (
                          <span title={formatDate(a.latestActivityTime)}>
                            {formatRelative(a.latestActivityTime)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">None</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 bg-[#141418] border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-500 font-mono">
            <div>
              Server Sync Time: {formatDate(tel?.serverTimestamp ?? Date.now())}
            </div>
            <div>
              All data read directly from AllTerrain database without intermediary caching.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
