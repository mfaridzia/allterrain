import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentAthleteId } from "@/lib/session";

export interface ShoeRecord {
  id: string;
  name: string;
  brand: string;
  model: string;
  sportType: "trail" | "road" | "racing" | "all-terrain";
  maxDistanceKm: number;
  maxElevationM: number;
  initialDistanceKm: number;
  initialElevationM: number;
  isDefault: boolean;
  isRetired: boolean;
  notes: string;
  totalDistanceKm: number;
  totalElevationM: number;
  activityCount: number;
  avgPaceSec: number;
  lastWornTime: number | null;
  distanceProgressPct: number;
  elevationProgressPct: number;
  overallWearPct: number;
  wearStatus: "fresh" | "active" | "warning" | "critical" | "retired";
  wearStatusLabel: string;
  createdAt: number;
}

export async function GET(req: NextRequest) {
  const athleteId = await getCurrentAthleteId(req);
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // 1. Fetch all shoes for current athlete
  let shoesRes = await db.execute({
    sql: `
      SELECT s.*, 
        COUNT(a.id) as activity_count,
        COALESCE(SUM(a.distance_meters), 0) as logged_distance_meters,
        COALESCE(SUM(a.elevation_gain), 0) as logged_elevation_gain,
        COALESCE(AVG(CASE WHEN a.avg_pace_sec > 0 THEN a.avg_pace_sec ELSE NULL END), 0) as avg_pace_sec,
        MAX(a.start_time) as last_worn_time
      FROM shoes s
      LEFT JOIN activities a ON a.shoe_id = s.id AND a.athlete_id = s.athlete_id
      WHERE s.athlete_id = ?
      GROUP BY s.id
      ORDER BY s.is_retired ASC, s.is_default DESC, s.created_at ASC
    `,
    args: [athleteId],
  });

  // 2. If no shoes exist yet, auto-seed starter trail and road shoes based on real activities
  if (shoesRes.rows.length === 0) {
    const now = Date.now();
    const starterTrailId = `shoe_${now}_trail`;
    const starterRoadId = `shoe_${now}_road`;

    await db.batch([
      {
        sql: `INSERT INTO shoes (
          id, athlete_id, name, brand, model, sport_type, 
          max_distance_km, max_elevation_m, initial_distance_km, initial_elevation_m,
          is_default, is_retired, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          starterTrailId,
          athleteId,
          "Hoka Speedgoat 5",
          "Hoka",
          "Speedgoat 5",
          "trail",
          650,
          22000,
          140,
          8500,
          1,
          0,
          "Vibram Megagrip 5mm lugs. Primary mountain & technical trail racing shoe.",
          now,
          now,
        ],
      },
      {
        sql: `INSERT INTO shoes (
          id, athlete_id, name, brand, model, sport_type, 
          max_distance_km, max_elevation_m, initial_distance_km, initial_elevation_m,
          is_default, is_retired, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          starterRoadId,
          athleteId,
          "Nike Pegasus 40",
          "Nike",
          "Air Zoom Pegasus 40",
          "road",
          750,
          6000,
          185,
          1200,
          1,
          0,
          "Daily road running and steady aerobic recovery sessions.",
          now + 1,
          now + 1,
        ],
      },
    ]);

    // Auto-link existing unassigned activities to appropriate starter shoe
    try {
      await db.execute({
        sql: `UPDATE activities 
              SET shoe_id = ? 
              WHERE athlete_id = ? 
                AND (sport_type = 'trail_run' OR elevation_gain > 150) 
                AND (shoe_id IS NULL OR shoe_id = '')`,
        args: [starterTrailId, athleteId],
      });

      await db.execute({
        sql: `UPDATE activities 
              SET shoe_id = ? 
              WHERE athlete_id = ? 
                AND sport_type != 'strength' 
                AND sport_type != 'gym' 
                AND (shoe_id IS NULL OR shoe_id = '')`,
        args: [starterRoadId, athleteId],
      });
    } catch {}

    // Re-query with updated aggregations
    shoesRes = await db.execute({
      sql: `
        SELECT s.*, 
          COUNT(a.id) as activity_count,
          COALESCE(SUM(a.distance_meters), 0) as logged_distance_meters,
          COALESCE(SUM(a.elevation_gain), 0) as logged_elevation_gain,
          COALESCE(AVG(CASE WHEN a.avg_pace_sec > 0 THEN a.avg_pace_sec ELSE NULL END), 0) as avg_pace_sec,
          MAX(a.start_time) as last_worn_time
        FROM shoes s
        LEFT JOIN activities a ON a.shoe_id = s.id AND a.athlete_id = s.athlete_id
        WHERE s.athlete_id = ?
        GROUP BY s.id
        ORDER BY s.is_retired ASC, s.is_default DESC, s.created_at ASC
      `,
      args: [athleteId],
    });
  }

  // 3. Process & format shoe statistics
  let totalTrackedKm = 0;
  let totalTrackedElevationM = 0;
  let activeShoesCount = 0;
  let retiredShoesCount = 0;
  let shoesNeedingReplacementCount = 0;

  const shoes: ShoeRecord[] = shoesRes.rows.map((row: any) => {
    const isRetired = Boolean(row.is_retired);
    const maxDist = Number(row.max_distance_km || 650);
    const maxElev = Number(row.max_elevation_m || 20000);
    const initialDist = Number(row.initial_distance_km || 0);
    const initialElev = Number(row.initial_elevation_m || 0);
    const loggedDistKm = Number(row.logged_distance_meters || 0) / 1000;
    const loggedElevM = Number(row.logged_elevation_gain || 0);

    const totalDistKm = Math.round((initialDist + loggedDistKm) * 10) / 10;
    const totalElevM = Math.round(initialElev + loggedElevM);

    const distPct = Math.min(100, Math.round((totalDistKm / maxDist) * 100));
    const elevPct = Math.min(100, Math.round((totalElevM / maxElev) * 100));

    // Weighted wear: trail shoe lugs wear out faster from steep technical climbs/descents
    const isTrailType = row.sport_type === "trail" || row.sport_type === "all-terrain";
    const overallWearPct = Math.min(
      100,
      isTrailType
        ? Math.max(distPct, Math.round(elevPct * 1.05))
        : distPct
    );

    let wearStatus: "fresh" | "active" | "warning" | "critical" | "retired";
    let wearStatusLabel: string;

    if (isRetired) {
      wearStatus = "retired";
      wearStatusLabel = "Retired";
      retiredShoesCount++;
    } else {
      activeShoesCount++;
      totalTrackedKm += totalDistKm;
      totalTrackedElevationM += totalElevM;

      if (overallWearPct >= 90) {
        wearStatus = "critical";
        wearStatusLabel = "Outsole Worn / Replace Soon";
        shoesNeedingReplacementCount++;
      } else if (overallWearPct >= 75) {
        wearStatus = "warning";
        wearStatusLabel = "High Mileage / Inspect Lugs";
      } else if (overallWearPct >= 35) {
        wearStatus = "active";
        wearStatusLabel = "Optimal Mid-Life";
      } else {
        wearStatus = "fresh";
        wearStatusLabel = "Fresh Condition";
      }
    }

    return {
      id: String(row.id),
      name: String(row.name),
      brand: String(row.brand || ""),
      model: String(row.model || ""),
      sportType: (row.sport_type || "trail") as any,
      maxDistanceKm: maxDist,
      maxElevationM: maxElev,
      initialDistanceKm: initialDist,
      initialElevationM: initialElev,
      isDefault: Boolean(row.is_default),
      isRetired,
      notes: String(row.notes || ""),
      totalDistanceKm: totalDistKm,
      totalElevationM: totalElevM,
      activityCount: Number(row.activity_count || 0),
      avgPaceSec: Math.round(Number(row.avg_pace_sec || 0)),
      lastWornTime: row.last_worn_time ? Number(row.last_worn_time) : null,
      distanceProgressPct: distPct,
      elevationProgressPct: elevPct,
      overallWearPct,
      wearStatus,
      wearStatusLabel,
      createdAt: Number(row.created_at || Date.now()),
    };
  });

  return NextResponse.json({
    shoes,
    summary: {
      totalTrackedKm: Math.round(totalTrackedKm * 10) / 10,
      totalTrackedElevationM: Math.round(totalTrackedElevationM),
      activeShoesCount,
      retiredShoesCount,
      shoesNeedingReplacementCount,
    },
  });
}

