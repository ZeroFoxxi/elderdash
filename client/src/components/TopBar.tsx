// Guardian Dashboard - Top Bar
// Medical-grade dark dashboard style
// Shows: data source mode, current scenario, realtime status, demo fall button

import { Wifi, Cloud, AlertTriangle, RefreshCw, WifiOff, Radio } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { SCENARIOS } from '../lib/scenarios';

export default function TopBar() {
  const {
    isEnglish,
    isDemoMode,
    dataSource,
    demoScenario,
    realtimeConnected,
    triggerDemoFall,
    lastUpdate,
  } = useDashboard();

  const currentScenario = SCENARIOS.find(s => s.id === demoScenario);

  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-6 gap-4 flex-shrink-0 shadow-sm">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-bold text-foreground truncate" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {isEnglish ? 'Active Elderly Companion System' : '独居老人主动陪伴'}
          </h1>
          <span className="text-sm font-normal text-muted-foreground hidden md:inline">
            Active Elderly Companion System
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {isEnglish
            ? 'Active Companion System for Elderly Living Alone · Edge AI Dashboard'
            : '独居老人主动陪伴系统 · 边缘 AI 仪表板'}
        </p>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* TTS Status */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <Wifi size={12} className="text-emerald-500" />
          <span className="text-muted-foreground">Local TTS</span>
          <span className="text-emerald-500 font-semibold">· Online</span>
        </div>

        {/* LLM Status */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <Cloud size={12} className="text-blue-400" />
          <span className="text-muted-foreground">Qwen-Turbo (Cloud)</span>
        </div>

        {/* Data Source Badge */}
        {isDemoMode ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{
              backgroundColor: currentScenario ? `${currentScenario.color}18` : 'rgba(245,158,11,0.1)',
              color: currentScenario?.color ?? '#f59e0b',
              border: `1px solid ${currentScenario ? currentScenario.color + '40' : 'rgba(245,158,11,0.3)'}`,
            }}
          >
            <span>{currentScenario?.icon ?? '◎'}</span>
            <span>
              {isEnglish
                ? `Demo · ${currentScenario?.label ?? 'Normal'}`
                : `演示 · ${currentScenario?.label_zh ?? '正常'}`}
            </span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
            style={{
              backgroundColor: realtimeConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: realtimeConnected ? '#10b981' : '#ef4444',
              border: `1px solid ${realtimeConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
            {realtimeConnected ? <Radio size={10} /> : <WifiOff size={10} />}
            <span>
              {realtimeConnected
                ? (isEnglish ? '● Jetson Live' : '● Jetson 实时')
                : (isEnglish ? '○ Waiting Jetson' : '○ 等待 Jetson')}
            </span>
          </div>
        )}

        {/* Last update time */}
        {lastUpdate && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
            <RefreshCw size={9} />
            <span>
              {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
        )}

        {/* Demo Fall Button - always visible in demo mode */}
        {isDemoMode && (
          <button
            onClick={triggerDemoFall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <AlertTriangle size={12} />
            {isEnglish ? '⚠ Demo Fall' : '⚠ 模拟跌倒'}
          </button>
        )}
      </div>
    </header>
  );
}
