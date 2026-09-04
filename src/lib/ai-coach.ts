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

export function buildAthleteContext(): string {
  const db = getDb();

  // 1. Get latest daily metric & PMC
  const latestMetric = db.prepare(`
    SELECT * FROM daily_metrics ORDER BY date DESC LIMIT 1
  `).get() as any;

  // 2. Get recent 5 activities
  const recentActivities = db.prepare(`
    SELECT name, sport_type, strftime('%Y-%m-%d', start_time / 1000, 'unixepoch') as act_date,
           distance_meters, duration_seconds, elevation_gain, elevation_loss,
           avg_pace_sec, avg_hr, max_hr, training_load, aerobic_te, anaerobic_te,
           vam_meters_per_hour, decoupling_pct
    FROM activities
    ORDER BY start_time DESC
    LIMIT 5
  `).all() as any[];

  // Format TSB and zone
  const tsb = latestMetric ? latestMetric.tsb : 0;
  const formZone = classifyFormZone(tsb);
  const ctl = latestMetric ? latestMetric.ctl : 0;
  const atl = latestMetric ? latestMetric.atl : 0;
  const rampRate = latestMetric ? latestMetric.ramp_rate : 0;
  const acwr = latestMetric ? latestMetric.acwr : 1.0;
  const hrvStatus = latestMetric ? latestMetric.hrv_status : "NORMAL";
  const recoveryScore = latestMetric ? latestMetric.recovery_score : 80;

  let activitiesSummary = "No activities recorded yet.";
  if (recentActivities.length > 0) {
    activitiesSummary = recentActivities
      .map((a) => {
        const distKm = (a.distance_meters / 1000).toFixed(2);
        const durMin = Math.round(a.duration_seconds / 60);
        const paceMin = Math.floor(a.avg_pace_sec / 60);
        const paceSec = Math.floor(a.avg_pace_sec % 60).toString().padStart(2, "0");
        const paceStr = `${paceMin}:${paceSec}/km`;
        const trailInfo = a.sport_type === "trail_run" || a.elevation_gain > 200
          ? ` | Elev: +${Math.round(a.elevation_gain)}m / -${Math.round(a.elevation_loss)}m | VAM: ${a.vam_meters_per_hour} m/h`
          : "";
        const decouplingInfo = a.decoupling_pct > 0 ? ` | Decoupling: ${a.decoupling_pct}%` : "";

        return `- [${a.act_date}] ${a.name} (${a.sport_type}): ${distKm}km in ${durMin}m @ ${paceStr}, HR avg ${a.avg_hr} bpm, Load: ${a.training_load}, TE: ${a.aerobic_te}/${a.anaerobic_te}${trailInfo}${decouplingInfo}`;
      })
      .join("\n");
  }

  const targetDist = getSetting("trail_target_race_dist", "36");
  const targetElev = getSetting("trail_target_race_elev", "2200");
  const targetVert = getSetting("trail_weekly_vert_target", "1000");
  const targetTier = getSetting("trail_training_tier", "finisher");

  return `
[ATHLETE LIVE PHYSIOLOGICAL DATA (COROS & INTERVALS.ICU)]
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

export function getAiModelInstance(provider: string, apiKey: string, modelName?: string) {
  switch (provider.toLowerCase()) {
    case "openai": {
      const openai = createOpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
      return openai(modelName || "gpt-4o-mini");
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
      return anthropic(modelName || "claude-3-5-sonnet-20241022");
    }
    case "deepseek": {
      const deepseek = createOpenAI({
        baseURL: "https://api.deepseek.com",
        apiKey: apiKey || process.env.DEEPSEEK_API_KEY,
      });
      return deepseek(modelName || "deepseek-chat");
    }
    case "ollama": {
      const openaiCompat = createOpenAI({
        baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
        apiKey: "ollama",
      });
      return openaiCompat(modelName || "llama3.2");
    }
    case "gemini":
    default: {
      const google = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(modelName || "gemini-2.5-flash");
    }
  }
}

export async function runCoachStream(messages: ChatMessage[]) {
  const provider = getSetting("ai_provider", "gemini");
  const apiKey = getSetting(`${provider}_api_key`, "");
  const modelName = getSetting("ai_model_name", "");

  const athleteContext = buildAthleteContext();

  const systemPrompt = `You are "COROS AI Athletic Coach", an elite endurance running & trail performance sports scientist and coach.
You combine scientific principles from Bannister Impulse-Response (CTL/ATL/TSB), Intervals.icu metrics (ACWR, Decoupling Pa:HR, Foster's Monotony & Strain, Polarized 80/20 TID), and Mountain/Trail metrics (VAM m/h, Naismith/Minetti energetic cost).

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
