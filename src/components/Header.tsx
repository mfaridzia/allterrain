"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  RefreshCw,
  Settings,
  Bot,
  Zap,
  LogOut,
  Mountain,
  ClipboardList,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { SettingsModal } from "./SettingsModal";
import { LanguageToggle } from "./LanguageToggle";
import { useTranslation } from "@/lib/i18n/context";
import { useAuthStatus, useSyncCorosMutation, useDisconnectMutation } from "@/lib/queries";

export interface HeaderProps {
  connected?: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
  onOpenSettings?: () => void;
  onToggleAi?: () => void;
  onDisconnect?: () => void;
  isAiOpen?: boolean;
  extraActions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  connected: externalConnected,
  onSync: externalOnSync,
  isSyncing: externalIsSyncing,
  onOpenSettings: externalOnOpenSettings,
  onToggleAi,
  onDisconnect: externalOnDisconnect,
  isAiOpen = false,
  extraActions,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [internalSettingsOpen, setInternalSettingsOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const { data: authData } = useAuthStatus();
  const syncMutation = useSyncCorosMutation();
  const disconnectMutation = useDisconnectMutation();

  const isConnected = externalConnected !== undefined ? externalConnected : !!authData?.connected;
  const isSyncing = externalIsSyncing !== undefined ? externalIsSyncing : syncMutation.isPending;

  // Auto-close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Handle ESC key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSync = async () => {
    if (externalOnSync) {
      externalOnSync();
      return;
    }
    try {
      await syncMutation.mutateAsync();
    } catch (err) {
      console.error("Manual sync failed:", err);
    }
  };

  const handleOpenSettings = () => {
    if (externalOnOpenSettings) {
      externalOnOpenSettings();
    } else {
      setInternalSettingsOpen(true);
    }
  };

  const handleDisconnect = async () => {
    if (externalOnDisconnect) {
      externalOnDisconnect();
      return;
    }

    if (window.confirm(t("nav.disconnectConfirm", "Are you sure you want to disconnect your COROS account?"))) {
      try {
        await disconnectMutation.mutateAsync();
        window.location.href = "/";
      } catch (err) {
        console.error("Disconnect failed:", err);
      }
    }
  };

  const navLinks = [
    {
      href: "/",
      label: t("nav.home", "Overview"),
      shortLabel: t("nav.home", "Overview"),
      description: "Load metrics summary & PMC chart",
      icon: Activity,
      exact: true,
    },
    {
      href: "/trail-planner",
      label: t("nav.trailPlanner", "GPX Planner"),
      shortLabel: "GPX Plan",
      description: "Trail elevation profile & route simulation",
      icon: Mountain,
      exact: false,
    },
    {
      href: "/activities",
      label: t("nav.activities", "Logbook"),
      shortLabel: t("nav.activities", "Logbook"),
      description: "COROS activity history & logbook",
      icon: ClipboardList,
      exact: false,
    },
  ];

