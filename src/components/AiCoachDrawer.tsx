"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Sparkles, User, AlertCircle, RefreshCw } from "lucide-react";

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Halo Coach! Saya adalah AI Training Coach Anda. Saya terhubung langsung ke data fisiologis COROS dan analitik Intervals.icu Anda (TSB, ACWR, VAM). Ada yang bisa saya bantu hari ini?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const quickPrompts = [
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
                content: `⚠️ ${err.message || "Gagal menghubungi AI model. Pastikan API key sudah diisi di menu Settings."}`,
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              COROS AI Coach
              <Sparkles className="h-3 w-3 text-orange-400" />
            </h3>
            <p className="text-[10px] text-zinc-400">
              Live Context: TSB {currentTsb > 0 ? `+${currentTsb}` : currentTsb} • ACWR {acwr.toFixed(2)}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="h-6 w-6 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-orange-600 text-white shadow-md rounded-br-none"
                  : "bg-zinc-900 border border-zinc-800/80 text-zinc-200 shadow-sm rounded-tl-none"
              }`}
            >
              {m.content || (loading ? <span className="animate-pulse">Analyzing athlete metrics...</span> : "")}
            </div>
            {m.role === "user" && (
              <div className="h-6 w-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="px-4 py-2 border-t border-zinc-900 bg-zinc-950 flex flex-col gap-1.5">
        <span className="text-[10px] text-zinc-400 uppercase font-semibold">Quick Inquiries:</span>
        <div className="flex flex-col gap-1">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSend(p)}
              className="text-left text-[11px] p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800/80 text-zinc-300 hover:text-orange-400 transition-colors truncate"
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
        className="p-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya coach tentang latihan hari ini..."
          disabled={loading}
          className="flex-1 px-3 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
};
