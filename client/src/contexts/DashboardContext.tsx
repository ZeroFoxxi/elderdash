// Guardian Dashboard - Main Data Context
// Supports: MQTT real-time data + Multi-scenario demo mode
// MQTT Topic: companion/status | Broker: ws://[jetson-ip]:9001

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { VitalsData, AlertData, BVIDataPoint, ConversationMessage, PageType } from '../lib/types';
import {
  generate24hBVIData,
  DEMO_ALERTS,
  DEMO_CONVERSATIONS,
} from '../lib/demo';
import { ScenarioEngine, type ScenarioType } from '../lib/scenarios';
import { useMqtt, type MqttConfig, type MqttConnectionStatus } from '../hooks/useMqtt';

export type DataSourceMode = 'demo' | 'mqtt';

export interface MqttSettings {
  brokerUrl: string;
  topic: string;
  username?: string;
  password?: string;
}

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
  isDemoMode: boolean;  // convenience alias: dataSource === 'demo'
  demoScenario: ScenarioType;
  setDemoScenario: (s: ScenarioType) => void;

  // MQTT
  mqttSettings: MqttSettings;
  setMqttSettings: (s: MqttSettings) => void;
  mqttStatus: MqttConnectionStatus;
  mqttConnected: boolean;
  mqttError: string | null;
  connectMqtt: (overrideSettings?: MqttSettings) => void;
  disconnectMqtt: () => void;

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

const DEFAULT_MQTT_SETTINGS: MqttSettings = {
  brokerUrl: 'ws://192.168.1.100:9001',
  topic: 'companion/status',
  username: '',
  password: '',
};

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageType>('live');
  const [isEnglish, setIsEnglish] = useState(false);
  const [dataSource, setDataSourceState] = useState<DataSourceMode>('demo');
  const [demoScenario, setDemoScenarioState] = useState<ScenarioType>('normal');
  const [mqttSettings, setMqttSettingsState] = useState<MqttSettings>(DEFAULT_MQTT_SETTINGS);

  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalsData[]>([]);
  const [bviHistory, setBviHistory] = useState<BVIDataPoint[]>(() => generate24hBVIData());
  const [alerts, setAlerts] = useState<AlertData[]>(DEMO_ALERTS);
  const [conversations] = useState<ConversationMessage[]>(DEMO_CONVERSATIONS);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Scenario engine (singleton)
  const scenarioEngineRef = useRef<ScenarioEngine>(new ScenarioEngine());
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // MQTT hook
  const { status: mqttStatus, lastData: mqttData, lastError: mqttError, connect, disconnect } = useMqtt();

  const toggleLanguage = useCallback(() => setIsEnglish(prev => !prev), []);

  const setDataSource = useCallback((mode: DataSourceMode) => {
    setDataSourceState(mode);
    if (mode === 'mqtt') {
      // Clear demo interval
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    }
  }, []);

  const setDemoScenario = useCallback((s: ScenarioType) => {
    setDemoScenarioState(s);
    scenarioEngineRef.current.setScenario(s);
  }, []);

  const setMqttSettings = useCallback((s: MqttSettings) => {
    setMqttSettingsState(s);
  }, []);

  const connectMqtt = useCallback((overrideSettings?: MqttSettings) => {
    const settings = overrideSettings ?? mqttSettings;
    const config: MqttConfig = {
      brokerUrl: settings.brokerUrl,
      topic: settings.topic,
      username: settings.username || undefined,
      password: settings.password || undefined,
    };
    connect(config);
    setDataSourceState('mqtt');
  }, [mqttSettings, connect]);

  const disconnectMqtt = useCallback(() => {
    disconnect();
    setDataSourceState('demo');
  }, [disconnect]);

  // Handle incoming MQTT data
  useEffect(() => {
    if (dataSource === 'mqtt' && mqttData) {
      setVitals(mqttData);
      setLastUpdate(new Date());
      setVitalsHistory(prev => {
        const updated = [...prev, mqttData];
        return updated.slice(-60);
      });
      // Handle alert from MQTT
      if (mqttData.alert) {
        setAlerts(prev => {
          // Avoid duplicate alerts within 30s
          const recent = prev[0];
          if (recent && recent.type === mqttData.alert!.type &&
              !recent.acknowledged) return prev;
          return [mqttData.alert!, ...prev];
        });
      }
      // Update BVI history
      setBviHistory(prev => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const newPoint: BVIDataPoint = {
          time: timeStr,
          bvi: mqttData.bvi,
          active: mqttData.bvi >= 40,
        };
        const updated = [...prev, newPoint];
        return updated.slice(-288); // Keep 24h of 5-min points
      });
    }
  }, [mqttData, dataSource]);

  // Demo mode data generation
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

    // Generate initial data immediately
    const initialVitals = engine.generate();
    setVitals(initialVitals);
    setLastUpdate(new Date());

    // Pre-populate history
    const preHistory: VitalsData[] = [];
    const tempEngine = new ScenarioEngine();
    tempEngine.setScenario('normal');
    for (let i = 0; i < 20; i++) {
      preHistory.push(tempEngine.generate());
    }
    setVitalsHistory(preHistory);

    demoIntervalRef.current = setInterval(() => {
      const newVitals = engine.generate();
      setVitals(newVitals);
      setLastUpdate(new Date());
      setVitalsHistory(prev => {
        const updated = [...prev, newVitals];
        return updated.slice(-60);
      });
      // Handle scenario-generated alerts
      if (newVitals.alert) {
        setAlerts(prev => {
          const recent = prev[0];
          // Deduplicate: same type within last 10 entries
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
      message: 'FALL DETECTED — High body movement followed by complete stillness ≥8s (5 consecutive confirmations)',
      message_zh: '检测到跌倒！高体动后完全静止 ≥8秒（5次连续确认）— 请立即确认老人状态！',
      timestamp: ts,
      acknowledged: false,
    };
    setAlerts(prev => [fallAlert, ...prev]);
    // If in demo mode, switch scenario to fall
    if (dataSource === 'demo') {
      setDemoScenario('fall');
    }
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
      mqttSettings,
      setMqttSettings,
      mqttStatus,
      mqttConnected: mqttStatus === 'connected',
      mqttError,
      connectMqtt,
      disconnectMqtt,
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
