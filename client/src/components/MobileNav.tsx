// Guardian Dashboard - Mobile Bottom Navigation Bar
// Shown only on small screens (< md breakpoint)
// Provides quick access to all 6 pages + unread alert badge

import { Activity, BarChart2, Bell, MessageSquare, FileText, Layers } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import type { PageType } from '../lib/types';

const NAV_ITEMS: {
  id: PageType;
  icon: React.ReactNode;
  label: string;
  label_zh: string;
}[] = [
  { id: 'live',         icon: <Activity size={18} />,     label: 'Live',      label_zh: '实时' },
  { id: 'vitality',     icon: <BarChart2 size={18} />,    label: 'BVI',       label_zh: 'BVI' },
  { id: 'alerts',       icon: <Bell size={18} />,         label: 'Alerts',    label_zh: '报警' },
  { id: 'companion',    icon: <MessageSquare size={18} />,label: 'Chat',      label_zh: '陪伴' },
  { id: 'report',       icon: <FileText size={18} />,     label: 'Report',    label_zh: '报告' },
  { id: 'architecture', icon: <Layers size={18} />,       label: 'Arch',      label_zh: '架构' },
];

export default function MobileNav() {
  const { currentPage, setCurrentPage, isEnglish, unackedCount } = useDashboard();

  return (
    <nav
      className="flex items-center justify-around border-t border-border bg-white px-1 py-1 safe-area-pb"
      style={{ minHeight: '56px' }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = currentPage === item.id;
        const showBadge = item.id === 'alerts' && unackedCount > 0;
        return (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className="relative flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-all min-w-[44px]"
            style={{
              color: isActive ? 'oklch(0.62 0.14 185)' : '#9ca3af',
              backgroundColor: isActive ? 'oklch(0.62 0.14 185 / 0.08)' : 'transparent',
            }}
          >
            {item.icon}
            <span className="text-[9px] font-medium leading-none">
              {isEnglish ? item.label : item.label_zh}
            </span>
            {showBadge && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                {unackedCount > 9 ? '9+' : unackedCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
