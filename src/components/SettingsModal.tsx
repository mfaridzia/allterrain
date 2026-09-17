"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, Key, Cpu, Check, AlertCircle, RefreshCw, Info, ExternalLink, Trash2, Heart, Share2, Copy, Shield } from "lucide-react";
import { useAppSettings, useUpdateSettingsMutation } from "@/lib/queries";
import { useTranslation } from "@/lib/i18n/context";
import { calculateAthleteHrZones, HrZoneCalcMethod } from "@/lib/analytics";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDER_KEY_PORTALS: Record<string, { url: string; label: string }> = {
  groq: { url: "https://console.groq.com/keys", label: "Get Groq Key" },
  gemini: { url: "https://aistudio.google.com/app/apikey", label: "Get Gemini Key" },
  deepseek: { url: "https://platform.deepseek.com/api_keys", label: "Get DeepSeek Key" },
  openai: { url: "https://platform.openai.com/api-keys", label: "Get OpenAI Key" },
  claude: { url: "https://console.anthropic.com/settings/keys", label: "Get Claude Key" },
};

function getCuratedModels(language?: string): Record<string, { id: string; label: string }[]> {
  const isEn = language === "en";
  return {
    groq: [
      {
        id: "openai/gpt-oss-120b",
        label: isEn
          ? "GPT-OSS 120B (Recommended • Flagship & Ultra-Fast)"
          : "GPT-OSS 120B (Rekomendasi • Sangat Cerdas & Super Cepat)",
      },
      {
        id: "qwen/qwen3.6-27b",
        label: isEn ? "Qwen 3.6 27B (Fast & Responsive)" : "Qwen 3.6 27B (Responsif & Cepat)",
      },
      {
        id: "openai/gpt-oss-20b",
        label: isEn ? "GPT-OSS 20B (Lightweight & Fast)" : "GPT-OSS 20B (Ringan & Cepat)",
      },
    ],
    gemini: [
      {
        id: "gemini-2.5-flash",
        label: isEn
          ? "Gemini 2.5 Flash (Recommended • Fast & Efficient)"
          : "Gemini 2.5 Flash (Rekomendasi • Cepat & Irit)",
      },
      {
        id: "gemini-2.5-pro",
        label: isEn
          ? "Gemini 2.5 Pro (Deep Reasoning & Analysis)"
          : "Gemini 2.5 Pro (Penalaran & Analisis Mendalam)",
      },
      {
        id: "gemini-1.5-flash",
        label: isEn ? "Gemini 1.5 Flash (Legacy Fast)" : "Gemini 1.5 Flash (Legacy Fast)",
      },
      {
        id: "gemini-1.5-pro",
        label: isEn ? "Gemini 1.5 Pro (Legacy Deep)" : "Gemini 1.5 Pro (Legacy Deep)",
      },
    ],
    deepseek: [
      {
        id: "deepseek-chat",
        label: isEn ? "DeepSeek V3 (deepseek-chat • Default)" : "DeepSeek V3 (deepseek-chat • Default)",
      },
      {
        id: "deepseek-reasoner",
        label: isEn
          ? "DeepSeek R1 (deepseek-reasoner • Deep Reasoning)"
          : "DeepSeek R1 (deepseek-reasoner • Penalaran Mendalam)",
      },
    ],
    openai: [
      {
        id: "gpt-4o-mini",
        label: isEn
          ? "GPT-4o Mini (Recommended • Fast & Cost-Effective)"
          : "GPT-4o Mini (Rekomendasi • Cepat & Hemat)",
      },
      {
        id: "gpt-4o",
        label: isEn ? "GPT-4o (Omni Flagship)" : "GPT-4o (Omni Flagship)",
      },
      {
        id: "o3-mini",
        label: isEn ? "o3-mini (Fast Reasoning)" : "o3-mini (Reasoning Cepat)",
      },
      {
        id: "o1",
        label: isEn ? "o1 (Deep Reasoning)" : "o1 (Deep Reasoning)",
      },
    ],
    claude: [
      {
        id: "claude-3-5-sonnet-20241022",
        label: isEn ? "Claude 3.5 Sonnet (Top Recommendation)" : "Claude 3.5 Sonnet (Rekomendasi Utama)",
      },
      {
        id: "claude-3-7-sonnet-20250219",
        label: isEn
          ? "Claude 3.7 Sonnet (Latest Hybrid Reasoning)"
          : "Claude 3.7 Sonnet (Hybrid Reasoning Terbaru)",
      },
      {
        id: "claude-3-5-haiku-20241022",
        label: isEn ? "Claude 3.5 Haiku (Fastest & Lightweight)" : "Claude 3.5 Haiku (Paling Cepat & Ringan)",
      },
      {
        id: "claude-3-opus-20240229",
        label: isEn ? "Claude 3 Opus" : "Claude 3 Opus",
      },
    ],
  };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { language, t } = useTranslation();
  const { data: settingsData } = useAppSettings();
  const updateSettingsMutation = useUpdateSettingsMutation();

  const curatedModels = getCuratedModels(language);

  const [provider, setProvider] = useState<string>("gemini");
  const [modelName, setModelName] = useState<string>("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [hrZoneCalcMethod, setHrZoneCalcMethod] = useState<HrZoneCalcMethod>("max_hr");
  const [athleteMaxHr, setAthleteMaxHr] = useState<string>("");
  const [athleteRestingHr, setAthleteRestingHr] = useState<string>("");
  const [athleteLthr, setAthleteLthr] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ai" | "physiology" | "public">("ai");
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Public Profile State
  const [publicProfileEnabled, setPublicProfileEnabled] = useState<boolean>(false);
  const [publicProfileShowPmc, setPublicProfileShowPmc] = useState<boolean>(true);
  const [publicProfileShowVolume, setPublicProfileShowVolume] = useState<boolean>(true);
  const [publicProfileShowTrail, setPublicProfileShowTrail] = useState<boolean>(true);
  const [publicProfileShowRecent, setPublicProfileShowRecent] = useState<boolean>(true);
  const [publicProfileShowHr, setPublicProfileShowHr] = useState<boolean>(false);
  const [athleteNickname, setAthleteNickname] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const [dynamicModels, setDynamicModels] = useState<Record<string, { id: string; label: string }[]>>({});
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);

  useEffect(() => {
    if (settingsData) {
      if (settingsData.aiProvider) setProvider(settingsData.aiProvider);
      if (settingsData.aiModelName) {
        setModelName(settingsData.aiModelName);
        const models = dynamicModels[settingsData.aiProvider] || curatedModels[settingsData.aiProvider] || [];
        if (!models.some((m) => m.id === settingsData.aiModelName)) {
          setIsCustomModel(true);
        }
      }
      if (settingsData.hrZoneCalcMethod) {
        setHrZoneCalcMethod(settingsData.hrZoneCalcMethod);
      }
      if (settingsData.athleteMaxHr) {
        setAthleteMaxHr(String(settingsData.athleteMaxHr));
      } else {
        setAthleteMaxHr("");
      }
      if (settingsData.athleteRestingHr) {
        setAthleteRestingHr(String(settingsData.athleteRestingHr));
      } else {
        setAthleteRestingHr("");
      }
      if (settingsData.athleteLthr) {
        setAthleteLthr(String(settingsData.athleteLthr));
      } else {
        setAthleteLthr("");
      }
      if (settingsData.publicProfile) {
        setPublicProfileEnabled(Boolean(settingsData.publicProfile.enabled));
        setPublicProfileShowPmc(settingsData.publicProfile.showPmc !== false);
        setPublicProfileShowVolume(settingsData.publicProfile.showVolume !== false);
        setPublicProfileShowTrail(settingsData.publicProfile.showTrail !== false);
        setPublicProfileShowRecent(settingsData.publicProfile.showRecent !== false);
        setPublicProfileShowHr(Boolean(settingsData.publicProfile.showHr));
        setAthleteNickname(settingsData.publicProfile.nickname || "");
      }
    }
  }, [settingsData, language]);

  if (!isOpen) return null;

  const configuredKeys = settingsData?.configuredKeys || {};
  const serverProvidedKeys = settingsData?.serverProvidedKeys || {};
  const saving = updateSettingsMutation.isPending;

  const getProviderBadge = (pId: string) => {
    if (pId === "groq" && (serverProvidedKeys.groq || configuredKeys.groq)) {
      return (
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 font-mono">
          {serverProvidedKeys.groq
            ? t("settingsModal.serverDefaultBadge", "Server Ready")
            : t("settingsModal.apiKeyStored", "✓ Stored")}
        </span>
      );
    }
    if (serverProvidedKeys[pId]) {
      return (
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 font-mono">
          {t("settingsModal.serverDefaultBadge", "Server Ready")}
        </span>
      );
    }
    if (configuredKeys[pId]) {
      return (
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 font-mono">
          {t("settingsModal.apiKeyStored", "✓ Stored")}
        </span>
      );
    }
    return (
      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-400 font-mono">
        {t("settingsModal.needsKeyBadge", "Needs Key")}
      </span>
    );
  };

  const handleFetchLiveModels = async () => {
    setIsFetchingModels(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/settings/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengambil daftar model dari provider.");
      }
      if (Array.isArray(data.models) && data.models.length > 0) {
        setDynamicModels((prev) => ({
          ...prev,
          [provider]: data.models,
        }));
        if (!data.models.some((m: any) => m.id === modelName)) {
          setModelName(data.models[0].id);
          setIsCustomModel(false);
        }
      }
    } catch (err: any) {
      setFetchError(err.message || "Gagal mengambil model.");
      setTimeout(() => setFetchError(null), 5000);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const detectedMaxHr = Number(settingsData?.detectedMaxHr) || 185;
  const detectedRestingHr = Number(settingsData?.detectedRestingHr) || 50;
  const detectedLthr = Number(settingsData?.detectedLthr) || Math.round(detectedMaxHr * 0.88);

  const maxHrNum = parseInt(athleteMaxHr.trim(), 10);
  const restingHrNum = parseInt(athleteRestingHr.trim(), 10);
  const lthrNum = parseInt(athleteLthr.trim(), 10);

  const effectiveMaxHr = !isNaN(maxHrNum) && maxHrNum >= 100 && maxHrNum <= 240 ? maxHrNum : detectedMaxHr;
  const effectiveRestingHr = !isNaN(restingHrNum) && restingHrNum >= 30 && restingHrNum <= 100 ? restingHrNum : detectedRestingHr;
  const effectiveLthr = !isNaN(lthrNum) && lthrNum >= 100 && lthrNum <= 220 ? lthrNum : detectedLthr;

  let hrValidationError: string | null = null;

  if (hrZoneCalcMethod === "max_hr") {
    if (athleteMaxHr.trim() && (isNaN(maxHrNum) || maxHrNum < 100 || maxHrNum > 240)) {
      hrValidationError = language === "en" ? "Max HR must be between 100 and 240 bpm." : "Max HR harus antara 100 dan 240 bpm.";
    }
  } else if (hrZoneCalcMethod === "hrr") {
    if (athleteMaxHr.trim() && (isNaN(maxHrNum) || maxHrNum < 100 || maxHrNum > 240)) {
      hrValidationError = language === "en" ? "Max HR must be between 100 and 240 bpm." : "Max HR harus antara 100 dan 240 bpm.";
    } else if (athleteRestingHr.trim() && (isNaN(restingHrNum) || restingHrNum < 30 || restingHrNum > 100)) {
      hrValidationError = language === "en" ? "Resting HR must be between 30 and 100 bpm." : "Resting HR harus antara 30 dan 100 bpm.";
    } else if (effectiveMaxHr <= effectiveRestingHr + 20) {
      hrValidationError = language === "en" ? "Max HR must be at least 20 bpm higher than Resting HR." : "Max HR harus lebih tinggi minimal 20 bpm dari Resting HR.";
    }
  } else if (hrZoneCalcMethod === "lthr") {
    if (athleteLthr.trim() && (isNaN(lthrNum) || lthrNum < 100 || lthrNum > 220)) {
      hrValidationError = language === "en" ? "LTHR must be between 100 and 220 bpm." : "LTHR harus antara 100 dan 220 bpm.";
    }
  }

  const isHrValid = !hrValidationError;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "physiology" && !isHrValid) {
      return;
    }
    setSavedSuccess(false);

    try {
      const payload: any = {
        aiProvider: provider,
        aiModelName: modelName,
        hrZoneCalcMethod,
      };

      if (activeTab === "ai") {
        if (apiKey.trim()) {
          if (provider === "groq") payload.groqApiKey = apiKey.trim();
          if (provider === "gemini") payload.geminiApiKey = apiKey.trim();
          if (provider === "openai") payload.openaiApiKey = apiKey.trim();
          if (provider === "claude") payload.claudeApiKey = apiKey.trim();
          if (provider === "deepseek") payload.deepseekApiKey = apiKey.trim();
        }
      }

      if (activeTab === "physiology") {
        if (athleteMaxHr.trim()) {
          const parsed = parseInt(athleteMaxHr.trim(), 10);
          if (!isNaN(parsed) && parsed >= 100 && parsed <= 240) {
            payload.athleteMaxHr = parsed;
          }
        } else {
          payload.athleteMaxHr = null;
        }

        if (athleteRestingHr.trim()) {
          const parsed = parseInt(athleteRestingHr.trim(), 10);
          if (!isNaN(parsed) && parsed >= 30 && parsed <= 100) {
            payload.athleteRestingHr = parsed;
          }
        } else {
          payload.athleteRestingHr = null;
        }

        if (athleteLthr.trim()) {
          const parsed = parseInt(athleteLthr.trim(), 10);
          if (!isNaN(parsed) && parsed >= 100 && parsed <= 220) {
            payload.athleteLthr = parsed;
          }
        } else {
          payload.athleteLthr = null;
        }
      }

      if (activeTab === "public") {
        payload.athleteNickname = athleteNickname;
        payload.publicProfileEnabled = publicProfileEnabled;
        payload.publicProfileShowPmc = publicProfileShowPmc;
        payload.publicProfileShowVolume = publicProfileShowVolume;
        payload.publicProfileShowTrail = publicProfileShowTrail;
        payload.publicProfileShowRecent = publicProfileShowRecent;
        payload.publicProfileShowHr = publicProfileShowHr;
      }

      await updateSettingsMutation.mutateAsync(payload);

      setSavedSuccess(true);
      setApiKey("");
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePublicEnabled = async (newVal: boolean) => {
    setPublicProfileEnabled(newVal);
    try {
      await updateSettingsMutation.mutateAsync({
        publicProfileEnabled: newVal,
        publicProfileShowPmc,
        publicProfileShowVolume,
        publicProfileShowTrail,
        publicProfileShowRecent,
        publicProfileShowHr,
        athleteNickname,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error("Auto-save publicProfileEnabled failed:", e);
    }
  };

  const handleTogglePublicOption = async (
    key: "pmc" | "volume" | "trail" | "recent" | "hr",
    newVal: boolean
  ) => {
    if (key === "pmc") setPublicProfileShowPmc(newVal);
    if (key === "volume") setPublicProfileShowVolume(newVal);
    if (key === "trail") setPublicProfileShowTrail(newVal);
    if (key === "recent") setPublicProfileShowRecent(newVal);
    if (key === "hr") setPublicProfileShowHr(newVal);

    const updated = {
      publicProfileEnabled,
      publicProfileShowPmc: key === "pmc" ? newVal : publicProfileShowPmc,
      publicProfileShowVolume: key === "volume" ? newVal : publicProfileShowVolume,
      publicProfileShowTrail: key === "trail" ? newVal : publicProfileShowTrail,
      publicProfileShowRecent: key === "recent" ? newVal : publicProfileShowRecent,
      publicProfileShowHr: key === "hr" ? newVal : publicProfileShowHr,
      athleteNickname,
    };

    try {
      await updateSettingsMutation.mutateAsync(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error("Auto-save public option failed:", e);
    }
  };

  const displayModels = dynamicModels[provider] || curatedModels[provider] || [];

  const previewZones = calculateAthleteHrZones({
    method: hrZoneCalcMethod,
    maxHr: effectiveMaxHr,
    restingHr: effectiveRestingHr,
    lthr: effectiveLthr,
  });

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full rounded-2xl bg-white border-2 border-zinc-950 p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-[6px_6px_0px_0px_#09090b] max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Settings className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-zinc-950 truncate">{t("settingsModal.title", "App Settings")}</h3>
              <p className="text-[11px] sm:text-xs font-medium text-zinc-600 truncate">{t("settingsModal.subtitle", "BYOK AI Provider & Model Config")}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Segmented Tab Controls */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`py-2 px-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "ai"
                ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/70"
            }`}
          >
            <Cpu className="h-3.5 w-3.5 stroke-[2.5]" />
            <span className="truncate">{t("settingsModal.tabAiCoach", "AI Coach")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("physiology")}
            className={`py-2 px-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "physiology"
                ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/70"
            }`}
          >
            <Heart className="h-3.5 w-3.5 text-rose-500 stroke-[2.5]" />
            <span className="truncate">{t("settingsModal.tabHrTargets", "HR Targets")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("public")}
            className={`py-2 px-1.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "public"
                ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/70"
            }`}
          >
            <Share2 className="h-3.5 w-3.5 text-orange-500 stroke-[2.5]" />
            <span className="truncate">{language === "en" ? "Public Share" : "Profil Publik"}</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {activeTab === "ai" && (
            <div className="space-y-4">
              {/* BYOK Info Banner */}
              <div className="p-3 rounded-xl bg-amber-50 border-2 border-zinc-950 text-xs text-zinc-900 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
            <div className="flex items-center gap-1.5 font-black text-amber-900">
              <Info className="h-4 w-4 stroke-[2.5] text-amber-700 shrink-0" />
              <span>{t("settingsModal.byokBadge", "Bring Your Own Key (BYOK)")}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-700 font-medium">
              {t(
                "settingsModal.byokDescription",
                "AllTerrain provides Groq for free out-of-the-box (server default). To unlock other models (DeepSeek, Claude, OpenAI, Gemini), please connect your personal API keys."
              )}
            </p>
          </div>

          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-orange-600 stroke-[2.5]" />
              {t("settingsModal.aiProvider", "AI Coach Provider (BYOK)")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: "groq",
                  label: "Groq (Free & Fast)",
                  defModel: "openai/gpt-oss-120b",
                  tooltip:
                    language === "en"
                      ? "Groq: Ultra-fast LPU inference (Free Tier default)"
                      : "Groq: Inferensi super cepat dengan chip LPU (Server Default Gratis)",
                },
                {
                  id: "gemini",
                  label: "Google Gemini",
                  defModel: "gemini-2.5-flash",
                  tooltip:
                    language === "en"
                      ? "Google Gemini: 1,500 free requests per day via AI Studio"
                      : "Google Gemini: Gratis 1.500 request per hari via AI Studio",
                },
                {
                  id: "deepseek",
                  label: "DeepSeek",
                  defModel: "deepseek-chat",
                  tooltip:
                    language === "en"
                      ? "DeepSeek: V3 & R1 models (BYOK personal API key)"
                      : "DeepSeek: Model V3 & R1 (Gunakan API key pribadi)",
                },
                {
                  id: "openai",
                  label: "OpenAI",
                  defModel: "gpt-4o-mini",
                  tooltip:
                    language === "en"
                      ? "OpenAI: GPT-4o, GPT-4o-mini & o3-mini models"
                      : "OpenAI: Model GPT-4o, GPT-4o-mini & o3-mini",
                },
                {
                  id: "claude",
                  label: "Anthropic Claude",
                  defModel: "claude-3-5-sonnet-20241022",
                  tooltip:
                    language === "en"
                      ? "Anthropic Claude: Claude 3.5 Sonnet, 3.7 Sonnet & Haiku"
                      : "Anthropic Claude: Model Claude 3.5 Sonnet, 3.7 Sonnet & Haiku",
                },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  title={p.tooltip}
                  onClick={() => {
                    setProvider(p.id);
                    setModelName(p.defModel);
                    setIsCustomModel(false);
                    setFetchError(null);
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all min-w-0 flex items-center justify-between gap-2 cursor-pointer ${
                    provider === p.id
                      ? "border-2 border-zinc-950 bg-orange-100 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                      : "border-2 border-zinc-200 bg-[#FAF9F5] text-zinc-700 hover:border-zinc-950 hover:bg-zinc-50"
                  }`}
                >
                  <div className="text-xs font-black truncate">{p.label}</div>
                  <div className="shrink-0">{getProviderBadge(p.id)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection Dropdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-black text-zinc-900 flex items-center gap-1.5 truncate">
                <Cpu className="h-3.5 w-3.5 text-orange-600 stroke-[2.5] shrink-0" />
                <span>{t("settingsModal.modelName", "AI Model")}</span>
                {dynamicModels[provider] && (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-300">
                    Live API
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={handleFetchLiveModels}
                disabled={isFetchingModels}
                className="text-[10px] font-bold text-zinc-700 hover:text-zinc-950 flex items-center gap-1 px-2 py-0.5 rounded-lg border border-zinc-300 hover:border-zinc-950 bg-white hover:bg-zinc-50 transition-all shadow-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 shrink-0"
                title={t("settingsModal.fetchModels", "Fetch Latest Models")}
              >
                <RefreshCw className={`h-3 w-3 ${isFetchingModels ? "animate-spin text-orange-600" : ""}`} />
                <span>{isFetchingModels ? t("settingsModal.fetching", "Fetching...") : t("settingsModal.fetchModels", "Fetch Latest Models")}</span>
              </button>
            </div>

            {fetchError && (
              <div className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl p-2 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{fetchError}</span>
              </div>
            )}

            {/* Model Select Dropdown */}
            <div className="relative">
              <select
                value={isCustomModel ? "__custom__" : modelName}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setIsCustomModel(true);
                  } else {
                    setIsCustomModel(false);
                    setModelName(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 focus:outline-none focus:bg-white font-mono shadow-[1.5px_1.5px_0px_0px_#09090b] cursor-pointer appearance-none pr-8 font-medium"
              >
                {displayModels.map((m) => (
                  <option key={m.id} value={m.id} className="font-mono text-xs py-1">
                    {m.label}
                  </option>
                ))}
                <option value="__custom__" className="font-sans font-bold text-zinc-800">
                  {t("settingsModal.customModelOption", "✏️ Custom Model... (Manual Input)")}
                </option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600 text-xs font-bold">
                ▼
              </div>
            </div>

            {/* If Custom Model chosen */}
            {isCustomModel && (
              <div className="pt-1 space-y-1">
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder={t("settingsModal.customModelPlaceholder", "e.g. claude-3-7-sonnet-20250219 or fine-tuned model")}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 focus:outline-none focus:bg-white font-mono shadow-[1.5px_1.5px_0px_0px_#09090b]"
                  autoFocus
                />
                <p className="text-[10px] text-zinc-500 font-medium">
                  {t("settingsModal.customModelHelper", "Enter model ID exactly as shown in provider API documentation.")}
                </p>
              </div>
            )}
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <label className="text-xs font-black text-zinc-900 flex items-center gap-1 truncate">
                <Key className="h-3.5 w-3.5 text-orange-600 stroke-[2.5] shrink-0" />
                <span>{t("settingsModal.apiKey", "API Key")} ({provider.toUpperCase()})</span>
              </label>
              <div className="flex items-center gap-2.5">
                {PROVIDER_KEY_PORTALS[provider] && (
                  <a
                    href={PROVIDER_KEY_PORTALS[provider].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 hover:underline"
                  >
                    <span>{PROVIDER_KEY_PORTALS[provider].label}</span>
                    <ExternalLink className="h-3 w-3 stroke-[2.5]" />
                  </a>
                )}
                {configuredKeys[provider] && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-emerald-700 font-bold">
                      {t("settingsModal.apiKeyStored", "✓ Stored")}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await updateSettingsMutation.mutateAsync({ clearKey: provider });
                          setApiKey("");
                        } catch (e) {
                          console.error("Failed to clear key:", e);
                        }
                      }}
                      className="inline-flex items-center gap-0.5 text-[10px] text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer ml-1"
                      title={t("settingsModal.clearKey", "Hapus Key")}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      <span>{t("settingsModal.clearKey", "Hapus")}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                configuredKeys[provider]
                  ? t("settingsModal.apiKeyPlaceholderExisting", "Leave blank to keep existing key")
                  : t("settingsModal.apiKeyPlaceholderEmpty", "Enter API Key...")
              }
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 placeholder-zinc-500 focus:outline-none focus:bg-white font-mono shadow-[1.5px_1.5px_0px_0px_#09090b]"
            />
            {provider === "groq" && serverProvidedKeys.groq && !configuredKeys.groq && (
              <p className="text-[10px] text-emerald-800 font-medium font-mono">
                {t(
                  "settingsModal.groqServerReadyNotice",
                  "Groq is active via server default. Enter an API key only if you want to use your personal quota."
                )}
              </p>
            )}
            <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium leading-tight">
              {t("settingsModal.apiKeyNotice", "Your API key is stored securely in your encrypted database and never transmitted to third parties.")}
            </p>
          </div>
        </div>
      )}

          {/* Tab 2: Athlete Physiology & Heart Rate Targets */}
          {activeTab === "physiology" && (
            <div className="space-y-3.5">
              {/* Method Selector Segmented Tabs */}
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 space-y-2.5 shadow-[2px_2px_0px_0px_#09090b]">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-zinc-950 flex items-center gap-1.5">
                    <Heart className="h-4 w-4 text-rose-600 stroke-[2.5]" />
                    <span>{t("settingsModal.calcMethodLabel", "Zone Calculation Method")}</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold text-zinc-700 uppercase px-1.5 py-0.5 rounded bg-zinc-200/70 border border-zinc-300">
                    {hrZoneCalcMethod === "max_hr" ? "% Max HR" : hrZoneCalcMethod === "hrr" ? "Karvonen HRR" : "Joe Friel LTHR"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-200/60 border border-zinc-950">
                  <button
                    type="button"
                    onClick={() => setHrZoneCalcMethod("max_hr")}
                    className={`py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-black transition-all text-center cursor-pointer ${
                      hrZoneCalcMethod === "max_hr"
                        ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                        : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200"
                    }`}
                  >
                    {t("settingsModal.methodMaxHr", "% Max HR")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setHrZoneCalcMethod("hrr")}
                    className={`py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-black transition-all text-center cursor-pointer ${
                      hrZoneCalcMethod === "hrr"
                        ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                        : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200"
                    }`}
                  >
                    {t("settingsModal.methodHrr", "HRR (Karvonen)")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setHrZoneCalcMethod("lthr")}
                    className={`py-1.5 px-2 rounded-lg text-[11px] sm:text-xs font-black transition-all text-center cursor-pointer ${
                      hrZoneCalcMethod === "lthr"
                        ? "bg-zinc-950 text-white shadow-[1.5px_1.5px_0px_0px_#09090b]"
                        : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200"
                    }`}
                  >
                    {t("settingsModal.methodLthr", "LTHR (Joe Friel)")}
                  </button>
                </div>
              </div>

              {/* Dynamic Inputs based on Method */}
              <div className="p-4 rounded-xl bg-white border-2 border-zinc-950 space-y-3.5 shadow-[2px_2px_0px_0px_#09090b]">
                {/* Max HR field (Optional, auto-detects from COROS) */}
                {(hrZoneCalcMethod === "max_hr" || hrZoneCalcMethod === "hrr") && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-zinc-950 flex items-center gap-1.5">
                        <span>{t("settingsModal.maxHrCardTitle", "Max Heart Rate (HR Max)")}</span>
                      </label>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        athleteMaxHr.trim() && !isNaN(maxHrNum) && maxHrNum >= 100 && maxHrNum <= 240
                          ? "text-rose-800 bg-rose-50 border-rose-200"
                          : "text-zinc-600 bg-zinc-100 border-zinc-300"
                      }`}>
                        {athleteMaxHr.trim() && !isNaN(maxHrNum) && maxHrNum >= 100 && maxHrNum <= 240
                          ? `Manual: ${maxHrNum} bpm`
                          : `Auto COROS: ${detectedMaxHr} bpm`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={100}
                        max={240}
                        value={athleteMaxHr}
                        onChange={(e) => setAthleteMaxHr(e.target.value)}
                        placeholder={`Auto: ${detectedMaxHr} bpm (COROS)`}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border-2 border-zinc-950 text-zinc-950 placeholder-zinc-400 focus:outline-none focus:bg-white font-mono font-black shadow-[1.5px_1.5px_0px_0px_#09090b]"
                      />
                      {athleteMaxHr && (
                        <button
                          type="button"
                          onClick={() => setAthleteMaxHr("")}
                          className="px-3 py-2.5 text-xs rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold shadow-[1.5px_1.5px_0px_0px_#09090b] cursor-pointer"
                          title={language === "en" ? "Reset to Auto" : "Reset ke Otomatis"}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                      {language === "en"
                        ? `Optional. Leave blank to auto-detect from COROS activity peaks (${detectedMaxHr} bpm).`
                        : `Opsional. Kosongkan untuk otomatis menggunakan data puncak denyut dari COROS (${detectedMaxHr} bpm).`}
                    </p>
                  </div>
                )}

                {/* Resting HR field (Optional for hrr, auto-detects from COROS sleep) */}
                {hrZoneCalcMethod === "hrr" && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-200">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-zinc-950 flex items-center gap-1.5">
                        <span>{t("settingsModal.restingHrCardTitle", "Resting Heart Rate (RHR)")}</span>
                      </label>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        athleteRestingHr.trim() && !isNaN(restingHrNum) && restingHrNum >= 30 && restingHrNum <= 100
                          ? "text-blue-800 bg-blue-50 border-blue-200"
                          : "text-zinc-600 bg-zinc-100 border-zinc-300"
                      }`}>
                        {athleteRestingHr.trim() && !isNaN(restingHrNum) && restingHrNum >= 30 && restingHrNum <= 100
                          ? `Manual: ${restingHrNum} bpm`
                          : `Auto COROS: ${detectedRestingHr} bpm`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={30}
                        max={100}
                        value={athleteRestingHr}
                        onChange={(e) => setAthleteRestingHr(e.target.value)}
                        placeholder={`Auto: ${detectedRestingHr} bpm (COROS)`}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border-2 border-zinc-950 text-zinc-950 placeholder-zinc-400 focus:outline-none focus:bg-white font-mono font-black shadow-[1.5px_1.5px_0px_0px_#09090b]"
                      />
                      {athleteRestingHr && (
                        <button
                          type="button"
                          onClick={() => setAthleteRestingHr("")}
                          className="px-3 py-2.5 text-xs rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold shadow-[1.5px_1.5px_0px_0px_#09090b] cursor-pointer"
                          title={language === "en" ? "Reset to Auto" : "Reset ke Otomatis"}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                      {language === "en"
                        ? `Optional. Leave blank to auto-detect baseline RHR from COROS deep sleep (${detectedRestingHr} bpm).`
                        : `Opsional. Kosongkan untuk otomatis menggunakan sensor denyut istirahat COROS saat tidur (${detectedRestingHr} bpm).`}
                    </p>
                  </div>
                )}

                {/* LTHR field (Optional for lthr, auto-derives) */}
                {hrZoneCalcMethod === "lthr" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-zinc-950 flex items-center gap-1.5">
                        <span>{t("settingsModal.lthrCardTitle", "Lactate Threshold Heart Rate (LTHR)")}</span>
                      </label>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        athleteLthr.trim() && !isNaN(lthrNum) && lthrNum >= 100 && lthrNum <= 220
                          ? "text-amber-800 bg-amber-50 border-amber-200"
                          : "text-zinc-600 bg-zinc-100 border-zinc-300"
                      }`}>
                        {athleteLthr.trim() && !isNaN(lthrNum) && lthrNum >= 100 && lthrNum <= 220
                          ? `Manual: ${lthrNum} bpm`
                          : `Auto Est: ${detectedLthr} bpm`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={100}
                        max={220}
                        value={athleteLthr}
                        onChange={(e) => setAthleteLthr(e.target.value)}
                        placeholder={`Auto: ${detectedLthr} bpm`}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white border-2 border-zinc-950 text-zinc-950 placeholder-zinc-400 focus:outline-none focus:bg-white font-mono font-black shadow-[1.5px_1.5px_0px_0px_#09090b]"
                      />
                      {athleteLthr && (
                        <button
                          type="button"
                          onClick={() => setAthleteLthr("")}
                          className="px-3 py-2.5 text-xs rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold shadow-[1.5px_1.5px_0px_0px_#09090b] cursor-pointer"
                          title={language === "en" ? "Reset to Auto" : "Reset ke Otomatis"}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed font-medium">
                      {language === "en"
                        ? `Optional. Leave blank to auto-derive from 88% Max HR (${detectedLthr} bpm).`
                        : `Opsional. Kosongkan untuk otomatis menurunkan dari 88% Max HR (${detectedLthr} bpm).`}
                    </p>
                  </div>
                )}

                {/* Validation Error Banner */}
                {hrValidationError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs font-bold shadow-[1.5px_1.5px_0px_0px_#f43f5e]">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 stroke-[2.5]" />
                    <span>{hrValidationError}</span>
                  </div>
                )}
              </div>

              {/* Interactive Zone Preview Card */}
              <div className="p-3.5 rounded-xl bg-white border-2 border-zinc-950 space-y-2.5 shadow-[2px_2px_0px_0px_#09090b]">
                <div className="flex items-center justify-between text-xs font-black text-zinc-950">
                  <span>{language === "en" ? "Calculated Training Zones:" : "Kalkulasi Zona Latihan:"}</span>
                  <span className="text-[10px] font-mono text-zinc-600 font-bold">
                    {hrZoneCalcMethod === "max_hr" && (athleteMaxHr.trim() ? `Manual Max: ${maxHrNum} bpm` : `Auto COROS: ${detectedMaxHr} bpm`)}
                    {hrZoneCalcMethod === "hrr" && (
                      `${athleteMaxHr.trim() ? `Max ${maxHrNum}` : `Auto ${detectedMaxHr}`} • ${athleteRestingHr.trim() ? `Rest ${restingHrNum}` : `Auto ${detectedRestingHr}`}`
                    )}
                    {hrZoneCalcMethod === "lthr" && (athleteLthr.trim() ? `Manual LTHR: ${lthrNum} bpm` : `Auto Est: ${detectedLthr} bpm`)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-950/20 space-y-0.5">
                    <div className="text-[10px] font-sans font-bold text-emerald-800 uppercase">Zone 1 (Recovery)</div>
                    <div className="font-black text-emerald-950">{previewZones.zones[0].pctLabel}</div>
                    <div className="text-[11px] text-emerald-700 font-bold">&lt; {previewZones.z1Max} bpm</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-950/20 space-y-0.5">
                    <div className="text-[10px] font-sans font-bold text-blue-800 uppercase">Zone 2 (Aerobic Base)</div>
                    <div className="font-black text-blue-950">{previewZones.zones[1].pctLabel}</div>
                    <div className="text-[11px] text-blue-700 font-bold">
                      {previewZones.z2Min} – {previewZones.z2Max} bpm
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-950/20 space-y-0.5">
                    <div className="text-[10px] font-sans font-bold text-amber-800 uppercase">Zone 3 (Tempo / Grey)</div>
                    <div className="font-black text-amber-950">{previewZones.zones[2].pctLabel}</div>
                    <div className="text-[11px] text-amber-700 font-bold">
                      {previewZones.z3Min} – {previewZones.z3Max} bpm
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-950/20 space-y-0.5">
                    <div className="text-[10px] font-sans font-bold text-orange-800 uppercase">Zone 4 (Threshold)</div>
                    <div className="font-black text-orange-950">{previewZones.zones[3].pctLabel}</div>
                    <div className="text-[11px] text-orange-700 font-bold">
                      {previewZones.z4Min} – {previewZones.z4Max} bpm
                    </div>
                  </div>

                  <div className="col-span-2 p-2.5 rounded-lg bg-rose-50 border border-rose-950/20 space-y-0.5">
                    <div className="text-[10px] font-sans font-bold text-rose-800 uppercase">Zone 5 (VO2Max / Anaerobic)</div>
                    <div className="font-black text-rose-950">{previewZones.zones[4].pctLabel}</div>
                    <div className="text-[11px] text-rose-700 font-bold">
                      {previewZones.z5Min}+ bpm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "public" && (
            <div className="space-y-4 pt-1">
              {/* Athlete Nickname Banner */}
              <div className="p-3.5 rounded-xl bg-orange-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-orange-800">
                    {t("publicProfile.nicknameLabel", "COROS Athlete Nickname")}
                  </div>
                  <div className="text-sm sm:text-base font-black text-zinc-950 font-mono flex items-center gap-1.5 mt-0.5">
                    <span>@{athleteNickname || "athlete"}</span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-200 text-orange-950 border border-orange-400">
                      COROS Verified
                    </span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-orange-500 text-white font-black flex items-center justify-center border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] text-sm uppercase">
                  {(athleteNickname || "AT").slice(0, 2)}
                </div>
              </div>

              {/* Master Switch */}
              <div className="p-4 rounded-xl bg-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs sm:text-sm font-black text-zinc-950">
                      {t("publicProfile.enableSwitch", "Aktifkan Profil Publik")}
                    </div>
                    <div className="text-[11px] sm:text-xs font-medium text-zinc-600 mt-0.5 leading-relaxed">
                      {t("publicProfile.enableHint", "Jika aktif, siapa saja yang memiliki tautan dapat melihat ringkasan performa dan konsistensi latihan Anda.")}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={publicProfileEnabled}
                    onClick={() => handleTogglePublicEnabled(!publicProfileEnabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-zinc-950 transition-colors duration-200 ease-in-out ${
                      publicProfileEnabled ? "bg-emerald-500" : "bg-zinc-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white border border-zinc-950 shadow transition duration-200 ease-in-out mt-0.5 ${
                        publicProfileEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Share URL & Quick Actions if Enabled */}
                {publicProfileEnabled && (
                  <div className="mt-4 pt-3 border-t-2 border-dashed border-zinc-200">
                    <div className="text-[10px] font-mono font-black uppercase text-zinc-500 mb-1.5">
                      {language === "en" ? "Public Profile Link" : "Tautan Profil Publik"}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold text-zinc-800 truncate select-all">
                        {typeof window !== "undefined" ? `${window.location.origin}/u/${encodeURIComponent(athleteNickname || "athlete")}` : `/u/${athleteNickname || "athlete"}`}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const url = typeof window !== "undefined" ? `${window.location.origin}/u/${encodeURIComponent(athleteNickname || "athlete")}` : `/u/${athleteNickname || "athlete"}`;
                          navigator.clipboard.writeText(url);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="px-3 py-2 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-black flex items-center gap-1.5 border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] cursor-pointer"
                      >
                        {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedLink ? t("common.copied", "Tersalin!") : t("common.copy", "Salin")}</span>
                      </button>
                      <a
                        href={`/u/${encodeURIComponent(athleteNickname || "athlete")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-white hover:bg-zinc-100 text-zinc-950 text-xs font-black flex items-center justify-center border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                        title={t("publicProfile.openProfile", "Buka Profil")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Granular Toggles */}
              {publicProfileEnabled && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-zinc-50 border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] space-y-3">
                  <div className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-orange-600" />
                    <span>{t("publicProfile.metricsToShare", "Metrik yang Ditampilkan ke Publik")}</span>
                  </div>

                  <div className="space-y-2">
                    {/* PMC */}
                    <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-200/50 cursor-pointer transition-colors border border-zinc-200 bg-white">
                      <input
                        type="checkbox"
                        checked={publicProfileShowPmc}
                        onChange={(e) => handleTogglePublicOption("pmc", e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-2 border-zinc-950 text-zinc-950 accent-zinc-950 focus:ring-0 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-black text-zinc-950 block">{t("publicProfile.showPmc", "Tingkat Kebugaran & PMC")}</span>
                        <span className="text-zinc-600 text-[11px] block mt-0.5">
                          {language === "en" ? "CTL score, ATL fatigue, Form Zone status & 7-day Ramp Rate." : "Skor CTL, ATL, status Form Zone & Ramp Rate kebugaran jangka panjang."}
                        </span>
                      </div>
                    </label>

                    {/* Volume */}
                    <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-200/50 cursor-pointer transition-colors border border-zinc-200 bg-white">
                      <input
                        type="checkbox"
                        checked={publicProfileShowVolume}
                        onChange={(e) => handleTogglePublicOption("volume", e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-2 border-zinc-950 text-zinc-950 accent-zinc-950 focus:ring-0 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-black text-zinc-950 block">{t("publicProfile.showVolume", "Volume & Agregat")}</span>
                        <span className="text-zinc-600 text-[11px] block mt-0.5">
                          {language === "en" ? "Total distance (KM), elevation gain (D+), training hours, and weekly bars." : "Total kilometer, akumulasi elevasi D+, total jam latihan, dan tren mingguan."}
                        </span>
                      </div>
                    </label>

                    {/* Trail */}
                    <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-200/50 cursor-pointer transition-colors border border-zinc-200 bg-white">
                      <input
                        type="checkbox"
                        checked={publicProfileShowTrail}
                        onChange={(e) => handleTogglePublicOption("trail", e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-2 border-zinc-950 text-zinc-950 accent-zinc-950 focus:ring-0 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-black text-zinc-950 block">{t("publicProfile.showTrail", "Data Trail & Fisiologi")}</span>
                        <span className="text-zinc-600 text-[11px] block mt-0.5">
                          {language === "en" ? "Peak VAM ascent speed (m/h) and trail climbing density." : "Rekor VAM (kecepatan vertikal m/h) dan densitas tanjakan trail."}
                        </span>
                      </div>
                    </label>

                    {/* Recent Feed */}
                    <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-200/50 cursor-pointer transition-colors border border-zinc-200 bg-white">
                      <input
                        type="checkbox"
                        checked={publicProfileShowRecent}
                        onChange={(e) => handleTogglePublicOption("recent", e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-2 border-zinc-950 text-zinc-950 accent-zinc-950 focus:ring-0 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-black text-zinc-950 block">{t("publicProfile.showRecent", "Feed Aktivitas Terkini")}</span>
                        <span className="text-zinc-600 text-[11px] block mt-0.5">
                          {language === "en" ? "Latest 6 recorded workouts with mini route silhouette outline." : "Daftar 6 sesi workout terakhir dengan siluet rute mini SVG."}
                        </span>
                      </div>
                    </label>

                    {/* HR */}
                    <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-200/50 cursor-pointer transition-colors border border-amber-300 bg-amber-50/50">
                      <input
                        type="checkbox"
                        checked={publicProfileShowHr}
                        onChange={(e) => handleTogglePublicOption("hr", e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-2 border-zinc-950 text-zinc-950 accent-zinc-950 focus:ring-0 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-black text-zinc-950 block">{t("publicProfile.showHr", "Data Detak Jantung / HR")}</span>
                        <span className="text-amber-800 text-[11px] font-medium block mt-0.5">
                          {t("publicProfile.hrWarning", "Nonaktif secara default demi menjaga kerahasiaan fisiologis dari kompetitor.")}
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Safe Privacy Notice */}
                  <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-[11px] text-emerald-900 font-medium leading-relaxed">
                    {t("publicProfile.privacyNotice", "Zero-Config & Aman: Hanya agregat dan siluet rute yang dibagikan. Koordinat titik rumah atau start/finish presisi GPS tidak akan pernah diekspos.")}
                  </div>
                </div>
              )}
            </div>
          )}

          {savedSuccess && (
            <div className="flex items-center gap-2 text-xs text-emerald-950 bg-emerald-100 border-2 border-zinc-950 p-2.5 rounded-xl shadow-[2px_2px_0px_0px_#09090b] font-bold">
              <Check className="h-4 w-4 stroke-[2.5] shrink-0" />
              <span>{t("settingsModal.savedSuccess", "Settings saved successfully!")}</span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-xs font-black rounded-xl bg-zinc-100 hover:bg-zinc-200 border-2 border-zinc-950 text-zinc-950 transition-all shadow-[1.5px_1.5px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              {t("settingsModal.cancelButton", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || (activeTab === "physiology" && !isHrValid)}
              className="w-full sm:w-auto px-5 py-2 text-xs font-black rounded-xl bg-orange-500 hover:bg-orange-600 text-white border-2 border-zinc-950 transition-all shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t("common.saving", "Saving...") : t("settingsModal.saveButton", "Save Configuration")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
