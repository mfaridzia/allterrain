"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Footprints,
} from "lucide-react";
import { SettingsModal } from "./SettingsModal";
import { ThemeToggle } from "./ThemeToggle";
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

    if (window.confirm("Are you sure you want to disconnect your COROS account?")) {
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
      label: "Dashboard",
      description: "Load metrics summary & PMC chart",
      icon: Activity,
      exact: true,
    },
    {
      href: "/trail-planner",
      label: "GPX Planner",
      description: "Trail elevation profile & route simulation",
      icon: Mountain,
      exact: false,
    },
    {
      href: "/activities",
      label: "Logbook",
      description: "COROS activity history & logbook",
      icon: ClipboardList,
      exact: false,
    },
    {
      href: "/gear",
      label: "Gear",
      description: "Shoe mileage, D+ elevation wear & alerts",
      icon: Footprints,
      exact: false,
    },
  ];

  const isLinkActive = (href: string, exact: boolean) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    return pathname.startsWith(href);
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

            {/* Dark Mode Theme Toggle */}
            <ThemeToggle />

            {/* Authenticated Controls */}
            {isConnected && (
              <>
                {/* Connection Status Indicator - Desktop */}
                <div
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border-2 border-zinc-950 dark:border-zinc-700 text-emerald-950 dark:text-emerald-300 text-xs font-bold font-mono shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000]"
                  title="COROS MCP connected"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse border border-zinc-950 dark:border-zinc-700" />
                  <span>Online</span>
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
                  <span>{isSyncing ? "Syncing..." : "Sync"}</span>
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
                  aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
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

        {/* Mobile Navigation Drawer Panel */}
        {isConnected && isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 z-40 bg-[#F6F4EE] dark:bg-[#09090b] border-b-2 border-zinc-950 dark:border-zinc-800 shadow-[0_6px_0_0_#09090b] dark:shadow-[0_6px_0_0_#000000] p-4 space-y-4 max-h-[calc(100vh-70px)] overflow-y-auto">
            {/* Nav Route Links */}
            <div>
              <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 px-1">
                Navigation Menu
              </div>
              <div className="space-y-1.5">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const active = isLinkActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                        active
                          ? "bg-white text-zinc-950 border-zinc-950 shadow-[2.5px_2.5px_0px_0px_#09090b] dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600 dark:shadow-[2.5px_2.5px_0px_0px_#000000]"
                          : "bg-white/70 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border-zinc-950/20 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-950"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 ${
                            active
                              ? "bg-orange-500 text-white border-zinc-950"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-black text-zinc-950 dark:text-zinc-100">
                            {item.label}
                          </div>
                          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 ${
                          active ? "text-orange-600" : "text-zinc-400 dark:text-zinc-600"
                        }`}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions & Status Section */}
            <div className="pt-3 border-t-2 border-zinc-200 dark:border-zinc-800 space-y-2.5">
              <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1 flex items-center justify-between">
                <span>Actions & Integration</span>
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
                  <span>{isSyncing ? "Syncing..." : "Sync COROS"}</span>
                </button>

                {/* AI Coach Action */}
                {onToggleAi && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onToggleAi();
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-zinc-950 dark:border-zinc-700 font-black text-xs shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all ${
                      isAiOpen
                        ? "bg-orange-500 text-white"
                        : "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100"
                    }`}
                  >
                    <Bot className={`h-3.5 w-3.5 ${isAiOpen ? "text-white" : "text-orange-600"}`} />
                    <span>AI Coach</span>
                  </button>
                )}

                {/* Settings Action */}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleOpenSettings();
                  }}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border-2 border-zinc-950 dark:border-zinc-700 text-zinc-950 dark:text-zinc-100 font-black text-xs shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                >
                  <Settings className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
                  <span>Settings</span>
                </button>

                {/* Disconnect Action */}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleDisconnect();
                  }}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-zinc-950 dark:border-zinc-700 text-rose-700 dark:text-rose-400 font-black text-xs shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Disconnect</span>
                </button>
              </div>
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
