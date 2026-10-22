"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthGate } from "@/components/AuthGate";
import { PmcChart } from "@/components/PmcChart";
import { AcwrCard } from "@/components/AcwrCard";
import { TidCard } from "@/components/TidCard";
import { TrailSuite } from "@/components/TrailSuite";
import { EvoLabSuite } from "@/components/EvoLabSuite";
import { RecoveryRadar } from "@/components/RecoveryRadar";
import { TrainingReadinessCard } from "@/components/TrainingReadinessCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { WeeklyZoneProgressionCard } from "@/components/WeeklyZoneProgressionCard";
import { PeriodizationSuite } from "@/components/PeriodizationSuite";
import dynamic from "next/dynamic";
import { Trophy, Mountain, RefreshCw, AlertCircle, CheckCircle2, Layers, Calendar } from "lucide-react";
import { useDashboardData, useSyncCorosMutation, useDisconnectMutation } from "@/lib/queries";
import { useTranslation } from "@/lib/i18n/context";

const AiCoachDrawer = dynamic(
  () => import("@/components/AiCoachDrawer").then((mod) => mod.AiCoachDrawer),
  { ssr: false }
);
const SettingsModal = dynamic(
  () => import("@/components/SettingsModal").then((mod) => mod.SettingsModal),
  { ssr: false }
);

