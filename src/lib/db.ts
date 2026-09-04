import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Create or connect to SQLite database in project root
const DB_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, "coros_athlete.db");

// Singleton database instance
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- OAuth token and session
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT,
      scope TEXT,
      expires_at INTEGER,
      athlete_info TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- OAuth PKCE states
    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      code_verifier TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Activities (Workouts)
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      coros_id TEXT UNIQUE,
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
    );

    -- Daily Metrics & PMC
    CREATE TABLE IF NOT EXISTS daily_metrics (
      date TEXT PRIMARY KEY, -- YYYY-MM-DD
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
      created_at INTEGER NOT NULL
    );

    -- AI Coach Chat History
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- User / App Settings (BYOK keys, preferences)
    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

// Token Helpers
export interface AuthTokenRecord {
  id: string;
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

export function saveCorosToken(token: {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  athlete_info?: any;
}) {
  const db = getDb();
  const now = Date.now();
  const expiresAt = token.expires_in ? now + token.expires_in * 1000 : null;

  const stmt = db.prepare(`
    INSERT INTO auth_tokens (id, provider, access_token, refresh_token, token_type, scope, expires_at, athlete_info, created_at, updated_at)
    VALUES ('coros_primary', 'coros', @access_token, @refresh_token, @token_type, @scope, @expires_at, @athlete_info, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, auth_tokens.refresh_token),
      token_type = excluded.token_type,
      scope = excluded.scope,
      expires_at = excluded.expires_at,
      athlete_info = COALESCE(excluded.athlete_info, auth_tokens.athlete_info),
      updated_at = excluded.updated_at
  `);

  stmt.run({
    access_token: token.access_token,
    refresh_token: token.refresh_token || null,
    token_type: token.token_type || "Bearer",
    scope: token.scope || null,
    expires_at: expiresAt,
    athlete_info: token.athlete_info ? JSON.stringify(token.athlete_info) : null,
    created_at: now,
    updated_at: now,
  });
}

export function getCorosToken(): AuthTokenRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM auth_tokens WHERE id = 'coros_primary'").get() as AuthTokenRecord | undefined;
  return row || null;
}

export function deleteCorosToken() {
  const db = getDb();
  db.prepare("DELETE FROM auth_tokens WHERE id = 'coros_primary'").run();
}

// PKCE State Helpers
export function savePkceState(state: string, codeVerifier: string) {
  const db = getDb();
  db.prepare("INSERT INTO oauth_states (state, code_verifier, created_at) VALUES (?, ?, ?)")
    .run(state, codeVerifier, Date.now());
  
  // Clean states older than 1 hour
  db.prepare("DELETE FROM oauth_states WHERE created_at < ?").run(Date.now() - 3600 * 1000);
}

export function consumePkceState(state: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT code_verifier FROM oauth_states WHERE state = ?").get(state) as { code_verifier: string } | undefined;
  if (row) {
    db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);
    return row.code_verifier;
  }
  return null;
}

// Settings Helpers
export function getSetting(key: string, defaultValue: string = ""): string {
  const db = getDb();
  const row = db.prepare("SELECT value FROM user_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? row.value : defaultValue;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
}
