import React from 'react';
import { OctagonAlert, ShieldCheck, Cpu, Terminal, Play, Bell } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TopBar: React.FC = () => {
  const { activeTab, agentStatus, activeRun, cancelExecution, addToast } = useApp();

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
    <header className="h-16 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md px-6 flex items-center justify-between z-20">
      {/* Title & View Info */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight text-white">{getTitle()}</h1>
        {activeRun && activeRun.status === 'running' && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>Running: {activeRun.workflowName}</span>
          </div>
        )}
      </div>

      {/* Target Status & Actions */}
      <div className="flex items-center gap-3">
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
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-600 transition-all text-xs font-bold shadow-sm shadow-rose-900/40 cursor-pointer"
          title="Emergency Stop (Hotkey: Ctrl+Alt+S) - Halts all active operations immediately"
        >
          <OctagonAlert size={15} className="shrink-0 animate-pulse text-rose-400 hover:text-white" />
          <span>Emergency Stop</span>
          <kbd className="hidden sm:inline-block text-[10px] bg-rose-950/60 border border-rose-500/30 px-1 rounded text-rose-300 font-mono">
            Ctrl+Alt+S
          </kbd>
        </button>
      </div>
    </header>
  );
};
