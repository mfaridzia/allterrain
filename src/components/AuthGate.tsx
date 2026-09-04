"use client";

import React, { useState } from "react";
import { Zap, ShieldCheck, Activity, Mountain, Brain, ArrowRight, Key } from "lucide-react";
import { useManualTokenMutation } from "@/lib/queries";

export const AuthGate: React.FC = () => {
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
      window.location.reload();
    } catch (err: any) {
      setManualError(err.message || "Failed to set manual token");
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#F6F4EE]">
      <div className="max-w-3xl w-full text-center space-y-8">
        {/* Glow & Badge with Official COROS Logo */}
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border-2 border-zinc-950 dark:border-zinc-700 shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000]">
          {/* Light Mode: Red emblem + dark typography */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/coros-logo.png"
            alt="COROS"
            width={78}
            height={19}
            className="h-[19px] w-[78px] object-contain shrink-0 dark:hidden"
          />
          {/* Dark Mode: Red emblem + white typography */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/coros-logo-dark.png"
            alt="COROS"
            width={78}
            height={19}
            className="h-[19px] w-[78px] object-contain shrink-0 hidden dark:block"
          />
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border-l-2 border-zinc-300 dark:border-zinc-700 pl-2.5">
            Official MCP Integration
          </span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-950 leading-tight">
            Unlock Elite <span className="underline decoration-orange-500 decoration-4">Performance Science</span> & <span className="underline decoration-cyan-500 decoration-4">Athletic</span> Analytics
          </h1>
          <p className="text-zinc-700 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-medium">
            Connect your COROS account to stream training loads, compute precise Bannister PMC curves (CTL/ATL/TSB), evaluate live recovery & readiness, and get AI-driven coaching insights.
          </p>
        </div>

        {/* Main CTA: Connect Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <a
            href="/api/auth/coros/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-base border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_#09090b] transition-all"
          >
            <span>Connect COROS Account</span>
            <ArrowRight className="h-5 w-5 stroke-[2.5]" />
          </a>

          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white border-2 border-zinc-950 text-zinc-950 font-black text-sm shadow-[3px_3px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:bg-zinc-100 transition-all cursor-pointer"
          >
            <Key className="h-4 w-4 text-zinc-950 stroke-[2.5]" />
            <span>Manual Bearer Token</span>
          </button>
        </div>

        {/* Manual Token Form Drawer */}
        {showManualInput && (
          <div className="max-w-md mx-auto p-5 rounded-2xl bg-white border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] text-left space-y-3">
            <label className="block text-xs font-black text-zinc-950">
              Paste COROS Bearer / Access Token
            </label>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1.5px_1.5px_0px_0px_#09090b]"
              />
              {manualError && <p className="text-xs text-rose-600 font-bold">{manualError}</p>}
              <button
                type="submit"
                disabled={savingManual || !manualToken.trim()}
                className="w-full py-2.5 text-xs font-black rounded-xl bg-orange-500 hover:bg-orange-600 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 transition-all cursor-pointer"
              >
                {savingManual ? "Connecting..." : "Save & Load Dashboard"}
              </button>
            </form>
          </div>
        )}

        {/* Value Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left">
          <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 space-y-2 shadow-[4px_4px_0px_0px_#09090b]">
            <div className="h-9 w-9 rounded-xl bg-blue-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Activity className="h-5 w-5 stroke-[2.5]" />
            </div>
            <h3 className="font-black text-zinc-950 text-sm">Performance Science Engine</h3>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed">
              Full PMC (Fitness CTL, Fatigue ATL, Form TSB), Form Zones, Ramp Rate, and ACWR Injury Risk analysis.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 space-y-2 shadow-[4px_4px_0px_0px_#09090b]">
            <div className="h-9 w-9 rounded-xl bg-cyan-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Mountain className="h-5 w-5 stroke-[2.5]" />
            </div>
            <h3 className="font-black text-zinc-950 text-sm">Trail & Mountain Suite</h3>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed">
              VAM (vertical ascent rate), cumulative D+/D-, and customizable trail race finish time estimator.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border-2 border-zinc-950 space-y-2 shadow-[4px_4px_0px_0px_#09090b]">
            <div className="h-9 w-9 rounded-xl bg-purple-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Brain className="h-5 w-5 stroke-[2.5]" />
            </div>
            <h3 className="font-black text-zinc-950 text-sm">BYOK AI Training Coach</h3>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed">
              Context-aware AI coach powered by Gemini, OpenAI, Claude, DeepSeek, or Ollama analyzing your live readiness.
            </p>
          </div>
        </div>

        {/* Security & Privacy Badge */}
        <div className="pt-4 flex items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 font-bold">
          <ShieldCheck className="h-4 w-4 text-emerald-600 stroke-[2.5]" />
          <span>Private & Secure: Tokens & athlete metrics are stored in your private encrypted database. Never shared with third parties.</span>
        </div>
      </div>
    </div>
  );
};
