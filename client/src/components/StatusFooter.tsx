// Guardian Dashboard - Status Footer
// Responsive: shows key info on all screen sizes

import { useDashboard } from '../contexts/DashboardContext';
import { SCENARIOS } from '../lib/scenarios';

export default function StatusFooter() {
  const { lastUpdate, isDemoMode, isEnglish, demoScenario, realtimeConnected } = useDashboard();
  const currentScenario = SCENARIOS.find(s => s.id === demoScenario);

  const dataFresh = lastUpdate ? (Date.now() - lastUpdate.getTime()) < 30000 : false;
  const isLive = realtimeConnected || (!isDemoMode && dataFresh);

  return (
    <footer className="bg-white border-t border-border flex items-center px-4 md:px-6 justify-between flex-shrink-0 min-h-[28px] py-1">
      {/* Left: project metadata */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
        <span className="hidden sm:inline">FYP</span>
        <span className="hidden sm:inline">·</span>
        <span>令狐雅熙</span>
        <span>·</span>
        <span>v3.0</span>
        <span className="hidden md:inline">·</span>
        <span className="hidden md:inline">Edge AI</span>
        <span>·</span>
        {isDemoMode ? (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: currentScenario ? `${currentScenario.color}15` : 'rgba(245,158,11,0.1)',
              color: currentScenario?.color ?? '#f59e0b',
            }}
          >
            {currentScenario?.icon ?? '◎'}{' '}
            {isEnglish
              ? `Demo · ${currentScenario?.label ?? 'Normal'}`
              : `演示 · ${currentScenario?.label_zh ?? '正常'}`}
          </span>
        ) : (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: isLive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
              color: isLive ? '#10b981' : '#ef4444',
            }}
          >
            {isLive
              ? (isEnglish ? '● Jetson Live' : '● Jetson 实时')
              : (isEnglish ? '○ Waiting' : '○ 等待 Jetson')}
          </span>
        )}
      </div>

      {/* Right: hardware info */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="hidden lg:inline">NVIDIA Jetson Nano B01</span>
        <span className="hidden lg:inline">·</span>
        <span className="hidden md:inline">STM32F103C6T6</span>
        <span className="hidden md:inline">·</span>
        <span>Refresh: 5s</span>
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
