"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { translations, Language } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (path: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "allterrain_language";

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("en");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === "id" || stored === "en") {
        setLanguageState(stored);
      } else {
        setLanguageState("en");
      }
    } catch {
      // ignore storage error
    } finally {
      setMounted(true);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev: Language) => {
      const next: Language = prev === "en" ? "id" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, next);
        document.documentElement.lang = next;
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (path: string, fallback?: string): string => {
      const currentDict = translations[language] as any;
      const fallbackDict = translations.en as any;

      const keys = path.split(".");
      let val: any = currentDict;
      for (const k of keys) {
        if (val && typeof val === "object" && k in val) {
          val = val[k];
        } else {
          val = undefined;
          break;
        }
      }

      if (typeof val === "string") return val;

      // Fallback to English dictionary
      let fallbackVal: any = fallbackDict;
      for (const k of keys) {
        if (fallbackVal && typeof fallbackVal === "object" && k in fallbackVal) {
          fallbackVal = fallbackVal[k];
        } else {
          fallbackVal = undefined;
          break;
        }
      }

      if (typeof fallbackVal === "string") return fallbackVal;

      return fallback || path;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
