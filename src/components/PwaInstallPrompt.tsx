"use client";

import React, { useState, useEffect } from "react";
import { Download, Share, PlusSquare, X, Smartphone } from "lucide-react";

const DISMISS_STORAGE_KEY = "allterrain_pwa_dismissed_until";
const DISMISS_DAYS = 7;

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Default true to prevent SSR flicker
  const [isDismissed, setIsDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 1. Check if already installed / running standalone
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    setIsStandalone(standaloneMode);
    if (standaloneMode) return;

    // 2. Check if dismissed recently
    try {
      const dismissedUntil = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } catch {
      setIsDismissed(false);
    }

    // 3. Register Service Worker in production or supported environments
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered successfully, scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("Service Worker registration failed:", err);
        });
    }

    // 4. Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setIsIos(isIosDevice);

    // 5. Intercept Android / Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(DISMISS_STORAGE_KEY, String(until));
    } catch {}
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsDismissed(true);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error("Install prompt error:", err);
    }
  };

  if (!mounted || isStandalone || isDismissed) {
    return null;
  }

  // Only show if we either have the native prompt (Android/Chromium) OR we're on iOS Safari
  const showAndroidBanner = !!deferredPrompt;
  const showIosBanner = isIos && !deferredPrompt;

  if (!showAndroidBanner && !showIosBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="relative p-4 rounded-2xl bg-[#FBF9F3] dark:bg-zinc-900 border-2 border-zinc-950 dark:border-zinc-700 shadow-[4px_4px_0px_0px_#09090b] dark:shadow-[4px_4px_0px_0px_#000000] text-zinc-950 dark:text-zinc-100">
        {/* Dismiss X button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1 rounded-lg text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content Header */}
        <div className="flex items-start gap-3.5 pr-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000]">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 3L4 18H8.5L12 11.5L15.5 18H20L12 3Z" fill="white" />
              <rect x="3" y="19.5" width="18" height="2" rx="1" fill="white" />
            </svg>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-black uppercase tracking-wider text-orange-600 dark:text-orange-500">
                Install Web App
              </span>
            </div>
            <h3 className="text-sm font-black tracking-tight leading-tight">
              {showIosBanner
                ? "Add ALLTERRAIN to Home Screen"
                : "Install ALLTERRAIN App"}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug">
              {showIosBanner
                ? "Launch like a native app without browser bars for instant access to your COROS workout analytics."
                : "Fast home screen access with a fullscreen experience, smoother performance, and offline caching."}
            </p>
          </div>
        </div>

        {/* iOS Step-by-Step Instructions */}
        {showIosBanner && (
          <div className="mt-3.5 pt-3 border-t-2 border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 font-medium">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 font-bold font-mono text-[10px]">
                1
              </span>
              <span className="flex-1 flex items-center gap-1.5">
                Tap the Share icon
                <Share className="h-4 w-4 text-sky-600 dark:text-sky-400 inline shrink-0" />
                in Safari's bottom toolbar
              </span>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 font-medium">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 font-bold font-mono text-[10px]">
                2
              </span>
              <span className="flex-1 flex items-center gap-1.5">
                Scroll down and tap
                <span className="font-bold flex items-center gap-1">
                  Add to Home Screen
                  <PlusSquare className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300 inline shrink-0" />
                </span>
              </span>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-black rounded-lg bg-white dark:bg-zinc-800 border-2 border-zinc-950 dark:border-zinc-700 shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        )}

        {/* Android / Desktop Install Action Button */}
        {showAndroidBanner && (
          <div className="mt-3.5 pt-3 border-t-2 border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
            <button
              onClick={handleDismiss}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors px-2 py-1"
            >
              Maybe Later
            </button>

            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-black rounded-xl bg-orange-500 hover:bg-orange-600 text-white border-2 border-zinc-950 shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install to Home Screen</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
