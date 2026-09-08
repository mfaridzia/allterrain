"use client";

import React from "react";
import { useTranslation } from "@/lib/i18n/context";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { language, toggleLanguage } = useTranslation();
  const nextLanguage = language === "en" ? "id" : "en";

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="h-8 px-2.5 rounded-lg border-2 border-zinc-950 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-[2px_2px_0px_0px_#09090b] dark:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer text-xs font-black font-mono select-none"
      title={language === "en" ? "Beralih ke Bahasa Indonesia (ID)" : "Switch to English (EN)"}
      aria-label="Toggle language"
    >
      <Languages className="h-3.5 w-3.5 text-orange-600 dark:text-orange-500 stroke-[2.5]" />
      <span>{nextLanguage.toUpperCase()}</span>
    </button>
  );
}