  const isLinkActive = (href: string, exact: boolean) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const handleCoachClick = () => {
    if (onToggleAi) {
      onToggleAi();
    } else {
      router.push("/?coach=open");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b-2 border-zinc-950 dark:border-zinc-800 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 shadow-[0_3px_0px_0px_#09090b] dark:shadow-[0_3px_0px_0px_#000000] transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand & Left Navigation */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2.5 group transition-transform active:scale-95"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white border-2 border-zinc-950 shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] group-hover:-translate-y-0.5 transition-transform">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 3L4 18H8.5L12 11.5L15.5 18H20L12 3Z" fill="white" />
                  <rect x="3" y="19.5" width="18" height="2" rx="1" fill="white" />
                </svg>
              </div>
              <div className="flex items-center">
                <span className="text-base sm:text-lg font-black tracking-tight text-zinc-950 dark:text-zinc-100 flex items-center">
                  ALL<span className="text-orange-600">TERRAIN</span>
                </span>
              </div>
            </Link>

            {/* Primary Neo-Brutalist Segmented Route Navigation - Desktop */}
            {isConnected && (
              <nav className="hidden md:flex items-center gap-1 p-1 bg-[#F0EDE4] dark:bg-zinc-900 rounded-xl border-2 border-zinc-950 dark:border-zinc-700 shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000]">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const active = isLinkActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                        active
                          ? "bg-white text-zinc-950 font-black border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600 dark:shadow-[2px_2px_0px_0px_#000000]"
                          : "text-zinc-600 hover:text-zinc-950 font-bold hover:bg-white/60 border-2 border-transparent dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 ${
                          active ? "text-orange-600" : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Custom page actions passed from children */}
            {isConnected && extraActions && (
              <div className="flex items-center gap-1.5 border-r-2 border-zinc-300 dark:border-zinc-700 pr-1.5 sm:pr-2.5 mr-0.5">
                {extraActions}
              </div>
            )}

            {/* Language Toggle */}
            <LanguageToggle />

            {/* Authenticated Controls */}
            {isConnected && (
              <>
                {/* Connection Status Indicator - Desktop */}
                <div
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border-2 border-zinc-950 dark:border-zinc-700 text-emerald-950 dark:text-emerald-300 text-xs font-bold font-mono shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000]"
                  title="COROS MCP connected"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse border border-zinc-950 dark:border-zinc-700" />
                  <span>{t("common.online", "Online")}</span>
                </div>

                {/* Manual Sync Button - Desktop */}
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-white dark:bg-zinc-800 border-2 border-zinc-950 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-950 dark:text-zinc-100 transition-all shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
                  title="Sync with COROS MCP"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-orange-600" : ""}`}
                  />
                  <span>{isSyncing ? t("common.syncing", "Syncing...") : t("common.sync", "Sync")}</span>
                </button>

                {/* AI Coach Trigger - Desktop */}
                {onToggleAi && (
                  <button
                    onClick={onToggleAi}
                    className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl border-2 border-zinc-950 dark:border-zinc-700 transition-all shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                      isAiOpen
                        ? "bg-orange-500 text-white"
                        : "bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-950 dark:text-zinc-100"
                    }`}
                    title="Open AI Coach Drawer"
                  >
                    <Bot className={`h-3.5 w-3.5 ${isAiOpen ? "text-white" : "text-orange-600"}`} />
                    <span>AI Coach</span>
                  </button>
                )}

                {/* Settings Trigger - Desktop */}
                <button
                  onClick={handleOpenSettings}
                  className="hidden md:flex p-1.5 text-zinc-950 dark:text-zinc-100 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-xl border-2 border-zinc-950 dark:border-zinc-700 shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                  title="Settings & API Keys"
                >
                  <Settings className="h-4 w-4" />
                </button>

                {/* Disconnect Button - Desktop */}
                <button
                  onClick={handleDisconnect}
                  className="hidden md:flex p-1.5 text-rose-600 dark:text-rose-400 bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border-2 border-zinc-950 dark:border-zinc-700 shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                  title="Disconnect COROS Account"
                >
                  <LogOut className="h-4 w-4" />
                </button>

                {/* Mobile Menu Hamburger Toggle */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label={isMobileMenuOpen ? "Close settings and account menu" : "Open settings and account menu"}
                  aria-expanded={isMobileMenuOpen}
                  className="md:hidden flex items-center justify-center p-2 text-zinc-950 dark:text-zinc-100 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-xl border-2 border-zinc-950 dark:border-zinc-700 shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                >
                  {isMobileMenuOpen ? (
                    <X className="h-4 w-4 text-orange-600" />
                  ) : (
                    <Menu className="h-4 w-4" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Settings & Integration Drawer Panel */}
        {isConnected && isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 z-40 bg-[#F6F4EE] dark:bg-[#09090b] border-b-2 border-zinc-950 dark:border-zinc-800 shadow-[0_6px_0_0_#09090b] dark:shadow-[0_6px_0_0_#000000] p-4 space-y-3.5 max-h-[calc(100vh-70px)] overflow-y-auto animate-in slide-in-from-top-2 duration-150">
            <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1 flex items-center justify-between">
              <span>Account & Device Integration</span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse border border-zinc-950 dark:border-zinc-700" />
                COROS Online
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Sync Action */}
              <button
                onClick={() => {
                  handleSync();
                }}
                disabled={isSyncing}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border-2 border-zinc-950 dark:border-zinc-700 text-zinc-950 dark:text-zinc-100 font-black text-xs shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 transition-all"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    isSyncing ? "animate-spin text-orange-600" : "text-zinc-700 dark:text-zinc-300"
                  }`}
                />
                <span>{isSyncing ? t("common.syncing", "Syncing...") : `${t("common.sync", "Sync")} COROS`}</span>
              </button>

              {/* Settings Action */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenSettings();
                }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border-2 border-zinc-950 dark:border-zinc-700 text-zinc-950 dark:text-zinc-100 font-black text-xs shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Settings className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
                <span>{t("common.settings", "Settings")}</span>
              </button>

              {/* Disconnect Action */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleDisconnect();
                }}
                className="col-span-2 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-zinc-950 dark:border-zinc-700 text-rose-700 dark:text-rose-400 font-black text-xs shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                <span>{t("nav.disconnect", "Disconnect")}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Backdrop Overlay */}
      {isConnected && isMobileMenuOpen && (
        <div
          className="fixed inset-0 top-[57px] sm:top-[61px] bg-zinc-950/40 backdrop-blur-[2px] z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Fixed Mobile Bottom Navigation Bar (5-Tab Segmented Neo-Brutalist with Center Sync) */}
      {isConnected && (
        <nav
          aria-label="Mobile Bottom Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-t-2 border-zinc-950 dark:border-zinc-800 shadow-[0_-3px_0px_0px_#09090b] dark:shadow-[0_-3px_0px_0px_#000000] px-1.5 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] transition-colors"
        >
          <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
            {/* 1: Overview */}
            <Link
              href="/"
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all select-none active:scale-95 ${
                isLinkActive("/", true)
                  ? "bg-zinc-950 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#f97316] dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600 dark:shadow-[2px_2px_0px_0px_#ea580c]"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 border-2 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              <Activity
                className={`h-4 w-4 mb-0.5 transition-colors ${
                  isLinkActive("/", true) ? "text-orange-500" : "text-zinc-500 dark:text-zinc-400"
                }`}
              />
              <span
                className={`text-[10px] tracking-tight text-center leading-tight truncate max-w-full ${
                  isLinkActive("/", true) ? "font-black text-white dark:text-zinc-100" : "font-bold"
                }`}
              >
                {t("nav.home", "Overview")}
              </span>
            </Link>

            {/* 2: GPX Plan */}
            <Link
              href="/trail-planner"
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all select-none active:scale-95 ${
                isLinkActive("/trail-planner", false)
                  ? "bg-zinc-950 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#f97316] dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600 dark:shadow-[2px_2px_0px_0px_#ea580c]"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 border-2 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              <Mountain
                className={`h-4 w-4 mb-0.5 transition-colors ${
                  isLinkActive("/trail-planner", false) ? "text-orange-500" : "text-zinc-500 dark:text-zinc-400"
                }`}
              />
              <span
                className={`text-[10px] tracking-tight text-center leading-tight truncate max-w-full ${
                  isLinkActive("/trail-planner", false) ? "font-black text-white dark:text-zinc-100" : "font-bold"
                }`}
              >
                GPX Plan
              </span>
            </Link>

            {/* 3: Center Hero Action - Sync Button */}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              aria-label={isSyncing ? "Syncing with COROS" : "Sync latest COROS activities"}
              className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] dark:border-zinc-700 dark:shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60 transition-all select-none"
            >
              <RefreshCw
                className={`h-4 w-4 mb-0.5 ${
                  isSyncing ? "animate-spin text-orange-700" : "text-zinc-950"
                }`}
              />
              <span className="text-[10px] font-black tracking-tight text-center leading-tight truncate max-w-full text-zinc-950">
                {isSyncing ? t("common.syncing", "Sync...") : t("common.sync", "Sync")}
              </span>
            </button>

            {/* 4: Logbook */}
            <Link
              href="/activities"
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all select-none active:scale-95 ${
                isLinkActive("/activities", false)
                  ? "bg-zinc-950 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#f97316] dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600 dark:shadow-[2px_2px_0px_0px_#ea580c]"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 border-2 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              <ClipboardList
                className={`h-4 w-4 mb-0.5 transition-colors ${
                  isLinkActive("/activities", false) ? "text-orange-500" : "text-zinc-500 dark:text-zinc-400"
                }`}
              />
              <span
                className={`text-[10px] tracking-tight text-center leading-tight truncate max-w-full ${
                  isLinkActive("/activities", false) ? "font-black text-white dark:text-zinc-100" : "font-bold"
                }`}
              >
                {t("nav.activities", "Logbook")}
              </span>
            </Link>

            {/* 5: AI Coach */}
            <button
              onClick={handleCoachClick}
              aria-label="Toggle AI Coach"
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all select-none active:scale-95 ${
                isAiOpen
                  ? "bg-orange-500 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] dark:border-zinc-600 dark:shadow-[2px_2px_0px_0px_#000000]"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 border-2 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              <Bot
                className={`h-4 w-4 mb-0.5 transition-colors ${
                  isAiOpen ? "text-white" : "text-orange-600"
                }`}
              />
              <span
                className={`text-[10px] tracking-tight text-center leading-tight truncate max-w-full ${
                  isAiOpen ? "font-black text-white" : "font-bold"
                }`}
              >
                AI Coach
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* Standalone Settings Modal if triggered internally */}
      {externalOnOpenSettings === undefined && (
        <SettingsModal
          isOpen={internalSettingsOpen}
          onClose={() => setInternalSettingsOpen(false)}
        />
      )}
    </>
  );
};
