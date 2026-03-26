// Guardian Dashboard - Status Footer
// Shows: system info, data source mode, current scenario, last update

import { useDashboard } from '../contexts/DashboardContext';
import { SCENARIOS } from '../lib/scenarios';

export default function StatusFooter() {
  const { lastUpdate, isDemoMode, isEnglish, demoScenario, mqttStatus } = useDashboard();
  const currentScenario = SCENARIOS.find(s => s.id === demoScenario);

  return (
    <footer className="h-7 bg-white border-t border-border flex items-center px-6 justify-between flex-shrink-0">
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>FYP</span>
        <span>·</span>
        <span>令狐雅熙</span>
        <span>·</span>
        <span>v2.5</span>
        <span>·</span>
        <span>Edge AI</span>
        <span>·</span>
        {isDemoMode ? (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: currentScenario ? `${currentScenario.color}15` : 'rgba(245,158,11,0.1)',
              color: currentScenario?.color ?? '#f59e0b',
            }}
          >
            {currentScenario?.icon ?? '◎'} {isEnglish ? `Demo · ${currentScenario?.label ?? 'Normal'}` : `演示 · ${currentScenario?.label_zh ?? '正常'}`}
          </span>
        ) : (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: mqttStatus === 'connected' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
              color: mqttStatus === 'connected' ? '#10b981' : '#ef4444',
            }}
          >
            {mqttStatus === 'connected' ? '● MQTT Live' : '○ MQTT Off'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>NVIDIA Jetson Nano B01</span>
        <span>·</span>
        <span>STM32F103C6T6</span>
        <span>·</span>
        <span>Data Refresh: 5s</span>
        {lastUpdate && (
          <>
            <span>·</span>
            <span className="font-mono">
              {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </>
        )}
      </div>
    </footer>
  );
}
