// Guardian Dashboard - Main App
// Active Elderly Companion System - Edge AI Dashboard

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DashboardProvider, useDashboard } from "./contexts/DashboardContext";
import Sidebar from "./components/Sidebar";
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

  // make sure to consider if you need authentication for certain routes
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {renderPage()}
        </main>
        <StatusFooter />
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
