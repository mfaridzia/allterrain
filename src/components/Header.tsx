"use client";

import React, { useState } from "react";
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

  const { data: authData } = useAuthStatus();
  const syncMutation = useSyncCorosMutation();
  const disconnectMutation = useDisconnectMutation();

  const isConnected = externalConnected !== undefined ? externalConnected : !!authData?.connected;
  const isSyncing = externalIsSyncing !== undefined ? externalIsSyncing : syncMutation.isPending;

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

    if (window.confirm("Apakah Anda yakin ingin memutuskan sambungan akun COROS?")) {
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
      <header className="sticky top-0 z-40 w-full border-b-2 border-zinc-950 bg-white/95 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 shadow-[0_3px_0px_0px_#09090b] transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand & Left Navigation */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 group transition-transform active:scale-95"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white border-2 border-zinc-950 shadow-[2.5px_2.5px_0px_0px_#09090b] group-hover:-translate-y-0.5 transition-transform">
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
                <span className="text-base sm:text-lg font-black tracking-tight text-zinc-950 flex items-center">
                  ALL<span className="text-orange-600">TERRAIN</span>
                </span>
              </div>
            </Link>

            {/* Primary Neo-Brutalist Segmented Route Navigation - only visible when connected */}
            {isConnected && (
              <nav className="flex items-center gap-1 p-1 bg-[#F0EDE4] rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const active = isLinkActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs rounded-lg transition-all ${
                        active
                          ? "bg-white text-zinc-950 font-black border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                          : "text-zinc-600 hover:text-zinc-950 font-bold hover:bg-white/60 border-2 border-transparent"
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 ${
                          active ? "text-orange-600" : "text-zinc-500"
                        }`}
                      />
                      <span className={item.href === "/" ? "inline" : "hidden xs:inline sm:inline"}>
                        {item.label}
                      </span>
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
                {/* Connection Status Indicator */}
                <div
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border-2 border-zinc-950 dark:border-zinc-700 text-emerald-950 dark:text-emerald-300 text-xs font-bold font-mono shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000]"
                  title="COROS MCP terhubung aktif"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse border border-zinc-950 dark:border-zinc-700" />
                  <span>Online</span>
                </div>

                {/* Manual Sync Button */}
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-black rounded-xl bg-white dark:bg-zinc-800 border-2 border-zinc-950 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-950 dark:text-zinc-100 transition-all shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
                  title="Sync with COROS MCP"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-orange-600" : ""}`}
                  />
                  <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync"}</span>
                </button>

                {/* AI Coach Trigger */}
                {onToggleAi && (
                  <button
                    onClick={onToggleAi}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-black rounded-xl border-2 border-zinc-950 dark:border-zinc-700 transition-all shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                      isAiOpen
                        ? "bg-orange-500 text-white"
                        : "bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-950 dark:text-zinc-100"
                    }`}
                    title="Buka AI Coach Drawer"
                  >
                    <Bot className={`h-3.5 w-3.5 ${isAiOpen ? "text-white" : "text-orange-600"}`} />
                    <span className="hidden md:inline">AI Coach</span>
                  </button>
                )}

                {/* Settings Trigger */}
                <button
                  onClick={handleOpenSettings}
                  className="p-1.5 text-zinc-950 dark:text-zinc-100 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-xl border-2 border-zinc-950 dark:border-zinc-700 shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                  title="Pengaturan & Kunci API"
                >
                  <Settings className="h-4 w-4" />
                </button>

                {/* Disconnect Button */}
                <button
                  onClick={handleDisconnect}
                  className="hidden sm:block p-1.5 text-rose-600 dark:text-rose-400 bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border-2 border-zinc-950 dark:border-zinc-700 shadow-[2.5px_2.5px_0px_0px_#09090b] dark:shadow-[2.5px_2.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                  title="Putuskan Sambungan COROS"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
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
