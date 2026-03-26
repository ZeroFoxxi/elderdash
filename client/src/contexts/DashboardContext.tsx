// Guardian Dashboard - Global State Context
// Active Elderly Companion System

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { VitalsData, AlertData, BVIDataPoint, ConversationMessage, PageType } from '../lib/types';
import {
  generateDemoVitals,
  generate24hBVIData,
  DEMO_ALERTS,
  DEMO_CONVERSATIONS,
} from '../lib/demo';

interface DashboardContextType {
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  isEnglish: boolean;
  toggleLanguage: () => void;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  vitals: VitalsData | null;
  vitalsHistory: VitalsData[];
  bviHistory: BVIDataPoint[];
  alerts: AlertData[];
  unackedCount: number;
  acknowledgeAlert: (index: number) => void;
  acknowledgeAll: () => void;
  conversations: ConversationMessage[];
  mqttConnected: boolean;
  lastUpdate: Date | null;
  triggerDemoFall: () => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageType>('live');
  const [isEnglish, setIsEnglish] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalsData[]>([]);
  const [bviHistory] = useState<BVIDataPoint[]>(() => generate24hBVIData());
  const [alerts, setAlerts] = useState<AlertData[]>(DEMO_ALERTS);
  const [conversations] = useState<ConversationMessage[]>(DEMO_CONVERSATIONS);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const demoTickRef = useRef(0);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleLanguage = useCallback(() => setIsEnglish(prev => !prev), []);
  const toggleDemoMode = useCallback(() => setIsDemoMode(prev => !prev), []);

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
    // Switch to alerts page
    setCurrentPage('alerts');
  }, [setCurrentPage]);

  // Demo mode data generation
  useEffect(() => {
    if (!isDemoMode) {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      setVitals(null);
      setVitalsHistory([]);
      setLastUpdate(null);
      return;
    }

    // Generate initial data immediately
    const initialVitals = generateDemoVitals(0);
    setVitals(initialVitals);
    setLastUpdate(new Date());

    // Pre-populate history with some data points
    const preHistory: VitalsData[] = [];
    for (let i = 20; i >= 1; i--) {
      preHistory.push(generateDemoVitals(i * 3));
    }
    setVitalsHistory(preHistory);

    demoIntervalRef.current = setInterval(() => {
      demoTickRef.current += 1;
      const newVitals = generateDemoVitals(demoTickRef.current);
      setVitals(newVitals);
      setLastUpdate(new Date());
      setVitalsHistory(prev => {
        const updated = [...prev, newVitals];
        return updated.slice(-60);
      });
    }, 5000);

    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, [isDemoMode]);

  // MQTT connection (when not in demo mode)
  useEffect(() => {
    if (isDemoMode) {
      setMqttConnected(false);
      return;
    }
    setMqttConnected(false);
  }, [isDemoMode]);

  const unackedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <DashboardContext.Provider value={{
      currentPage,
      setCurrentPage,
      isEnglish,
      toggleLanguage,
      isDemoMode,
      toggleDemoMode,
      vitals,
      vitalsHistory,
      bviHistory,
      alerts,
      unackedCount,
      acknowledgeAlert,
      acknowledgeAll,
      conversations,
      mqttConnected,
      lastUpdate,
      triggerDemoFall,
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
