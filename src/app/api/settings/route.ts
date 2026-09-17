import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, deleteSetting, getDb } from "@/lib/db";
import { getCurrentAthleteId } from "@/lib/session";
import { fetchAndSaveAthleteUserInfo } from "@/lib/coros-mcp";

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
    hrZoneCalcMethodStr,
    athleteMaxHrStr,
    athleteRestingHrStr,
    athleteLthrStr,
    periodizationMode,
    periodizationFocus,
    periodizationRaceDate,
    periodizationRaceDistStr,
    periodizationRaceElevStr,
    publicProfileEnabledStr,
    publicProfileShowPmcStr,
    publicProfileShowVolumeStr,
    publicProfileShowTrailStr,
    publicProfileShowRecentStr,
    publicProfileShowHrStr,
    athleteNicknameStr,
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
    getSetting("hr_zone_calc_method", "max_hr", athleteId),
    getSetting("athlete_max_hr", "", athleteId),
    getSetting("athlete_resting_hr", "", athleteId),
    getSetting("athlete_lthr", "", athleteId),
    getSetting("periodization_mode", "continuous", athleteId),
    getSetting("periodization_focus", "hybrid", athleteId),
    getSetting("periodization_race_date", "", athleteId),
    getSetting("periodization_race_dist", "60", athleteId),
    getSetting("periodization_race_elev", "5400", athleteId),
    getSetting("public_profile_enabled", "false", athleteId),
    getSetting("public_profile_show_pmc", "true", athleteId),
    getSetting("public_profile_show_volume", "true", athleteId),
    getSetting("public_profile_show_trail", "true", athleteId),
    getSetting("public_profile_show_recent", "true", athleteId),
    getSetting("public_profile_show_hr", "false", athleteId),
    getSetting("athlete_nickname", "", athleteId),
  ]);

  const hasGeminiKey = !!geminiKey;
  const hasOpenAiKey = !!openAiKey;
  const hasClaudeKey = !!claudeKey;
  const hasDeepseekKey = !!deepseekKey;
  const hasGroqKey = !!groqKey || !!process.env.GROQ_API_KEY;

  const db = getDb();
  const [maxHrRes, rhrRes] = await Promise.all([
    db.execute({
      sql: "SELECT max(max_hr) as peak_max_hr FROM activities WHERE athlete_id = ? AND max_hr >= 130 AND max_hr <= 240",
      args: [athleteId],
    }),
    db.execute({
      sql: `SELECT ROUND(AVG(resting_hr)) as avg_rhr FROM (
        SELECT resting_hr FROM daily_metrics 
        WHERE athlete_id = ? AND resting_hr >= 30 AND resting_hr <= 100 
        ORDER BY date DESC LIMIT 7
      )`,
      args: [athleteId],
    }),
  ]);

  const detectedMaxHr = Number(maxHrRes.rows[0]?.peak_max_hr) || 185;
  const detectedRestingHr = Number(rhrRes.rows[0]?.avg_rhr) || 50;
  const detectedLthr = Math.round(detectedMaxHr * 0.88);

  let effectiveNickname = athleteNicknameStr;
  if (!effectiveNickname) {
    try {
      const userRes = await fetchAndSaveAthleteUserInfo(athleteId || "athlete_primary");
      if (userRes.nickname) {
        effectiveNickname = userRes.nickname;
        await setSetting("athlete_nickname", effectiveNickname, athleteId || "athlete_primary");
        await setSetting("athlete_nickname", effectiveNickname, "athlete_primary");
      }
    } catch {}
  }

  return NextResponse.json({
    aiProvider,
    aiModelName,
    hrZoneCalcMethod: hrZoneCalcMethodStr || "max_hr",
    athleteMaxHr: athleteMaxHrStr ? Number(athleteMaxHrStr) : null,
    athleteRestingHr: athleteRestingHrStr ? Number(athleteRestingHrStr) : null,
    athleteLthr: athleteLthrStr ? Number(athleteLthrStr) : null,
    detectedMaxHr,
    detectedRestingHr,
    detectedLthr,
    configuredKeys: {
      gemini: hasGeminiKey,
      openai: hasOpenAiKey,
      claude: hasClaudeKey,
      deepseek: hasDeepseekKey,
      groq: hasGroqKey,
    },
    serverProvidedKeys: {
      gemini: false,
      openai: false,
      claude: false,
      deepseek: false,
      groq: !groqKey && !!process.env.GROQ_API_KEY,
    },
    trailSettings: {
      targetRaceDist: Number(trailTargetRaceDistStr),
      targetRaceElev: Number(trailTargetRaceElevStr),
      weeklyVertTarget: Number(trailWeeklyVertTargetStr),
      trainingTier: trailTrainingTier,
    },
    periodizationSettings: {
      mode: periodizationMode || "continuous",
      focus: periodizationFocus || "hybrid",
      raceDate: periodizationRaceDate || "",
      raceDist: Number(periodizationRaceDistStr || "60"),
      raceElev: Number(periodizationRaceElevStr || "5400"),
    },
    publicProfile: {
      enabled: publicProfileEnabledStr === "true",
      showPmc: publicProfileShowPmcStr === "true",
      showVolume: publicProfileShowVolumeStr === "true",
      showTrail: publicProfileShowTrailStr === "true",
      showRecent: publicProfileShowRecentStr === "true",
      showHr: publicProfileShowHrStr === "true",
      nickname: effectiveNickname || "athlete",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const athleteId = (await getCurrentAthleteId(req)) || "athlete_primary";
    const body = await req.json();

    if (body.clearKey) {
      await deleteSetting(`${body.clearKey}_api_key`, athleteId);
    }
    if (body.aiProvider) {
      await setSetting("ai_provider", body.aiProvider, athleteId);
    }
    if (body.aiModelName) {
      await setSetting("ai_model_name", body.aiModelName, athleteId);
    }
    if (body.geminiApiKey !== undefined) {
      if (!body.geminiApiKey) await deleteSetting("gemini_api_key", athleteId);
      else await setSetting("gemini_api_key", body.geminiApiKey, athleteId);
    }
    if (body.openaiApiKey !== undefined) {
      if (!body.openaiApiKey) await deleteSetting("openai_api_key", athleteId);
      else await setSetting("openai_api_key", body.openaiApiKey, athleteId);
    }
    if (body.claudeApiKey !== undefined) {
      if (!body.claudeApiKey) await deleteSetting("claude_api_key", athleteId);
      else await setSetting("claude_api_key", body.claudeApiKey, athleteId);
    }
    if (body.deepseekApiKey !== undefined) {
      if (!body.deepseekApiKey) await deleteSetting("deepseek_api_key", athleteId);
      else await setSetting("deepseek_api_key", body.deepseekApiKey, athleteId);
    }
    if (body.groqApiKey !== undefined) {
      if (!body.groqApiKey) await deleteSetting("groq_api_key", athleteId);
      else await setSetting("groq_api_key", body.groqApiKey, athleteId);
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
    if (body.hrZoneCalcMethod !== undefined) {
      if (["max_hr", "hrr", "lthr"].includes(body.hrZoneCalcMethod)) {
        await setSetting("hr_zone_calc_method", body.hrZoneCalcMethod, athleteId);
      }
    }
    if (body.athleteMaxHr !== undefined) {
      if (!body.athleteMaxHr) {
        await deleteSetting("athlete_max_hr", athleteId);
      } else {
        await setSetting("athlete_max_hr", String(body.athleteMaxHr), athleteId);
      }
    }
    if (body.athleteRestingHr !== undefined) {
      if (!body.athleteRestingHr) {
        await deleteSetting("athlete_resting_hr", athleteId);
      } else {
        await setSetting("athlete_resting_hr", String(body.athleteRestingHr), athleteId);
      }
    }
    if (body.athleteLthr !== undefined) {
      if (!body.athleteLthr) {
        await deleteSetting("athlete_lthr", athleteId);
      } else {
        await setSetting("athlete_lthr", String(body.athleteLthr), athleteId);
      }
    }
    if (body.periodizationMode !== undefined) {
      await setSetting("periodization_mode", String(body.periodizationMode), athleteId);
    }
    if (body.periodizationFocus !== undefined) {
      await setSetting("periodization_focus", String(body.periodizationFocus), athleteId);
    }
    if (body.periodizationRaceDate !== undefined) {
      await setSetting("periodization_race_date", String(body.periodizationRaceDate), athleteId);
    }
    if (body.periodizationRaceDist !== undefined) {
      await setSetting("periodization_race_dist", String(body.periodizationRaceDist), athleteId);
    }
    if (body.periodizationRaceElev !== undefined) {
      await setSetting("periodization_race_elev", String(body.periodizationRaceElev), athleteId);
    }
    if (body.athleteNickname) {
      const cleanNick = String(body.athleteNickname).trim();
      await setSetting("athlete_nickname", cleanNick, athleteId);
      await setSetting("athlete_nickname", cleanNick, "athlete_primary");
    }
    if (body.publicProfileEnabled !== undefined) {
      await setSetting("public_profile_enabled", String(body.publicProfileEnabled), athleteId);
      await setSetting("public_profile_enabled", String(body.publicProfileEnabled), "athlete_primary");
    }
    if (body.publicProfileShowPmc !== undefined) {
      await setSetting("public_profile_show_pmc", String(body.publicProfileShowPmc), athleteId);
      await setSetting("public_profile_show_pmc", String(body.publicProfileShowPmc), "athlete_primary");
    }
    if (body.publicProfileShowVolume !== undefined) {
      await setSetting("public_profile_show_volume", String(body.publicProfileShowVolume), athleteId);
      await setSetting("public_profile_show_volume", String(body.publicProfileShowVolume), "athlete_primary");
    }
    if (body.publicProfileShowTrail !== undefined) {
      await setSetting("public_profile_show_trail", String(body.publicProfileShowTrail), athleteId);
      await setSetting("public_profile_show_trail", String(body.publicProfileShowTrail), "athlete_primary");
    }
    if (body.publicProfileShowRecent !== undefined) {
      await setSetting("public_profile_show_recent", String(body.publicProfileShowRecent), athleteId);
      await setSetting("public_profile_show_recent", String(body.publicProfileShowRecent), "athlete_primary");
    }
    if (body.publicProfileShowHr !== undefined) {
      await setSetting("public_profile_show_hr", String(body.publicProfileShowHr), athleteId);
      await setSetting("public_profile_show_hr", String(body.publicProfileShowHr), "athlete_primary");
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 500 });
  }
}
