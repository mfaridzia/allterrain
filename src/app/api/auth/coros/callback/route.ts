import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/coros-auth";
import { consumePkceState, saveCorosToken } from "@/lib/db";
import { syncCorosData } from "@/lib/coros-mcp";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(`${url.origin}/?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${url.origin}/?error=missing_code_or_state`);
  }

  const codeVerifier = consumePkceState(state);
  if (!codeVerifier) {
    return NextResponse.redirect(`${url.origin}/?error=invalid_or_expired_state`);
  }

  try {
    const redirectUri = `${url.origin}/api/auth/coros/callback`;
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier,
      redirectUri,
    });

    saveCorosToken(tokens);

    // Initial sync trigger in background
    syncCorosData().catch((err) => console.warn("Background initial sync notice:", err));

    return NextResponse.redirect(`${url.origin}/?connected=true`);
  } catch (err: any) {
    console.error("Token exchange error:", err);
    return NextResponse.redirect(`${url.origin}/?error=${encodeURIComponent(err.message || "token_exchange_failed")}`);
  }
}
