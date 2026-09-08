"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Sparkles, User, AlertCircle, RefreshCw, Key, Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { useAppSettings } from "@/lib/queries";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AiCoachDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  currentTsb: number;
  acwr: number;
}

export const AiCoachDrawer: React.FC<AiCoachDrawerProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  currentTsb,
  acwr,
}) => {
  const { language, t } = useTranslation();
  const { data: settingsData } = useAppSettings();

  const activeProvider = settingsData?.aiProvider || "deepseek";
  const configuredKeys = settingsData?.configuredKeys || {};
  const serverProvidedKeys = settingsData?.serverProvidedKeys || {};
  const isMissingKey = activeProvider !== "ollama" && !configuredKeys[activeProvider];

  const getProviderDisplayName = (pId: string) => {
    switch (pId) {
      case "gemini":
        return "Gemini";
      case "deepseek":
        return "DeepSeek";
      case "openai":
        return "OpenAI";
      case "claude":
        return "Claude";
      case "ollama":
        return "Ollama";
      default:
        return pId;
    }
  };

  const defaultWelcomeEn =
    "Hello! I am your AI Athletic Coach, directly connected to your COROS physiological telemetry and performance analytics (TSB, ACWR, VAM). How can I assist your training today?";
  const defaultWelcomeId =
    "Halo Coach! Saya adalah AI Training Coach Anda. Saya terhubung langsung ke data fisiologis COROS dan analitik performa Anda (TSB, ACWR, VAM). Ada yang bisa saya bantu hari ini?";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: language === "en" ? defaultWelcomeEn : defaultWelcomeId,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dynamically update greeting if user hasn't messaged yet
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [
          {
            id: "welcome",
            role: "assistant",
            content: language === "en" ? defaultWelcomeEn : defaultWelcomeId,
          },
        ];
      }
      return prev;
    });
  }, [language, defaultWelcomeEn, defaultWelcomeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const quickPrompts =
    language === "en"
      ? [
          "Is today safe for a hard interval session?",
          "Analyze my injury risk based on my current ACWR and TSB.",
          "What pacing & climbing strategy should I use based on my VAM?",
        ]
      : [
          "Apakah hari ini aman untuk sesi interval keras?",
          "Analisis risiko cedera dari status ACWR dan TSB saya.",
          "Bagaimana strategi pacing & nanjak race trail berdasarkan VAM saya?",
        ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text.trim(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const assistantMsgId = `assistant_${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          language,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP error ${response.status}`);
      }

      if (!response.body) throw new Error("No response body stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: !done });
        accumulated += chunkValue;

        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, content: accumulated } : msg))
        );
      }
    } catch (err: any) {
      console.error("Streaming error:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `⚠️ ${err.message || (language === "en" ? "Failed to connect to AI model. Please ensure your API key is configured in Settings." : "Gagal menghubungi AI model. Pastikan API key sudah diisi di menu Settings.")}`,
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[#F6F4EE] border-l-4 border-zinc-950 shadow-[-8px_0px_0px_0px_rgba(9,9,11,0.15)] flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b-2 border-zinc-950 flex items-center justify-between bg-white shadow-[0_2px_0px_0px_#09090b]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-lg bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <Bot className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-black text-zinc-950 flex items-center gap-1">
                <span>COROS AI Coach</span>
                <Sparkles className="h-3 w-3 text-orange-600 stroke-[2.5]" />
              </h3>
              {isMissingKey ? (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 border border-zinc-950 font-mono">
                  {getProviderDisplayName(activeProvider)} • {t("aiCoach.keyRequired", "Key Required")}
                </span>
              ) : activeProvider === "deepseek" && serverProvidedKeys.deepseek && !configuredKeys.deepseek ? (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-950 border border-zinc-950 font-mono">
                  DeepSeek • {t("aiCoach.serverDefault", "Server Default")}
                </span>
              ) : (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-200 text-sky-950 border border-zinc-950 font-mono">
                  {getProviderDisplayName(activeProvider)} • {activeProvider === "ollama" ? t("aiCoach.local", "Local") : t("aiCoach.personalKey", "Your Key")}
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono font-bold text-zinc-600">
              Live: TSB {currentTsb > 0 ? `+${currentTsb}` : currentTsb} • ACWR {acwr.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl border-2 border-zinc-950 bg-white hover:bg-zinc-100 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] transition-colors cursor-pointer"
              title={t("settingsModal.title", "App Settings")}
            >
              <SettingsIcon className="h-4 w-4 stroke-[2.5]" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] transition-colors"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Missing Key Warning Banner */}
      {isMissingKey && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-100 border-2 border-zinc-950 shadow-[2.5px_2.5px_0px_0px_#09090b] space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-amber-900 stroke-[2.5] shrink-0" />
            <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
              {t("aiCoach.missingKeyTitle", "API Key Required (BYOK)")}
            </h4>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-800 font-medium">
            <strong className="font-bold text-zinc-950 capitalize">{getProviderDisplayName(activeProvider)}</strong>{" "}
            {t(
              "aiCoach.missingKeyDesc",
              "requires your personal API key. Please configure your key in Settings to begin coaching, or switch back to DeepSeek (Server Default)."
            )}
          </p>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full py-1.5 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-black text-xs border-2 border-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] flex items-center justify-center gap-1.5 transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <Key className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>{t("aiCoach.openSettings", "Configure API Key in Settings")}</span>
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F6F4EE]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="h-6 w-6 rounded-md bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 mt-0.5 shadow-[1px_1px_0px_0px_#09090b]">
                <Bot className="h-3.5 w-3.5 stroke-[2.5]" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-wrap break-words min-w-0 border-2 border-zinc-950 ${
                m.role === "user"
                  ? "bg-orange-500 text-white font-semibold shadow-[2px_2px_0px_0px_#09090b] rounded-br-none"
                  : "bg-white text-zinc-900 font-medium shadow-[2px_2px_0px_0px_#09090b] rounded-tl-none"
              }`}
            >
              {m.content || (loading ? <span className="animate-pulse font-bold text-zinc-600">{language === "en" ? "Analyzing athlete metrics..." : "Menganalisis data fisiologis atlet..."}</span> : "")}
            </div>
            {m.role === "user" && (
              <div className="h-6 w-6 rounded-md bg-zinc-950 border-2 border-zinc-950 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-[1px_1px_0px_0px_#09090b]">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="px-4 py-3 border-t-2 border-zinc-950 bg-white flex flex-col gap-1.5 shadow-[0_-2px_0px_0px_#09090b]">
        <span className="text-[10px] text-zinc-600 uppercase font-black tracking-wider">
          {language === "en" ? "Quick Inquiries:" : "Pertanyaan Cepat:"}
        </span>
        <div className="flex flex-col gap-1.5">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              disabled={loading || isMissingKey}
              onClick={() => handleSend(p)}
              className="text-left text-[11px] p-2 rounded-xl bg-[#FAF9F5] hover:bg-orange-50 border-2 border-zinc-950 text-zinc-800 font-bold transition-all truncate shadow-[1.5px_1.5px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:pointer-events-none"
            >
              • {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isMissingKey) handleSend();
        }}
        className="p-3.5 border-t-2 border-zinc-950 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isMissingKey
              ? t("aiCoach.inputDisabledPlaceholder", "Configure API key in Settings to enable chat...")
              : language === "en"
                ? "Ask coach about today's training..."
                : "Tanya coach tentang latihan hari ini..."
          }
          disabled={loading || isMissingKey}
          className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 placeholder-zinc-500 focus:outline-none focus:bg-white font-medium shadow-[1.5px_1.5px_0px_0px_#09090b] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || isMissingKey}
          className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 stroke-[2.5]" />}
        </button>
      </form>
    </div>
  );
};