export async function POST(req: NextRequest) {
  const athleteId = await getCurrentAthleteId(req);
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      brand = "",
      model = "",
      sportType = "trail",
      maxDistanceKm = 650,
      maxElevationM = 20000,
      initialDistanceKm = 0,
      initialElevationM = 0,
      isDefault = false,
      notes = "",
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Shoe name is required" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();
    const id = `shoe_${now}_${Math.random().toString(36).substring(2, 7)}`;

    // If marked default, unset other defaults for the same sport type
    if (isDefault) {
      await db.execute({
        sql: `UPDATE shoes SET is_default = 0 WHERE athlete_id = ? AND sport_type = ?`,
        args: [athleteId, sportType],
      });
    }

    await db.execute({
      sql: `INSERT INTO shoes (
        id, athlete_id, name, brand, model, sport_type,
        max_distance_km, max_elevation_m, initial_distance_km, initial_elevation_m,
        is_default, is_retired, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      args: [
        id,
        athleteId,
        name.trim(),
        brand.trim(),
        model.trim(),
        sportType,
        Number(maxDistanceKm) || 650,
        Number(maxElevationM) || 20000,
        Number(initialDistanceKm) || 0,
        Number(initialElevationM) || 0,
        isDefault ? 1 : 0,
        notes.trim(),
        now,
        now,
      ],
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Failed to add shoe:", err);
    return NextResponse.json({ error: err.message || "Failed to create shoe" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const athleteId = await getCurrentAthleteId(req);
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, name, brand, model, sportType, maxDistanceKm, maxElevationM, isDefault, isRetired, notes } = body;

    if (!id) {
      return NextResponse.json({ error: "Shoe ID required" }, { status: 400 });
    }

    const db = getDb();
    const now = Date.now();

    // If making default, unset other defaults for this sport type
    if (isDefault) {
      const currentRes = await db.execute({
        sql: `SELECT sport_type FROM shoes WHERE id = ? AND athlete_id = ?`,
        args: [id, athleteId],
      });
      const st = currentRes.rows[0]?.sport_type || sportType || "trail";
      await db.execute({
        sql: `UPDATE shoes SET is_default = 0 WHERE athlete_id = ? AND sport_type = ?`,
        args: [athleteId, st],
      });
    }

    // Build dynamic update
    const fields: string[] = ["updated_at = ?"];
    const args: any[] = [now];

    if (name !== undefined) {
      fields.push("name = ?");
      args.push(name.trim());
    }
    if (brand !== undefined) {
      fields.push("brand = ?");
      args.push(brand.trim());
    }
    if (model !== undefined) {
      fields.push("model = ?");
      args.push(model.trim());
    }
    if (sportType !== undefined) {
      fields.push("sport_type = ?");
      args.push(sportType);
    }
    if (maxDistanceKm !== undefined) {
      fields.push("max_distance_km = ?");
      args.push(Number(maxDistanceKm));
    }
    if (maxElevationM !== undefined) {
      fields.push("max_elevation_m = ?");
      args.push(Number(maxElevationM));
    }
    if (isDefault !== undefined) {
      fields.push("is_default = ?");
      args.push(isDefault ? 1 : 0);
    }
    if (isRetired !== undefined) {
      fields.push("is_retired = ?");
      args.push(isRetired ? 1 : 0);
    }
    if (notes !== undefined) {
      fields.push("notes = ?");
      args.push(notes.trim());
    }

    args.push(id, athleteId);

    await db.execute({
      sql: `UPDATE shoes SET ${fields.join(", ")} WHERE id = ? AND athlete_id = ?`,
      args,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to update shoe:", err);
    return NextResponse.json({ error: err.message || "Failed to update shoe" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const athleteId = await getCurrentAthleteId(req);
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Shoe ID required" }, { status: 400 });
    }

    const db = getDb();

    // Unlink any activities pointing to this shoe
    await db.execute({
      sql: `UPDATE activities SET shoe_id = NULL WHERE shoe_id = ? AND athlete_id = ?`,
      args: [id, athleteId],
    });

    // Delete the shoe
    await db.execute({
      sql: `DELETE FROM shoes WHERE id = ? AND athlete_id = ?`,
      args: [id, athleteId],
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete shoe:", err);
    return NextResponse.json({ error: err.message || "Failed to delete shoe" }, { status: 500 });
  }
}
