import React, { useState } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Play,
  RefreshCw,
  Sparkles,
  MousePointer,
  Layers,
  FileCode,
  ShieldAlert,
  Search,
  Check,
  Zap,
  Info,
  FileText,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const PromptManagerView: React.FC = () => {
  const { addLog, requestApproval, addToast, agentStatus, inspectIde } = useApp();

  const [selectedIde, setSelectedIde] = useState<string>(agentStatus.activeIdeId || 'antigravity');
  const [inspecting, setInspecting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [promptData, setPromptData] = useState<any>(null);
  const [completionResult, setCompletionResult] = useState<any>(null);
  const [selectedRadioIndex, setSelectedRadioIndex] = useState<number | null>(null);
  const [targetPattern, setTargetPattern] = useState<string>('(Recommended)');

  const [inspectingFileChanges, setInspectingFileChanges] = useState(false);
  const [testingAcceptAll, setTestingAcceptAll] = useState(false);
  const [fileChangeData, setFileChangeData] = useState<any>(null);
  const [testDetectionResult, setTestDetectionResult] = useState<any>(null);

  const handleInspectFileChanges = async () => {
    if (!window.api || !window.api.inspectFileChanges) return;
    setInspectingFileChanges(true);
    setTestDetectionResult(null);
    try {
      const res = await window.api.inspectFileChanges();
      setFileChangeData(res);
      addToast(
        res?.fileChangeApprovalFound
          ? `File change approval interface detected! (${res.modifiedFiles?.length || 0} file(s))`
          : 'No file-change approval controls currently active in Antigravity.',
        res?.fileChangeApprovalFound ? 'success' : 'info'
      );
      addLog({
        level: res?.fileChangeApprovalFound ? 'INFO' : 'DEBUG',
        category: 'FILE_CHANGE',
        message: res?.fileChangeApprovalFound
          ? `Detected 'Accept all' file change approval banner with ${res.modifiedFiles?.length || 0} modified files.`
          : 'File change inspection completed: no pending approval banner found.',
        metadata: res,
      });
    } catch (err: any) {
      addToast(`File change inspection failed: ${err.message}`, 'error');
    } finally {
      setInspectingFileChanges(false);
    }
  };

  const handleTestAcceptAllDetection = async () => {
    if (!window.api || !window.api.testAcceptAllDetection) return;
    setTestingAcceptAll(true);
    try {
      const res = await window.api.testAcceptAllDetection();
      setTestDetectionResult(res);
      setFileChangeData(res);
      addToast(
        res?.fileChangeApprovalFound
          ? `[Read-Only Test] Verified actionable button: '${res.buttonFound?.name}'. Nothing was clicked.`
          : '[Read-Only Test] No candidate button detected in target window.',
        res?.fileChangeApprovalFound ? 'success' : 'info'
      );
    } catch (err: any) {
      addToast(`Test detection failed: ${err.message}`, 'error');
    } finally {
      setTestingAcceptAll(false);
    }
  };

  const handleInspectPrompt = async () => {
    if (!window.api) return;
    setInspecting(true);
    setCompletionResult(null);
    try {
      const res = await window.api.runDiagnosticInspect(0);
      const report = res?.reportJson || res;
      const options = (report?.OptionsIdentified || report?.radioButtons || []).map((o: any) => {
        if (typeof o === 'string') {
          return {
            name: o,
            isRecommended: o.includes('(Recommended)') || o.includes('[Recommended]'),
          };
        }
        return {
          name: o.Name || o.name || '',
          isRecommended: !!(
            o.IsRecommended ??
            o.isRecommended ??
            ((o.Name || o.name || '').includes('(Recommended)') ||
             (o.Name || o.name || '').includes('[Recommended]'))
          ),
          controlType: o.ControlType || o.controlType || 'Option',
        };
      });

      const normalized = {
        promptDetected: !!(report?.PromptFound ?? report?.promptDetected),
        detectedPromptType: report?.DetectedPromptType || report?.detectedPromptType || 'None',
        targetProcessName: report?.WindowTitle || report?.targetProcessName || 'Antigravity IDE',
        promptBounds: report?.ContainerBoundingRect || report?.promptBounds || 'Active Modal Container',
        radioButtons: options,
        explicitRecommendation: report?.ExplicitRecommendedOption || 'None',
        candidateSubmitButtons: (
          report?.CandidateSubmitButtons ||
          report?.candidateSubmitButtons ||
          []
        ).map((b: any) => (typeof b === 'string' ? { name: b } : b)),
        candidateCancelButtons: (
          report?.CandidateCancelButtons ||
          report?.candidateCancelButtons ||
          []
        ).map((b: any) => (typeof b === 'string' ? { name: b } : b)),
        rawReport: report,
        summary: res?.summaryText,
      };

      setPromptData(normalized);
      addLog({
        level: normalized.promptDetected ? 'INFO' : 'DEBUG',
        category: 'PROMPT',
        message: normalized.promptDetected
          ? `Detected prompt modal with ${normalized.radioButtons.length} options (Recommended: ${normalized.explicitRecommendation}).`
          : 'Prompt inspection completed: no active prompt modal found.',
        metadata: normalized,
      });

      if (normalized.radioButtons.length > 0) {
        const recIdx = normalized.radioButtons.findIndex((r: any) => r.isRecommended);
        if (recIdx !== -1) {
          setSelectedRadioIndex(recIdx);
          setTargetPattern(normalized.radioButtons[recIdx].name);
        } else {
          setSelectedRadioIndex(0);
          setTargetPattern(normalized.radioButtons[0].name);
        }
      }

      addToast(
        normalized.promptDetected
          ? `Prompt detected: ${normalized.detectedPromptType}`
          : 'No confirmation dialog currently open in Antigravity.',
        normalized.promptDetected ? 'success' : 'info'
      );
    } catch (err: any) {
      addToast(`Inspection failed: ${err.message}`, 'error');
    } finally {
      setInspecting(false);
    }
  };

  const handleCompletePrompt = async () => {
    if (!window.api) return;
    setCompleting(true);
    setCompletionResult(null);
    try {
      const res = await window.api.runDiagnosticComplete(targetPattern, 0);
      const rep = res?.reportJson || res;
      const isSuccess =
        rep?.FinalStatus === 'COMPLETED_SUCCESSFULLY' ||
        rep?.FinalStatus === 'SUBMITTED_WAITING_RESPONSE' ||
        rep?.FinalStatus === 'OPTION_SELECTED_NO_SUBMIT_BUTTON';

      const isClosed = rep?.DialogClosedAfterAction ?? isSuccess;

      const normCompletion = {
        success: isSuccess,
        finalStatus: rep?.FinalStatus || 'COMPLETED',
        optionSelected: rep?.TargetOptionFound || targetPattern,
        submitInvoked: rep?.SubmitButtonFound || 'Submit',
        actionTakenOnOption: rep?.ActionTakenOnOption || 'Select',
        actionTakenOnSubmit: rep?.ActionTakenOnSubmit || 'Invoke',
        verifiedDismissed: isClosed,
        logs: rep?.Logs || [],
      };

      setCompletionResult(normCompletion);
      addToast(
        isSuccess ? 'Prompt completed and verified successfully!' : `Completion status: ${normCompletion.finalStatus}`,
        isSuccess ? 'success' : 'warning'
      );

      // Re-inspect to refresh prompt view
      setTimeout(handleInspectPrompt, 500);
    } catch (err: any) {
      addToast(`Completion failed: ${err.message}`, 'error');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-6xl mx-auto w-full min-w-0">
      {/* Header and Probe Bar */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <MessageSquare size={22} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Prompt Manager</h2>
              <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Policy: {agentStatus.approvalPolicy?.toUpperCase().replace('_', ' ') || 'SAFE AUTO'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xl">
              Inspect accessible options, recommended markers, and verified submit button actions in real-time.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <select
            value={selectedIde}
            onChange={(e) => setSelectedIde(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-blue-500 flex-1 sm:flex-none"
          >
            <option value="antigravity">Antigravity IDE</option>
            <option value="vscode_copilot">VS Code + Copilot</option>
          </select>

          <button
            onClick={handleInspectPrompt}
            disabled={inspecting}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            <Search size={15} className={inspecting ? 'animate-spin' : ''} />
            <span>{inspecting ? `Inspecting ${selectedIde === 'vscode_copilot' ? 'VS Code' : 'Antigravity'}...` : 'Inspect Live Prompt'}</span>
          </button>
        </div>
      </div>

      {/* Main Inspection View */}
      {promptData ? (
        <div className="space-y-6">
          {/* Status & Container Overview Card */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Detection Status
              </span>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                  promptData.promptDetected
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {promptData.promptDetected ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {promptData.promptDetected ? 'ACTIVE PROMPT DETECTED' : 'NO DIALOG DETECTED'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 text-[11px]">Prompt Type</span>
                <div className="font-bold text-slate-200">{promptData.detectedPromptType}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 text-[11px]">Recommended Option</span>
                <div className="font-bold text-emerald-400 truncate">
                  {promptData.explicitRecommendation !== 'None' ? promptData.explicitRecommendation : 'None marked'}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 text-[11px]">Automatic Handling</span>
                <div className="font-bold text-slate-200">
                  {agentStatus.autoPilotEnabled ? 'Enabled (AutoPilot Active)' : 'Paused'}
                </div>
              </div>
            </div>
          </div>

          {/* Options List */}
          {promptData.promptDetected && promptData.radioButtons?.length > 0 && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  <span>Available Options ({promptData.radioButtons.length})</span>
                </h3>
                <span className="text-xs text-slate-400">Click to preview option target</span>
              </div>

              <div className="space-y-2.5">
                {promptData.radioButtons.map((opt: any, idx: number) => {
                  const isSelected = selectedRadioIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedRadioIndex(idx);
                        setTargetPattern(opt.name);
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 text-white shadow-md'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-blue-400 bg-blue-500 text-white'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                        <div>
                          <span className="text-xs font-semibold block">{opt.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Type: {opt.controlType || 'Option'}
                          </span>
                        </div>
                      </div>

                      {opt.isRecommended && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shrink-0 flex items-center gap-1">
                          <Check size={10} /> RECOMMENDED
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons and Submit Trigger */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Detected Action Buttons:</span>
                  {promptData.candidateSubmitButtons?.length > 0 ? (
                    promptData.candidateSubmitButtons.map((b: any, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20"
                      >
                        {b.name || 'Submit'}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">None detected</span>
                  )}
                </div>

                <button
                  onClick={handleCompletePrompt}
                  disabled={completing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  <Play size={14} className={completing ? 'animate-spin' : ''} />
                  <span>{completing ? 'Executing Selection & Submit...' : 'Select & Submit This Prompt'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Completion Verification Outcome */}
          {completionResult && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>Execution &amp; Verification Outcome</span>
                </h3>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  {completionResult.finalStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Selected Option</span>
                  <div className="font-bold text-slate-200 truncate">{completionResult.optionSelected}</div>
                  <span className="text-[10px] text-slate-500">{completionResult.actionTakenOnOption}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Invoked Action</span>
                  <div className="font-bold text-slate-200 truncate">{completionResult.submitInvoked}</div>
                  <span className="text-[10px] text-slate-500">{completionResult.actionTakenOnSubmit}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">Dialog Dismissed</span>
                  <div className={`font-bold ${completionResult.verifiedDismissed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {completionResult.verifiedDismissed ? 'VERIFIED CLOSED' : 'IN TRANSITION'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <MessageSquare size={36} className="mx-auto text-slate-600" />
          <h3 className="text-sm font-bold text-white">No Diagnostic Inspection Captured Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click &quot;Inspect Live Prompt&quot; above to scan Antigravity IDE for active recommendation and confirmation dialogs.
          </p>
        </div>
      )}

      {/* File Change Approval Inspector Subsection */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-white">File Change Approval Inspector</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  ANTIGRAVITY UIA
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xl">
                Inspect multi-file edit review banners and candidate &quot;Accept all&quot; approval controls.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleInspectFileChanges}
              disabled={inspectingFileChanges}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer border border-slate-700 shadow-sm"
              title="Perform completely read-only UI Automation inspection of file-change controls"
            >
              <Search size={14} className={inspectingFileChanges ? 'animate-spin text-cyan-400' : 'text-cyan-400'} />
              <span>{inspectingFileChanges ? 'Inspecting...' : 'Inspect File Changes'}</span>
            </button>

            <button
              onClick={handleTestAcceptAllDetection}
              disabled={testingAcceptAll}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/30 cursor-pointer"
              title="Test detection and verify what would be clicked, without actually clicking anything"
            >
              <Eye size={14} className={testingAcceptAll ? 'animate-spin' : ''} />
              <span>{testingAcceptAll ? 'Testing...' : 'Test Accept All Detection'}</span>
            </button>
          </div>
        </div>

        {fileChangeData ? (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px]">Detection Status</span>
                <div className="font-bold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${fileChangeData.fileChangeApprovalFound ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  <span className={fileChangeData.fileChangeApprovalFound ? 'text-emerald-400' : 'text-slate-400'}>
                    {fileChangeData.fileChangeApprovalFound ? 'PENDING APPROVAL FOUND' : 'NO CONTROLS ACTIVE'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px]">Confidence &amp; Safety</span>
                <div className="font-bold">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    fileChangeData.confidence === 'HIGH'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : fileChangeData.confidence === 'MEDIUM'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {fileChangeData.confidence} {fileChangeData.isAmbiguous ? '(AMBIGUOUS)' : ''}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px]">Target Window</span>
                <div className="font-bold text-slate-200 truncate">{fileChangeData.windowTitle || agentStatus.targetWindowTitle || 'Antigravity IDE'}</div>
                <span className="text-[10px] text-slate-500 font-mono">HWND {fileChangeData.targetHwnd || agentStatus.targetHwnd} &bull; PID {fileChangeData.processId || agentStatus.targetPid}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px]">Modified Files</span>
                <div className="font-bold text-cyan-400">{fileChangeData.modifiedFiles?.length || 0} file(s) detected</div>
                <span className="text-[10px] text-slate-500">In review container</span>
              </div>
            </div>

            {/* Candidate Button and Container Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <MousePointer size={14} className="text-cyan-400" />
                  <span>Detected Actionable Button</span>
                </span>
                {fileChangeData.buttonFound ? (
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-0.5 border-b border-slate-900">
                      <span className="text-slate-400">Name:</span>
                      <span className="font-bold text-white">{fileChangeData.buttonFound.name}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-900">
                      <span className="text-slate-400">Control Type:</span>
                      <span className="font-mono text-slate-300">{fileChangeData.buttonFound.controlType}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-900">
                      <span className="text-slate-400">Bounding Box:</span>
                      <span className="font-mono text-slate-300">{fileChangeData.buttonFound.boundingRectangle || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Supports Invoke:</span>
                      <span className={fileChangeData.buttonFound.supportsInvoke ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {fileChangeData.buttonFound.supportsInvoke ? 'YES (Actionable)' : 'NO'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-[11px]">No candidate button matching &quot;Accept all&quot; found.</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-400" />
                  <span>Associated Container &amp; Actions</span>
                </span>
                {fileChangeData.container ? (
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-0.5 border-b border-slate-900">
                      <span className="text-slate-400">Container Class:</span>
                      <span className="font-mono text-slate-300">{fileChangeData.container.className || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-slate-900">
                      <span className="text-slate-400">Container Bounds:</span>
                      <span className="font-mono text-slate-300">{fileChangeData.container.boundingRectangle || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-400">Sibling Actions:</span>
                      <span className="text-slate-300">{fileChangeData.siblingActions?.join(', ') || 'None'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-[11px]">No associated review container identified.</p>
                )}
              </div>
            </div>

            {/* Modified Files List */}
            {fileChangeData.modifiedFiles && fileChangeData.modifiedFiles.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 block">Identified Modified Files:</span>
                <div className="flex flex-wrap gap-1.5">
                  {fileChangeData.modifiedFiles.map((file: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono text-[11px]"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Read-Only Test Feedback Card */}
            {testDetectionResult && (
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Eye size={16} />
                  <span>Read-Only Test Result</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {testDetectionResult.fileChangeApprovalFound
                    ? `Detection verified: In a live AutoPilot cycle with policy '${agentStatus.approvalPolicy}', AutoPilot would target button "${testDetectionResult.buttonFound?.name}" inside container "${testDetectionResult.container?.className}". This test did NOT execute the click.`
                    : 'No pending file change approval interface detected. Nothing would be invoked.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-500 text-xs">
            Click &quot;Inspect File Changes&quot; to probe Antigravity IDE for active multi-file change approval banners.
          </div>
        )}
      </div>
    </div>
  );
};
