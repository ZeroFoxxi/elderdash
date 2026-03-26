import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getLatestVitals,
  getRecentAlerts,
  getRecentCompanionLogs,
  getBviHistory,
} from "../db";

/**
 * Realtime polling router
 * Frontend polls this every 5 seconds instead of using WebSocket
 * This works reliably in both dev and production environments
 */
export const realtimeRouter = router({
  // Get latest vitals snapshot + recent alerts + recent companion logs
  poll: publicProcedure
    .input(z.object({
      since: z.number().optional(), // Unix timestamp ms - only return data newer than this
    }).optional())
    .query(async ({ input }) => {
      const [latestVitals, recentAlerts, companionLogs] = await Promise.all([
        getLatestVitals(),
        getRecentAlerts(50),
        getRecentCompanionLogs(20),
      ]);

      // Check if vitals are fresh (within last 30 seconds)
      const vitalsAge = latestVitals?.createdAt
        ? Date.now() - new Date(latestVitals.createdAt).getTime()
        : Infinity;
      const isLive = vitalsAge < 30_000;

      // Filter to only return items newer than 'since' if provided
      const since = input?.since;
      const newAlerts = since
        ? recentAlerts.filter(a => new Date(a.createdAt).getTime() > since)
        : recentAlerts;
      const newLogs = since
        ? companionLogs.filter(l => new Date(l.createdAt).getTime() > since)
        : companionLogs;

      return {
        vitals: latestVitals,
        vitalsAge,
        isLive,
        alerts: newAlerts,
        companionLogs: newLogs,
        serverTs: Date.now(),
      };
    }),

  // Get BVI daily summaries for week/month comparison
  bviHistory: publicProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(7), // 7 = week, 30 = month
    }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 7;
      const summaries = await getBviHistory(days);
      return { summaries, days };
    }),
});
