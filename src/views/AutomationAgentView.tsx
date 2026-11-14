import React, { useState, useEffect } from 'react';
import {
  Bot,
  Play,
  Pause,
  Square,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Monitor,
  Shield,
  Layers,
  Cpu,
  Clock,
  ExternalLink,
  ChevronRight,
  Activity,
  Sliders,
  HelpCircle,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AutomationAgentView: React.FC = () => {
  const {
    agentStatus,
    setAgentStatus,
    toggleAutoPilot,
    setApprovalPolicy,
    setSelectedWindow,
    refreshAvailableWindows,
    setTargetIdeFilter,
    addLog,
    addToast,
    setActiveTab,
  } = useApp();

  const [isScanning, setIsScanning] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);
  const [intervalMs, setIntervalMs] = useState(2000);

  const fetchStatus = async () => {
    try {
      if (window.api) {
        const status = await window.api.getAgentStatus();
        setAgentStatus(status);
      }
    } catch (err: any) {
      console.error('Failed to get agent status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    refreshAvailableWindows();
  }, []);

  const handleStartMonitoring = async () => {
    if (!window.api) return;
    try {
      await window.api.startAgentMonitoring(intervalMs);
      await fetchStatus();
      addToast('Agent real-time monitoring started.', 'success');
      addLog({
        level: 'INFO',
        category: 'AGENT',
        message: `Agent monitoring started with ${intervalMs}ms interval.`,
      });
    } catch (err: any) {
      addToast(`Failed to start monitoring: ${err.message}`, 'error');
    }
  };

  const handleStopMonitoring = async () => {
    if (!window.api) return;
    try {
      await window.api.stopAgentMonitoring();
      await fetchStatus();
      addToast('Agent monitoring stopped.', 'info');
      addLog({
        level: 'INFO',
        category: 'AGENT',
        message: 'Agent monitoring stopped.',
      });
    } catch (err: any) {
      addToast(`Failed to stop monitoring: ${err.message}`, 'error');
    }
  };

  const handleProbeNow = async () => {
    if (!window.api) return;
    setIsProbing(true);
    setProbeResult(null);
    try {
      const res = await window.api.probePrompt();
      setProbeResult(res?.reportJson || res);
      await fetchStatus();
      const detected = res?.reportJson?.PromptFound || res?.promptDetected;
      addToast(
        detected ? 'Active prompt detected in window!' : 'No prompt modal currently visible.',
        detected ? 'success' : 'info'
      );
      addLog({
        level: detected ? 'INFO' : 'DEBUG',
        category: 'PROMPT',
        message: detected
          ? `Probe detected prompt: ${res?.reportJson?.DetectedPromptType || 'Dialog'}`
          : 'Probe: No prompt modal visible.',
        metadata: res,
      });
    } catch (err: any) {
      setProbeResult({ error: err.message || String(err) });
      addToast(`Probe error: ${err.message}`, 'error');
    } finally {
      setIsProbing(false);
    }
  };

  const handleScanWindows = async () => {
    if (!window.api) return;
    setIsScanning(true);
    try {
      const list = await refreshAvailableWindows();
      await window.api.scanTarget();
      await fetchStatus();
      addToast(`Scanned desktop: found ${list.length} target window(s).`, 'info');
    } catch (err: any) {
      addToast(`Window scan error: ${err.message}`, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const isConnected = !!agentStatus.targetPid;
  const isRunning = agentStatus.state === 'monitoring' || agentStatus.state === 'running' || agentStatus.state === 'prompt_detected' || agentStatus.state === 'submitting';

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-6xl mx-auto w-full min-w-0">
      {/* Header and Controls */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Bot size={24} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Automation Agent</h2>
                <span
                  className={`text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    isRunning
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {isRunning ? 'MONITORING ACTIVE' : 'IDLE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xl">
                Continuously tracks Antigravity processes, inspects desktop UIA tree, and auto-submits prompts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            {!isRunning ? (
              <button
                onClick={handleStartMonitoring}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <Play size={14} />
                <span>Start Monitoring</span>
              </button>
            ) : (
              <button
                onClick={handleStopMonitoring}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/30 cursor-pointer"
              >
                <Square size={14} />
                <span>Stop Monitoring</span>
              </button>
            )}

            <button
              onClick={handleProbeNow}
              disabled={isProbing}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <Search size={14} className={isProbing ? 'animate-spin text-cyan-400' : 'text-cyan-400'} />
              <span>{isProbing ? 'Probing...' : 'Probe UI Tree'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-IDE Environments Grid */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Supported IDE Environments</h3>
          </div>
          <span className="text-xs text-slate-400">2 AI Environments Connected &amp; Monitored</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {[
            {
              id: 'antigravity',
              name: 'Antigravity IDE',
              proc: 'Antigravity.exe',
              caps: ['Prompt Submission', 'Option Selection', 'Accept All File Changes', 'Terminal Approval'],
            },
            {
              id: 'vscode_copilot',
              name: 'VS Code + Copilot',
              proc: 'Code.exe',
              caps: ['Copilot Chat Prompts', 'Inline Edit Approvals', 'Apply Changes', 'Terminal Approval'],
            },
          ].map((ide) => {
            const conn = agentStatus.ideConnections?.find((c) => c.ideId === ide.id);
            const isTargetConnected = conn ? conn.connectionStatus === 'connected' : (agentStatus.activeIdeId === ide.id && !!agentStatus.targetPid);
            const pid = conn?.pid || (agentStatus.activeIdeId === ide.id ? agentStatus.targetPid : null);
            const hwnd = conn?.hwnd || (agentStatus.activeIdeId === ide.id ? agentStatus.targetHwnd : null);
            const isFilterActive = agentStatus.targetIdeFilter === ide.id;

            return (
              <div
                key={ide.id}
                className={`p-4 rounded-xl border transition-all ${
                  isFilterActive
                    ? 'bg-blue-950/30 border-blue-500 shadow-md'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    <span>{ide.name}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isTargetConnected
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {isTargetConnected ? 'CONNECTED' : 'STANDBY'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-400 mb-3 font-mono">
                  <div>Process: <span className="text-slate-300">{ide.proc}</span></div>
                  <div>PID: <span className="text-slate-300">{pid || 'None'}</span> &bull; HWND: <span className="text-slate-300">{hwnd || 'Auto'}</span></div>
                  {ide.id === 'vscode_copilot' && (
                    <div className="pt-0.5">
                      Copilot: <span className={`font-semibold ${conn?.copilotStatus === 'connected' ? 'text-purple-400' : 'text-slate-400'}`}>
                        {conn?.copilotStatus === 'connected' ? 'Connected' : conn?.copilotStatus === 'interface_unavailable' ? 'Interface Minimized' : 'Ready'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {ide.caps.map((c, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      {c}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => setTargetIdeFilter(isFilterActive ? 'auto' : ide.id as any)}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isFilterActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {isFilterActive ? 'Active Target Filter' : 'Focus This IDE'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Connection Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor size={18} className="text-blue-400" />
            <h3 className="text-sm font-bold text-white">Target Window Connection</h3>
          </div>
          <button
            onClick={handleScanWindows}
            disabled={isScanning}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
            <span>Scan Windows</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[11px]">Process Status</span>
            <div className="font-bold text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{isConnected ? 'Running' : 'Not Detected'}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">PID: {agentStatus.targetPid || 'None'}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[11px]">Active Window</span>
            <div className="font-bold text-slate-200 truncate" title={agentStatus.targetWindowTitle || ''}>
              {agentStatus.targetWindowTitle || 'None selected'}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">HWND: {agentStatus.targetHwnd || 'Auto'}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[11px]">Interactive Desktop</span>
            <div className="font-bold text-slate-200 font-mono">{agentStatus.sessionDesktop}</div>
            <span className="text-[10px] text-emerald-500">STA Desktop Thread OK</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[11px]">Monitoring Interval</span>
            <div className="font-bold text-slate-200">{intervalMs} ms</div>
            <span className="text-[10px] text-slate-500">Configurable in settings</span>
          </div>
        </div>

        {/* Target Window Instance Dropdown */}
        {agentStatus.availableWindows && agentStatus.availableWindows.length > 0 && (
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-medium">Select Specific Target Window:</span>
            <select
              value={agentStatus.selectedHwnd || ''}
              onChange={(e) => setSelectedWindow(e.target.value ? Number(e.target.value) : null)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-full sm:w-96"
            >
              <option value="">Auto-Detect Active Window (Recommended)</option>
              {agentStatus.availableWindows.map((w) => (
                <option key={w.hwnd} value={w.hwnd}>
                  {w.title} (PID {w.pid})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Troubleshooting Guidance Card */}
      {!isConnected && (
        <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-2.5">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <AlertCircle size={16} />
            <span>Antigravity Window Not Detected — Troubleshooting Guide</span>
          </div>
          <ol className="list-decimal list-inside text-slate-300 space-y-1 leading-relaxed pl-1">
            <li>Ensure <strong>Antigravity IDE</strong> is open on your Windows desktop.</li>
            <li>Click anywhere inside Antigravity so it is brought to the foreground once.</li>
            <li>Click <strong>&quot;Scan Windows&quot;</strong> above to refresh the process list.</li>
            <li>If running with elevated permissions, ensure AutoPilot AI is also run with standard user or administrator rights matching Antigravity.</li>
          </ol>
        </div>
      )}

      {/* Diagnostic Probe Results */}
      {probeResult && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Search size={16} className="text-cyan-400" />
              <span>Diagnostic Probe Output</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">{probeResult.Timestamp || new Date().toISOString()}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Prompt Detected:</span>
              <div className={`font-bold ${probeResult.PromptFound ? 'text-emerald-400' : 'text-slate-400'}`}>
                {probeResult.PromptFound ? 'TRUE' : 'FALSE'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Recommended Marker:</span>
              <div className="font-bold text-slate-200 truncate">{probeResult.ExplicitRecommendedOption || 'None'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Candidate Buttons:</span>
              <div className="font-bold text-slate-200 truncate">
                {probeResult.CandidateSubmitButtons?.length ? probeResult.CandidateSubmitButtons.join(', ') : 'None'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
