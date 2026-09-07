import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { getCurrentAthleteId } from "@/lib/session";

interface ModelOption {
  id: string;
  label: string;
}

export async function POST(req: NextRequest) {
  try {
    const athleteId = (await getCurrentAthleteId(req)) || "athlete_primary";
    const body = await req.json();
    const provider = String(body.provider || "gemini").toLowerCase();

    // Priority: user provided key in body > stored key in DB > env var
    let apiKey = String(body.apiKey || "").trim();
    if (!apiKey) {
      apiKey = await getSetting(`${provider}_api_key`, "", athleteId);
    }

    if (!apiKey && provider !== "ollama") {
      if (provider === "gemini") apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
      else if (provider === "openai") apiKey = process.env.OPENAI_API_KEY || "";
      else if (provider === "claude" || provider === "anthropic") apiKey = process.env.ANTHROPIC_API_KEY || "";
      else if (provider === "deepseek") apiKey = process.env.DEEPSEEK_API_KEY || "";
    }

    if (!apiKey && provider !== "ollama") {
      return NextResponse.json(
        { success: false, error: `Please enter an API Key for ${provider.toUpperCase()} first.` },
        { status: 400 }
      );
    }

    let models: ModelOption[] = [];

    switch (provider) {
      case "claude":
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        });
        if (!res.ok) {
          const err = await res.text();
          return NextResponse.json(
            { success: false, error: `Anthropic API error (${res.status}): ${err}` },
            { status: res.status }
          );
        }
        const data = await res.json();
        const rawList = Array.isArray(data.data) ? data.data : [];
        models = rawList.map((m: any) => ({
          id: m.id,
          label: m.display_name ? `${m.display_name} (${m.id})` : m.id,
        }));
        break;
      }

      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
        if (!res.ok) {
          const err = await res.text();
          return NextResponse.json(
            { success: false, error: `OpenAI API error (${res.status}): ${err}` },
            { status: res.status }
          );
        }
        const data = await res.json();
        const rawList = Array.isArray(data.data) ? data.data : [];
        // Filter only chat and completion models, exclude embeddings/tts/whisper/etc.
        models = rawList
          .filter((m: any) => {
            const id = String(m.id || "").toLowerCase();
            if (
              id.includes("embedding") ||
              id.includes("tts") ||
              id.includes("whisper") ||
              id.includes("dall-e") ||
              id.includes("moderation") ||
              id.includes("realtime") ||
              id.includes("transcription") ||
              id.includes("babbage") ||
              id.includes("davinci")
            ) {
              return false;
            }
            return (
              id.startsWith("gpt-") ||
              id.startsWith("o1") ||
              id.startsWith("o3") ||
              id.startsWith("chatgpt-")
            );
          })
          .sort((a: any, b: any) => (b.created || 0) - (a.created || 0))
          .map((m: any) => ({
            id: m.id,
            label: m.id,
          }));
        break;
      }

      case "gemini": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (!res.ok) {
          const err = await res.text();
          return NextResponse.json(
            { success: false, error: `Gemini API error (${res.status}): ${err}` },
            { status: res.status }
          );
        }
        const data = await res.json();
        const rawList = Array.isArray(data.models) ? data.models : [];
        models = rawList
          .filter((m: any) => {
            const id = String(m.name || "").toLowerCase();
            const methods = Array.isArray(m.supportedGenerationMethods)
              ? m.supportedGenerationMethods
              : [];
            return (
              methods.includes("generateContent") &&
              !id.includes("embedding") &&
              !id.includes("aqa") &&
              !id.includes("imagen")
            );
          })
          .map((m: any) => {
            const cleanId = String(m.name || "").replace(/^models\//, "");
            return {
              id: cleanId,
              label: m.displayName ? `${m.displayName} (${cleanId})` : cleanId,
            };
          });
        break;
      }

      case "deepseek": {
        const res = await fetch("https://api.deepseek.com/models", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
        if (!res.ok) {
          const err = await res.text();
          return NextResponse.json(
            { success: false, error: `DeepSeek API error (${res.status}): ${err}` },
            { status: res.status }
          );
        }
        const data = await res.json();
        const rawList = Array.isArray(data.data) ? data.data : [];
        models = rawList.map((m: any) => ({
          id: m.id,
          label: m.id === "deepseek-chat" ? "DeepSeek V3 Chat (deepseek-chat)" : m.id === "deepseek-reasoner" ? "DeepSeek R1 Reasoner (deepseek-reasoner)" : m.id,
        }));
        break;
      }

      case "ollama": {
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        const res = await fetch(`${baseUrl}/api/tags`);
        if (!res.ok) {
          return NextResponse.json(
            { success: false, error: "Ollama instance not running on localhost:11434." },
            { status: 503 }
          );
        }
        const data = await res.json();
        const rawList = Array.isArray(data.models) ? data.models : [];
        models = rawList.map((m: any) => ({
          id: m.name,
          label: m.name,
        }));
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      provider,
      models,
    });
  } catch (err: any) {
    console.error("Failed to fetch models from provider:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch models from provider" },
      { status: 500 }
    );
  }
}
