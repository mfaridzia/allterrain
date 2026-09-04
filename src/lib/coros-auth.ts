import crypto from "crypto";
import { saveCorosToken, getCorosToken, getSetting, setSetting } from "./db";

// Official COROS OAuth Endpoints
export const COROS_AUTH_BASE = "https://mcpus.coros.com";
export const COROS_AUTH_ENDPOINT = `${COROS_AUTH_BASE}/oauth2/authorize`;
export const COROS_TOKEN_ENDPOINT = `${COROS_AUTH_BASE}/oauth2/token`;
export const COROS_REGISTER_ENDPOINT = `${COROS_AUTH_BASE}/connect/register`;
export const COROS_MCP_ENDPOINT = "https://mcp.coros.com/mcp";

export const COROS_SCOPES = "openid mcp.tools offline_access";

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function generateRandomState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Dynamic Client Registration (RFC 7591)
 * MCP servers require OAuth clients to register their redirect_uri dynamically.
 */
export async function getOrRegisterClientId(redirectUri: string): Promise<string> {
  const settingKey = `coros_client_id_${redirectUri}`;
  const existingClientId = getSetting(settingKey);
  if (existingClientId) {
    return existingClientId;
  }

  // Register client with COROS
  try {
    const response = await fetch(COROS_REGISTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_name: "COROS Athletic Intelligence",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: "mcp.tools openid offline_access",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Dynamic Client Registration failed: ${response.status} ${err}`);
    }

    const data = await response.json();
    const registeredClientId = data.client_id;
    if (!registeredClientId) {
      throw new Error("No client_id returned from COROS registration");
    }

    setSetting(settingKey, registeredClientId);
    setSetting("coros_last_client_id", registeredClientId);
    setSetting("coros_last_redirect_uri", redirectUri);
    return registeredClientId;
  } catch (err) {
    console.error("Error during COROS client registration:", err);
    // Fallback to last registered client id if available
    const fallback = getSetting("coros_last_client_id", "2ce02fb7-a269-4dce-9ef6-a28c69cac029");
    return fallback;
  }
}

export async function getCorosAuthUrl(redirectUri: string, state: string, codeChallenge: string): Promise<string> {
  const clientId = await getOrRegisterClientId(redirectUri);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: COROS_SCOPES,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${COROS_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}> {
  const clientId = await getOrRegisterClientId(params.redirectUri);

  const bodyParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
  });

  const response = await fetch(COROS_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange COROS OAuth code: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data;
}

export async function refreshCorosToken(): Promise<string> {
  const current = getCorosToken();
  if (!current || !current.refresh_token) {
    throw new Error("No refresh token available. Please reconnect COROS.");
  }

  const redirectUri = getSetting("coros_last_redirect_uri", "http://localhost:3000/api/auth/coros/callback");
  const clientId = await getOrRegisterClientId(redirectUri);

  const bodyParams = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: current.refresh_token,
  });

  const response = await fetch(COROS_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh COROS token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  saveCorosToken({
    access_token: data.access_token,
    refresh_token: data.refresh_token || current.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  });

  return data.access_token;
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokenRecord = getCorosToken();
  if (!tokenRecord) return null;

  // Check if expired or within 60s of expiring
  const now = Date.now();
  if (tokenRecord.expires_at && tokenRecord.expires_at - now < 60000) {
    try {
      return await refreshCorosToken();
    } catch {
      return null;
    }
  }

  return tokenRecord.access_token;
}
