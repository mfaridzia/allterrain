import { createClient, Client } from "@libsql/client";
import path from "path";
import fs from "fs";

// Singleton database instance
let _client: Client | null = null;
let _schemaInitPromise: Promise<void> | null = null;

export function getDb(): Client {
  if (!_client) {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl) {
      _client = createClient({
        url: tursoUrl,
        authToken: tursoAuthToken,
      });
    } else {
      // Local SQLite fallback via @libsql/client
      const dbDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const dbPath = path.join(dbDir, "coros_athlete.db");
      _client = createClient({
        url: `file:${dbPath}`,
      });
    }
  }

  // Ensure schema runs once
  if (!_schemaInitPromise) {
    _schemaInitPromise = initSchema(_client).catch((err) => {
      console.warn("DB Schema initialization notice:", err);
    });
  }

  return _client;
}

export async function initSchema(client: Client): Promise<void> {
  // 1. Create Core Tables
  await client.batch([
    `CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      athlete_id TEXT,
      provider TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT,
      scope TEXT,
      expires_at INTEGER,
      athlete_info TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      code_verifier TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL DEFAULT 'athlete_primary',
      coros_id TEXT,
      name TEXT NOT NULL,
      sport_type TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      distance_meters REAL NOT NULL,
      duration_seconds INTEGER NOT NULL,
      elevation_gain REAL DEFAULT 0,
      elevation_loss REAL DEFAULT 0,
      avg_pace_sec REAL DEFAULT 0,
      avg_hr INTEGER DEFAULT 0,
      max_hr INTEGER DEFAULT 0,
      avg_cadence INTEGER DEFAULT 0,
      training_load REAL DEFAULT 0,
      aerobic_te REAL DEFAULT 0,
      anaerobic_te REAL DEFAULT 0,
      effort_pace_sec REAL DEFAULT 0,
      vam_meters_per_hour REAL DEFAULT 0,
      decoupling_pct REAL DEFAULT 0,
      efficiency_factor REAL DEFAULT 0,
      raw_data TEXT,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS daily_metrics (
      date TEXT NOT NULL,
      athlete_id TEXT NOT NULL DEFAULT 'athlete_primary',
      training_load REAL DEFAULT 0,
      ctl REAL DEFAULT 0,
      atl REAL DEFAULT 0,
      tsb REAL DEFAULT 0,
      form_pct REAL DEFAULT 0,
      ramp_rate REAL DEFAULT 0,
      acwr REAL DEFAULT 0,
      monotony REAL DEFAULT 0,
      strain REAL DEFAULT 0,
      hrv_rmssd REAL DEFAULT 0,
      hrv_status TEXT DEFAULT 'NORMAL',
      resting_hr INTEGER DEFAULT 0,
      sleep_duration_seconds INTEGER DEFAULT 0,
      sleep_quality_score INTEGER DEFAULT 0,
      recovery_score INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (athlete_id, date)
    );`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL DEFAULT 'athlete_primary',
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT NOT NULL,
      athlete_id TEXT NOT NULL DEFAULT 'athlete_primary',
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (athlete_id, key)
    );`,
    `CREATE TABLE IF NOT EXISTS shoes (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL DEFAULT 'athlete_primary',
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      sport_type TEXT NOT NULL DEFAULT 'trail',
      max_distance_km REAL DEFAULT 650,
      max_elevation_m REAL DEFAULT 20000,
      initial_distance_km REAL DEFAULT 0,
      initial_elevation_m REAL DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      is_retired INTEGER DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
  ]);

  // 2. Safe Column Additions for backward compatibility with existing databases
  const alterStatements = [
    "ALTER TABLE activities ADD COLUMN athlete_id TEXT DEFAULT 'athlete_primary';",
    "ALTER TABLE activities ADD COLUMN shoe_id TEXT;",
    "ALTER TABLE daily_metrics ADD COLUMN athlete_id TEXT DEFAULT 'athlete_primary';",
    "ALTER TABLE user_settings ADD COLUMN athlete_id TEXT DEFAULT 'athlete_primary';",
    "ALTER TABLE chat_messages ADD COLUMN athlete_id TEXT DEFAULT 'athlete_primary';",
    "ALTER TABLE auth_tokens ADD COLUMN athlete_id TEXT DEFAULT 'athlete_primary';",
  ];

  for (const statement of alterStatements) {
    try {
      await client.execute(statement);
    } catch {
      // Ignore if column already exists
    }
  }

  // 3. Helpful Indexes & Constraints
  try {
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_activities_athlete_time ON activities (athlete_id, start_time DESC);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_activities_shoe ON activities (shoe_id);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_shoes_athlete ON shoes (athlete_id);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_daily_metrics_athlete ON daily_metrics (athlete_id, date ASC);`);
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_athlete_date ON daily_metrics (athlete_id, date);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_athlete ON sessions (athlete_id);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_auth_athlete ON auth_tokens (athlete_id);`);
  } catch {
    // Ignore index creation notices
  }

  // 4. Migrate any unassigned 'athlete_primary' data to active athlete
  try {
    const activeAthleteRes = await client.execute(
      `SELECT athlete_id FROM auth_tokens WHERE athlete_id != 'athlete_primary' ORDER BY updated_at DESC LIMIT 1;`
    );
    if (activeAthleteRes.rows.length > 0) {
      const targetAthlete = String(activeAthleteRes.rows[0].athlete_id);
      await client.execute({ sql: `UPDATE activities SET athlete_id = ? WHERE athlete_id = 'athlete_primary';`, args: [targetAthlete] });
      await client.execute({ sql: `UPDATE daily_metrics SET athlete_id = ? WHERE athlete_id = 'athlete_primary';`, args: [targetAthlete] });
      await client.execute({ sql: `UPDATE user_settings SET athlete_id = ? WHERE athlete_id = 'athlete_primary';`, args: [targetAthlete] });
    }
  } catch {}
}

