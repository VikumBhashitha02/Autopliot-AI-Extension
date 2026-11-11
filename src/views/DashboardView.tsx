import React from 'react';
import {
  Workflow,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Pause,
  Plus,
  Terminal,
  Bot,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
  Activity,
  OctagonAlert,
  Sliders,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const DashboardView: React.FC = () => {
  const {
    workflows,
    runs,
    agentStatus,
    setActiveTab,
    setSelectedWorkflow,
    toggleAutoPilot,
    cancelActiveRun,
    addToast,
  } = useApp();

  const isEnabled = agentStatus.autoPilotEnabled !== false;
  const isRunning = agentStatus.state === 'monitoring' || agentStatus.state === 'running' || agentStatus.state === 'submitting' || agentStatus.state === 'prompt_detected';
  const totalWorkflows = workflows.length;
  const activeWorkflows = workflows.filter((w) => w.enabled).length;
  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;

  const recentRuns = runs.slice(0, 5);
  const recentActions = agentStatus.actionHistory.slice(0, 6);

  const handleEmergencyStop = async () => {
    try {
      if (window.api && window.api.emergencyStop) {
        await window.api.emergencyStop();
      }
      await cancelActiveRun();
      addToast('Emergency Stop Triggered! All operations halted.', 'error');
    } catch (err: any) {
      addToast(`Emergency stop failed: ${err.message}`, 'error');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Top Banner / Automation Status Hero */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/40 border border-blue-500/20 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              System Dashboard
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                isRunning
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400' : 'bg-slate-400'}`} />
              {isRunning ? 'AUTOPILOT RUNNING' : isEnabled ? 'IDLE' : 'PAUSED'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Policy: {agentStatus.approvalPolicy?.toUpperCase().replace('_', ' ') || 'SAFE AUTO'}
            </span>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            AutoPilot AI Control Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Target: <strong className="text-slate-200">{agentStatus.targetWindowTitle || 'Antigravity IDE'}</strong> &bull;{' '}
            {agentStatus.currentStepDescription || 'Listening for confirmation prompts in background'}
          </p>
        </div>

        {/* Quick Automation Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => toggleAutoPilot(!isEnabled)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              isEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {isEnabled ? <Pause size={15} /> : <Play size={15} />}
            <span>{isEnabled ? 'Pause Automation' : 'Start Automation'}</span>
          </button>

          <button
            onClick={handleEmergencyStop}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
            title="Emergency Stop (Ctrl+Alt+S) - Cancel all actions immediately"
          >
            <OctagonAlert size={15} />
            <span>Emergency Stop</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Prompts Detected</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Terminal size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{agentStatus.totalPromptsDetected}</div>
          <span className="text-xs text-slate-400 font-medium">real-time scans</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Auto-Submitted</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">{agentStatus.totalPromptsAutoSubmitted}</div>
          <span className="text-xs text-emerald-400/90 font-medium">zero manual clicks</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Successful Runs</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Workflow size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white">{completedRuns}</div>
          <span className="text-xs text-slate-400 font-medium">workflows verified</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Active Target</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Bot size={16} />
            </div>
          </div>
          <div className="text-base font-bold text-slate-200 truncate">
            {agentStatus.targetProcessName}
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {agentStatus.targetPid ? `PID ${agentStatus.targetPid}` : 'Offline'}
          </span>
        </div>
      </div>

      {/* 2-Column: Recent AutoPilot Actions & Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Real-Time Actions */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              <span>Recent Auto-Completed Actions</span>
            </h3>
            <button
              onClick={() => setActiveTab('autopilot')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <span>Live View</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {recentActions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Bot size={32} className="mx-auto text-slate-600" />
              <p className="text-xs">No automatic actions taken in this session yet.</p>
              <p className="text-[11px] text-slate-600">
                When you run prompts in Antigravity, AutoPilot will automatically handle confirmation dialogs and log them here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActions.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{act.title}</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-semibold border border-blue-500/20">
                          {act.buttonClicked}
                        </span>
                      </div>
                      <span className="text-slate-400 text-[11px] block mt-0.5">
                        Selected: <strong className="text-slate-200">{act.optionSelected}</strong>
                      </span>
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

        {/* Right Column: Workflow Activity */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Workflow size={16} className="text-blue-400" />
              <span>Execution History</span>
            </h3>
            <button
              onClick={() => setActiveTab('monitor')}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <span>Monitor</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {recentRuns.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Clock size={32} className="mx-auto text-slate-600" />
              <p className="text-xs">No workflow executions recorded yet.</p>
              <button
                onClick={() => setActiveTab('prompts')}
                className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all font-semibold"
              >
                Inspect Live Prompt
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        r.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : r.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {r.status === 'completed' ? (
                        <CheckCircle2 size={16} />
                      ) : r.status === 'failed' ? (
                        <XCircle size={16} />
                      ) : (
                        <Activity size={16} className="animate-spin" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white">{r.workflowName}</div>
                      <span className="text-[11px] text-slate-400">
                        Triggered by {r.triggeredBy} &bull; {new Date(r.startTime).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-[11px] font-bold block uppercase ${
                        r.status === 'completed'
                          ? 'text-emerald-400'
                          : r.status === 'failed'
                          ? 'text-rose-400'
                          : 'text-blue-400'
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {r.durationMs ? `${r.durationMs}ms` : 'active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
