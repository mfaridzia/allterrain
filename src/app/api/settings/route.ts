import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";
import { getCurrentAthleteId } from "@/lib/session";

export async function GET(req: NextRequest) {
  const athleteId = (await getCurrentAthleteId(req)) || "athlete_primary";

  const aiProvider = await getSetting("ai_provider", "gemini", athleteId);
  const aiModelName = await getSetting("ai_model_name", "gemini-2.5-flash", athleteId);

  // Check if keys configured either per-athlete in db or globally in process.env
  const hasGeminiKey = !!(await getSetting("gemini_api_key", "", athleteId)) || !!process.env.GEMINI_API_KEY;
  const hasOpenAiKey = !!(await getSetting("openai_api_key", "", athleteId)) || !!process.env.OPENAI_API_KEY;
  const hasClaudeKey = !!(await getSetting("claude_api_key", "", athleteId)) || !!process.env.ANTHROPIC_API_KEY;
  const hasDeepseekKey = !!(await getSetting("deepseek_api_key", "", athleteId)) || !!process.env.DEEPSEEK_API_KEY;

  const trailTargetRaceDist = Number(await getSetting("trail_target_race_dist", "36", athleteId));
  const trailTargetRaceElev = Number(await getSetting("trail_target_race_elev", "2200", athleteId));
  const trailWeeklyVertTarget = Number(await getSetting("trail_weekly_vert_target", "1000", athleteId));
  const trailTrainingTier = await getSetting("trail_training_tier", "finisher", athleteId);

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
