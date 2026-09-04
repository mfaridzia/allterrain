import { NextRequest, NextResponse } from "next/server";
import { generateCodeVerifier, generateCodeChallenge, generateRandomState, getCorosAuthUrl } from "@/lib/coros-auth";
import { savePkceState } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/coros/callback`;

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateRandomState();

    // Persist state and verifier in DB
    savePkceState(state, codeVerifier);

    const authUrl = await getCorosAuthUrl(redirectUri, state, codeChallenge);
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error("Login redirect error:", err);
    return NextResponse.json({ error: err.message || "Failed to initiate COROS login" }, { status: 500 });
  }
}
