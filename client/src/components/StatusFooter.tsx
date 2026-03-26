// Guardian Dashboard - Status Footer
import { useDashboard } from '../contexts/DashboardContext';

export default function StatusFooter() {
  const { lastUpdate, isDemoMode, isEnglish } = useDashboard();

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
        {isDemoMode && (
          <>
            <span>·</span>
            <span className="text-amber-500">{isEnglish ? 'Demo Mode' : '演示模式'}</span>
          </>
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
            <span>
              {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </>
        )}
      </div>
    </footer>
  );
}
