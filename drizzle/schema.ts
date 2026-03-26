import { bigint, float, int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Real-time vitals snapshots pushed from Jetson Nano every ~5 seconds.
 * Stores the latest sensor readings for live dashboard display.
 */
export const vitalsSnapshots = mysqlTable("vitals_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  // Radar (R60ABD1)
  radarHr: float("radarHr"),          // Heart rate from radar (bpm)
  radarRr: float("radarRr"),          // Respiration rate from radar (/min)
  movement: float("movement"),        // Body movement score (0-10)
  targetId: varchar("targetId", { length: 32 }),  // "Human" / "Pet" / "None"
  // PPG (STM32)
  ppgHr: float("ppgHr"),             // PPG heart rate (bpm), 0 = no signal
  ppgSpo2: float("ppgSpo2"),         // SpO2 (%)
  ppgSignalQuality: float("ppgSignalQuality"), // 0-100
  ppgConnected: boolean("ppgConnected").default(false),
  // Fused result
  fusedHr: float("fusedHr"),         // Fused heart rate (bpm)
  fusedMethod: varchar("fusedMethod", { length: 64 }), // e.g. "60% Radar + 40% PPG"
  bvi: float("bvi"),                 // Behavioral Vitality Index (0-100)
  // System
  deviceId: varchar("deviceId", { length: 64 }).default("jetson-b01"),
  apiKey: varchar("apiKey", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VitalsSnapshot = typeof vitalsSnapshots.$inferSelect;
export type InsertVitalsSnapshot = typeof vitalsSnapshots.$inferInsert;

/**
 * Alert events pushed from Jetson Nano (fall, hr_high, spo2_low, bvi_low, etc.)
 */
export const alertEvents = mysqlTable("alert_events", {
  id: int("id").autoincrement().primaryKey(),
  alertType: varchar("alertType", { length: 64 }).notNull(), // "fall", "hr_high", "spo2_low", "bvi_low"
  severity: mysqlEnum("severity", ["critical", "warning", "info"]).notNull(),
  message: text("message").notNull(),
  messageZh: text("messageZh"),
  acknowledged: boolean("acknowledged").default(false),
  deviceId: varchar("deviceId", { length: 64 }).default("jetson-b01"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertEvent = typeof alertEvents.$inferSelect;
export type InsertAlertEvent = typeof alertEvents.$inferInsert;

/**
 * AI companion conversation logs from Jetson Nano
 */
export const companionLogs = mysqlTable("companion_logs", {
  id: int("id").autoincrement().primaryKey(),
  role: mysqlEnum("role", ["system", "user", "assistant"]).notNull(),
  content: text("content").notNull(),
  logType: varchar("logType", { length: 32 }).default("chat"), // "chat", "patrol", "alert_response"
  deviceId: varchar("deviceId", { length: 64 }).default("jetson-b01"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CompanionLog = typeof companionLogs.$inferSelect;
export type InsertCompanionLog = typeof companionLogs.$inferInsert;
