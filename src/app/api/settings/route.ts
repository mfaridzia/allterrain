import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";
import { getCurrentAthleteId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const athleteId = (await getCurrentAthleteId(req)) || "athlete_primary";

  const defaultProvider = process.env.AI_PROVIDER || (process.env.GROQ_API_KEY ? "groq" : "groq");
  const defaultModel = process.env.AI_MODEL_NAME || (defaultProvider === "groq" ? "openai/gpt-oss-120b" : defaultProvider === "deepseek" ? "deepseek-chat" : "gemini-2.5-flash");

  // Parallel fetch to eliminate async waterfall (Vercel Best Practice: async-parallel)
  const [
    aiProvider,
    aiModelName,
    geminiKey,
    openAiKey,
    claudeKey,
    deepseekKey,
    groqKey,
    trailTargetRaceDistStr,
    trailTargetRaceElevStr,
    trailWeeklyVertTargetStr,
    trailTrainingTier,
  ] = await Promise.all([
    getSetting("ai_provider", defaultProvider, athleteId),
    getSetting("ai_model_name", defaultModel, athleteId),
    getSetting("gemini_api_key", "", athleteId),
    getSetting("openai_api_key", "", athleteId),
    getSetting("claude_api_key", "", athleteId),
    getSetting("deepseek_api_key", "", athleteId),
    getSetting("groq_api_key", "", athleteId),
    getSetting("trail_target_race_dist", "36", athleteId),
    getSetting("trail_target_race_elev", "2200", athleteId),
    getSetting("trail_weekly_vert_target", "1000", athleteId),
    getSetting("trail_training_tier", "finisher", athleteId),
  ]);

  const hasGeminiKey = !!geminiKey || !!process.env.GEMINI_API_KEY;
  const hasOpenAiKey = !!openAiKey || !!process.env.OPENAI_API_KEY;
  const hasClaudeKey = !!claudeKey || !!process.env.ANTHROPIC_API_KEY;
  const hasDeepseekKey = !!deepseekKey || !!process.env.DEEPSEEK_API_KEY;
  const hasGroqKey = !!groqKey || !!process.env.GROQ_API_KEY;

  return NextResponse.json({
    aiProvider,
    aiModelName,
    configuredKeys: {
      gemini: hasGeminiKey,
      openai: hasOpenAiKey,
      claude: hasClaudeKey,
      deepseek: hasDeepseekKey,
      groq: hasGroqKey,
    },
    serverProvidedKeys: {
      gemini: !geminiKey && !!process.env.GEMINI_API_KEY,
      openai: !openAiKey && !!process.env.OPENAI_API_KEY,
      claude: !claudeKey && !!process.env.ANTHROPIC_API_KEY,
      deepseek: !deepseekKey && !!process.env.DEEPSEEK_API_KEY,
      groq: !groqKey && !!process.env.GROQ_API_KEY,
    },
    trailSettings: {
      targetRaceDist: Number(trailTargetRaceDistStr),
      targetRaceElev: Number(trailTargetRaceElevStr),
      weeklyVertTarget: Number(trailWeeklyVertTargetStr),
      trainingTier: trailTrainingTier,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const athleteId = (await getCurrentAthleteId(req)) || "athlete_primary";
    const body = await req.json();

    if (body.aiProvider) {
      await setSetting("ai_provider", body.aiProvider, athleteId);
    }
    if (body.aiModelName) {
      await setSetting("ai_model_name", body.aiModelName, athleteId);
    }
    if (body.geminiApiKey) {
      await setSetting("gemini_api_key", body.geminiApiKey, athleteId);
    }
    if (body.openaiApiKey) {
      await setSetting("openai_api_key", body.openaiApiKey, athleteId);
    }
    if (body.claudeApiKey) {
      await setSetting("claude_api_key", body.claudeApiKey, athleteId);
    }
    if (body.deepseekApiKey) {
      await setSetting("deepseek_api_key", body.deepseekApiKey, athleteId);
    }
    if (body.groqApiKey) {
      await setSetting("groq_api_key", body.groqApiKey, athleteId);
    }
    if (body.trailTargetRaceDist !== undefined) {
      await setSetting("trail_target_race_dist", body.trailTargetRaceDist.toString(), athleteId);
    }
    if (body.trailTargetRaceElev !== undefined) {
      await setSetting("trail_target_race_elev", body.trailTargetRaceElev.toString(), athleteId);
    }
    if (body.trailWeeklyVertTarget !== undefined) {
      await setSetting("trail_weekly_vert_target", body.trailWeeklyVertTarget.toString(), athleteId);
    }
    if (body.trailTrainingTier !== undefined) {
      await setSetting("trail_training_tier", body.trailTrainingTier.toString(), athleteId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 500 });
  }
}
