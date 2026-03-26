/**
 * useRealtime - connects to /ws/live and receives real-time data from Jetson
 * Falls back gracefully when not connected
 */
import { useEffect, useRef, useCallback } from "react";

export type RealtimeVitals = {
  radarHr: number | null;
  radarRr: number | null;
  movement: number | null;
  targetId: string | null;
  ppgHr: number;
  ppgSpo2: number | null;
  ppgSignalQuality: number | null;
  ppgConnected: boolean;
  fusedHr: number | null;
  fusedMethod: string | null;
  bvi: number | null;
  deviceId: string;
  createdAt?: string;
};

export type RealtimeAlert = {
  id?: number;
  alertType: string;
  severity: "critical" | "warning" | "info";
  message: string;
  messageZh?: string | null;
  acknowledged: boolean;
  deviceId: string;
  createdAt: string | Date;
};

export type RealtimeCompanionLog = {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  logType: string;
  deviceId: string;
  createdAt: string | Date;
};

export type RealtimeMessage =
  | { type: "init"; data: { latestVitals: RealtimeVitals | null; recentAlerts: RealtimeAlert[]; companionLogs: RealtimeCompanionLog[] }; ts: number }
  | { type: "vitals"; data: RealtimeVitals; ts: number }
  | { type: "alert"; data: RealtimeAlert; ts: number }
  | { type: "companion"; data: RealtimeCompanionLog; ts: number };

type Handlers = {
  onInit?: (data: RealtimeMessage & { type: "init" }) => void;
  onVitals?: (data: RealtimeVitals) => void;
  onAlert?: (data: RealtimeAlert) => void;
  onCompanion?: (data: RealtimeCompanionLog) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

export function useRealtime(handlers: Handlers, enabled: boolean = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Keep handlers ref up to date without re-connecting
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;

    // Build WebSocket URL: same host, /ws/live path
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;

    console.log("[Realtime] Connecting to", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Realtime] Connected");
      handlersRef.current.onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg: RealtimeMessage = JSON.parse(event.data);
        switch (msg.type) {
          case "init":
            handlersRef.current.onInit?.(msg);
            break;
          case "vitals":
            handlersRef.current.onVitals?.(msg.data);
            break;
          case "alert":
            handlersRef.current.onAlert?.(msg.data);
            break;
          case "companion":
            handlersRef.current.onCompanion?.(msg.data);
            break;
        }
      } catch (e) {
        console.error("[Realtime] Parse error:", e);
      }
    };

    ws.onclose = () => {
      console.log("[Realtime] Disconnected, reconnecting in 5s...");
      handlersRef.current.onDisconnect?.();
      wsRef.current = null;
      if (mountedRef.current && enabled) {
        reconnectTimer.current = setTimeout(connect, 5000);
      }
    };

    ws.onerror = (err) => {
      console.error("[Realtime] WebSocket error:", err);
    };
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);
}
