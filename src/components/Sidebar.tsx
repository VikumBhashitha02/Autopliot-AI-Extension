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
} from 'lucide-react';
import appIcon from '../assets/app-icon.png';
import { useApp, NavigationTab } from '../context/AppContext';

  export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, theme, toggleTheme, activeRun, agentStatus } = useApp();
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
    { id: 'logs', label: 'Logs & Diagnostics', icon: <FileTerminal size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <aside
      className={`h-screen flex flex-col justify-between border-r border-slate-800 bg-slate-950/80 backdrop-blur-xl transition-all duration-300 z-30 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
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
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  AutoPilot <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">AI</span>
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Workflow Automation</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <div className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {item.icon}
                </div>
                {!collapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
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
        {!collapsed && (
          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  agentStatus.targetPid ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className="text-slate-300 font-medium truncate max-w-[120px]">
                {agentStatus.targetProcessName}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Safe</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 transition-colors w-full justify-center"
            title="Toggle Light / Dark Theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