// Token Helpers
export interface AuthTokenRecord {
  id: string;
  athlete_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: number | null;
  athlete_info: string | null;
  created_at: number;
  updated_at: number;
}

export async function saveCorosToken(
  token: {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
    athlete_info?: any;
  },
  athleteId: string = "athlete_primary"
): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const expiresAt = token.expires_in ? now + token.expires_in * 1000 : null;

  await db.execute({
    sql: `
      INSERT INTO auth_tokens (
        id, athlete_id, provider, access_token, refresh_token, token_type,
        scope, expires_at, athlete_info, created_at, updated_at
      ) VALUES (?, ?, 'coros', ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        athlete_id = excluded.athlete_id,
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, auth_tokens.refresh_token),
        token_type = excluded.token_type,
        scope = excluded.scope,
        expires_at = excluded.expires_at,
        athlete_info = COALESCE(excluded.athlete_info, auth_tokens.athlete_info),
        updated_at = excluded.updated_at
    `,
    args: [
      athleteId,
      athleteId,
      token.access_token,
      token.refresh_token || null,
      token.token_type || "Bearer",
      token.scope || null,
      expiresAt,
      token.athlete_info ? JSON.stringify(token.athlete_info) : null,
      now,
      now,
    ],
  });
}

export async function getCorosToken(athleteId: string = "athlete_primary"): Promise<AuthTokenRecord | null> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT * FROM auth_tokens WHERE athlete_id = ? OR id = ? ORDER BY updated_at DESC LIMIT 1`,
    args: [athleteId, athleteId],
  });

  if (res.rows.length === 0) return null;
  return res.rows[0] as unknown as AuthTokenRecord;
}

export async function deleteCorosToken(athleteId: string = "athlete_primary"): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: `DELETE FROM auth_tokens WHERE athlete_id = ? OR id = ?`,
    args: [athleteId, athleteId],
  });
}

// PKCE State Helpers
export async function savePkceState(state: string, codeVerifier: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO oauth_states (state, code_verifier, created_at) VALUES (?, ?, ?)`,
    args: [state, codeVerifier, now],
  });

  // Clean states older than 1 hour
  try {
    await db.execute({
      sql: `DELETE FROM oauth_states WHERE created_at < ?`,
      args: [now - 3600 * 1000],
    });
  } catch {}
}

export async function consumePkceState(state: string): Promise<string | null> {
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT code_verifier FROM oauth_states WHERE state = ?`,
    args: [state],
  });

  if (res.rows.length > 0) {
    const verifier = String(res.rows[0].code_verifier);
    await db.execute({
      sql: `DELETE FROM oauth_states WHERE state = ?`,
      args: [state],
    });
    return verifier;
  }
  return null;
}

// Settings Helpers
export async function getSetting(
  key: string,
  defaultValue: string = "",
  athleteId: string = "athlete_primary"
): Promise<string> {
  const db = getDb();
  const res = await db.execute({
    sql: `
      SELECT value FROM user_settings 
      WHERE key = ? AND (athlete_id = ? OR athlete_id = 'athlete_primary') 
      ORDER BY CASE WHEN athlete_id = ? THEN 0 ELSE 1 END, updated_at DESC 
      LIMIT 1
    `,
    args: [key, athleteId, athleteId],
  });

  if (res.rows.length === 0) return defaultValue;
  return String(res.rows[0].value ?? defaultValue);
}

export async function setSetting(
  key: string,
  value: string,
  athleteId: string = "athlete_primary"
): Promise<void> {
  const db = getDb();
  const now = Date.now();

  await db.execute({
    sql: `
      INSERT INTO user_settings (key, athlete_id, value, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(athlete_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    args: [key, athleteId, value, now],
  });
}
