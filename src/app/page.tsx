"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { AuthGate } from "@/components/AuthGate";
import { PmcChart } from "@/components/PmcChart";
import { AcwrCard } from "@/components/AcwrCard";
import { TidCard } from "@/components/TidCard";
import { TrailSuite } from "@/components/TrailSuite";
import { EvoLabSuite } from "@/components/EvoLabSuite";
import { RecoveryRadar } from "@/components/RecoveryRadar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AiCoachDrawer } from "@/components/AiCoachDrawer";
import { SettingsModal } from "@/components/SettingsModal";
import { Trophy, Mountain, RefreshCw, AlertCircle, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"evolab" | "trail">("evolab");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<"coros" | "intervals">("coros");

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/dashboard");
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/coros/sync", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setSyncMessage(`Synced ${json.syncedActivities || 0} activities & recalculated PMC.`);
        await fetchDashboard();
      } else {
        setSyncMessage(`Sync notice: ${json.error || "Connected to MCP"}`);
      }
    } catch (err: any) {
      setSyncMessage(`Sync notice: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your COROS account?")) return;
    await fetch("/api/auth/coros/status", { method: "POST" });
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500 animate-spin">
          <RefreshCw className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold text-zinc-400">Loading Athlete Intelligence Engine...</p>
      </div>
    );
  }

  const isConnected = dashboardData?.connected;

  const activeModeData = dashboardData?.modes?.[scaleMode] || {
    current: dashboardData?.current || { ctl: 0, atl: 0, tsb: 0, rampRate: 0, formPct: 0 },
    pmcSeries: dashboardData?.pmcSeries || [],
    acwr: dashboardData?.acwr || { acwr: 1.0, status: "sweet_spot", label: "Optimal Sweet Spot", description: "" },
    monotony: dashboardData?.monotony || { monotony: 0, strain: 0, monotonyAlert: false },
    scaleDescription: "",
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Header
        connected={isConnected}
        onSync={handleSync}
        isSyncing={isSyncing}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleAi={() => setIsAiOpen(!isAiOpen)}
        onDisconnect={handleDisconnect}
        isAiOpen={isAiOpen}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {syncMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900 border border-orange-500/30 text-xs text-orange-300">
            <Sparkles className="h-4 w-4 text-orange-400 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {!isConnected ? (
          <AuthGate />
        ) : (
          <>
            {/* Main Bannister PMC Chart with Dual Scale Toggle */}
            <PmcChart
              data={activeModeData.pmcSeries || []}
              currentCtl={activeModeData.current?.ctl || 0}
              currentAtl={activeModeData.current?.atl || 0}
              currentTsb={activeModeData.current?.tsb || 0}
              rampRate={activeModeData.current?.rampRate || 0}
              formPct={activeModeData.current?.formPct || 0}
              mode={scaleMode}
              onToggleMode={setScaleMode}
              scaleDescription={activeModeData.scaleDescription}
            />

            {/* Middle Grid: Injury Risk & Load Balance + Intensity & Recovery */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ACWR & Monotony / Strain */}
              <div className="lg:col-span-1">
                <AcwrCard
                  acwr={activeModeData.acwr?.acwr || 1.0}
                  status={activeModeData.acwr?.status || "sweet_spot"}
                  label={activeModeData.acwr?.label || "Baseline"}
                  description={activeModeData.acwr?.description || ""}
                  monotony={activeModeData.monotony?.monotony || 0}
                  strain={activeModeData.monotony?.strain || 0}
                  monotonyAlert={activeModeData.monotony?.monotonyAlert || false}
                />
              </div>

              {/* TID 80/20 & Decoupling */}
              <div className="lg:col-span-1">
                <TidCard
                  z1z2Pct={dashboardData.tid?.z1z2Pct || 80}
                  z3Pct={dashboardData.tid?.z3Pct || 15}
                  z4z5Pct={dashboardData.tid?.z4z5Pct || 5}
                  isPolarized={dashboardData.tid?.isPolarized ?? true}
                  avgDecoupling={dashboardData.trail?.avgDecoupling || 3.5}
                />
              </div>

              {/* Recovery Radar */}
              <div className="lg:col-span-1">
                <RecoveryRadar
                  recoveryScore={dashboardData.current?.recoveryScore || 82}
                  hrvRmssd={dashboardData.current?.hrvRmssd || 68}
                  hrvStatus={dashboardData.current?.hrvStatus || "NORMAL"}
                  restingHr={dashboardData.current?.restingHr || 48}
                  sleepHours={dashboardData.current?.sleepHours || "7.5"}
                  date={dashboardData.current?.date}
                />
              </div>
            </div>

            {/* Suite Tabs: Road EvoLab vs Trail & Mountain */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <button
                  onClick={() => setActiveTab("evolab")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                    activeTab === "evolab"
                      ? "bg-orange-500/10 text-orange-400 border border-orange-500/30"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  <Trophy className="h-4 w-4" />
                  <span>Road EvoLab & Race Predictor</span>
                </button>

                <button
                  onClick={() => setActiveTab("trail")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                    activeTab === "trail"
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  <Mountain className="h-4 w-4" />
                  <span>Trail & Mountain Running Suite</span>
                </button>
              </div>

              <div className={activeTab === "evolab" ? "block" : "hidden"}>
                <EvoLabSuite
                  racePredictor={
                    dashboardData.racePredictor || {
                      fiveKmSeconds: 1200,
                      tenKmSeconds: 2500,
                      halfMarathonSeconds: 5600,
                      marathonSeconds: 12000,
                      runningFitness: 65,
                      marathonLevel: 68,
                    }
                  }
                />
              </div>

              <div className={activeTab === "trail" ? "block" : "hidden"}>
                <TrailSuite
                  totalGain={dashboardData.trail?.totalElevationGain || 0}
                  totalLoss={dashboardData.trail?.totalElevationLoss || 0}
                  avgVam={dashboardData.trail?.avgVam || 520}
                  trailActivitiesCount={dashboardData.trail?.trailActivitiesCount || 0}
                  flatMarathonPaceSec={
                    dashboardData.racePredictor?.marathonSeconds
                      ? Math.round(dashboardData.racePredictor.marathonSeconds / 42.195)
                      : 318
                  }
                  thisWeekGain={dashboardData.trail?.thisWeekGain}
                  thisWeekDistanceKm={dashboardData.trail?.thisWeekDistanceKm}
                  thisWeekDensity={dashboardData.trail?.thisWeekDensity}
                  rolling7dGain={dashboardData.trail?.rolling7dGain}
                  rolling7dDistanceKm={dashboardData.trail?.rolling7dDistanceKm}
                  rolling7dDensity={dashboardData.trail?.rolling7dDensity}
                  trailOnlyDensity={dashboardData.trail?.trailOnlyDensity}
                  savedTargetRaceDist={dashboardData.trail?.targetRaceDist}
                  savedTargetRaceElev={dashboardData.trail?.targetRaceElev}
                  savedWeeklyVertTarget={dashboardData.trail?.weeklyVertTarget}
                  savedTrainingTier={dashboardData.trail?.trainingTier}
                />
              </div>
            </div>

            {/* Activities Feed & Workout Deep Dive (Compact Preview) */}
            <ActivityFeed
              activities={dashboardData.activities || []}
              compact={true}
              maxCompactItems={4}
            />
          </>
        )}
      </main>

      {/* Slide-out AI Coach Panel */}
      <AiCoachDrawer
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentTsb={dashboardData?.current?.tsb || 0}
        acwr={dashboardData?.acwr?.acwr || 1.0}
      />

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
