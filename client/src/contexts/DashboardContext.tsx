// Guardian Dashboard - Main Data Context
// Supports:
//   - Demo mode: multi-scenario simulation (normal/hr_high/fall/night/spo2_low)
//   - Realtime mode: HTTP polling via tRPC every 5s (works in all environments)

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { VitalsData, AlertData, BVIDataPoint, ConversationMessage, PageType } from '../lib/types';
import {
  generate24hBVIData,
  DEMO_ALERTS,
  DEMO_CONVERSATIONS,
} from '../lib/demo';
import { ScenarioEngine, type ScenarioType, type BviLoopPhase } from '../lib/scenarios';
import { trpc } from '../lib/trpc';
import {
  requestNotificationPermission,
  sendAlertNotification,
  getNotificationPermission,
} from '../lib/notifications';

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

  // Browser Notifications
  notificationPermission: NotificationPermission | 'unsupported';
  requestNotifications: () => Promise<void>;
  notificationsEnabled: boolean;
  toggleNotifications: () => void;

  // BVI Loop Phase (for Agent status card)
  bviLoopPhase: BviLoopPhase;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

// Convert DB vitals row → internal VitalsData format
function mapDbVitals(row: {
  radarHr: number | null;
  radarRr: number | null;
  movement: number | null;
  bvi: number | null;
  ppgHr: number | null;
  ppgSpo2: number | null;
  ppgSignalQuality: number | null;
  ppgConnected: boolean | null;
  fusedHr: number | null;
  fusedMethod: string | null;
  targetId: string | null;
}): VitalsData {
  const hr = row.fusedHr ?? row.radarHr ?? 0;
  return {
    heartRate: hr,
    // Use null-coalescing (not ||) to preserve legitimate 0 values
    respRate: row.radarRr !== null ? row.radarRr : 0,
    movement: row.movement !== null ? row.movement : 0,
    bvi: row.bvi !== null ? row.bvi : 0,
    ppgHr: row.ppgHr !== null ? row.ppgHr : 0,
    ppgSpo2: row.ppgSpo2 !== null ? row.ppgSpo2 : 0,
    ppgSignalQuality: row.ppgSignalQuality !== null ? row.ppgSignalQuality : 0,
    ppgConnected: row.ppgConnected !== null ? row.ppgConnected : false,
    radarHr: row.radarHr !== null ? row.radarHr : 0,
    fusedHr: row.fusedHr !== null ? row.fusedHr : 0,
    fusedMethod: row.fusedMethod ?? 'Radar only',
    targetId: row.targetId ?? 'None',
    alert: null,
  };
}

