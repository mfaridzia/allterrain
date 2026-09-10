"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, Key, Cpu, Check, AlertCircle, RefreshCw, Info, ExternalLink } from "lucide-react";
import { useAppSettings, useUpdateSettingsMutation } from "@/lib/queries";
import { useTranslation } from "@/lib/i18n/context";

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

const CURATED_MODELS: Record<string, { id: string; label: string }[]> = {
  groq: [
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Rekomendasi • Sangat Pintar & Super Cepat)" },
    { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill 70B (Penalaran Mendalam)" },
    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B (Konteks Panjang)" },
    { id: "gemma2-9b-it", label: "Gemma 2 9B (Ringan & Cepat)" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Rekomendasi • Cepat & Irit)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Penalaran & Analisis Mendalam)" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Legacy Fast)" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Legacy Deep)" },
  ],
  deepseek: [
    { id: "deepseek-chat", label: "DeepSeek V3 (deepseek-chat • Default)" },
    { id: "deepseek-reasoner", label: "DeepSeek R1 (deepseek-reasoner • Penalaran)" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o Mini (Rekomendasi • Cepat & Hemat)" },
    { id: "gpt-4o", label: "GPT-4o (Omni Flagship)" },
    { id: "o3-mini", label: "o3-mini (Reasoning Cepat)" },
    { id: "o1", label: "o1 (Deep Reasoning)" },
  ],
  claude: [
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Rekomendasi Utama)" },
    { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet (Hybrid Reasoning Terbaru)" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Paling Cepat & Ringan)" },
    { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { data: settingsData } = useAppSettings();
  const updateSettingsMutation = useUpdateSettingsMutation();

  const [provider, setProvider] = useState<string>("gemini");
  const [modelName, setModelName] = useState<string>("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const [dynamicModels, setDynamicModels] = useState<Record<string, { id: string; label: string }[]>>({});
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);

  useEffect(() => {
    if (settingsData) {
      if (settingsData.aiProvider) setProvider(settingsData.aiProvider);
      if (settingsData.aiModelName) {
        setModelName(settingsData.aiModelName);
        const models = dynamicModels[settingsData.aiProvider] || CURATED_MODELS[settingsData.aiProvider] || [];
        if (!models.some((m) => m.id === settingsData.aiModelName)) {
          setIsCustomModel(true);
        }
      }
    }
  }, [settingsData]);

  if (!isOpen) return null;

  const configuredKeys = settingsData?.configuredKeys || {};
  const serverProvidedKeys = settingsData?.serverProvidedKeys || {};
  const saving = updateSettingsMutation.isPending;

  const getProviderBadge = (pId: string) => {
    if (pId === "deepseek" && (serverProvidedKeys.deepseek || configuredKeys.deepseek)) {
      return (
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 font-mono">
          {serverProvidedKeys.deepseek
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(false);

    try {
      const payload: any = {
        aiProvider: provider,
        aiModelName: modelName,
      };

      if (apiKey.trim()) {
        if (provider === "groq") payload.groqApiKey = apiKey.trim();
        if (provider === "gemini") payload.geminiApiKey = apiKey.trim();
        if (provider === "openai") payload.openaiApiKey = apiKey.trim();
        if (provider === "claude") payload.claudeApiKey = apiKey.trim();
        if (provider === "deepseek") payload.deepseekApiKey = apiKey.trim();
      }

      await updateSettingsMutation.mutateAsync(payload);

      setSavedSuccess(true);
      setApiKey("");
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const displayModels = dynamicModels[provider] || CURATED_MODELS[provider] || [];

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

        <form onSubmit={handleSave} className="space-y-4">
          {/* BYOK Info Banner */}
          <div className="p-3 rounded-xl bg-amber-50 border-2 border-zinc-950 text-xs text-zinc-900 shadow-[2px_2px_0px_0px_#09090b] space-y-1">
            <div className="flex items-center gap-1.5 font-black text-amber-900">
              <Info className="h-4 w-4 stroke-[2.5] text-amber-700 shrink-0" />
              <span>{t("settingsModal.byokBadge", "Bring Your Own Key (BYOK)")}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-700 font-medium">
              {t(
                "settingsModal.byokDescription",
                "AllTerrain provides DeepSeek for free out-of-the-box (server default). To unlock other models (Groq, Claude, OpenAI, Gemini), please connect your personal API keys."
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
                { id: "groq", label: "Groq (Free & Fast)", defModel: "llama-3.3-70b-versatile" },
                { id: "gemini", label: "Google Gemini", defModel: "gemini-2.5-flash" },
                { id: "deepseek", label: "DeepSeek", defModel: "deepseek-chat" },
                { id: "openai", label: "OpenAI", defModel: "gpt-4o-mini" },
                { id: "claude", label: "Anthropic Claude", defModel: "claude-3-5-sonnet-20241022" },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setProvider(p.id);
                    setModelName(p.defModel);
                    setIsCustomModel(false);
                    setFetchError(null);
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all min-w-0 flex items-center justify-between gap-2 ${
                    provider === p.id
                      ? "border-2 border-zinc-950 bg-orange-100 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                      : "border-2 border-zinc-200 bg-[#FAF9F5] text-zinc-700 hover:border-zinc-950"
                  }`}
                >
                  <div className="text-xs font-black truncate">{p.label}</div>
                  <div className="shrink-0">
                    {getProviderBadge(p.id)}
                  </div>
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
                  <span className="text-[10px] text-emerald-700 font-bold shrink-0">
                    {t("settingsModal.apiKeyStored", "✓ Stored")}
                  </span>
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
            {provider === "deepseek" && serverProvidedKeys.deepseek && !configuredKeys.deepseek && (
              <p className="text-[10px] text-emerald-800 font-medium font-mono">
                {t(
                  "settingsModal.deepseekServerReadyNotice",
                  "DeepSeek is active via server default. Enter an API key only if you want to use your personal quota."
                )}
              </p>
            )}
            <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium leading-tight">
              {t("settingsModal.apiKeyNotice", "Your API key is stored securely in your encrypted database and never transmitted to third parties.")}
            </p>
          </div>

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
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2 text-xs font-black rounded-xl bg-orange-500 hover:bg-orange-600 text-white border-2 border-zinc-950 transition-all shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
            >
              {saving ? t("common.saving", "Saving...") : t("settingsModal.saveButton", "Save Configuration")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
