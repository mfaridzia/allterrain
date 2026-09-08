"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ShieldCheck,
  Mountain,
  Brain,
  Layers,
  Scale,
  Lock,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  HeartPulse,
  Compass,
  Gauge,
  Sparkles,
  Key,
  CheckCircle2,
} from "lucide-react";
import { Header } from "@/components/Header";
import { useTranslation } from "@/lib/i18n/context";
import { useManualTokenMutation } from "@/lib/queries";

export default function FeaturesPage() {
  const { t } = useTranslation();
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualError, setManualError] = useState("");
  const manualTokenMutation = useManualTokenMutation();
  const savingManual = manualTokenMutation.isPending;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setManualError("");
    try {
      await manualTokenMutation.mutateAsync(manualToken.trim());
      window.location.href = "/";
    } catch (err: any) {
      setManualError(err.message || t("landing.manualTokenError", "Failed to set manual token"));
    }
  };

  const pillars = [
    {
      id: "pmc",
      icon: Activity,
      iconBg: "bg-orange-500 text-white",
      tagBg: "bg-orange-100 text-orange-950 border-orange-950",
      title: t("featuresPage.p1Title", "1. Banister PMC & Exponential Moving Averages"),
      subtitle: t("featuresPage.p1Subtitle", "Eric Banister Impulse-Response Model (1975)"),
      desc: t(
        "featuresPage.p1Desc",
        "Calculates Chronic Training Load (CTL / Fitness, 42-day rolling EWMA) and Acute Training Load (ATL / Fatigue, 7-day EWMA) to derive Training Stress Balance (TSB / Form = CTL - ATL). Supports both COROS Native 0-100 baseline normalization and Intervals.icu absolute load scaling, complete with 5 discrete Form Zones and Ramp Rate velocity tracking to prevent overreaching spikes."
      ),
      tags: ["CTL (42d EWMA)", "ATL (7d EWMA)", "TSB = CTL - ATL", "Ramp Rate", "Dual Scale Mode"],
    },
    {
      id: "acwr",
      icon: Gauge,
      iconBg: "bg-amber-500 text-zinc-950",
      tagBg: "bg-amber-100 text-amber-950 border-amber-950",
      title: t("featuresPage.p2Title", "2. Adaptive Readiness & ACWR Workload Governor"),
      subtitle: t("featuresPage.p2Subtitle", "Dr. Tim Gabbett ACWR Injury Prevention Paradigm"),
      desc: t(
        "featuresPage.p2Desc",
        "Continuously monitors the Acute:Chronic Workload Ratio (ACWR). Values between 0.8–1.3 represent the safe 'Sweet Spot', 1.3–1.5 trigger fatigue warnings, and >1.5 activate the physiological safety governor. Dynamically prescribes target mileage and intensity for Today and Tomorrow, automatically downshifting when fatigue compromises musculoskeletal safety."
      ),
      tags: ["ACWR Ratio", "Sweet Spot (0.8–1.3)", "Safety Governor", "Dynamic Daily Prescriptions"],
    },
    {
      id: "polarization",
      icon: Layers,
      iconBg: "bg-blue-500 text-white",
      tagBg: "bg-blue-100 text-blue-950 border-blue-950",
      title: t("featuresPage.p3Title", "3. Weekly 80/20 Polarization & Zone Progression"),
      subtitle: t("featuresPage.p3Subtitle", "Dr. Stephen Seiler Polarized Endurance Model"),
      desc: t(
        "featuresPage.p3Desc",
        "Quantifies time-in-zone across Zone 1-2 (Aerobic Base), Zone 3-4 (Threshold / Grey Zone), and Zone 5+ (High Intensity). Diagnoses whether an athlete is falling into the recreational trap of 'training too hard on easy days and too exhausted on hard days'. Tracks multi-week zone progressions against ideal 80/20 and Pyramidal benchmarks."
      ),
      tags: ["80/20 Zone Split", "Pyramidal vs Polarized", "Grey Zone Detection", "Weekly Zone Progression"],
    },
    {
      id: "trail",
      icon: Mountain,
      iconBg: "bg-cyan-500 text-zinc-950",
      tagBg: "bg-cyan-100 text-cyan-950 border-cyan-950",
      title: t("featuresPage.p4Title", "4. Trail GPX Simulator, Historical VAM & Fueling"),
      subtitle: t("featuresPage.p4Subtitle", "Mountain Ascent Velocity (VAM) & Ultra Hydration Protocol"),
      desc: t(
        "featuresPage.p4Desc",
        "Upload any GPX course file to interactively inspect elevation gain (D+), loss (D-), and grade difficulty. Dynamically extracts your historical VAM (vertical ascent meters/hour) from previous COROS mountain sessions to predict realistic race finish times, accompanied by an hourly carbohydrate (40-90g/hr), electrolyte, and hydration pacing strategy."
      ),
      tags: ["GPX Elevation Profile", "Historical VAM (m/hr)", "Finish Estimator", "Hourly Nutrition Plan"],
    },
    {
      id: "compare",
      icon: Scale,
      iconBg: "bg-purple-500 text-white",
      tagBg: "bg-purple-100 text-purple-950 border-purple-950",
      title: t("featuresPage.p5Title", "5. Head-to-Head Compare & Cardiac Drift (Pa:HR)"),
      subtitle: t("featuresPage.p5Subtitle", "Aerobic Decoupling & Mitochondrial Durability Analysis"),
      desc: t(
        "featuresPage.p5Desc",
        "Compare any two training sessions side-by-side with split-by-split pace differences and elevation overlays. Calculates Pa:HR aerobic decoupling between the first and second half of runs; decoupling below 5% demonstrates superior aerobic durability and heat/fuel stability, while decoupling above 5% highlights cardiovascular strain or dehydration."
      ),
      tags: ["Pa:HR Decoupling (< 5%)", "Side-by-Side Workout Compare", "KM Split Delta", "Cardiac Drift"],
    },
    {
      id: "ai-coach",
      icon: Brain,
      iconBg: "bg-rose-500 text-white",
      tagBg: "bg-rose-100 text-rose-950 border-rose-950",
      title: t("featuresPage.p6Title", "6. BYOK Contextual AI Coach"),
      subtitle: t("featuresPage.p6Subtitle", "Multi-LLM Intelligence (DeepSeek, Claude, GPT, Gemini)"),
      desc: t(
        "featuresPage.p6Desc",
        "Bring Your Own Key (BYOK) for total privacy and zero rate limits. Unlike standard generic AI chats, the AllTerrain coach receives your exact training telemetry in its system prompt—including real-time CTL, ATL, TSB, recovery score, recent sleep/HRV, and past workouts—enabling deep, contextual answers for tapering, pacing, and recovery questions."
      ),
      tags: ["BYOK Privacy", "DeepSeek / Claude / OpenAI / Gemini", "Real-time Telemetry Prompt", "Zero Quota Limits"],
    },
    {
      id: "privacy",
      icon: Lock,
      iconBg: "bg-emerald-500 text-white",
      tagBg: "bg-emerald-100 text-emerald-950 border-emerald-950",
      title: t("featuresPage.p7Title", "7. Zero-Knowledge Privacy & Official COROS MCP"),
      subtitle: t("featuresPage.p7Subtitle", "Encrypted SQLite Storage & Direct Hardware Telemetry"),
      desc: t(
        "featuresPage.p7Desc",
        "Direct integration via official COROS MCP / API protocols. Your athlete tokens, heart rate data, and GPS telemetry are stored locally in your private encrypted database. No analytics trackers, no third-party data selling, no vendor lock-in."
      ),
      tags: ["Official COROS MCP", "Private SQLite Encrypted", "No Trackers / Ads", "Data Sovereignty"],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-zinc-950 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border-2 border-zinc-950 font-black text-xs text-zinc-900 shadow-[2px_2px_0px_0px_#09090b] hover:bg-zinc-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>{t("featuresPage.backToHome", "Back to Dashboard")}</span>
          </Link>

          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
            ALLTERRAIN v2.0
          </span>
        </div>

        {/* Hero Header */}
        <section className="text-center space-y-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
            <Sparkles className="h-3.5 w-3.5 text-orange-600" />
            <span className="text-[11px] font-black uppercase tracking-wider text-orange-950">
              {t("featuresPage.badge", "Sports Science & Exercise Physiology")}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-950 leading-tight">
            {t("featuresPage.heroTitle", "Inside the Engine: AllTerrain Methodology")}
          </h1>

          <p className="text-zinc-700 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-medium">
            {t(
              "featuresPage.heroSubtitle",
              "Bridging raw COROS wearable telemetry and actionable sports science. Designed for marathoners, trail runners, and coaches who demand precision."
            )}
          </p>
        </section>

        {/* Pillars List */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b-2 border-zinc-300 pb-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-800">
              {t("featuresPage.pillarsTitle", "Core Architectural Pillars")}
            </h2>
            <span className="text-xs font-bold text-zinc-500">7 Core Engines</span>
          </div>

          <div className="space-y-4">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article
                  key={pillar.id}
                  className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] space-y-4 hover:-translate-y-0.5 transition-transform"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-xl border-2 border-zinc-950 flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_#09090b] ${pillar.iconBg}`}
                      >
                        <Icon className="h-5 w-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <h3 className="font-black text-base sm:text-lg text-zinc-950 leading-snug">
                          {pillar.title}
                        </h3>
                        <p className="text-xs font-bold text-zinc-500 mt-0.5">
                          {pillar.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-700 font-medium leading-relaxed">
                    {pillar.desc}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {pillar.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border-2 ${pillar.tagBg} shadow-[1px_1px_0px_0px_#09090b]`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA Block */}
        <section className="p-6 sm:p-8 rounded-2xl bg-[#FFEBD9] border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] text-center space-y-5">
          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
              {t("featuresPage.connectCtaTitle", "Ready to elevate your training with real science?")}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-700 font-medium leading-relaxed">
              {t(
                "featuresPage.connectCtaSubtitle",
                "Connect your COROS account in seconds. Zero ads, zero tracking, your data stays in your private encrypted database."
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href="/api/auth/coros/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#09090b] transition-all"
            >
              <span>{t("featuresPage.connectButton", "Connect COROS Account")}</span>
              <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </a>

            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white border-2 border-zinc-950 text-zinc-950 font-black text-xs shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-zinc-100 transition-all cursor-pointer"
            >
              <Key className="h-3.5 w-3.5 text-zinc-950 stroke-[2.5]" />
              <span>{t("featuresPage.manualTokenButton", "Use Bearer Token")}</span>
            </button>
          </div>

          {/* Manual Token Form Drawer */}
          {showManualInput && (
            <div className="max-w-md mx-auto p-4 rounded-xl bg-white border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] text-left space-y-2.5">
              <label className="block text-xs font-black text-zinc-950">
                {t("landing.manualTokenTitle", "Paste COROS Bearer / Access Token")}
              </label>
              <form onSubmit={handleManualSubmit} className="space-y-2.5">
                <input
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder={t("landing.manualTokenPlaceholder", "eyJhbGciOi...")}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1px_1px_0px_0px_#09090b]"
                />
                {manualError && <p className="text-xs text-rose-600 font-bold">{manualError}</p>}
                <button
                  type="submit"
                  disabled={savingManual || !manualToken.trim()}
                  className="w-full py-2 text-xs font-black rounded-lg bg-orange-500 hover:bg-orange-600 text-white border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 transition-all cursor-pointer"
                >
                  {savingManual
                    ? t("landing.manualTokenConnecting", "Connecting...")
                    : t("landing.manualTokenSubmit", "Save & Load Dashboard")}
                </button>
              </form>
            </div>
          )}

          {/* Security Subtext */}
          <div className="pt-2 flex items-center justify-center">
            <p className="text-[11px] text-zinc-600 font-bold text-center flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 stroke-[2.5] mr-1.5 shrink-0" />
              <span>
                {t(
                  "landing.privacyNotice",
                  "Private & Secure: Tokens & athlete metrics are stored in your private encrypted database. Never shared with third parties."
                )}
              </span>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
