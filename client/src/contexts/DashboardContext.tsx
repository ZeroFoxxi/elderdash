// Guardian Dashboard - Main Data Context
// Supports:
//   - Demo mode: multi-scenario simulation (normal/hr_high/fall/night/spo2_low)
//   - Realtime mode: WebSocket /ws/live ← data pushed from Jetson via HTTP API

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { VitalsData, AlertData, BVIDataPoint, ConversationMessage, PageType } from '../lib/types';
import {
  generate24hBVIData,
  DEMO_ALERTS,
  DEMO_CONVERSATIONS,
} from '../lib/demo';
import { ScenarioEngine, type ScenarioType } from '../lib/scenarios';
import { useRealtime, type RealtimeVitals, type RealtimeAlert, type RealtimeCompanionLog } from '../hooks/useRealtime';

export type DataSourceMode = 'demo' | 'realtime';

interface DashboardContextType {
  // Navigation
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  isEnglish: boolean;
  toggleLanguage: () => void;

  // Data source
  dataSource: DataSourceMode;
  setDataSource: (mode: DataSourceMode) => void;

  // Demo mode
  isDemoMode: boolean;
  demoScenario: ScenarioType;
  setDemoScenario: (s: ScenarioType) => void;

  // Realtime connection status
  realtimeConnected: boolean;

  // Vitals data
  vitals: VitalsData | null;
  vitalsHistory: VitalsData[];
  bviHistory: BVIDataPoint[];
  lastUpdate: Date | null;

  // Alerts
  alerts: AlertData[];
  unackedCount: number;
  acknowledgeAlert: (index: number) => void;
  acknowledgeAll: () => void;
  triggerDemoFall: () => void;

  // Conversations
  conversations: ConversationMessage[];
}

const DashboardContext = createContext<DashboardContextType | null>(null);

// Convert Jetson realtime vitals → internal VitalsData format
function mapRealtimeVitals(rv: RealtimeVitals): VitalsData {
  const hr = rv.fusedHr ?? rv.radarHr ?? 0;
  return {
    heartRate: hr,
    respRate: rv.radarRr ?? 0,
    movement: rv.movement ?? 0,
    bvi: rv.bvi ?? 0,
    ppgHr: rv.ppgHr,
    ppgSpo2: rv.ppgSpo2 ?? 0,
    ppgSignalQuality: rv.ppgSignalQuality ?? 0,
    ppgConnected: rv.ppgConnected,
    radarHr: rv.radarHr ?? 0,
    fusedHr: rv.fusedHr ?? 0,
    fusedMethod: rv.fusedMethod ?? 'Radar only',
    targetId: rv.targetId ?? 'None',
    alert: null,
  };
}

