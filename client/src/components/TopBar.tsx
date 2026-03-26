// Guardian Dashboard - Top Bar
// Responsive layout: adapts to mobile/tablet/desktop
// Shows: data source mode, current scenario, realtime status, demo fall button

import { Wifi, Cloud, AlertTriangle, RefreshCw, WifiOff, Radio, Bot } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { SCENARIOS } from '../lib/scenarios';

// BVI loop phase labels for the demo scenario badge
const BVI_PHASE_LABELS: Record<string, { zh: string; en: string; color: string }> = {
  active:           { zh: '活跃监测', en: 'Active', color: '#10b981' },
  declining:        { zh: 'BVI下降中', en: 'BVI Declining', color: '#f59e0b' },
  patrol_triggered: { zh: 'Agent巡检触发', en: 'Patrol Triggered', color: '#ef4444' },
  ai_conversing:    { zh: 'AI对话中', en: 'AI Conversing', color: '#6366f1' },
  recovering:       { zh: 'BVI恢复中', en: 'Recovering', color: '#14b8a6' },
  stable:           { zh: '已恢复稳定', en: 'Stable', color: '#10b981' },
};

export default function TopBar() {
  const {
    isEnglish,
    isDemoMode,
    dataSource,
    demoScenario,
    realtimeConnected,
    triggerDemoFall,
    lastUpdate,
    bviLoopPhase,
  } = useDashboard();

  const currentScenario = SCENARIOS.find(s => s.id === demoScenario);
  const dataFresh = lastUpdate ? (Date.now() - lastUpdate.getTime()) < 30000 : false;
  const isLive = realtimeConnected || dataFresh;

  const isBviLoop = demoScenario === 'bvi_loop';
  const loopPhaseInfo = BVI_PHASE_LABELS[bviLoopPhase] ?? BVI_PHASE_LABELS.active;

  return (
    <header className="bg-white border-b border-border flex items-center px-4 md:px-6 gap-3 flex-shrink-0 shadow-sm min-h-[56px] flex-wrap py-2">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-sm md:text-base font-bold text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {isEnglish ? 'Active Elderly Companion' : '独居老人主动陪伴'}
          </h1>
          <span className="text-xs font-normal text-muted-foreground hidden lg:inline">
            Active Elderly Companion System
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground hidden sm:block truncate">
          {isEnglish
            ? 'Edge AI Dashboard · Jetson Nano B01'
            : '边缘 AI 仪表板 · Jetson Nano B01'}
        </p>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        {/* TTS Status — hidden on small screens */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px]">
          <Wifi size={11} className="text-emerald-500" />
          <span className="text-muted-foreground">Local TTS</span>
          <span className="text-emerald-500 font-semibold">· Online</span>
        </div>

        {/* LLM Status — hidden on small screens */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px]">
          <Cloud size={11} className="text-blue-400" />
          <span className="text-muted-foreground hidden lg:inline">Qwen-Turbo (Cloud)</span>
          <span className="text-muted-foreground lg:hidden">Qwen</span>
        </div>

        {/* Data Source Badge */}
        {isDemoMode ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Main scenario badge */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold"
              style={{
                backgroundColor: currentScenario ? `${currentScenario.color}18` : 'rgba(245,158,11,0.1)',
                color: currentScenario?.color ?? '#f59e0b',
                border: `1px solid ${currentScenario ? currentScenario.color + '40' : 'rgba(245,158,11,0.3)'}`,
              }}
            >
              <span>{currentScenario?.icon ?? '◎'}</span>
              <span className="hidden sm:inline">
                {isEnglish
                  ? `Demo · ${currentScenario?.label ?? 'Normal'}`
                  : `演示 · ${currentScenario?.label_zh ?? '正常'}`}
              </span>
              <span className="sm:hidden">Demo</span>
            </div>
            {/* BVI Loop phase badge — only in bvi_loop scenario */}
            {isBviLoop && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold"
                style={{
                  backgroundColor: `${loopPhaseInfo.color}15`,
                  color: loopPhaseInfo.color,
                  border: `1px solid ${loopPhaseInfo.color}40`,
                }}
              >
                <Bot size={9} />
                <span className="hidden sm:inline">
                  {isEnglish ? loopPhaseInfo.en : loopPhaseInfo.zh}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold"
            style={{
              backgroundColor: isLive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: isLive ? '#10b981' : '#ef4444',
              border: `1px solid ${isLive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
            {isLive ? <Radio size={10} /> : <WifiOff size={10} />}
            <span>
              {isLive
                ? (isEnglish ? '● Jetson Live' : '● Jetson 实时')
                : (isEnglish ? '○ Waiting' : '○ 等待')}
            </span>
          </div>
        )}

        {/* Last update time — hidden on mobile */}
        {lastUpdate && (
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
            <RefreshCw size={9} />
            <span>
              {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
        )}

        {/* Demo Fall Button */}
        {isDemoMode && (
          <button
            onClick={triggerDemoFall}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <AlertTriangle size={11} />
            <span className="hidden sm:inline">{isEnglish ? '⚠ Demo Fall' : '⚠ 模拟跌倒'}</span>
            <span className="sm:hidden">⚠</span>
          </button>
        )}
      </div>
    </header>
  );
}
