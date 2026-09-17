import { getDb, getSetting, setSetting } from "./db";
import { fetchAndSaveAthleteUserInfo } from "./coros-mcp";

export interface PublicActivityItem {
  id: string;
  name: string;
  sportType: string;
  startTime: number;
  distanceMeters: number;
  durationSeconds: number;
  elevationGain: number;
  avgPaceSec: number;
  avgHr?: number;
  maxHr?: number;
  svgRoutePath?: string | null;
}

export interface PublicProfileData {
  found: boolean;
  isPublic: boolean;
  nickname: string;
  athleteId?: string;
  settings: {
    showPmc: boolean;
    showVolume: boolean;
    showTrail: boolean;
    showRecent: boolean;
    showHr: boolean;
  };
  pmc?: {
    date: string;
    ctl: number;
    atl: number;
    tsb: number;
    rampRate: number;
    formZone: {
      zone: string;
      label: string;
      color: string;
    };
  } | null;
  volume?: {
    totalWorkouts: number;
    totalDistanceKm: number;
    totalElevationM: number;
    totalDurationHours: number;
    sportBreakdown: {
      sport: string;
      label: string;
      count: number;
      distanceKm: number;
      pct: number;
    }[];
    weeklyVolume: {
      weekLabel: string;
      distanceKm: number;
    }[];
  } | null;
  trail?: {
    maxVam: number;
    totalTrailElevM: number;
    climbDensity: number; // m D+ / km on hilly runs
  } | null;
  recentActivities?: PublicActivityItem[];
}

/**
 * Generate a simplified SVG path for safe route silhouette visualization (no coordinates leaked)
 */
function generateMiniSvgPath(gpsTrackJson: string, width = 120, height = 70): string | null {
  try {
    const points: { lat: number; lng: number }[] = JSON.parse(gpsTrackJson);
    if (!points || points.length < 2) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    // Sub-sample if too many points for lightweight render
    const step = Math.max(1, Math.floor(points.length / 80));
    const sampled: { lat: number; lng: number }[] = [];
    for (let i = 0; i < points.length; i += step) {
      sampled.push(points[i]);
    }
    if (sampled[sampled.length - 1] !== points[points.length - 1]) {
      sampled.push(points[points.length - 1]);
    }

    for (const p of sampled) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    const dLat = maxLat - minLat;
    const midLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const cosMidLat = Math.cos(midLatRad);
    const dLng = (maxLng - minLng) * cosMidLat;

    if (dLat < 0.00001 && dLng < 0.00001) return null;

    const pad = 8;
    const usableW = width - pad * 2;
    const usableH = height - pad * 2;
    const scale = Math.min(usableW / (dLng || 0.0001), usableH / (dLat || 0.0001));

    const actualW = dLng * scale;
    const actualH = dLat * scale;
    const offsetX = pad + (usableW - actualW) / 2;
    const offsetY = pad + (usableH - actualH) / 2;

    const projected = sampled.map((p) => {
      const normLng = (p.lng - minLng) * cosMidLat;
      const normLat = maxLat - p.lat;
      return {
        x: offsetX + normLng * scale,
        y: offsetY + normLat * scale,
      };
    });

    let pathD = `M ${projected[0].x.toFixed(1)},${projected[0].y.toFixed(1)}`;
    for (let i = 1; i < projected.length; i++) {
      pathD += ` L ${projected[i].x.toFixed(1)},${projected[i].y.toFixed(1)}`;
    }
    return pathD;
  } catch {
    return null;
  }
}

/**
 * Determine athlete Form Zone from TSB
 */
function getFormZone(tsb: number): { zone: string; label: string; color: string } {
  if (tsb > 25) {
    return { zone: "transition", label: "Detraining / Transition", color: "text-zinc-500 bg-zinc-200" };
  } else if (tsb >= 5) {
    return { zone: "fresh", label: "Fresh • Race Ready", color: "text-cyan-800 bg-cyan-100 border-cyan-400" };
  } else if (tsb >= -10) {
    return { zone: "optimal", label: "Optimal Training Zone", color: "text-emerald-800 bg-emerald-100 border-emerald-400" };
  } else if (tsb >= -30) {
    return { zone: "grey", label: "Neutral / Grey Zone", color: "text-amber-800 bg-amber-100 border-amber-400" };
  } else {
    return { zone: "overreaching", label: "High Risk Overreaching", color: "text-red-800 bg-red-100 border-red-400" };
  }
}

