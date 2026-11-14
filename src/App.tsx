import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AppFooter } from './components/AppFooter';
import { ApprovalModal } from './components/ApprovalModal';

import { AutoPilotLiveView } from './views/AutoPilotLiveView';
import { RulesView } from './views/RulesView';
import { DashboardView } from './views/DashboardView';
import { WorkflowBuilderView } from './views/WorkflowBuilderView';
import { AutomationAgentView } from './views/AutomationAgentView';
import { PromptManagerView } from './views/PromptManagerView';
import { ExecutionMonitorView } from './views/ExecutionMonitorView';
import { LogsDiagnosticsView } from './views/LogsDiagnosticsView';
import { WorkflowLibraryView } from './views/WorkflowLibraryView';
import { SettingsView } from './views/SettingsView';

const MainContent: React.FC = () => {
  const { activeTab } = useApp();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'autopilot':
        return <AutoPilotLiveView />;
      case 'rules':
        return <RulesView />;
      case 'dashboard':
        return <DashboardView />;
      case 'builder':
        return <WorkflowBuilderView />;
      case 'agent':
        return <AutomationAgentView />;
      case 'prompts':
        return <PromptManagerView />;
      case 'monitor':
        return <ExecutionMonitorView />;
      case 'logs':
        return <LogsDiagnosticsView />;
      case 'library':
        return <WorkflowLibraryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <AutoPilotLiveView />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 relative min-w-0">
          {renderActiveView()}
        </main>
        <AppFooter />
      </div>
      <ApprovalModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
};

export default App;
