"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, Key, Cpu, Check, AlertCircle } from "lucide-react";
import { useAppSettings, useUpdateSettingsMutation } from "@/lib/queries";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { data: settingsData } = useAppSettings();
  const updateSettingsMutation = useUpdateSettingsMutation();

  const [provider, setProvider] = useState<string>("gemini");
  const [modelName, setModelName] = useState<string>("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (settingsData) {
      if (settingsData.aiProvider) setProvider(settingsData.aiProvider);
      if (settingsData.aiModelName) setModelName(settingsData.aiModelName);
    }
  }, [settingsData]);

  if (!isOpen) return null;

  const configuredKeys = settingsData?.configuredKeys || {};
  const saving = updateSettingsMutation.isPending;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(false);

    try {
      const payload: any = {
        aiProvider: provider,
        aiModelName: modelName,
      };

      if (apiKey.trim()) {
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

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl bg-white border-2 border-zinc-950 p-6 space-y-5 shadow-[6px_6px_0px_0px_#09090b]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
              <Settings className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-950">App Settings</h3>
              <p className="text-xs font-medium text-zinc-600">BYOK AI Provider & Model Configuration</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-zinc-900 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-orange-600 stroke-[2.5]" />
              AI Coach Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "gemini", label: "Google Gemini", defModel: "gemini-2.5-flash" },
                { id: "deepseek", label: "DeepSeek", defModel: "deepseek-chat" },
                { id: "openai", label: "OpenAI", defModel: "gpt-4o-mini" },
                { id: "claude", label: "Anthropic Claude", defModel: "claude-3-5-sonnet-20241022" },
                { id: "ollama", label: "Ollama (Local)", defModel: "llama3.2" },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setProvider(p.id);
                    setModelName(p.defModel);
                  }}
                  className={`p-2.5 rounded-xl text-left transition-all ${
                    provider === p.id
                      ? "border-2 border-zinc-950 bg-orange-100 text-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                      : "border-2 border-zinc-200 bg-[#FAF9F5] text-zinc-700 hover:border-zinc-950"
                  }`}
                >
                  <div className="text-xs font-black">{p.label}</div>
                  <div className="text-[10px] font-bold text-zinc-500 font-mono">
                    {configuredKeys[p.id] ? "✓ Configured" : "Needs Key"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Name */}
          <div className="space-y-1">
            <label className="text-xs font-black text-zinc-900">Model Name</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 focus:outline-none focus:bg-white font-mono shadow-[1.5px_1.5px_0px_0px_#09090b]"
            />
          </div>

          {/* API Key Input */}
          {provider !== "ollama" && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-zinc-900 flex items-center gap-1">
                  <Key className="h-3.5 w-3.5 text-orange-600 stroke-[2.5]" />
                  API Key ({provider.toUpperCase()})
                </label>
                {configuredKeys[provider] && (
                  <span className="text-[10px] text-emerald-700 font-bold">✓ Stored securely</span>
                )}
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={configuredKeys[provider] ? "Leave blank to keep existing key" : "Enter API Key..."}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 placeholder-zinc-500 focus:outline-none focus:bg-white font-mono shadow-[1.5px_1.5px_0px_0px_#09090b]"
              />
              <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium">
                Your API key is stored securely in your encrypted database and never transmitted to third parties.
              </p>
            </div>
          )}

          {savedSuccess && (
            <div className="flex items-center gap-2 text-xs text-emerald-950 bg-emerald-100 border-2 border-zinc-950 p-2.5 rounded-xl shadow-[2px_2px_0px_0px_#09090b] font-bold">
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>Settings saved successfully!</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-black rounded-xl bg-zinc-100 hover:bg-zinc-200 border-2 border-zinc-950 text-zinc-950 transition-all shadow-[1.5px_1.5px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-black rounded-xl bg-orange-500 hover:bg-orange-600 text-white border-2 border-zinc-950 transition-all shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
