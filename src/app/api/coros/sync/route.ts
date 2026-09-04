import { NextResponse } from "next/server";
import { syncCorosData } from "@/lib/coros-mcp";

export async function POST() {
  try {
    const result = await syncCorosData();
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
