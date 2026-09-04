"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, Key, Cpu, Check, AlertCircle } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [provider, setProvider] = useState<string>("gemini");
  const [modelName, setModelName] = useState<string>("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState<string>("");
  const [configuredKeys, setConfiguredKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data.aiProvider) setProvider(data.aiProvider);
          if (data.aiModelName) setModelName(data.aiModelName);
          if (data.configuredKeys) setConfiguredKeys(data.configuredKeys);
        })
        .catch((err) => console.error("Failed to load settings:", err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
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

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save settings");

      setSavedSuccess(true);
      setApiKey("");
      // Update key flags
      setConfiguredKeys((prev) => ({
        ...prev,
        [provider]: true,
      }));
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">App Settings</h3>
              <p className="text-xs text-zinc-400">BYOK AI Provider & Model Configuration</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-orange-400" />
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
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    provider === p.id
                      ? "border-orange-500 bg-orange-500/10 text-white"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <div className="text-xs font-bold">{p.label}</div>
                  <div className="text-[10px] text-zinc-400">
                    {configuredKeys[p.id] ? "✓ Key Configured" : "Needs Key"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Model Name</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-orange-500 font-mono"
            />
          </div>

          {/* API Key Input */}
          {provider !== "ollama" && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                  <Key className="h-3 w-3 text-orange-400" />
                  API Key ({provider.toUpperCase()})
                </label>
                {configuredKeys[provider] && (
                  <span className="text-[10px] text-emerald-400 font-medium">✓ Stored securely</span>
                )}
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={configuredKeys[provider] ? "Leave blank to keep existing key" : "Enter API Key..."}
                className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 font-mono"
              />
              <p className="text-[10px] text-zinc-400">
                Your API key is saved locally in SQLite and never transmitted to third parties.
              </p>
            </div>
          )}

          {savedSuccess && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800 p-2.5 rounded-xl">
              <Check className="h-4 w-4" />
              <span>Settings saved successfully!</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
