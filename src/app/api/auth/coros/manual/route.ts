import { NextRequest, NextResponse } from "next/server";
import { saveCorosToken } from "@/lib/db";
import { syncCorosData } from "@/lib/coros-mcp";
import {
  createSession,
  extractAthleteIdFromToken,
  getCurrentAthleteId,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const trimmed = token.trim();
    let athleteId = await getCurrentAthleteId(req);
    if (!athleteId) {
      athleteId = extractAthleteIdFromToken({ access_token: trimmed });
    }

    await saveCorosToken(
      {
        access_token: trimmed,
        token_type: "Bearer",
        expires_in: 30 * 86400,
      },
      athleteId
    );

    const sessionId = await createSession(athleteId);

    syncCorosData(athleteId).catch((e) => console.warn("Initial sync after manual token:", e));

    const res = NextResponse.json({ success: true, athleteId });
    res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to set token" }, { status: 500 });
  }
}
