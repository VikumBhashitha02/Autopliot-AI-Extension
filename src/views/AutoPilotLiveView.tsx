import React, { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Radio,
  Sparkles,
  Bot,
  Activity,
  Layers,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Eye,
  Check,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AutoPilotLiveView: React.FC = () => {
  const {
    agentStatus,
    toggleAutoPilot,
    setApprovalPolicy,
    setSelectedWindow,
    refreshAvailableWindows,
    triggerAutoSubmitNow,
    clearActionHistory,
    setTargetIdeFilter,
    addToast,
    setActiveTab,
  } = useApp();

  const [isTriggering, setIsTriggering] = useState(false);
  const [isRefreshingWindows, setIsRefreshingWindows] = useState(false);

  const isEnabled = agentStatus.autoPilotEnabled !== false;
  const currentPolicy = agentStatus.approvalPolicy || 'auto_safe_only';
  const isConnected = !!agentStatus.targetPid;

  const handleRefreshWindows = async () => {
    setIsRefreshingWindows(true);
    try {
      await refreshAvailableWindows();
      addToast('Refreshed desktop window list', 'info');
    } finally {
      setIsRefreshingWindows(false);
    }
  };

  const handleTestNow = async () => {
    setIsTriggering(true);
    try {
      const res = await triggerAutoSubmitNow();
      if (res?.reportJson?.PromptFound) {
        addToast(
          `Action performed: ${res.reportJson.SubmitButtonFound || 'Option Selected'} (Status: ${res.reportJson.FinalStatus})`,
          'success'
        );
      } else {
        addToast(
          'Probe completed: No active prompt dialog currently open in target window.',
          'info'
        );
      }
    } catch (err: any) {
      addToast(`Error running test: ${err.message}`, 'error');
    } finally {
      setIsTriggering(false);
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'submitting':
      case 'selecting_option':
      case 'verifying':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
            <Activity size={14} className="animate-spin" /> {state.toUpperCase().replace('_', ' ')}
          </span>
        );
      case 'file_change_detected':
      case 'file_change_analyzing':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 animate-pulse">
            <Eye size={14} /> FILE CHANGES DETECTED
          </span>
        );
      case 'file_change_accepting':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
            <Activity size={14} className="animate-spin" /> ACCEPTING FILE CHANGES
          </span>
        );
      case 'file_change_accepted':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> FILE CHANGES ACCEPTED
          </span>
        );
      case 'file_change_approval_required':
      case 'file_change_ambiguous':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 animate-pulse">
            <AlertCircle size={14} /> FILE CHANGE APPROVAL REQUIRED
          </span>
        );
      case 'prompt_detected':
      case 'analyzing':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 animate-pulse">
            <Eye size={14} /> PROMPT DETECTED
          </span>
        );
      case 'waiting_for_next_prompt':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> PROMPT SUBMITTED — WAITING NEXT
          </span>
        );
      case 'awaiting_approval':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 animate-pulse">
            <AlertCircle size={14} /> APPROVAL REQUIRED
          </span>
        );
      case 'monitoring':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> MONITORING LIVE
          </span>
        );
      case 'paused':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
            <Pause size={14} /> PAUSED
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {state.toUpperCase()}
          </span>
        );
    }
  };

  const stateSteps = [
    { key: 'monitoring', label: 'Monitoring' },
    { key: 'prompt_detected', label: 'Detected' },
    { key: 'analyzing', label: 'Analyzing' },
    { key: 'selecting_option', label: 'Selecting' },
    { key: 'submitting', label: 'Submitting' },
    { key: 'verifying', label: 'Verified' },
  ];

  const getStepIndex = (state: string) => {
    switch (state) {
      case 'monitoring': return 0;
      case 'prompt_detected': return 1;
      case 'analyzing': return 2;
      case 'selecting_option': return 3;
      case 'submitting': return 4;
      case 'verifying':
      case 'waiting_for_next_prompt': return 5;
      default: return 0;
    }
  };

  const currentStepIdx = getStepIndex(agentStatus.state);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Target IDE Environment Selector & Connection */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-4">
        {/* IDE Mode Selector Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Target IDE:</span>
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'auto', label: 'Auto-Detect' },
                { id: 'antigravity', label: 'Antigravity' },
                { id: 'vscode_copilot', label: 'VS Code + Copilot' },
              ].map((ide) => (
                <button
                  key={ide.id}
                  onClick={() => setTargetIdeFilter(ide.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    (agentStatus.targetIdeFilter || 'auto') === ide.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ide.label}
                </button>
              ))}
            </div>
          </div>
          {agentStatus.activeIdeName && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold flex items-center gap-1.5">
              <Bot size={13} /> Active: {agentStatus.activeIdeName}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-4 h-4 rounded-full ${
                  isConnected
                    ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50'
                    : 'bg-amber-500 shadow-lg shadow-amber-500/50'
                }`}
              />
              {isConnected && (
                <div className="absolute w-7 h-7 rounded-full bg-emerald-500/30 animate-ping" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {isConnected
                    ? `${agentStatus.activeIdeName || 'IDE'} Connected`
                    : 'Waiting for Supported IDE Window (Antigravity / VS Code)...'}
                </span>
                {isConnected && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    PID {agentStatus.targetPid}
                  </span>
                )}
                {agentStatus.targetHwnd && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    HWND {agentStatus.targetHwnd}
                  </span>
                )}
                {agentStatus.activeIdeId === 'vscode_copilot' && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Copilot Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {agentStatus.targetWindowTitle || 'Active on Windows Desktop (WinSta0\\Default)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefreshWindows}
              disabled={isRefreshingWindows}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              title="Refresh open Antigravity windows list"
            >
              <RefreshCw size={14} className={isRefreshingWindows ? 'animate-spin text-blue-400' : ''} />
              <span className="hidden sm:inline">Refresh Windows</span>
            </button>

            <button
              onClick={handleTestNow}
              disabled={isTriggering || !isConnected}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-md ${
                isTriggering
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              <Zap size={14} className={isTriggering ? 'animate-spin text-amber-300' : 'text-amber-300'} />
              <span>{isTriggering ? 'Probing Prompt...' : '⚡ Test Prompt Scan'}</span>
            </button>
          </div>
        </div>

        {/* Window Selector if Multiple Antigravity Windows Exist */}
        {agentStatus.availableWindows && agentStatus.availableWindows.length > 1 && (
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-medium shrink-0">Target Window Instance:</span>
            <select
              value={agentStatus.selectedHwnd || ''}
              onChange={(e) => setSelectedWindow(e.target.value ? Number(e.target.value) : null)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-full max-w-lg"
            >
              <option value="">Auto-Detect Active Antigravity Window (Default)</option>
              {agentStatus.availableWindows.map((w) => (
                <option key={w.hwnd} value={w.hwnd}>
                  {w.title} (PID: {w.pid})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Real-Time Workflow State Machine Banner */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Real-Time Automation State
              </span>
              {getStateBadge(agentStatus.state)}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Prompt-to-Result AutoPilot
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {agentStatus.currentStepDescription || 'Continuously monitoring Antigravity IDE confirmation prompts'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleAutoPilot(!isEnabled)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer ${
                isEnabled
                  ? 'bg-rose-600/90 hover:bg-rose-500 text-white shadow-rose-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              {isEnabled ? <Pause size={16} /> : <Play size={16} />}
              <span>{isEnabled ? 'Pause AutoPilot' : 'Start AutoPilot'}</span>
            </button>
          </div>
        </div>

        {/* State Machine Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
          {stateSteps.map((step, idx) => {
            const isCompleted = currentStepIdx > idx;
            const isCurrent = currentStepIdx === idx && agentStatus.state !== 'idle' && agentStatus.state !== 'paused';
            return (
              <div
                key={step.key}
                className={`p-3 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-md shadow-blue-500/10'
                    : isCompleted
                    ? 'bg-slate-900 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {isCompleted ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : isCurrent ? (
                    <Activity size={13} className="animate-spin text-blue-400" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-slate-700 text-[9px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                  )}
                  <span className="text-[11px] font-bold uppercase tracking-wider">{step.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block">
                  {isCurrent ? 'ACTIVE' : isCompleted ? 'DONE' : 'WAIT'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Automation Policy Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders size={16} className="text-blue-400" />
            <span>Select Automation Policy</span>
          </h3>
          <span className="text-xs text-slate-400">Controls how dialogs are confirmed</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Option 1: Safe Auto-Pilot */}
          <div
            onClick={() => setApprovalPolicy('auto_safe_only')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
              currentPolicy === 'auto_safe_only'
                ? 'bg-blue-950/40 border-blue-500 shadow-xl shadow-blue-900/20'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            {currentPolicy === 'auto_safe_only' && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                <Check size={10} /> RECOMMENDED
              </span>
            )}
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <ShieldCheck size={20} />
            </div>
            <h4 className="font-bold text-sm text-white">Safe Auto-Pilot</h4>
            <p className="text-xs text-slate-400 mt-1">
              Automatically selects explicit <strong className="text-slate-200">(Recommended)</strong> options and invokes Submit. Pauses safely for ambiguous prompts.
            </p>
          </div>

          {/* Option 2: Full Auto */}
          <div
            onClick={() => setApprovalPolicy('full_auto')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
              currentPolicy === 'full_auto'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-xl shadow-indigo-900/20'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            {currentPolicy === 'full_auto' && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                <Check size={10} /> ACTIVE
              </span>
            )}
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <Zap size={20} />
            </div>
            <h4 className="font-bold text-sm text-white">Full Autonomous</h4>
            <p className="text-xs text-slate-400 mt-1">
              Unattended prompt completion across multi-turn coding dialogs, backed by non-bypassable destructive command safety guards.
            </p>
          </div>

          {/* Option 3: Always Manual */}
          <div
            onClick={() => setApprovalPolicy('always_manual')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
              currentPolicy === 'always_manual'
                ? 'bg-amber-950/40 border-amber-500 shadow-xl shadow-amber-900/20'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            {currentPolicy === 'always_manual' && (
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Check size={10} /> ACTIVE
              </span>
            )}
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <ShieldAlert size={20} />
            </div>
            <h4 className="font-bold text-sm text-white">Manual Approval</h4>
            <p className="text-xs text-slate-400 mt-1">
              Detects and inspects prompts in the background, but always pauses for your explicit manual approval before clicking Submit.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Prompts Detected</span>
          <div className="text-2xl font-black text-white">{agentStatus.totalPromptsDetected}</div>
          <span className="text-[11px] text-slate-500">Live UIA scans</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Auto-Submitted</span>
          <div className="text-2xl font-black text-emerald-400">{agentStatus.totalPromptsAutoSubmitted}</div>
          <span className="text-[11px] text-emerald-500/80">Zero manual clicks</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Continuous Streak</span>
          <div className="text-2xl font-black text-cyan-400">{agentStatus.consecutivePromptsHandled}</div>
          <span className="text-[11px] text-slate-500">Subsequent prompts</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Latest Action</span>
          <div className="text-sm font-bold text-slate-200 truncate">
            {agentStatus.lastAutoAction?.buttonClicked || 'None yet'}
          </div>
          <span className="text-[11px] text-slate-500 truncate block">
            {agentStatus.lastAutoAction?.optionSelected || 'Awaiting prompt'}
          </span>
        </div>
      </div>

      {/* Action History Feed */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <h3 className="text-sm font-bold text-white">Recent Automation Actions</h3>
          </div>
          {agentStatus.actionHistory.length > 0 && (
            <button
              onClick={clearActionHistory}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear History
            </button>
          )}
        </div>

        {agentStatus.actionHistory.length === 0 ? (
          <div className="py-8 text-center text-slate-500 space-y-2">
            <Bot size={28} className="mx-auto text-slate-600" />
            <p className="text-xs">No prompts handled in this session yet.</p>
            <p className="text-[11px] text-slate-600">
              When Antigravity displays a coding confirmation or option dialog, AutoPilot will automatically select the recommendation and submit it here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {agentStatus.actionHistory.map((act) => (
              <div
                key={act.id}
                className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={15} />
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{act.title}</span>
                      {act.ideName && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {act.ideName}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        act.actionType === 'FILE_CHANGE_ACCEPT_ALL' || act.actionCategory === 'FILE_CHANGE_APPROVAL'
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                          : act.actionCategory === 'TERMINAL_APPROVAL'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {act.buttonClicked}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      {act.actionType === 'FILE_CHANGE_ACCEPT_ALL' && act.fileChangeMetadata?.modifiedFiles?.length ? (
                        <span>Files: <strong className="text-slate-200">{act.fileChangeMetadata.modifiedFiles.slice(0, 3).join(', ')}{act.fileChangeMetadata.modifiedFiles.length > 3 ? '...' : ''}</strong></span>
                      ) : (
                        <span>Selected: <span className="text-slate-200 font-medium">{act.optionSelected}</span></span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] font-mono text-emerald-400 block font-semibold">
                    {act.status}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {act.durationMs}ms &bull; {new Date(act.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