// Convert Jetson alert → internal AlertData format
function mapRealtimeAlert(ra: RealtimeAlert): AlertData {
  const ts = new Date(ra.createdAt);
  const timeStr = `${String(ts.getMonth() + 1).padStart(2, '0')}/${String(ts.getDate()).padStart(2, '0')} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
  const severityMap: Record<string, AlertData['severity']> = {
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info',
  };
  return {
    type: ra.alertType,
    severity: severityMap[ra.severity] ?? 'Warning',
    message: ra.message,
    message_zh: ra.messageZh ?? ra.message,
    timestamp: timeStr,
    acknowledged: ra.acknowledged,
  };
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageType>('live');
  const [isEnglish, setIsEnglish] = useState(false);
  const [dataSource, setDataSourceState] = useState<DataSourceMode>('demo');
  const [demoScenario, setDemoScenarioState] = useState<ScenarioType>('normal');
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalsData[]>([]);
  const [bviHistory, setBviHistory] = useState<BVIDataPoint[]>(() => generate24hBVIData());
  const [alerts, setAlerts] = useState<AlertData[]>(DEMO_ALERTS);
  const [conversations, setConversations] = useState<ConversationMessage[]>(DEMO_CONVERSATIONS);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const scenarioEngineRef = useRef<ScenarioEngine>(new ScenarioEngine());
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleLanguage = useCallback(() => setIsEnglish(prev => !prev), []);

  const setDataSource = useCallback((mode: DataSourceMode) => {
    setDataSourceState(mode);
    if (mode === 'demo') {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    }
  }, []);

  const setDemoScenario = useCallback((s: ScenarioType) => {
    setDemoScenarioState(s);
    scenarioEngineRef.current.setScenario(s);
  }, []);

  // ─── Realtime WebSocket ─────────────────────────────────────────────────────
  useRealtime({
    onConnect: () => {
      setRealtimeConnected(true);
      console.log('[Dashboard] Realtime connected');
    },
    onDisconnect: () => {
      setRealtimeConnected(false);
    },
    onInit: (msg) => {
      // Load initial state from server
      if (msg.data.latestVitals) {
        const mapped = mapRealtimeVitals(msg.data.latestVitals);
        setVitals(mapped);
        setLastUpdate(new Date());
      }
      if (msg.data.recentAlerts.length > 0) {
        const mappedAlerts = msg.data.recentAlerts.map(mapRealtimeAlert);
        setAlerts(mappedAlerts);
      }
      if (msg.data.companionLogs.length > 0) {
        // Convert companion logs to conversation messages
        const msgs: ConversationMessage[] = msg.data.companionLogs.map(log => ({
          role: log.role as 'user' | 'assistant' | 'system',
          content: log.content,
          timestamp: new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          type: log.logType as any,
        }));
        setConversations(msgs.reverse());
      }
    },
    onVitals: (rv) => {
      if (dataSource !== 'realtime') return;
      const mapped = mapRealtimeVitals(rv);
      setVitals(mapped);
      setLastUpdate(new Date());
      setVitalsHistory(prev => [...prev, mapped].slice(-60));
      // Update BVI history
      setBviHistory(prev => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        return [...prev, { time: timeStr, bvi: rv.bvi ?? 0, active: (rv.bvi ?? 0) >= 40 }].slice(-288);
      });
    },
    onAlert: (ra) => {
      const mapped = mapRealtimeAlert(ra);
      setAlerts(prev => {
        const recent = prev.slice(0, 5).find(a => a.type === mapped.type && !a.acknowledged);
        if (recent) return prev;
        return [mapped, ...prev];
      });
      // Auto-navigate to alerts page for critical alerts
      if (ra.severity === 'critical') {
        setCurrentPage('alerts');
      }
    },
    onCompanion: (log) => {
      const msg: ConversationMessage = {
        role: log.role as 'user' | 'assistant' | 'system',
        content: log.content,
        timestamp: new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        type: log.logType as any,
      };
      setConversations(prev => [...prev, msg].slice(-100));
    },
  }, true); // Always connect to realtime WebSocket

  // ─── Demo mode data generation ──────────────────────────────────────────────
  useEffect(() => {
    if (dataSource !== 'demo') {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      return;
    }

    const engine = scenarioEngineRef.current;
    engine.setScenario(demoScenario);

    const initialVitals = engine.generate();
    setVitals(initialVitals);
    setLastUpdate(new Date());

    const preHistory: VitalsData[] = [];
    const tempEngine = new ScenarioEngine();
    tempEngine.setScenario('normal');
    for (let i = 0; i < 20; i++) preHistory.push(tempEngine.generate());
    setVitalsHistory(preHistory);

    demoIntervalRef.current = setInterval(() => {
      const newVitals = engine.generate();
      setVitals(newVitals);
      setLastUpdate(new Date());
      setVitalsHistory(prev => [...prev, newVitals].slice(-60));
      if (newVitals.alert) {
        setAlerts(prev => {
          const recentSame = prev.slice(0, 10).find(a => a.type === newVitals.alert!.type && !a.acknowledged);
          if (recentSame) return prev;
          return [newVitals.alert!, ...prev];
        });
      }
    }, 5000);

    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [dataSource, demoScenario]);

  // ─── Alert actions ──────────────────────────────────────────────────────────
  const acknowledgeAlert = useCallback((index: number) => {
    setAlerts(prev => prev.map((a, i) => i === index ? { ...a, acknowledged: true } : a));
  }, []);

  const acknowledgeAll = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
  }, []);

  const triggerDemoFall = useCallback(() => {
    const now = new Date();
    const ts = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const fallAlert: AlertData = {
      type: 'FALL DETECTED',
      severity: 'Critical',
      message: 'FALL DETECTED — High body movement followed by complete stillness ≥8s',
      message_zh: '检测到跌倒！高体动后完全静止 ≥8秒 — 请立即确认老人状态！',
      timestamp: ts,
      acknowledged: false,
    };
    setAlerts(prev => [fallAlert, ...prev]);
    if (dataSource === 'demo') setDemoScenario('fall');
    setCurrentPage('alerts');
  }, [dataSource, setDemoScenario]);

  const unackedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <DashboardContext.Provider value={{
      currentPage,
      setCurrentPage,
      isEnglish,
      toggleLanguage,
      dataSource,
      setDataSource,
      isDemoMode: dataSource === 'demo',
      demoScenario,
      setDemoScenario,
      realtimeConnected,
      vitals,
      vitalsHistory,
      bviHistory,
      lastUpdate,
      alerts,
      unackedCount,
      acknowledgeAlert,
      acknowledgeAll,
      triggerDemoFall,
      conversations,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
