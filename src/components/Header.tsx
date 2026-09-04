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
} from "lucide-react";
import { SettingsModal } from "./SettingsModal";

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
  const [internalConnected, setInternalConnected] = useState<boolean>(true);
  const [internalSyncing, setInternalSyncing] = useState<boolean>(false);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState<boolean>(false);

  // If connected is not passed from page props, check status automatically
  useEffect(() => {
    if (externalConnected === undefined) {
      fetch("/api/auth/coros/status")
        .then((res) => res.json())
        .then((data) => {
          setInternalConnected(!!data.connected);
        })
        .catch(() => {
          setInternalConnected(false);
        });
    }
  }, [externalConnected]);

  const isConnected = externalConnected !== undefined ? externalConnected : internalConnected;
  const isSyncing = externalIsSyncing !== undefined ? externalIsSyncing : internalSyncing;

  const handleSync = async () => {
    if (externalOnSync) {
      externalOnSync();
      return;
    }

    try {
      setInternalSyncing(true);
      const res = await fetch("/api/coros/sync", { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Manual sync failed:", err);
    } finally {
      setInternalSyncing(false);
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

    if (window.confirm("Apakah Anda yakin ingin memutuskan sambungan akun COROS?")) {
      try {
        await fetch("/api/auth/coros/status", { method: "POST" });
        window.location.reload();
      } catch (err) {
        console.error("Disconnect failed:", err);
      }
    }
  };

  const navLinks = [
    {
      href: "/",
      label: "Dashboard",
      icon: Activity,
      exact: true,
    },
    {
      href: "/trail-planner",
      label: "GPX Planner",
      icon: Mountain,
      exact: false,
    },
    {
      href: "/activities",
      label: "Logbook",
      icon: ClipboardList,
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
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand & Left Navigation */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 group transition-opacity hover:opacity-95"
            >
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white font-bold shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1">
                    COROS <span className="text-orange-500">ATHLETIC</span>
                  </span>
                  <span className="hidden md:inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 tracking-wider">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-zinc-400 hidden lg:block leading-none mt-0.5">
                  Intervals.icu Engine • Trail & EvoLab
                </p>
              </div>
            </Link>

            {/* Primary Segmented Route Navigation */}
            <nav className="flex items-center gap-1 p-1 bg-zinc-900/90 rounded-xl border border-zinc-800/80 shadow-inner">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const active = isLinkActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      active
                        ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/80"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 ${
                        active ? "text-orange-400" : "text-zinc-400"
                      }`}
                    />
                    <span className={item.href === "/" ? "inline" : "hidden xs:inline sm:inline"}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Custom page actions passed from children */}
            {extraActions && (
              <div className="flex items-center gap-1.5 border-r border-zinc-800/80 pr-1.5 sm:pr-2.5 mr-0.5">
                {extraActions}
              </div>
            )}

            {/* Connection Status Indicator */}
            {isConnected ? (
              <>
                <div
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-medium"
                  title="COROS MCP terhubung aktif"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Online</span>
                </div>

                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 transition-colors disabled:opacity-50"
                  title="Sync with COROS MCP"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-orange-400" : ""}`}
                  />
                  <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync"}</span>
                </button>
              </>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Offline</span>
              </div>
            )}

            {/* AI Coach Trigger (if onToggleAi provided) */}
            {onToggleAi && (
              <button
                onClick={onToggleAi}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isAiOpen
                    ? "bg-orange-600 text-white shadow-md shadow-orange-500/30"
                    : "bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200"
                }`}
                title="Buka AI Coach Drawer"
              >
                <Bot className="h-3.5 w-3.5 text-orange-400" />
                <span className="hidden md:inline">AI Coach</span>
              </button>
            )}

            {/* Settings Trigger */}
            <button
              onClick={handleOpenSettings}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
              title="Pengaturan & Kunci API"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* Disconnect Button (if connected) */}
            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="hidden sm:block p-1.5 text-zinc-500 hover:text-red-400 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
                title="Putuskan Sambungan COROS"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

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
