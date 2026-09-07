import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { getDb, getSetting } from "./db";
import { classifyFormZone } from "./analytics";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function buildAthleteContext(athleteId: string = "athlete_primary"): Promise<string> {
  const db = getDb();

  // 1. Get latest daily metric & PMC for athlete
  const metricRes = await db.execute({
    sql: `SELECT * FROM daily_metrics WHERE athlete_id = ? ORDER BY date DESC LIMIT 1`,
    args: [athleteId],
  });
  const latestMetric: any = metricRes.rows[0] || null;

  // 2. Get recent 5 activities for athlete
  const actRes = await db.execute({
    sql: `
      SELECT name, sport_type, strftime('%Y-%m-%d', start_time / 1000, 'unixepoch') as act_date,
             distance_meters, duration_seconds, elevation_gain, elevation_loss,
             avg_pace_sec, avg_hr, max_hr, training_load, aerobic_te, anaerobic_te,
             vam_meters_per_hour, decoupling_pct
      FROM activities
      WHERE athlete_id = ?
      ORDER BY start_time DESC
      LIMIT 5
    `,
    args: [athleteId],
  });
  const recentActivities: any[] = actRes.rows;

  // Format TSB and zone
  const tsb = latestMetric ? Number(latestMetric.tsb || 0) : 0;
  const formZone = classifyFormZone(tsb);
  const ctl = latestMetric ? Number(latestMetric.ctl || 0) : 0;
  const atl = latestMetric ? Number(latestMetric.atl || 0) : 0;
  const rampRate = latestMetric ? Number(latestMetric.ramp_rate || 0) : 0;
  const acwr = latestMetric ? Number(latestMetric.acwr || 1.0) : 1.0;
  const hrvStatus = latestMetric ? String(latestMetric.hrv_status || "NORMAL") : "NORMAL";
  const recoveryScore = latestMetric ? Number(latestMetric.recovery_score || 80) : 80;

  let activitiesSummary = "No activities recorded yet.";
  if (recentActivities.length > 0) {
    activitiesSummary = recentActivities
      .map((a) => {
        const distKm = (Number(a.distance_meters || 0) / 1000).toFixed(2);
        const durMin = Math.round(Number(a.duration_seconds || 0) / 60);
        const paceSec = Number(a.avg_pace_sec || 0);
        const paceMin = Math.floor(paceSec / 60);
        const paceSecRemainder = Math.floor(paceSec % 60).toString().padStart(2, "0");
        const paceStr = `${paceMin}:${paceSecRemainder}/km`;
        const elevGain = Math.round(Number(a.elevation_gain || 0));
        const elevLoss = Math.round(Number(a.elevation_loss || 0));
        const vam = Number(a.vam_meters_per_hour || 0);
        const trailInfo = a.sport_type === "trail_run" || elevGain > 200
          ? ` | Elev: +${elevGain}m / -${elevLoss}m | VAM: ${vam} m/h`
          : "";
        const decoupling = Number(a.decoupling_pct || 0);
        const decouplingInfo = decoupling > 0 ? ` | Decoupling: ${decoupling}%` : "";

        return `- [${a.act_date}] ${a.name} (${a.sport_type}): ${distKm}km in ${durMin}m @ ${paceStr}, HR avg ${a.avg_hr} bpm, Load: ${a.training_load}, TE: ${a.aerobic_te}/${a.anaerobic_te}${trailInfo}${decouplingInfo}`;
      })
      .join("\n");
  }

  const targetDist = await getSetting("trail_target_race_dist", "36", athleteId);
  const targetElev = await getSetting("trail_target_race_elev", "2200", athleteId);
  const targetVert = await getSetting("trail_weekly_vert_target", "1000", athleteId);
  const targetTier = await getSetting("trail_training_tier", "finisher", athleteId);

  return `
[ATHLETE LIVE PHYSIOLOGICAL DATA (COROS & PERFORMANCE SCIENCE)]
- Active Target Mountain Race: ${targetDist} km with +${targetElev}m D+ (Target Weekly Vert: +${targetVert}m D+, Mode: ${targetTier})
- Today's Fitness (CTL - 42d EMA): ${ctl}
- Today's Fatigue (ATL - 7d EMA): ${atl}
- Today's Form (TSB = CTL - ATL): ${tsb} (${formZone.label} - ${formZone.description})
- Form %: ${latestMetric ? latestMetric.form_pct : 0}%
- CTL Ramp Rate (past 7 days): ${rampRate >= 0 ? "+" : ""}${rampRate}/week (Optimal is +5 to +8; >+10 is dangerous)
- ACWR (Acute:Chronic Workload Ratio): ${acwr} (Sweet spot is 0.8 - 1.3; >1.5 is high injury risk)
- Recovery Index: ${recoveryScore}% | HRV Status: ${hrvStatus}
- Recent Workouts:
${activitiesSummary}
`;
}

/**
 * Safely normalize user-entered model names to valid official provider model IDs
 */
