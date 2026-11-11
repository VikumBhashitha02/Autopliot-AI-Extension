import React from 'react';
import { OctagonAlert, ShieldCheck, Cpu, Terminal, Play, Bell, Menu } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TopBar: React.FC = () => {
  const { activeTab, agentStatus, activeRun, cancelExecution, addToast, toggleSidebar } = useApp();

  const handleEmergencyStop = async () => {
    try {
      if (window.api && window.api.emergencyStop) {
        await window.api.emergencyStop();
      }
      if (activeRun) {
        await cancelExecution(activeRun.id);
      }
      addToast('Emergency Stop Triggered! All operations halted.', 'error');
    } catch (err: any) {
      addToast(`Emergency stop failed: ${err.message}`, 'error');
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard & System Health';
      case 'builder': return 'Workflow Builder & Automation Designer';
      case 'agent': return 'Automation Agent & Session Monitor';
      case 'prompts': return 'Prompt Manager & Diagnostics';
      case 'monitor': return 'Live Execution Monitor';
      case 'logs': return 'Logs & Diagnostic History';
      case 'library': return 'Workflow Library & Templates';
      case 'settings': return 'Preferences & Security Guardrails';
      default: return 'AutoPilot AI';
    }
  };

  return (
    <header className="h-16 min-h-[64px] border-b border-slate-800 bg-slate-950/70 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-20 shrink-0">
      {/* Title & View Info with Hamburger on Mobile */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shrink-0 cursor-pointer"
          title="Open Navigation Menu"
          aria-label="Toggle navigation drawer"
        >
          <Menu size={20} />
        </button>

        <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-white truncate max-w-[150px] xs:max-w-[200px] sm:max-w-md md:max-w-none">
          {getTitle()}
        </h1>

        {activeRun && activeRun.status === 'running' && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold animate-pulse shrink-0">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span className="truncate max-w-[120px] lg:max-w-none">Running: {activeRun.workflowName}</span>
          </div>
        )}
      </div>

      {/* Target Status & Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Antigravity Process Info */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <Terminal size={14} className="text-blue-400" />
          <span className="text-slate-400">Target:</span>
          <span className="font-semibold text-slate-200">
            {agentStatus.targetProcessName}
          </span>
          {agentStatus.targetPid ? (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
              PID {agentStatus.targetPid}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px]">
              Offline
            </span>
          )}
        </div>

        {/* Desktop Station Info */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
          <Cpu size={14} className="text-purple-400" />
          <span>Desktop:</span>
          <span className="font-mono text-slate-200 text-[11px]">{agentStatus.sessionDesktop}</span>
        </div>

        {/* Global Emergency Stop Button */}
        <button
          onClick={handleEmergencyStop}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-600 transition-all text-xs font-bold shadow-sm shadow-rose-900/40 cursor-pointer shrink-0"
          title="Emergency Stop (Hotkey: Ctrl+Alt+S) - Halts all active operations immediately"
        >
          <OctagonAlert size={15} className="shrink-0 animate-pulse text-rose-400 hover:text-white" />
          <span className="inline sm:hidden">Stop</span>
          <span className="hidden sm:inline">Emergency Stop</span>
          <kbd className="hidden md:inline-block text-[10px] bg-rose-950/60 border border-rose-500/30 px-1 rounded text-rose-300 font-mono">
            Ctrl+Alt+S
          </kbd>
        </button>
      </div>
    </header>
  );
};
