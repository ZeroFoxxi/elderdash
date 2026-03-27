/**
 * Guardian Dashboard - Realtime Service
 *
 * Architecture:
 *   Jetson Nano (Python)
 *     → POST /api/ingest/vitals    (every 5s, with API key)
 *     → POST /api/ingest/alert     (on event)
 *     → POST /api/ingest/companion (on AI dialogue)
 *
 *   Server
 *     → Stores to DB
 *     → Broadcasts to all connected browser WebSocket clients
 *
 *   Browser
 *     → Connects to /ws/live
 *     → Receives real-time updates
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { Express } from "express";
import fs from "fs";
import path from "path";
import {
  insertVitalsSnapshot,
  insertAlertEvent,
  insertCompanionLog,
  getLatestVitals,
  getVitalsHistory,
  getRecentAlerts,
  getRecentCompanionLogs,
} from "./db";

// ─── API Key ──────────────────────────────────────────────────────────────────
// Simple shared secret between Jetson and Dashboard
// In production, rotate this key and store in env
const INGEST_API_KEY = process.env.JETSON_API_KEY || "guardian-jetson-2024";

// ─── Connected browser clients ────────────────────────────────────────────────
const browserClients = new Set<WebSocket>();

function broadcast(type: string, data: unknown) {
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  for (const client of Array.from(browserClients)) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// ─── Setup WebSocket server for browsers ─────────────────────────────────────
export function setupRealtimeServer(httpServer: Server, app: Express) {
  // WebSocket server for browser clients at /ws/live
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/live" });

  wss.on("connection", async (ws) => {
    browserClients.add(ws);
    console.log(`[Realtime] Browser connected. Total: ${browserClients.size}`);

    // Send initial state on connect
    try {
      const [latestVitals, recentAlerts, companionLogs] = await Promise.all([
        getLatestVitals(),
        getRecentAlerts(50),
        getRecentCompanionLogs(30),
      ]);
      ws.send(JSON.stringify({
        type: "init",
        data: { latestVitals, recentAlerts, companionLogs },
        ts: Date.now(),
      }));
    } catch (err) {
      console.error("[Realtime] Failed to send init state:", err);
    }

    ws.on("close", () => {
      browserClients.delete(ws);
      console.log(`[Realtime] Browser disconnected. Total: ${browserClients.size}`);
    });

    ws.on("error", (err) => {
      console.error("[Realtime] WebSocket error:", err);
      browserClients.delete(ws);
    });
  });

  console.log("[Realtime] Browser WebSocket server ready at /ws/live");

  // ─── HTTP Ingest Endpoints for Jetson ──────────────────────────────────────

  // Middleware: verify API key
  function verifyApiKey(req: any, res: any, next: any) {
    const key = req.headers["x-api-key"] || req.body?.apiKey;
    if (key !== INGEST_API_KEY) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    next();
  }

  /**
   * POST /api/ingest/vitals
   * Called by Jetson every ~5 seconds with sensor readings
   *
   * Body: {
   *   apiKey: string,
   *   radarHr: number,
   *   radarRr: number,
   *   movement: number,
   *   targetId: string,       // "Human" | "Pet" | "None"
   *   ppgHr: number,          // 0 if no signal
   *   ppgSpo2: number,
   *   ppgSignalQuality: number,
   *   ppgConnected: boolean,
   *   fusedHr: number,
   *   fusedMethod: string,
   *   bvi: number,
   *   deviceId?: string
   * }
   */
  app.post("/api/ingest/vitals", verifyApiKey, async (req, res) => {
    try {
      const body = req.body;
      // Helper: parse number, returning null only if truly missing (not if 0)
      const parseNum = (v: unknown): number | null => {
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      const snapshot = {
        radarHr: parseNum(body.radarHr),
        radarRr: parseNum(body.radarRr),          // Fix: was || null, now preserves 0
        movement: parseNum(body.movement),         // Fix: was || null, now preserves 0.0
        targetId: body.targetId ?? null,           // Fix: was || null, now preserves 'None'
        ppgHr: parseNum(body.ppgHr) ?? 0,
        ppgSpo2: parseNum(body.ppgSpo2),
        ppgSignalQuality: parseNum(body.ppgSignalQuality),
        ppgConnected: body.ppgConnected === true || body.ppgConnected === 'true' || body.ppgConnected === 1,
        fusedHr: parseNum(body.fusedHr),
        fusedMethod: body.fusedMethod ?? null,
        bvi: parseNum(body.bvi),
        deviceId: body.deviceId ?? 'jetson-b01',
        apiKey: INGEST_API_KEY,
      };

      try {
        await insertVitalsSnapshot(snapshot);
      } catch (dbErr) {
        console.warn("[Ingest] Database unavailable, continuing without persistence:", (dbErr as any).message);
      }
      // Broadcast to all connected browsers (even if DB failed)
      broadcast("vitals", snapshot);
      res.json({ ok: true, ts: Date.now() });
    } catch (err) {
      console.error("[Ingest] vitals error:", err);
      // Still return 200 to allow Jetson to continue pushing
      res.json({ ok: false, warning: "Vitals received but not persisted", ts: Date.now() });
    }
  });

  /**
   * POST /api/ingest/alert
   * Called by Jetson when an alert event occurs
   *
   * Body: {
   *   apiKey: string,
   *   alertType: string,   // "fall" | "hr_high" | "hr_low" | "spo2_low" | "bvi_low"
   *   severity: string,    // "critical" | "warning" | "info"
   *   message: string,     // English message
   *   messageZh?: string,  // Chinese message
   *   deviceId?: string
   * }
   */
  app.post("/api/ingest/alert", verifyApiKey, async (req, res) => {
    try {
      const body = req.body;
      const alert = {
        alertType: body.alertType || "unknown",
        severity: (body.severity || "warning") as "critical" | "warning" | "info",
        message: body.message || "",
        messageZh: body.messageZh || null,
        acknowledged: false,
        deviceId: body.deviceId || "jetson-b01",
      };

      await insertAlertEvent(alert);

      // Broadcast to all connected browsers
      broadcast("alert", { ...alert, createdAt: new Date() });

      res.json({ ok: true, ts: Date.now() });
    } catch (err) {
      console.error("[Ingest] alert error:", err);
      res.status(500).json({ error: "Failed to store alert" });
    }
  });

  /**
   * POST /api/ingest/companion
   * Called by Jetson when AI companion has a dialogue
   *
   * Body: {
   *   apiKey: string,
   *   role: string,       // "user" | "assistant" | "system"
   *   content: string,
   *   logType?: string,   // "chat" | "patrol" | "alert_response"
   *   deviceId?: string
   * }
   */
  app.post("/api/ingest/companion", verifyApiKey, async (req, res) => {
    try {
      const body = req.body;
      const log = {
        role: (body.role || "assistant") as "user" | "assistant" | "system",
        content: body.content || "",
        logType: body.logType || "chat",
        deviceId: body.deviceId || "jetson-b01",
      };

      await insertCompanionLog(log);

      // Broadcast to all connected browsers
      broadcast("companion", { ...log, createdAt: new Date() });

      res.json({ ok: true, ts: Date.now() });
    } catch (err) {
      console.error("[Ingest] companion error:", err);
      res.status(500).json({ error: "Failed to store companion log" });
    }
  });

  /**
   * GET /api/ingest/status
   * Health check endpoint - Jetson can ping this to verify connectivity
   */
  app.get("/api/ingest/status", (req, res) => {
    res.json({
      ok: true,
      connectedBrowsers: browserClients.size,
      ts: Date.now(),
      message: "Guardian Dashboard API is running",
    });
  });

  /**
   * POST /api/ingest/deploy-bundle
   * Upload new JS/CSS bundle files to replace old ones in production.
   * Body: { apiKey, filename, content (base64) }
   */
  app.post("/api/ingest/deploy-bundle", verifyApiKey, async (req, res) => {
    try {
      const { filename, content } = req.body;
      if (!filename || !content) {
        return res.status(400).json({ error: "filename and content are required" });
      }
      // Only allow JS/CSS/HTML files
      if (!/\.(js|css|html)$/.test(filename)) {
        return res.status(400).json({ error: "Only .js, .css, .html files are allowed" });
      }
      // Determine target directory
      const publicDir = path.resolve(import.meta.dirname, "public");
      const assetsDir = path.join(publicDir, "assets");
      const targetDir = filename === "index.html" ? publicDir : assetsDir;
      const targetPath = path.join(targetDir, filename);
      // Write file
      const buffer = Buffer.from(content, "base64");
      fs.writeFileSync(targetPath, buffer);
      console.log(`[Deploy] Wrote ${buffer.length} bytes to ${targetPath}`);
      res.json({ ok: true, path: targetPath, size: buffer.length });
    } catch (err: any) {
      console.error("[Deploy] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}
