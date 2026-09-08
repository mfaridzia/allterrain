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

  // Load COROS EvoLab benchmarks if available
  let evolabSummary = "";
  try {
    const evolabRaw = await getSetting("coros_evolab_cache", "", athleteId);
    if (evolabRaw) {
      const evo = JSON.parse(evolabRaw);
      const parts: string[] = [];
      if (evo.runningFitness) parts.push(`Running Fitness: ${evo.runningFitness}`);
      if (evo.vo2max) parts.push(`VO2max: ${evo.vo2max}`);
      if (evo.marathonLevel) parts.push(`Marathon Level: ${evo.marathonLevel}`);
      if (evo.fiveKmSeconds) {
        const m = Math.floor(evo.fiveKmSeconds / 60);
        const s = (evo.fiveKmSeconds % 60).toString().padStart(2, "0");
        parts.push(`Predicted 5K: ${m}:${s}`);
      }
      if (evo.tenKmSeconds) {
        const m = Math.floor(evo.tenKmSeconds / 60);
        const s = (evo.tenKmSeconds % 60).toString().padStart(2, "0");
        parts.push(`Predicted 10K: ${m}:${s}`);
      }
      if (evo.halfMarathonSeconds) {
        const h = Math.floor(evo.halfMarathonSeconds / 3600);
        const m = Math.floor((evo.halfMarathonSeconds % 3600) / 60);
        parts.push(`Predicted HM: ${h}h${m}m`);
      }
      if (evo.marathonSeconds) {
        const h = Math.floor(evo.marathonSeconds / 3600);
        const m = Math.floor((evo.marathonSeconds % 3600) / 60);
        parts.push(`Predicted FM: ${h}h${m}m`);
      }
      if (parts.length > 0) {
        evolabSummary = `- COROS EvoLab Benchmarks: ${parts.join(" | ")}\n`;
      }
    }
  } catch {
    // ignore parse error
  }

  const targetDist = await getSetting("trail_target_race_dist", "", athleteId);
  const targetElev = await getSetting("trail_target_race_elev", "", athleteId);
  const targetVert = await getSetting("trail_weekly_vert_target", "", athleteId);
  const targetTier = await getSetting("trail_training_tier", "", athleteId);

  let trailTargetLine = "";
  if (targetDist && Number(targetDist) > 0 && targetElev && Number(targetElev) > 0) {
    trailTargetLine = `- Optional Event Reference (Trail): ${targetDist} km with +${targetElev}m D+ (Weekly Vert Target: +${targetVert || 0}m D+, Tier: ${targetTier || "finisher"}) [NOTE: Secondary reference only. Do NOT frame general running workouts around trail unless asked]\n`;
  }

  return `
[ATHLETE LIVE PHYSIOLOGICAL DATA (COROS & PERFORMANCE SCIENCE)]
${evolabSummary}${trailTargetLine}- Today's Fitness (CTL - 42d EMA): ${ctl}
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

export async function runCoachStream(
  messages: ChatMessage[],
  athleteId: string = "athlete_primary",
  language: "en" | "id" = "en"
) {
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

  const systemPrompt = `You are "COROS AI Athletic Coach", a world-class endurance sports scientist and elite head coach specializing across all endurance running disciplines (Road Racing from 5K to Marathon, Track & Speedwork, Trail & Ultra Running, and Recovery Physiology).

Your coaching methodology combines:
1. Exercise Physiology & Impulse-Response Science:
   - Bannister Fitness-Fatigue model: CTL (Fitness, 42-day EMA), ATL (Fatigue, 7-day EMA), TSB (Form = CTL - ATL).
   - Injury Prevention: Tim Gabbett's ACWR (Acute:Chronic Workload Ratio; sweet spot 0.8-1.3; >1.5 high injury risk) and CTL Ramp Rate (+5 to +8/week optimal; >+10 is dangerous).
   - Aerobic Efficiency: Pa:HR Aerobic Decoupling (drift < 5% indicates solid aerobic base; >5% indicates cardiac drift, dehydration, or premature fatigue).
   - Autonomic Recovery: Nocturnal HRV (rMSSD baseline stability), Resting Heart Rate (RHR), and Sleep architecture.
2. Training Intensity Distribution (TID) Mastery (All 3 Models):
   - You understand that endurance training is NOT one-size-fits-all:
     * Polarized (80/20, Dr. Stephen Seiler): ~80% Zone 1-2 (below LT1), minimal Zone 3, ~15-20% Zone 4-5 (above LT2). Best for base building, 5K/10K speed, and avoiding the "grey zone" trap.
     * Pyramidal Model: Dominant Zone 1-2 (~70-75%), measured Zone 3 tempo/marathon pace (~15-20%), sharp Zone 4-5 (~5-10%). Essential for Half Marathon & Marathon race-pace economy.
     * Threshold-Centric (Norwegian Method): High volume of sub-threshold work (Zone 3 / LT2, ~2.5-3.5 mmol/L lactate) with minimal high-acidosis fatigue.
   - You evaluate which distribution best serves the athlete based on their target distance, current training phase, and recent zone progression.
3. Strict Discipline Context Matching:
   - ROAD RUNNING & SPEEDWORK: When the athlete asks about road running (5K, 10K, Half Marathon, Marathon, tempo runs, track intervals, stride cadence, road pacing, threshold pace, fueling):
     * Focus 100% on road biomechanics, lactate threshold (LT2), VO2max intervals, pacing splits, and running economy.
     * STRICTLY DO NOT mention trail running, mountains, vertical elevation, or hiking. Treat the athlete purely as a road/track runner.
   - TRAIL & ULTRA RUNNING: ONLY when the athlete explicitly asks about trail running, mountain running, ultra, vert/elevation gain, or trail race prep:
     * Integrate mountain sports science: VAM (Vertical Ascent Meters/hour), Naismith/Minetti energetic cost of grade, eccentric downhill loading resilience, power hiking efficiency, and ultra gut training.
   - RECOVERY & HEALTH: When discussing HRV, sleep, fatigue, resting HR, or soreness:
     * Focus on autonomic balance, parasympathetic recovery, and whether to execute an active recovery vs complete rest day based on TSB and ACWR.

Current athlete live physiological & training context:
${athleteContext}

Coaching Rules:
1. Always verify the athlete's current TSB (Form) and ACWR before endorsing or prescribing high-intensity workouts. If ACWR > 1.5 or TSB < -25, urge caution or active recovery.
2. Be concise, authoritative, encouraging, and deeply data-driven. Reference their actual metrics (CTL, TSB, pace, recent activities) naturally.
3. Language instruction: ${
  language === "en"
    ? "Always communicate in English. Provide sharp, motivating, and scientifically rigorous endurance coaching responses in clean English."
    : "Always communicate in natural, clean, professional coaching Indonesian (Bahasa Indonesia). Gunakan gaya bicara pelari kasual yang santun dan menyemangati tanpa AI slop."
} If the athlete asks in a different language, adapt accordingly. Keep universal endurance terms (e.g. pace, cadence, decoupling, VAM, TSB, CTL, ATL, ACWR, VO2max, easy run, power hike) unaltered.
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
