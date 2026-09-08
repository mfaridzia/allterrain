"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Sparkles, User, AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

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
  const { language } = useTranslation();

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
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shrink-0 shadow-[1.5px_1.5px_0px_0px_#09090b]">
            <Bot className="h-4 w-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-zinc-950 flex items-center gap-1.5">
              <span>COROS AI Coach</span>
              <Sparkles className="h-3 w-3 text-orange-600 stroke-[2.5]" />
            </h3>
            <p className="text-[10px] font-mono font-bold text-zinc-600">
              Live: TSB {currentTsb > 0 ? `+${currentTsb}` : currentTsb} • ACWR {acwr.toFixed(2)}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b] transition-colors"
        >
          <X className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>

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
              disabled={loading}
              onClick={() => handleSend(p)}
              className="text-left text-[11px] p-2 rounded-xl bg-[#FAF9F5] hover:bg-orange-50 border-2 border-zinc-950 text-zinc-800 font-bold transition-all truncate shadow-[1.5px_1.5px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
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
          handleSend();
        }}
        className="p-3.5 border-t-2 border-zinc-950 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={language === "en" ? "Ask coach about today's training..." : "Tanya coach tentang latihan hari ini..."}
          disabled={loading}
          className="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 placeholder-zinc-500 focus:outline-none focus:bg-white font-medium shadow-[1.5px_1.5px_0px_0px_#09090b]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40 transition-all cursor-pointer"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 stroke-[2.5]" />}
        </button>
      </form>
    </div>
  );
};
