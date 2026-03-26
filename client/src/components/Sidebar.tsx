// Guardian Dashboard - Sidebar Navigation
// Dark sidebar with teal accent, medical dashboard style

import { Activity, BarChart2, Bell, MessageSquare, FileText, Heart, Shield } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
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
    toggleDemoMode,
    toggleLanguage,
    unackedCount,
  } = useDashboard();

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
            <Heart size={13} style={{ color: 'oklch(0.62 0.14 185)' }} />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-white leading-tight">Guardian</div>
            <div className="text-[9px] leading-tight" style={{ color: 'oklch(0.7 0.01 240)' }}>
              Companion System · 智
            </div>
          </div>
        </div>
        <div className="text-[9px] pl-9" style={{ color: 'oklch(0.55 0.01 240)' }}>
          能守护
        </div>
      </div>

      {/* Device Status */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot flex-shrink-0" />
          <span className="text-[11px] font-semibold text-white truncate">Jetson Nano B01</span>
        </div>
        <div className="text-[9px] pl-3" style={{ color: 'oklch(0.55 0.01 240)' }}>
          R60ABD1 + PPG {isEnglish ? 'Online' : '在线'}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map(item => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all relative"
              style={{
                backgroundColor: isActive ? 'oklch(0.62 0.14 185)' : 'transparent',
                color: isActive ? 'white' : 'oklch(0.65 0.01 240)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(0.25 0.03 250)';
                  (e.currentTarget as HTMLElement).style.color = 'oklch(0.9 0.01 240)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'oklch(0.65 0.01 240)';
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
        <button
          onClick={toggleDemoMode}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[10px] transition-all"
          style={{
            backgroundColor: isDemoMode ? 'oklch(0.7 0.15 65 / 0.15)' : 'transparent',
            color: isDemoMode ? 'oklch(0.85 0.12 65)' : 'oklch(0.5 0.01 240)',
            border: isDemoMode ? '1px solid oklch(0.7 0.15 65 / 0.3)' : '1px solid transparent',
          }}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDemoMode ? 'live-dot' : ''}`}
            style={{ backgroundColor: isDemoMode ? 'oklch(0.85 0.12 65)' : 'oklch(0.4 0.01 240)' }}
          />
          {isEnglish ? 'Demo Data' : '模拟数据'}
        </button>
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
