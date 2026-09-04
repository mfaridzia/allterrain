"use client";

import React, { useState } from "react";
import { Zap, ShieldCheck, Activity, Mountain, Brain, ArrowRight, Key } from "lucide-react";

export const AuthGate: React.FC = () => {
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState("");

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    setSavingManual(true);
    setManualError("");

    try {
      // Save direct token to settings
      const res = await fetch("/api/auth/coros/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: manualToken.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to save token");
      }

      window.location.reload();
    } catch (err: any) {
      setManualError(err.message || "Failed to set manual token");
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full text-center space-y-8">
        {/* Glow & Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold uppercase tracking-wider">
          <Zap className="h-4 w-4 text-orange-500" />
          Official COROS MCP Integration
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Unlock Elite <span className="text-orange-500">Intervals.icu</span> & <span className="text-cyan-400">Trail</span> Analytics
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Connect your COROS account to stream training loads, compute precise Bannister PMC curves (CTL/ATL/TSB), predict trail finish times with VAM, and get AI-driven coaching insights.
          </p>
        </div>

        {/* Main CTA: Connect Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <a
            href="/api/auth/coros/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-base shadow-xl shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Connect COROS Account</span>
            <ArrowRight className="h-5 w-5" />
          </a>

          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-medium text-sm transition-all hover:bg-zinc-800"
          >
            <Key className="h-4 w-4 text-zinc-400" />
            <span>Manual Bearer Token</span>
          </button>
        </div>

        {/* Manual Token Form Drawer */}
        {showManualInput && (
          <div className="max-w-md mx-auto p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-left space-y-3">
            <label className="block text-xs font-semibold text-zinc-300">
              Paste COROS Bearer / Access Token
            </label>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-orange-500"
              />
              {manualError && <p className="text-xs text-red-400">{manualError}</p>}
              <button
                type="submit"
                disabled={savingManual || !manualToken.trim()}
                className="w-full py-2 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors"
              >
                {savingManual ? "Connecting..." : "Save & Load Dashboard"}
              </button>
            </form>
          </div>
        )}

        {/* Value Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left">
          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-sm">Intervals.icu Engine</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Full PMC (Fitness CTL, Fatigue ATL, Form TSB), Form Zones, Ramp Rate, and ACWR Injury Risk analysis.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
            <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Mountain className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-sm">Trail & Mountain Suite</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              VAM (vertical ascent rate), cumulative D+/D-, and customizable trail race finish time estimator.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Brain className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-sm">BYOK AI Training Coach</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Context-aware AI coach powered by Gemini, OpenAI, Claude, or Ollama analyzing your live readiness.
            </p>
          </div>
        </div>

        {/* Security & Privacy Badge */}
        <div className="pt-4 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Private & Secure: Tokens & athlete metrics stored locally in your SQLite database.</span>
        </div>
      </div>
    </div>
  );
};
