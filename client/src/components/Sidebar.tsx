// Guardian Dashboard - Sidebar
// Dark sidebar with teal accent, medical dashboard style
// Includes: Data Source Switcher (Demo/Realtime) + Scenario Selector

import { useState } from 'react';
import { Activity, BarChart2, Bell, MessageSquare, FileText, Wifi, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { SCENARIOS } from '../lib/scenarios';
import type { PageType } from '../lib/types';

const navItems: {
  id: PageType;
  icon: React.ReactNode;
  label: string;
  label_zh: string;
  sub: string;
  sub_zh: string;
}[] = [
  {
    id: 'live',
    icon: <Activity size={15} />,
    label: 'Live Monitor',
    label_zh: '实时监控',
    sub: 'Vitals Overview',
    sub_zh: '生理数据总览',
  },
  {
    id: 'vitality',
    icon: <BarChart2 size={15} />,
    label: 'Vitality Index',
    label_zh: '活力指数',
    sub: 'BVI Trend Anal...',
    sub_zh: 'BVI 趋势分析',
  },
  {
    id: 'alerts',
    icon: <Bell size={15} />,
    label: 'Alert History',
    label_zh: '报警记录',
    sub: 'Event Log',
    sub_zh: '事件历史',
  },
  {
    id: 'companion',
    icon: <MessageSquare size={15} />,
    label: 'AI Companion Log',
    label_zh: 'AI 陪伴日志',
    sub: 'Dialogue & Patrol',
    sub_zh: '对话与巡检',
  },
  {
    id: 'report',
    icon: <FileText size={15} />,
    label: 'Daily Report',
    label_zh: '每日报告',
    sub: 'Health Summary',
    sub_zh: '健康摘要',
  },
];

export default function Sidebar() {
  const {
    currentPage,
    setCurrentPage,
    isEnglish,
    isDemoMode,
    dataSource,
    setDataSource,
    demoScenario,
    setDemoScenario,
    realtimeConnected,
    toggleLanguage,
    unackedCount,
  } = useDashboard();

  const [showDataPanel, setShowDataPanel] = useState(false);

  return (
    <aside
      className="w-[155px] min-w-[155px] flex flex-col h-screen border-r border-sidebar-border"
      style={{ backgroundColor: 'oklch(0.17 0.02 250)' }}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-0.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'oklch(0.62 0.14 185 / 0.2)' }}
          >
            <span style={{ color: 'oklch(0.62 0.14 185)' }} className="text-xs font-bold">G</span>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-white truncate">Guardian</div>
            <div className="text-[9px] truncate" style={{ color: 'oklch(0.5 0.01 240)' }}>
              Companion System · 智能守护
            </div>
          </div>
        </div>
      </div>

      {/* Device Status */}
      <div className="px-4 py-2.5 border-b border-sidebar-border">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full live-dot" style={{ backgroundColor: '#10b981' }} />
          <span className="text-[10px] font-medium" style={{ color: 'oklch(0.85 0.01 240)' }}>
            Jetson Nano B01
          </span>
        </div>
        <div className="text-[9px]" style={{ color: 'oklch(0.45 0.01 240)' }}>
          R60ABD1 + PPG {isEnglish ? 'Online' : '在线'}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all relative"
              style={{
                backgroundColor: isActive ? 'oklch(0.62 0.14 185)' : 'transparent',
                color: isActive ? 'white' : 'oklch(0.6 0.01 240)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.25 0.03 250)';
                  (e.currentTarget as HTMLElement).style.color = 'oklch(0.85 0.01 240)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'oklch(0.6 0.01 240)';
                }
              }}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/50 rounded-r" />
              )}
              <span className="flex-shrink-0 opacity-80">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-medium truncate">
                    {isEnglish ? item.label : item.label_zh}
                  </span>
                  {item.id === 'alerts' && unackedCount > 0 && (
                    <span className="flex-shrink-0 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {unackedCount > 9 ? '9+' : unackedCount}
                    </span>
                  )}
                </div>
                <div
                  className="text-[9px] truncate"
                  style={{ color: isActive ? 'rgba(255,255,255,0.6)' : 'oklch(0.45 0.01 240)' }}
                >
                  {isEnglish ? item.sub : item.sub_zh}
                </div>
              </div>
              {isActive && (
                <div className="flex-shrink-0 w-1 h-1 rounded-full bg-white/50" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom controls */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-1.5">

        {/* Data Source Toggle Button */}
        <button
          onClick={() => setShowDataPanel(prev => !prev)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[10px] transition-all"
          style={{
            backgroundColor: showDataPanel ? 'oklch(0.25 0.03 250)' : 'transparent',
            color: isDemoMode ? 'oklch(0.85 0.12 65)' : realtimeConnected ? '#10b981' : 'oklch(0.5 0.01 240)',
            border: `1px solid ${isDemoMode ? 'oklch(0.7 0.15 65 / 0.3)' : realtimeConnected ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
          }}
        >
          {isDemoMode
            ? <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 live-dot" style={{ backgroundColor: 'oklch(0.85 0.12 65)' }} />
            : realtimeConnected
              ? <Wifi size={10} className="flex-shrink-0" />
              : <WifiOff size={10} className="flex-shrink-0" />
          }
          <span className="flex-1 text-left truncate">
            {isDemoMode
              ? (isEnglish ? 'Demo Mode' : '演示模式')
              : realtimeConnected
                ? (isEnglish ? 'Jetson Live' : '实时数据')
                : (isEnglish ? 'Waiting...' : '等待连接')}
          </span>
          {showDataPanel ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>

        {/* Data Source Panel */}
        {showDataPanel && (
          <div
            className="rounded-lg p-2 space-y-2"
            style={{ backgroundColor: 'oklch(0.13 0.02 250)', border: '1px solid oklch(0.28 0.02 250)' }}
          >
            {/* Mode Tabs */}
            <div className="flex gap-1">
              <button
                onClick={() => setDataSource('demo')}
                className="flex-1 py-1 rounded text-[9px] font-medium transition-all"
                style={{
                  backgroundColor: isDemoMode ? 'oklch(0.62 0.14 185)' : 'oklch(0.22 0.02 250)',
                  color: isDemoMode ? 'white' : 'oklch(0.5 0.01 240)',
                }}
              >
                {isEnglish ? 'Demo' : '演示'}
              </button>
              <button
                onClick={() => setDataSource('realtime')}
                className="flex-1 py-1 rounded text-[9px] font-medium transition-all"
                style={{
                  backgroundColor: !isDemoMode ? 'oklch(0.62 0.14 185)' : 'oklch(0.22 0.02 250)',
                  color: !isDemoMode ? 'white' : 'oklch(0.5 0.01 240)',
                }}
              >
                {isEnglish ? 'Realtime' : '实时'}
              </button>
            </div>

            {/* Demo: Scenario Selector */}
            {isDemoMode && (
              <div className="space-y-1">
                <div className="text-[9px] font-medium" style={{ color: 'oklch(0.5 0.01 240)' }}>
                  {isEnglish ? 'Scenario' : '情境'}
                </div>
                {SCENARIOS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setDemoScenario(s.id)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[9px] transition-all text-left"
                    style={{
                      backgroundColor: demoScenario === s.id ? `${s.color}22` : 'transparent',
                      color: demoScenario === s.id ? s.color : 'oklch(0.5 0.01 240)',
                      border: demoScenario === s.id ? `1px solid ${s.color}44` : '1px solid transparent',
                    }}
                  >
                    <span className="flex-shrink-0">{s.icon}</span>
                    <span className="truncate">{isEnglish ? s.label : s.label_zh}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Realtime Mode: Connection Status */}
            {!isDemoMode && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: realtimeConnected ? '#10b981' : '#ef4444' }}
                  />
                  <span className="text-[9px]" style={{ color: realtimeConnected ? '#10b981' : '#ef4444' }}>
                    {realtimeConnected
                      ? (isEnglish ? 'Jetson Connected' : 'Jetson 已连接')
                      : (isEnglish ? 'Waiting for Jetson' : '等待 Jetson 连接')}
                  </span>
                </div>
                <div className="text-[8px]" style={{ color: 'oklch(0.38 0.01 240)' }}>
                  {isEnglish
                    ? 'Run Python script on Jetson to send data'
                    : '在 Jetson 上运行 Python 脚本发送数据'}
                </div>
                <div
                  className="text-[8px] font-mono px-1.5 py-1 rounded"
                  style={{ backgroundColor: 'oklch(0.1 0.01 250)', color: 'oklch(0.62 0.14 185)' }}
                >
                  POST /api/ingest/vitals
                </div>
              </div>
            )}
          </div>
        )}

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[10px] transition-all"
          style={{ color: 'oklch(0.5 0.01 240)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.25 0.03 250)';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.85 0.01 240)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'oklch(0.5 0.01 240)';
          }}
        >
          <span className="text-[10px]">🌐</span>
          {isEnglish ? '切换中文' : 'Switch to English'}
        </button>
      </div>
    </aside>
  );
}
