import { NextRequest, NextResponse } from "next/server";
import { saveCorosToken } from "@/lib/db";
import { syncCorosData } from "@/lib/coros-mcp";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    saveCorosToken({
      access_token: token.trim(),
      token_type: "Bearer",
      expires_in: 30 * 86400, // 30 days default
    });

    // Trigger initial sync
    syncCorosData().catch((e) => console.warn("Initial sync after manual token:", e));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to set token" }, { status: 500 });
  }
}
