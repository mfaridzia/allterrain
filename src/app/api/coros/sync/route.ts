import { NextRequest, NextResponse } from "next/server";
import { syncCorosData } from "@/lib/coros-mcp";
import { getCurrentAthleteId, getRequestTimezone } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const athleteId = (await getCurrentAthleteId(req)) || "athlete_primary";
    const userTimezone = getRequestTimezone(req);
    const result = await syncCorosData(athleteId, userTimezone);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Manual sync failed:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to sync data from COROS" },
      { status: 500 }
    );
  }
}
