import React, { useState } from 'react';
import {
  Zap,
  Sliders,
  LayoutDashboard,
  Workflow,
  Bot,
  MessageSquare,
  Activity,
  FileTerminal,
  FolderKanban,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  ShieldCheck,
  X,
} from 'lucide-react';
import appIcon from '../assets/app-icon.png';
import { useApp, NavigationTab } from '../context/AppContext';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, theme, toggleTheme, activeRun, agentStatus, sidebarOpen, setSidebarOpen } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  const isAutoPilotOn = agentStatus.autoPilotEnabled !== false;

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode; badge?: string | number; badgeColor?: string }> = [
    {
      id: 'autopilot',
      label: 'Live AutoPilot',
      icon: <Zap size={20} className={isAutoPilotOn ? 'text-amber-400 fill-amber-400/20' : ''} />,
      badge: isAutoPilotOn ? 'ACTIVE' : 'PAUSED',
      badgeColor: isAutoPilotOn
        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
        : 'bg-slate-800 text-slate-400 border-slate-700',
    },
    {
      id: 'agent',
      label: 'Automation Agent',
      icon: <Bot size={20} />,
      badge: agentStatus.state === 'running' || agentStatus.state === 'monitoring' ? 'ACTIVE' : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse',
    },
    { id: 'rules', label: 'Automation Rules', icon: <Sliders size={20} /> },
    {
      id: 'prompts',
      label: 'Prompt Manager',
      icon: <MessageSquare size={20} />,
      badge: agentStatus.lastPromptDetected ? 'DETECTED' : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    { id: 'dashboard', label: 'Dashboard & Stats', icon: <LayoutDashboard size={20} /> },
    {
      id: 'monitor',
      label: 'Execution Monitor',
      icon: <Activity size={20} />,
      badge: activeRun && activeRun.status === 'running' ? 'RUNNING' : undefined,
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse',
    },
    { id: 'builder', label: 'Workflow Builder', icon: <Workflow size={20} /> },
    { id: 'library', label: 'Workflow Library', icon: <FolderKanban size={20} /> },
    { id: 'logs', label: 'Logs & Diagnostics', icon: <FileTerminal size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <>
      {/* Mobile / Narrow Webview Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r border-slate-800 bg-slate-950/95 backdrop-blur-xl transition-all duration-300 md:relative md:z-30 ${
          sidebarOpen ? 'translate-x-0 shadow-2xl shadow-black/80' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'w-64 md:w-20' : 'w-64'}`}
      >
        {/* Top Branding */}
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <img
                  src={appIcon}
                  alt="AutoPilot AI Icon"
                  className="w-10 h-10 object-contain drop-shadow-[0_2px_8px_rgba(59,130,246,0.35)] select-none pointer-events-none"
                />
              </div>
              {(!collapsed || sidebarOpen) && (
                <div className="flex flex-col">
                  <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                    AutoPilot <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">AI</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Workflow Automation</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden md:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                title="Close Navigation Drawer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation List */}
          <nav className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-11rem)]">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <div className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {item.icon}
                  </div>
                  {(!collapsed || sidebarOpen) && (
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ml-1.5 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-3 border-t border-slate-800/80 space-y-3">
          {(!collapsed || sidebarOpen) && (
            <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    agentStatus.targetPid ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                  }`}
                />
                <span className="text-slate-300 font-medium truncate max-w-[120px]">
                  {agentStatus.targetProcessName}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Safe</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 transition-colors w-full justify-center cursor-pointer"
              title="Toggle Light / Dark Theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {(!collapsed || sidebarOpen) && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