export default function DashboardPage() {
  const { t, language } = useTranslation();
  const { data: dashboardData, isLoading: loading } = useDashboardData();
  const syncMutation = useSyncCorosMutation();
  const disconnectMutation = useDisconnectMutation();
  const isSyncing = syncMutation.isPending;

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"evolab" | "trail" | "periodization" | "zones">("evolab");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<"coros" | "intervals">("coros");

  // Save session ID to localStorage if passed in redirect (vital for in-app mobile browsers like Threads/IG)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        const sid = url.searchParams.get("sid");
        if (sid) {
          localStorage.setItem("allterrain_session", sid);
          url.searchParams.delete("sid");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
        if (url.searchParams.get("coach") === "open" || url.searchParams.get("coach") === "1") {
          setIsAiOpen(true);
          url.searchParams.delete("coach");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
      } catch {}
    }
  }, []);

  const handleSync = async () => {
    setSyncMessage(null);
    try {
      const json = await syncMutation.mutateAsync();
      if (json.success) {
        setSyncMessage(`Synced ${json.syncedActivities || 0} activities & recalculated PMC.`);
      } else {
        setSyncMessage(`Sync notice: ${json.error || "Connected to MCP"}`);
      }
    } catch (err: any) {
      setSyncMessage(`Sync notice: ${err.message}`);
    } finally {
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your COROS account?")) return;
    await disconnectMutation.mutateAsync();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-orange-400 border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] flex items-center justify-center text-black animate-spin">
          <RefreshCw className="h-6 w-6" />
        </div>
        <p className="text-xs font-black text-zinc-900 uppercase tracking-wider">
          {t("landing.loadingAthleteEngine", "Loading Athlete Intelligence Engine...")}
        </p>
      </div>
    );
  }

  const isConnected = dashboardData?.connected;

  const activeModeData = dashboardData?.modes?.[scaleMode] || {
    current: dashboardData?.current || { ctl: 0, atl: 0, tsb: 0, rampRate: 0, formPct: 0 },
    pmcSeries: dashboardData?.pmcSeries || [],
    acwr: dashboardData?.acwr || { acwr: 1.0, status: "sweet_spot", label: "Optimal Sweet Spot", description: "" },
    monotony: dashboardData?.monotony || { monotony: 0, strain: 0, monotonyAlert: false },
    readiness: dashboardData?.readiness,
    scaleDescription: "",
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-zinc-950 flex flex-col font-sans">
      <Header
        connected={isConnected}
        onSync={handleSync}
        isSyncing={isSyncing}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleAi={() => setIsAiOpen(!isAiOpen)}
        onDisconnect={handleDisconnect}
        isAiOpen={isAiOpen}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-24 sm:pb-6">
        {syncMessage && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-100 border-2 border-zinc-950 text-xs font-bold text-amber-950 shadow-[3px_3px_0px_0px_#09090b]">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
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

            {/* Daily Science Prescription: Training Readiness & Suggestion */}
            <TrainingReadinessCard readiness={activeModeData.readiness} />

            {/* Middle Grid: Injury Risk & Load Balance + Intensity & Recovery */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* ACWR & Monotony / Strain */}
              <div className="lg:col-span-1 flex flex-col h-full">
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
              <div className="lg:col-span-1 flex flex-col h-full">
                <TidCard
                  z1z2Pct={dashboardData.tid?.z1z2Pct || 80}
                  z3Pct={dashboardData.tid?.z3Pct || 15}
                  z4z5Pct={dashboardData.tid?.z4z5Pct || 5}
                  isPolarized={dashboardData.tid?.isPolarized ?? true}
                  avgDecoupling={dashboardData.trail?.avgDecoupling || 3.5}
                  windowDays={dashboardData.tid?.windowDays || 28}
                  onOpenZonesTab={() => {
                    setActiveTab("zones");
                    setTimeout(() => {
                      const el = document.getElementById("suite-tabs");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }, 50);
                  }}
                />
              </div>

              {/* Recovery Radar */}
              <div className="lg:col-span-1 flex flex-col h-full">
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

            {/* Suite Tabs: Road EvoLab vs Trail & Mountain vs Weekly Zones */}
            <div id="suite-tabs" className="space-y-4">
              <div className="flex items-center gap-2 p-1 -m-1 pb-2 overflow-x-auto max-w-full">
                <button
                  onClick={() => setActiveTab("evolab")}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black rounded-xl border-2 border-zinc-950 transition-all shrink-0 ${
                    activeTab === "evolab"
                      ? "bg-orange-400 text-black shadow-[3px_3px_0px_0px_#09090b] -translate-y-0.5"
                      : "bg-white text-zinc-700 hover:text-black hover:bg-zinc-50 shadow-[2px_2px_0px_0px_#09090b] dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Trophy className="h-4 w-4 text-zinc-950 shrink-0" />
                  <span className="sm:inline hidden">Road EvoLab & Race Predictor</span>
                  <span className="sm:hidden inline">Road & Race</span>
                </button>

                <button
                  onClick={() => setActiveTab("trail")}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black rounded-xl border-2 border-zinc-950 transition-all shrink-0 ${
                    activeTab === "trail"
                      ? "bg-cyan-400 text-black shadow-[3px_3px_0px_0px_#09090b] -translate-y-0.5"
                      : "bg-white text-zinc-700 hover:text-black hover:bg-zinc-50 shadow-[2px_2px_0px_0px_#09090b] dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Mountain className="h-4 w-4 text-zinc-950 shrink-0" />
                  <span className="sm:inline hidden">Trail & Mountain Running</span>
                  <span className="sm:hidden inline">Trail & Mountain</span>
                </button>

                <button
                  onClick={() => setActiveTab("periodization")}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black rounded-xl border-2 border-zinc-950 transition-all shrink-0 ${
                    activeTab === "periodization"
                      ? "bg-emerald-400 text-black shadow-[3px_3px_0px_0px_#09090b] -translate-y-0.5"
                      : "bg-white text-zinc-700 hover:text-black hover:bg-zinc-50 shadow-[2px_2px_0px_0px_#09090b] dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Calendar className="h-4 w-4 text-zinc-950 shrink-0" />
                  <span className="sm:inline hidden">
                    {language === "en" ? "Periodization & Mesocycle" : "Periodisasi & Mesosiklus"}
                  </span>
                  <span className="sm:hidden inline">
                    {language === "en" ? "Periodization" : "Periodisasi"}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("zones")}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black rounded-xl border-2 border-zinc-950 transition-all shrink-0 ${
                    activeTab === "zones"
                      ? "bg-violet-400 text-black shadow-[3px_3px_0px_0px_#09090b] -translate-y-0.5"
                      : "bg-white text-zinc-700 hover:text-black hover:bg-zinc-50 shadow-[2px_2px_0px_0px_#09090b] dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Layers className="h-4 w-4 text-zinc-950 shrink-0" />
                  <span className="sm:inline hidden">Weekly Zones & 80/20</span>
                  <span className="sm:hidden inline">Weekly 80/20</span>
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
                  uphill={dashboardData.trail?.uphill}
                />
              </div>

              <div className={activeTab === "periodization" ? "block" : "hidden"}>
                <PeriodizationSuite
                  currentCtl={activeModeData.current?.ctl || 42}
                  currentAtl={activeModeData.current?.atl || 42}
                  currentTsb={activeModeData.current?.tsb || 0}
                  thisWeekDistanceKm={dashboardData.trail?.thisWeekDistanceKm || 0}
                  thisWeekGain={dashboardData.trail?.thisWeekGain || 0}
                  thisWeekLoad={
                    scaleMode === "intervals"
                      ? (dashboardData.periodization?.thisWeekRtss ?? dashboardData.periodization?.thisWeekLoad ?? 0)
                      : (dashboardData.periodization?.thisWeekLoad ?? 0)
                  }
                  scaleMode={scaleMode}
                  onToggleScaleMode={setScaleMode}
                  savedMode={dashboardData.periodization?.mode}
                  savedFocus={dashboardData.periodization?.focus}
                  savedRaceDate={dashboardData.periodization?.raceDate}
                  savedRaceDist={dashboardData.periodization?.raceDist}
                  savedRaceElev={dashboardData.periodization?.raceElev}
                />
              </div>

              <div className={activeTab === "zones" ? "block" : "hidden"}>
                <WeeklyZoneProgressionCard
                  progression={dashboardData.weeklyZoneProgression}
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

      {!isConnected && <Footer />}

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