export function normalizeModelName(provider: string, userModel?: string): string {
  const p = provider.toLowerCase();
  const raw = (userModel || "").trim().toLowerCase();

  if (p === "anthropic" || p === "claude") {
    if (!raw) return "claude-3-5-sonnet-20241022";
    if (raw.includes("3-7") || raw.includes("3.7")) return "claude-3-7-sonnet-20250219";
    if (raw.includes("haiku")) return "claude-3-5-haiku-20241022";
    if (raw.includes("opus")) return "claude-3-opus-20240229";
    if (raw.includes("sonnet") || raw.includes("claude")) {
      if (raw === "claude-3-5-sonnet" || raw === "claude-sonnet" || raw === "sonnet") {
        return "claude-3-5-sonnet-20241022";
      }
      return userModel!.trim();
    }
    return "claude-3-5-sonnet-20241022";
  }

  if (p === "openai") {
    if (!raw) return "gpt-4o-mini";
    if (raw.includes("4o-mini") || raw === "mini") return "gpt-4o-mini";
    if (raw.includes("4o")) return "gpt-4o";
    if (raw.includes("o1-mini")) return "o1-mini";
    if (raw.includes("o1")) return "o1";
    if (raw.includes("o3")) return "o3-mini";
    if (raw.startsWith("gpt-")) return userModel!.trim();
    return "gpt-4o-mini";
  }

  if (p === "deepseek") {
    if (!raw) return "deepseek-chat";
    if (raw.includes("reasoner") || raw.includes("r1")) return "deepseek-reasoner";
    if (raw.includes("chat") || raw.includes("deepseek") || raw.includes("v3")) return "deepseek-chat";
    return "deepseek-chat";
  }

  if (p === "gemini") {
    if (!raw) return "gemini-2.5-flash";
    if (raw.includes("flash")) return raw.includes("2.5") ? "gemini-2.5-flash" : "gemini-1.5-flash";
    if (raw.includes("pro")) return raw.includes("2.5") ? "gemini-2.5-pro" : "gemini-1.5-pro";
    if (raw.startsWith("gemini-")) return userModel!.trim();
    return "gemini-2.5-flash";
  }

  return userModel?.trim() || "gpt-4o-mini";
}

export function getAiModelInstance(provider: string, apiKey: string, modelName?: string) {
  const p = provider.toLowerCase();
  const normalizedModel = normalizeModelName(p, modelName);

  switch (p) {
    case "openai": {
      const openai = createOpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
      return openai(normalizedModel);
    }
    case "claude":
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
      return anthropic(normalizedModel);
    }
    case "deepseek": {
      const deepseek = createOpenAI({
        baseURL: "https://api.deepseek.com",
        apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
      });
      return deepseek(normalizedModel);
    }
    case "ollama": {
      const openaiCompat = createOpenAI({
        baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
        apiKey: "ollama",
      });
      return openaiCompat(modelName?.trim() || "llama3.2");
    }
    case "gemini":
    default: {
      const google = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(normalizedModel);
    }
  }
}

export async function runCoachStream(messages: ChatMessage[], athleteId: string = "athlete_primary") {
  let provider = await getSetting("ai_provider", "", athleteId);
  if (!provider) {
    if (process.env.AI_PROVIDER) {
      provider = process.env.AI_PROVIDER;
    } else if (process.env.DEEPSEEK_API_KEY) {
      provider = "deepseek";
    } else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      provider = "gemini";
    } else if (process.env.OPENAI_API_KEY) {
      provider = "openai";
    } else if (process.env.ANTHROPIC_API_KEY) {
      provider = "claude";
    } else {
      provider = "deepseek";
    }
  } else if (provider === "gemini" && !process.env.GEMINI_API_KEY && process.env.DEEPSEEK_API_KEY) {
    // If set to gemini default but only DEEPSEEK_API_KEY is configured in env
    provider = "deepseek";
  }

  const apiKey = await getSetting(`${provider}_api_key`, "", athleteId);
  let modelName = await getSetting("ai_model_name", "", athleteId);
  if (!modelName) {
    if (provider === "deepseek") modelName = "deepseek-chat";
    else if (provider === "openai") modelName = "gpt-4o-mini";
    else if (provider === "claude") modelName = "claude-3-5-sonnet-20241022";
    else modelName = "gemini-2.5-flash";
  }

  const athleteContext = await buildAthleteContext(athleteId);

  const systemPrompt = `You are "COROS AI Athletic Coach", an elite endurance running & trail performance sports scientist and coach.
You combine scientific principles from Bannister Impulse-Response (CTL/ATL/TSB), advanced endurance metrics (ACWR, Decoupling Pa:HR, Foster's Monotony & Strain, Polarized 80/20 TID), and Mountain/Trail metrics (VAM m/h, Naismith/Minetti energetic cost).

Current athlete context:
${athleteContext}

Guidelines:
1. Always analyze the athlete's current TSB (Form) and ACWR before recommending workout intensities. If ACWR > 1.5 or TSB < -30, emphasize recovery, easy aerobic spinning, or rest to prevent injury.
2. Adapt seamlessly to whatever topic the athlete asks:
   - If asking about Road running (5K, 10K, Half Marathon, Marathon), focus on road pacing, threshold pace (4:42/km), interval sessions, cadence, and road race nutrition.
   - If asking about recovery, HRV, sleep, or resting HR, analyze their autonomic nervous system trends and recovery score.
   - If asking about injury prevention, knee pain, shin splints, or gym strength training, provide actionable biomechanical & physical therapy advice.
   - ONLY bring up the active mountain race goal if the user asks about trail/mountain running, or if their question directly relates to target race preparation. Never force trail topics into unrelated road, recovery, or general questions.
3. Be encouraging, concise, highly data-driven, and clear.
4. Speak in the language used by the athlete (Bahasa Indonesia or English).
`;

  const model = getAiModelInstance(provider, apiKey, modelName);

  return streamText({
    model,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as any,
      content: m.content,
    })),
  });
}