/**
 * Safely look up public athlete profile by nickname (case-insensitive)
 */
export async function getPublicAthleteProfile(
  rawUsername: string
): Promise<PublicProfileData> {
  const username = decodeURIComponent(rawUsername).trim();
  const db = getDb();

  // 1. First attempt: locate athlete by nickname in user_settings (case-insensitive)
  let athleteQuery = await db.execute({
    sql: `
      SELECT athlete_id, value as nickname FROM user_settings 
      WHERE key = 'athlete_nickname' AND LOWER(TRIM(value)) = LOWER(?)
      ORDER BY updated_at DESC LIMIT 1;
    `,
    args: [username],
  });

  let athleteId: string | null = null;
  let verifiedNickname: string = username;

  if (athleteQuery.rows.length > 0) {
    athleteId = String(athleteQuery.rows[0].athlete_id);
    verifiedNickname = String(athleteQuery.rows[0].nickname || username);
  } else {
    // 2. Check if username directly matches an athlete_id or id in auth_tokens
    const tokenDirectQuery = await db.execute({
      sql: `SELECT athlete_id, id FROM auth_tokens WHERE athlete_id = ? OR id = ? LIMIT 1;`,
      args: [username, username],
    });

    if (tokenDirectQuery.rows.length > 0) {
      athleteId = String(tokenDirectQuery.rows[0].athlete_id || tokenDirectQuery.rows[0].id);
      const nickSetting = await getSetting("athlete_nickname", username, athleteId);
      verifiedNickname = nickSetting || username;
    } else {
      // 3. Robust fallback: Inspect active tokens and resolve nickname via COROS MCP or cached settings
      const tokensRes = await db.execute({
        sql: `SELECT athlete_id, id FROM auth_tokens ORDER BY updated_at DESC LIMIT 5;`
      });

      for (const row of tokensRes.rows) {
        const candidateId = String(row.athlete_id || row.id);
        const storedNick = await getSetting("athlete_nickname", "", candidateId);
        if (storedNick && storedNick.toLowerCase().trim() === username.toLowerCase().trim()) {
          athleteId = candidateId;
          verifiedNickname = storedNick;
          break;
        }

        // Live check via queryUserInfo
        try {
          const userRes = await fetchAndSaveAthleteUserInfo(candidateId);
          if (userRes.nickname) {
            await setSetting("athlete_nickname", userRes.nickname, candidateId);
            await setSetting("athlete_nickname", userRes.nickname, "athlete_primary");
            if (userRes.nickname.toLowerCase().trim() === username.toLowerCase().trim()) {
              athleteId = candidateId;
              verifiedNickname = userRes.nickname;
              break;
            }
          }
        } catch {}
      }

      // 4. Single-athlete deployment fallback: if only 1 athlete in system
      if (!athleteId && tokensRes.rows.length > 0) {
        const singleCandidateId = String(tokensRes.rows[0].athlete_id || tokensRes.rows[0].id);
        try {
          const userRes = await fetchAndSaveAthleteUserInfo(singleCandidateId);
          if (userRes.nickname) {
            await setSetting("athlete_nickname", userRes.nickname, singleCandidateId);
            await setSetting("athlete_nickname", userRes.nickname, "athlete_primary");
            verifiedNickname = userRes.nickname;
          }
        } catch {}
        athleteId = singleCandidateId;
      }
    }
  }

  // If athlete not found at all
  if (!athleteId) {
    return {
      found: false,
      isPublic: false,
      nickname: username,
      settings: {
        showPmc: false,
        showVolume: false,
        showTrail: false,
        showRecent: false,
        showHr: false,
      },
    };
  }

  // 2. Check if Public Profile is enabled by athlete or primary fallback
  const isPublicEnabled =
    (await getSetting("public_profile_enabled", "false", athleteId)) === "true" ||
    (await getSetting("public_profile_enabled", "false", "athlete_primary")) === "true";

  const showPmc = (await getSetting("public_profile_show_pmc", "true", athleteId)) !== "false";
  const showVolume = (await getSetting("public_profile_show_volume", "true", athleteId)) !== "false";
  const showTrail = (await getSetting("public_profile_show_trail", "true", athleteId)) !== "false";
  const showRecent = (await getSetting("public_profile_show_recent", "true", athleteId)) !== "false";
  const showHr = (await getSetting("public_profile_show_hr", "false", athleteId)) === "true";

  if (!isPublicEnabled) {
    return {
      found: true,
      isPublic: false,
      nickname: verifiedNickname,
      athleteId,
      settings: { showPmc, showVolume, showTrail, showRecent, showHr },
    };
  }

  // 3. Parallel Query for Permitted Metrics
  const queries: Promise<any>[] = [];

  // A. Latest PMC
  const pmcPromise = showPmc
    ? db.execute({
        sql: `
          SELECT date, ctl, atl, tsb, ramp_rate 
          FROM daily_metrics 
          WHERE athlete_id = ? OR athlete_id = 'athlete_primary'
          ORDER BY date DESC LIMIT 1;
        `,
        args: [athleteId],
      })
    : Promise.resolve(null);

  // B. Volume Aggregates
  const volumePromise = showVolume
    ? Promise.all([
        db.execute({
          sql: `
            SELECT 
              COUNT(*) as total_workouts,
              COALESCE(SUM(distance_meters), 0) as total_dist,
              COALESCE(SUM(duration_seconds), 0) as total_dur,
              COALESCE(SUM(elevation_gain), 0) as total_elev
            FROM activities 
            WHERE athlete_id = ? OR athlete_id = 'athlete_primary';
          `,
          args: [athleteId],
        }),
        db.execute({
          sql: `
            SELECT sport_type, COUNT(*) as count, COALESCE(SUM(distance_meters), 0) as dist
            FROM activities 
            WHERE athlete_id = ? OR athlete_id = 'athlete_primary'
            GROUP BY sport_type;
          `,
          args: [athleteId],
        }),
        db.execute({
          sql: `
            SELECT 
              strftime('%Y-%W', datetime(start_time / 1000, 'unixepoch')) as week_id,
              SUM(distance_meters) as week_dist
            FROM activities
            WHERE (athlete_id = ? OR athlete_id = 'athlete_primary') AND start_time >= (strftime('%s', 'now') - 8 * 7 * 86400) * 1000
            GROUP BY week_id
            ORDER BY week_id ASC;
          `,
          args: [athleteId],
        }),
      ])
    : Promise.resolve(null);

  // C. Trail & Mountain Dynamics
  const trailPromise = showTrail
    ? db.execute({
        sql: `
          SELECT 
            COALESCE(MAX(vam_meters_per_hour), 0) as max_vam,
            COALESCE(SUM(CASE WHEN sport_type = 'trail_run' THEN elevation_gain ELSE 0 END), 0) as trail_elev,
            COALESCE(SUM(CASE WHEN elevation_gain > 150 THEN elevation_gain ELSE 0 END), 0) as hilly_elev,
            COALESCE(SUM(CASE WHEN elevation_gain > 150 THEN distance_meters ELSE 0 END), 0) as hilly_dist
          FROM activities 
          WHERE athlete_id = ? OR athlete_id = 'athlete_primary';
        `,
        args: [athleteId],
      })
    : Promise.resolve(null);

  // D. Recent Activities Feed (Latest 6)
  const recentPromise = showRecent
    ? db.execute({
        sql: `
          SELECT 
            id, name, sport_type, start_time, distance_meters, duration_seconds,
            elevation_gain, avg_pace_sec, avg_hr, max_hr, gps_track
          FROM activities 
          WHERE athlete_id = ? OR athlete_id = 'athlete_primary'
          ORDER BY start_time DESC LIMIT 6;
        `,
        args: [athleteId],
      })
    : Promise.resolve(null);

  const [pmcRes, volumeRes, trailRes, recentRes] = await Promise.all([
    pmcPromise,
    volumePromise,
    trailPromise,
    recentPromise,
  ]);

  // Format PMC
  let pmcData = null;
  if (pmcRes && pmcRes.rows.length > 0) {
    const row = pmcRes.rows[0];
    const ctl = Math.round(Number(row.ctl) || 0);
    const atl = Math.round(Number(row.atl) || 0);
    const tsb = Math.round(Number(row.tsb) || 0);
    const rampRate = Math.round((Number(row.ramp_rate) || 0) * 10) / 10;
    pmcData = {
      date: String(row.date),
      ctl,
      atl,
      tsb,
      rampRate,
      formZone: getFormZone(tsb),
    };
  }

  // Format Volume
  let volumeData = null;
  if (volumeRes) {
    const [summaryRes, sportsRes, weeksRes] = volumeRes;
    const summaryRow = summaryRes.rows[0];
    const totalWorkouts = Number(summaryRow?.total_workouts) || 0;
    const totalDistKm = Math.round(((Number(summaryRow?.total_dist) || 0) / 1000) * 10) / 10;
    const totalElevM = Math.round(Number(summaryRow?.total_elev) || 0);
    const totalDurHours = Math.round(((Number(summaryRow?.total_dur) || 0) / 3600) * 10) / 10;

    const sportLabels: Record<string, string> = {
      run: "Road Run",
      trail_run: "Trail Run",
      cycling: "Sepeda",
      strength: "Strength / Gym",
      indoor_run: "Treadmill",
    };

    const sportBreakdown = (sportsRes.rows || []).map((r: any) => {
      const sportKey = String(r.sport_type).toLowerCase();
      const count = Number(r.count) || 0;
      const dist = Math.round(((Number(r.dist) || 0) / 1000) * 10) / 10;
      const pct = totalWorkouts > 0 ? Math.round((count / totalWorkouts) * 100) : 0;
      return {
        sport: sportKey,
        label: sportLabels[sportKey] || sportKey.toUpperCase(),
        count,
        distanceKm: dist,
        pct,
      };
    });

    const weeklyVolume = (weeksRes.rows || []).map((w: any, idx: number) => ({
      weekLabel: `W${idx + 1}`,
      distanceKm: Math.round(((Number(w.week_dist) || 0) / 1000) * 10) / 10,
    }));

    volumeData = {
      totalWorkouts,
      totalDistanceKm: totalDistKm,
      totalElevationM: totalElevM,
      totalDurationHours: totalDurHours,
      sportBreakdown,
      weeklyVolume,
    };
  }

  // Format Trail
  let trailData = null;
  if (trailRes && trailRes.rows.length > 0) {
    const tRow = trailRes.rows[0];
    const maxVam = Math.round(Number(tRow.max_vam) || 0);
    const trailElev = Math.round(Number(tRow.trail_elev) || 0);
    const hillyElev = Number(tRow.hilly_elev) || 0;
    const hillyDistKm = (Number(tRow.hilly_dist) || 0) / 1000;
    const climbDensity = hillyDistKm > 0 ? Math.round(hillyElev / hillyDistKm) : 0;

    trailData = {
      maxVam,
      totalTrailElevM: trailElev,
      climbDensity,
    };
  }

  // Format Recent Activities (Sanitize GPS coords and Heart Rate)
  let recentActivities: PublicActivityItem[] = [];
  if (recentRes && recentRes.rows.length > 0) {
    recentActivities = recentRes.rows.map((row: any) => {
      const act: PublicActivityItem = {
        id: String(row.id),
        name: String(row.name || "Workout"),
        sportType: String(row.sport_type || "run"),
        startTime: Number(row.start_time),
        distanceMeters: Number(row.distance_meters) || 0,
        durationSeconds: Number(row.duration_seconds) || 0,
        elevationGain: Number(row.elevation_gain) || 0,
        avgPaceSec: Number(row.avg_pace_sec) || 0,
      };

      if (showHr) {
        if (row.avg_hr) act.avgHr = Number(row.avg_hr);
        if (row.max_hr) act.maxHr = Number(row.max_hr);
      }

      if (row.gps_track) {
        act.svgRoutePath = generateMiniSvgPath(String(row.gps_track), 120, 70);
      }

      return act;
    });
  }

  return {
    found: true,
    isPublic: true,
    nickname: verifiedNickname,
    athleteId,
    settings: { showPmc, showVolume, showTrail, showRecent, showHr },
    pmc: pmcData,
    volume: volumeData,
    trail: trailData,
    recentActivities,
  };
}
