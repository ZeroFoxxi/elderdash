// Guardian Dashboard - Main App
// Active Elderly Companion System - Edge AI Dashboard
// Mobile: bottom nav bar; Desktop: left sidebar

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DashboardProvider, useDashboard } from "./contexts/DashboardContext";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import TopBar from "./components/TopBar";
import LiveMonitor from "./pages/LiveMonitor";
import VitalityIndex from "./pages/VitalityIndex";
import AlertHistory from "./pages/AlertHistory";
import CompanionLog from "./pages/CompanionLog";
import DailyReport from './pages/DailyReport';
import SystemArchitecture from './pages/SystemArchitecture';
import StatusFooter from './components/StatusFooter';

function DashboardContent() {
  const { currentPage } = useDashboard();
  const renderPage = () => {
    switch (currentPage) {
      case 'live': return <LiveMonitor />;
      case 'vitality': return <VitalityIndex />;
      case 'alerts': return <AlertHistory />;
      case 'companion': return <CompanionLog />;
      case 'report': return <DailyReport />;
      case 'architecture': return <SystemArchitecture />;
      default: return <LiveMonitor />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {renderPage()}
        </main>
        {/* Status footer — hidden on mobile to save space */}
        <div className="hidden md:block">
          <StatusFooter />
        </div>
        {/* Mobile bottom nav — visible only on mobile */}
        <div className="md:hidden">
          <MobileNav />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <DashboardProvider>
          <DashboardContent />
          <Toaster />
        </DashboardProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
