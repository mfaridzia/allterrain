"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

export const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="w-full border-t-2 border-zinc-950 bg-white py-6 pb-24 sm:pb-6 px-4 text-center mt-4 sm:mt-6 shadow-[0_-2px_0px_0px_#09090b]">
      <div className="max-w-5xl mx-auto space-y-3">
        <nav
          aria-label="Footer navigation"
          className="flex flex-col sm:flex-row items-center justify-center gap-y-2 sm:gap-x-6 text-xs font-black text-zinc-900"
        >
          {/* Primary product links */}
          <div className="flex items-center justify-center gap-x-4 sm:gap-x-6">
            <Link href="/" className="hover:text-orange-600 transition-colors">
              {t("nav.home", "Overview")}
            </Link>
            <span className="text-zinc-300 select-none">•</span>
            <Link href="/features" className="hover:text-orange-600 transition-colors">
              {t("footer.features", "Features & Science")}
            </Link>
          </div>

          {/* Desktop divider between groups */}
          <span className="hidden sm:inline text-zinc-300 select-none">•</span>

          {/* Legal / Policy links */}
          <div className="flex items-center justify-center gap-x-4 sm:gap-x-6">
            <Link href="/privacy" className="hover:text-orange-600 transition-colors">
              {t("footer.privacy", "Privacy Policy")}
            </Link>
            <span className="text-zinc-300 select-none">•</span>
            <Link href="/terms" className="hover:text-orange-600 transition-colors">
              {t("footer.terms", "Terms of Service")}
            </Link>
          </div>
        </nav>

        <p className="text-[11px] sm:text-xs font-medium text-zinc-500 max-w-none mx-auto leading-relaxed px-2 sm:whitespace-nowrap">
          {t(
            "footer.disclaimer",
            "© 2026 ALLTERRAIN. Developed for the COROS user community. Not affiliated with COROS Wearables Inc."
          )}
        </p>
      </div>
    </footer>
  );
};