// Convert DB alert row → internal AlertData format
function mapDbAlert(row: {
  alertType: string;
  severity: string;
  message: string;
  messageZh: string | null;
  acknowledged: boolean | null;
  createdAt: Date | string;
}): AlertData {
  const ts = new Date(row.createdAt);
  const timeStr = `${String(ts.getMonth() + 1).padStart(2, '0')}/${String(ts.getDate()).padStart(2, '0')} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
  const severityMap: Record<string, AlertData['severity']> = {
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info',
  };
  return {
    type: row.alertType,
    severity: severityMap[row.severity] ?? 'Warning',
    message: row.message,
    message_zh: row.messageZh ?? row.message,
    timestamp: timeStr,
    acknowledged: row.acknowledged ?? false,
  };
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageType>('live');
  const [isEnglish, setIsEnglish] = useState(false);
  const [dataSource, setDataSourceState] = useState<DataSourceMode>('realtime');
  const [demoScenario, setDemoScenarioState] = useState<ScenarioType>('normal');
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalsData[]>([]);
  const [bviHistory, setBviHistory] = useState<BVIDataPoint[]>(() => generate24hBVIData());
  const [alerts, setAlerts] = useState<AlertData[]>(DEMO_ALERTS);
  const [conversations, setConversations] = useState<ConversationMessage[]>(DEMO_CONVERSATIONS);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // ─── Browser Notification State ─────────────────────────────────────────────
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    () => getNotificationPermission()
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const scenarioEngineRef = useRef<ScenarioEngine>(new ScenarioEngine());
  const [bviLoopPhase, setBviLoopPhase] = useState<BviLoopPhase>('active');
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenTs = useRef<number>(0);
  const prevVitalsRef = useRef<VitalsData | null>(null);
  // Track last seen alert count to detect truly new alerts
  const lastAlertCountRef = useRef<number>(0);

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

  // ─── Notification helpers ────────────────────────────────────────────────────
  const requestNotifications = useCallback(async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled(prev => !prev);
  }, []);

  // ─── tRPC Polling (replaces WebSocket) ─────────────────────────────────────
  // Poll every 5 seconds, always enabled regardless of mode
  const { data: pollData } = trpc.realtime.poll.useQuery(
    { since: lastSeenTs.current },
    {
      refetchInterval: 5000,
      refetchIntervalInBackground: true,
      staleTime: 0,
    }
  );

  useEffect(() => {
    if (!pollData) return;

    const { vitals: dbVitals, isLive, alerts: newAlerts, companionLogs: newLogs, serverTs } = pollData;

    // Update connection status based on data freshness
    setRealtimeConnected(isLive);

    if (isLive && dbVitals) {
      // Auto-switch to realtime when live data arrives
      setDataSourceState('realtime');

      const mapped = mapDbVitals(dbVitals);

      // Only update if data actually changed (compare heartRate as proxy)
      if (mapped.heartRate !== prevVitalsRef.current?.heartRate ||
          mapped.bvi !== prevVitalsRef.current?.bvi) {
        prevVitalsRef.current = mapped;
        setVitals(mapped);
        setLastUpdate(new Date());
        setVitalsHistory(prev => [...prev, mapped].slice(-60));
        setBviHistory(prev => {
          const now = new Date();
          const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          return [...prev, { time: timeStr, bvi: mapped.bvi, active: mapped.bvi >= 40 }].slice(-288);
        });
      }
    }

    // Process new alerts
    if (newAlerts.length > 0) {
      const mappedAlerts = newAlerts.map(mapDbAlert);
      setAlerts(prev => {
        const existingTypes = new Set(prev.slice(0, 20).map(a => `${a.type}-${a.timestamp}`));
        const truly_new = mappedAlerts.filter(a => !existingTypes.has(`${a.type}-${a.timestamp}`));
        if (truly_new.length === 0) return prev;

        // ── Browser Notifications for truly new alerts ──────────────────────
        if (notificationsEnabled) {
          truly_new.forEach(alert => {
            sendAlertNotification({
              alertType: alert.type,
              severity: alert.severity,
              message: isEnglish ? alert.message : alert.message_zh,
              isEnglish,
            });
          });
        }

        // Auto-navigate to alerts for critical
        const hasCritical = truly_new.some(a => a.severity === 'Critical');
        if (hasCritical) setCurrentPage('alerts');
        return [...truly_new, ...prev];
      });
    }

    // Process new companion logs
    if (newLogs.length > 0) {
      const msgs: ConversationMessage[] = newLogs.map(log => ({
        role: log.role as 'user' | 'assistant' | 'system',
        content: log.content,
        timestamp: new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        type: log.logType as any,
      }));
      setConversations(msgs.reverse());
    }

    // Update lastSeenTs for delta polling
    lastSeenTs.current = serverTs;
  }, [pollData, notificationsEnabled, isEnglish]);

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

    // 演示模式使用 1000ms tick，让场景变化更快可见
    // 这样 fall 场景约 20s 触发报警，bvi_loop 场景约 85s 完成一个周期
    demoIntervalRef.current = setInterval(() => {
      const newVitals = engine.generate();
      setVitals(newVitals);
      setLastUpdate(new Date());
      setVitalsHistory(prev => [...prev, newVitals].slice(-60));
      // Update BVI loop phase for Agent status card
      if (demoScenario === 'bvi_loop') {
        setBviLoopPhase(engine.getBviLoopPhase());
      }
      if (newVitals.alert) {
        setAlerts(prev => {
          // 去重逻辑优化：只防止2秒内重复同类型报警，不防止场景重新触发的同类型报警
          const twoSecondsAgo = Date.now() - 2000;
          const veryRecentSame = prev.slice(0, 5).find(a => {
            if (a.type !== newVitals.alert!.type) return false;
            // 如果没有 addedAt 时间戳，跳过去重
            return false;
          });
          if (veryRecentSame) return prev;

          // ── Browser Notifications for demo alerts ──────────────────────
          if (notificationsEnabled) {
            sendAlertNotification({
              alertType: newVitals.alert!.type,
              severity: newVitals.alert!.severity,
              message: isEnglish ? newVitals.alert!.message : newVitals.alert!.message_zh,
              isEnglish,
            });
          }

          return [newVitals.alert!, ...prev];
        });
      }
    }, 1000);

    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [dataSource, demoScenario, notificationsEnabled, isEnglish]);

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

    // Send browser notification for demo fall
    if (notificationsEnabled) {
      sendAlertNotification({
        alertType: 'FALL DETECTED',
        severity: 'Critical',
        message: isEnglish
          ? 'FALL DETECTED — High body movement followed by complete stillness ≥8s'
          : '检测到跌倒！高体动后完全静止 ≥8秒 — 请立即确认老人状态！',
        isEnglish,
      });
    }

    if (dataSource === 'demo') setDemoScenario('fall');
    setCurrentPage('alerts');
  }, [dataSource, setDemoScenario, notificationsEnabled, isEnglish]);

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
      bviLoopPhase,
      alerts,
      unackedCount,
      acknowledgeAlert,
      acknowledgeAll,
      triggerDemoFall,
      conversations,
      notificationPermission,
      requestNotifications,
      notificationsEnabled,
      toggleNotifications,
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
