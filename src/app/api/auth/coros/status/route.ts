import { NextRequest, NextResponse } from "next/server";
import { getCorosToken, deleteCorosToken } from "@/lib/db";
import { refreshCorosToken } from "@/lib/coros-auth";
import { getCurrentAthleteId, deleteSession, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(req: NextRequest) {
  const athleteId = await getCurrentAthleteId(req);
  if (!athleteId) {
    return NextResponse.json({
      connected: false,
    });
  }

  let tokenRecord = await getCorosToken(athleteId);
  if (!tokenRecord) {
    return NextResponse.json({
      connected: false,
    });
  }

  let isExpired = tokenRecord.expires_at ? Date.now() > tokenRecord.expires_at : false;
  if (isExpired && tokenRecord.refresh_token) {
    try {
      await refreshCorosToken(athleteId);
      tokenRecord = await getCorosToken(athleteId);
      isExpired = false;
    } catch {
      isExpired = true;
    }
  }

  if (!tokenRecord) {
    return NextResponse.json({
      connected: false,
    });
  }
  let athleteInfo = null;
  try {
    if (tokenRecord.athlete_info) {
      athleteInfo = JSON.parse(tokenRecord.athlete_info);
    }
  } catch {}

  return NextResponse.json({
    connected: !isExpired,
    hasToken: true,
    athleteId,
    expiresAt: tokenRecord.expires_at,
    isExpired,
    athleteInfo,
  });
}

export async function POST(req: NextRequest) {
  const athleteId = await getCurrentAthleteId(req);
  const sessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await deleteSession(sessionId);
  }

  if (athleteId) {
    await deleteCorosToken(athleteId);
  }

  const response = NextResponse.json({ success: true, message: "Disconnected from COROS" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
