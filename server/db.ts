import { eq, desc, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, vitalsSnapshots, alertEvents, companionLogs, InsertVitalsSnapshot, InsertAlertEvent, InsertCompanionLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Vitals Snapshots ───────────────────────────────────────────────────────

export async function insertVitalsSnapshot(data: InsertVitalsSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(vitalsSnapshots).values(data);
}

export async function getLatestVitals() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(vitalsSnapshots).orderBy(desc(vitalsSnapshots.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function getVitalsHistory(hours: number = 1) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return db.select().from(vitalsSnapshots)
    .where(gte(vitalsSnapshots.createdAt, since))
    .orderBy(desc(vitalsSnapshots.createdAt))
    .limit(720);
}

// ─── Alert Events ────────────────────────────────────────────────────────────

export async function insertAlertEvent(data: InsertAlertEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(alertEvents).values(data);
}

export async function getRecentAlerts(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.select().from(alertEvents)
    .where(gte(alertEvents.createdAt, since))
    .orderBy(desc(alertEvents.createdAt))
    .limit(limit);
}

export async function acknowledgeAlert(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(alertEvents).set({ acknowledged: true }).where(eq(alertEvents.id, id));
}

export async function acknowledgeAllAlerts() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(alertEvents).set({ acknowledged: true });
}

// ─── Companion Logs ──────────────────────────────────────────────────────────

export async function insertCompanionLog(data: InsertCompanionLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(companionLogs).values(data);
}

export async function getRecentCompanionLogs(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.select().from(companionLogs)
    .where(gte(companionLogs.createdAt, since))
    .orderBy(desc(companionLogs.createdAt))
    .limit(limit);
}

// ─── BVI History (for week/month comparison) ─────────────────────────────────

export interface BviDailySummary {
  date: string;       // "YYYY-MM-DD"
  avgBvi: number;
  peakBvi: number;
  activeMinutes: number;   // minutes where bvi >= 40 (each snapshot = 5 min)
  restingMinutes: number;
  dataPoints: number;
}

/**
 * Get per-day BVI summaries for the past N days.
 * Each snapshot represents ~5 minutes of data.
 */
export async function getBviHistory(days: number = 7): Promise<BviDailySummary[]> {
  const db = await getDb();
  if (!db) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Fetch raw snapshots for the period
  const rows = await db.select({
    createdAt: vitalsSnapshots.createdAt,
    bvi: vitalsSnapshots.bvi,
  })
    .from(vitalsSnapshots)
    .where(gte(vitalsSnapshots.createdAt, since))
    .orderBy(desc(vitalsSnapshots.createdAt))
    .limit(days * 300); // max 300 snapshots per day (5-min interval = 288/day)

  if (rows.length === 0) return [];

  // Group by date
  const byDate: Record<string, number[]> = {};
  for (const row of rows) {
    const d = new Date(row.createdAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!byDate[dateKey]) byDate[dateKey] = [];
    if (row.bvi !== null) byDate[dateKey].push(row.bvi);
  }

  // Build summaries
  const summaries: BviDailySummary[] = Object.entries(byDate).map(([date, bvis]) => {
    const avg = bvis.length > 0 ? Math.round(bvis.reduce((s, v) => s + v, 0) / bvis.length) : 0;
    const peak = bvis.length > 0 ? Math.max(...bvis) : 0;
    const activeCount = bvis.filter(b => b >= 40).length;
    const restingCount = bvis.filter(b => b < 40).length;
    return {
      date,
      avgBvi: avg,
      peakBvi: peak,
      activeMinutes: activeCount * 5,
      restingMinutes: restingCount * 5,
      dataPoints: bvis.length,
    };
  });

  // Sort ascending by date
  summaries.sort((a, b) => a.date.localeCompare(b.date));

  return summaries;
}
