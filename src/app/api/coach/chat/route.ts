import { NextRequest, NextResponse } from "next/server";
import { runCoachStream, ChatMessage } from "@/lib/ai-coach";
import { getCurrentAthleteId } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: ChatMessage[] } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
    }

    const athleteId = (await getCurrentAthleteId(req)) || "athlete_primary";
    const result = await runCoachStream(messages, athleteId);
    return result.toTextStreamResponse();
  } catch (err: any) {
    console.error("AI Coach Chat error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate AI response. Please check your API key in Settings." },
      { status: 500 }
    );
  }
}
