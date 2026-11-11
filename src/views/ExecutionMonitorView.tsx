import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  Layers,
  Terminal,
  ShieldAlert,
  ChevronRight,
  Eye,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WorkflowExecutionRecord, StepExecutionResult } from '../../electron/engine/types';

export const ExecutionMonitorView: React.FC = () => {
  const { activeRun, runs, cancelActiveRun, executeWorkflow, agentStatus } = useApp();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const displayRun: WorkflowExecutionRecord | undefined =
    (selectedRunId ? runs.find((r) => r.id === selectedRunId) : activeRun) ||
    (runs.length > 0 ? runs[0] : undefined);

  useEffect(() => {
    if (activeRun) {
      setSelectedRunId(activeRun.id);
    }
  }, [activeRun?.id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayRun?.logs?.length]);

  const handleEmergencyStop = async () => {
    if (window.api && (window.api as any).emergencyStop) {
      await (window.api as any).emergencyStop();
    }
    await cancelActiveRun();
  };

  const handleReRun = async () => {
    if (!displayRun) return;
    await executeWorkflow(displayRun.workflowId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 animate-pulse">
            <Activity size={13} className="animate-spin" /> RUNNING
          </span>
        );
      case 'completed':
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 size={13} /> COMPLETED
          </span>
        );
      case 'failed':
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
            <XCircle size={13} /> FAILED
          </span>
        );
      case 'cancelled':
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
            <Square size={13} /> CANCELLED
          </span>
        );
      default:
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  const stepList: StepExecutionResult[] = displayRun?.stepResults
    ? Object.values(displayRun.stepResults)
    : [];

  // Lifecycle Timeline Steps for End-to-End Prompt Automation
  const timelineStages = [
    { label: 'Time Detected', desc: 'Scan matched interactive dialog' },
    { label: 'Dialog Analyzed', desc: 'Options & recommendation mapped' },
    { label: 'Option Selected', desc: 'Recommendation selected & verified' },
    { label: 'Submit Invoked', desc: 'Verified button pattern executed' },
    { label: 'Result Verified', desc: 'Dialog dismissed from desktop' },
    { label: 'Continuous Flow', desc: 'Listening for next task or prompt' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Activity size={26} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight">Execution Monitor</h2>
              {displayRun && getStatusBadge(displayRun.status)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active run: <strong className="text-slate-200">{displayRun?.workflowName || 'No active run'}</strong> &bull;{' '}
              Target: {agentStatus.targetWindowTitle || 'Antigravity IDE'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {displayRun && displayRun.status === 'running' && (
            <button
              onClick={handleEmergencyStop}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer"
            >
              <Square size={14} />
              <span>Cancel Run</span>
            </button>
          )}

          {displayRun && (
            <button
              onClick={handleReRun}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Re-Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-Time Prompt-to-Result Automation Timeline */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            <span>Prompt-to-Result Verification Timeline</span>
          </h3>
          <span className="text-xs text-slate-400">Real-time Windows UIA Lifecycle</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {timelineStages.map((stage, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1 relative"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="truncate">{stage.label}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">{stage.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Execution Split View: Steps & Live Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step Results Card */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers size={16} className="text-blue-400" />
              <span>Workflow Steps ({stepList.length})</span>
            </h3>
            {displayRun && (
              <span className="text-xs text-slate-400 font-mono">
                Duration: {displayRun.durationMs || 0} ms
              </span>
            )}
          </div>

          {stepList.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No steps executed in this run.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {stepList.map((step) => (
                <div
                  key={step.stepId}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        step.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : step.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {step.status === 'completed' ? (
                        <CheckCircle2 size={15} />
                      ) : step.status === 'failed' ? (
                        <XCircle size={15} />
                      ) : (
                        <Activity size={15} className="animate-spin" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white">{step.stepName}</div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Type: {step.type} &bull; Retries: {step.retryCount}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-[11px] font-bold block uppercase ${
                        step.status === 'completed'
                          ? 'text-emerald-400'
                          : step.status === 'failed'
                          ? 'text-rose-400'
                          : 'text-blue-400'
                      }`}
                    >
                      {step.status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {step.durationMs ? `${step.durationMs}ms` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Execution Logs */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 flex flex-col h-[480px]">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal size={16} className="text-emerald-400" />
              <span>Real-Time Logs &amp; Diagnostics</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {displayRun?.logs?.length || 0} entries
            </span>
          </div>

          <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-mono text-xs overflow-y-auto space-y-2">
            {!displayRun?.logs || displayRun.logs.length === 0 ? (
              <span className="text-slate-600 block py-6 text-center">
                Waiting for execution logs...
              </span>
            ) : (
              displayRun.logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 select-none text-[10px] shrink-0 pt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`text-[10px] px-1 rounded uppercase font-bold shrink-0 ${
                      log.level === 'error'
                        ? 'bg-rose-500/20 text-rose-400'
                        : log.level === 'warn'
                        ? 'bg-amber-500/20 text-amber-400'
                        : log.level === 'debug'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span
                    className={`break-all ${
                      log.level === 'error'
                        ? 'text-rose-300'
                        : log.level === 'warn'
                        ? 'text-amber-200'
                        : 'text-slate-300'
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
