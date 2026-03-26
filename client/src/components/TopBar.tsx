// Guardian Dashboard - Top Navigation Bar
// Medical-grade dark dashboard style

import { Wifi, Cloud, AlertTriangle, RefreshCw } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';

export default function TopBar() {
  const { isEnglish, isDemoMode, triggerDemoFall, lastUpdate, vitals } = useDashboard();

  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-6 gap-4 flex-shrink-0 shadow-sm">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-bold text-foreground truncate" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {isEnglish ? 'Active Elderly Companion System' : '独居老人主动陪伴'}
          </h1>
          <span className="text-sm font-normal text-muted-foreground hidden md:inline">
            {isEnglish ? 'Active Elderly Companion' : 'Active Elderly Companion'}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {isEnglish
            ? 'Active Companion System for Elderly Living Alone · Edge AI Dashboard'
            : '独居老人主动陪伴系统 · 边缘 AI 仪表板'}
        </p>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-4 flex-shrink-0">
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

        {/* Last update time */}
        {lastUpdate && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <AlertTriangle size={12} />
            {isEnglish ? '⚠ Demo Fall' : '⚠ 模拟跌倒 / Demo Fall'}
          </button>
        )}
      </div>
    </header>
  );
}
