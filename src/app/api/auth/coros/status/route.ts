import { NextResponse } from "next/server";
import { getCorosToken, deleteCorosToken } from "@/lib/db";

export async function GET() {
  const tokenRecord = getCorosToken();
  if (!tokenRecord) {
    return NextResponse.json({
      connected: false,
    });
  }

  const isExpired = tokenRecord.expires_at ? Date.now() > tokenRecord.expires_at : false;
  let athleteInfo = null;
  try {
    if (tokenRecord.athlete_info) {
      athleteInfo = JSON.parse(tokenRecord.athlete_info);
    }
  } catch {}

  return NextResponse.json({
    connected: !isExpired,
    hasToken: true,
    expiresAt: tokenRecord.expires_at,
    isExpired,
    athleteInfo,
  });
}

export async function POST() {
  deleteCorosToken();
  return NextResponse.json({ success: true, message: "Disconnected from COROS" });
}
