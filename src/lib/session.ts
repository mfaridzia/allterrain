import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getDb } from "./db";

export const SESSION_COOKIE_NAME = "allterrain_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Extract or generate a stable athlete ID from COROS OAuth token payload
 */
export function extractAthleteIdFromToken(tokenData: any): string {
  if (tokenData.athlete_info?.id) return String(tokenData.athlete_info.id);
  if (tokenData.user_id) return String(tokenData.user_id);
  if (tokenData.open_id) return String(tokenData.open_id);
  if (tokenData.sub) return String(tokenData.sub);

  // Check if access_token has JWT payload
  if (typeof tokenData.access_token === "string" && tokenData.access_token.includes(".")) {
    try {
      const parts = tokenData.access_token.split(".");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      if (payload.sub || payload.userId || payload.uid || payload.athleteId) {
        return String(payload.sub || payload.userId || payload.uid || payload.athleteId);
      }
    } catch {}
  }

  // Consistent fallback: SHA-256 hash of access token or refresh token
  const source = tokenData.refresh_token || tokenData.access_token || crypto.randomUUID();
  const hash = crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
  return `athlete_${hash}`;
}

/**
 * Create a new session in the database for an athlete
 */
export async function createSession(athleteId: string): Promise<string> {
  const db = getDb();
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;

  await db.execute({
    sql: `INSERT INTO sessions (session_id, athlete_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    args: [sessionId, athleteId, now, expiresAt],
  });

  return sessionId;
}

/**
 * Look up athlete ID from a session token
 */
export async function getAthleteIdFromSession(sessionId: string): Promise<string | null> {
  if (!sessionId) return null;
  const db = getDb();
  const now = Date.now();

  const res = await db.execute({
    sql: `SELECT athlete_id, expires_at FROM sessions WHERE session_id = ?`,
    args: [sessionId],
  });

  const row = res.rows[0];
  if (!row) return null;

  if (typeof row.expires_at === "number" && row.expires_at < now) {
    // Session expired, clean up
    await db.execute({
      sql: `DELETE FROM sessions WHERE session_id = ?`,
      args: [sessionId],
    });
    return null;
  }

  return String(row.athlete_id);
}

/**
 * Helper to retrieve the current athlete ID from either NextRequest or next/headers cookies
 */
export async function getCurrentAthleteId(req?: NextRequest | Request): Promise<string | null> {
  let sessionId: string | null = null;

  if (req && "cookies" in req && typeof (req as NextRequest).cookies.get === "function") {
    sessionId = (req as NextRequest).cookies.get(SESSION_COOKIE_NAME)?.value || null;
  } else {
    try {
      const cookieStore = await cookies();
      sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
    } catch {
      sessionId = null;
    }
  }

  if (!sessionId) {
    return null;
  }

  return getAthleteIdFromSession(sessionId);
}

/**
 * Destroy a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM sessions WHERE session_id = ?`,
    args: [sessionId],
  });
}
