import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

export async function GET() {
  const aiProvider = getSetting("ai_provider", "gemini");
  const aiModelName = getSetting("ai_model_name", "gemini-2.5-flash");

  // Do not expose full secret keys to frontend; only return whether they are configured
  const hasGeminiKey = !!getSetting("gemini_api_key") || !!process.env.GEMINI_API_KEY;
  const hasOpenAiKey = !!getSetting("openai_api_key") || !!process.env.OPENAI_API_KEY;
  const hasClaudeKey = !!getSetting("claude_api_key") || !!process.env.ANTHROPIC_API_KEY;
  const hasDeepseekKey = !!getSetting("deepseek_api_key") || !!process.env.DEEPSEEK_API_KEY;

  const trailTargetRaceDist = Number(getSetting("trail_target_race_dist", "36"));
  const trailTargetRaceElev = Number(getSetting("trail_target_race_elev", "2200"));
  const trailWeeklyVertTarget = Number(getSetting("trail_weekly_vert_target", "1000"));
  const trailTrainingTier = getSetting("trail_training_tier", "finisher");

  return NextResponse.json({
    aiProvider,
    aiModelName,
    configuredKeys: {
      gemini: hasGeminiKey,
      openai: hasOpenAiKey,
      claude: hasClaudeKey,
      deepseek: hasDeepseekKey,
    },
    trailSettings: {
      targetRaceDist: trailTargetRaceDist,
      targetRaceElev: trailTargetRaceElev,
      weeklyVertTarget: trailWeeklyVertTarget,
      trainingTier: trailTrainingTier,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.aiProvider) {
      setSetting("ai_provider", body.aiProvider);
    }
    if (body.aiModelName) {
      setSetting("ai_model_name", body.aiModelName);
    }
    if (body.geminiApiKey) {
      setSetting("gemini_api_key", body.geminiApiKey);
    }
    if (body.openaiApiKey) {
      setSetting("openai_api_key", body.openaiApiKey);
    }
    if (body.claudeApiKey) {
      setSetting("claude_api_key", body.claudeApiKey);
    }
    if (body.deepseekApiKey) {
      setSetting("deepseek_api_key", body.deepseekApiKey);
    }
    if (body.trailTargetRaceDist !== undefined) {
      setSetting("trail_target_race_dist", body.trailTargetRaceDist.toString());
    }
    if (body.trailTargetRaceElev !== undefined) {
      setSetting("trail_target_race_elev", body.trailTargetRaceElev.toString());
    }
    if (body.trailWeeklyVertTarget !== undefined) {
      setSetting("trail_weekly_vert_target", body.trailWeeklyVertTarget.toString());
    }
    if (body.trailTrainingTier !== undefined) {
      setSetting("trail_training_tier", body.trailTrainingTier.toString());
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 500 });
  }
}
