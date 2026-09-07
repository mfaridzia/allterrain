import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentAthleteId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const athleteId = await getCurrentAthleteId(req);
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { activityId, shoeId } = body;

    if (!activityId) {
      return NextResponse.json({ error: "activityId is required" }, { status: 400 });
    }

    const db = getDb();

    // Verify shoe exists if shoeId provided
    if (shoeId) {
      const shoeCheck = await db.execute({
        sql: `SELECT id FROM shoes WHERE id = ? AND athlete_id = ?`,
        args: [shoeId, athleteId],
      });
      if (shoeCheck.rows.length === 0) {
        return NextResponse.json({ error: "Shoe not found" }, { status: 404 });
      }
    }

    await db.execute({
      sql: `UPDATE activities SET shoe_id = ? WHERE id = ? AND athlete_id = ?`,
      args: [shoeId || null, activityId, athleteId],
    });

    return NextResponse.json({ success: true, activityId, shoeId });
  } catch (err: any) {
    console.error("Failed to assign shoe:", err);
    return NextResponse.json({ error: err.message || "Failed to assign shoe" }, { status: 500 });
  }
}
