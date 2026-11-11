import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Clock,
  CheckCircle2,
  Trash2,
  Database,
  Save,
  Key,
  ShieldCheck,
  Zap,
  Sliders,
  AlertTriangle,
  Info,
  Check,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppSettings } from '../../electron/engine/types';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, addToast, refreshRuns, agentStatus, setSelectedWindow } = useApp();

  const [formSettings, setFormSettings] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    await updateSettings(formSettings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleClearRuns = async () => {
    if (confirm('Are you sure you want to clear all past execution history?')) {
      if (window.api && (window.api as any).clearRuns) {
        await (window.api as any).clearRuns();
      }
      await refreshRuns();
      addToast('Execution history cleared.', 'info');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <SettingsIcon size={26} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Settings &amp; Automation Configuration
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure safe automation thresholds, continuous monitoring, and target application boundaries.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
            savedSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
          }`}
        >
          {savedSuccess ? <CheckCircle2 size={15} /> : <Save size={15} />}
          <span>{savedSuccess ? 'Settings Saved & Applied!' : 'Save & Apply Settings'}</span>
        </button>
      </div>

      {/* Policy Selector with Plain-Language Guidance */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <span>Automation Approval Policy</span>
          </h3>
          <span className="text-xs text-slate-400">Active: {formSettings.approvalPolicy}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Policy 1: Safe Auto-Pilot */}
          <div
            onClick={() => setFormSettings({ ...formSettings, approvalPolicy: 'auto_safe_only' })}
            className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
              formSettings.approvalPolicy === 'auto_safe_only'
                ? 'bg-blue-950/40 border-blue-500 shadow-md text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">Safe Auto-Pilot</span>
              {formSettings.approvalPolicy === 'auto_safe_only' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  RECOMMENDED
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed">
              Automatically selects explicit <strong className="text-slate-200">(Recommended)</strong> options in routine confirmation dialogs and invokes Submit. Pauses safely for ambiguous prompts.
            </p>
          </div>

          {/* Policy 2: Full Auto */}
          <div
            onClick={() => setFormSettings({ ...formSettings, approvalPolicy: 'full_auto' })}
            className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
              formSettings.approvalPolicy === 'full_auto'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-md text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">Full Autonomous</span>
              {formSettings.approvalPolicy === 'full_auto' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed">
              Provides unattended prompt handling across multi-turn workflows. Permanent safeguards prevent destructive commands (rm -rf, format, etc.) regardless of mode.
            </p>
          </div>

          {/* Policy 3: Always Manual */}
          <div
            onClick={() => setFormSettings({ ...formSettings, approvalPolicy: 'always_manual' })}
            className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
              formSettings.approvalPolicy === 'always_manual'
                ? 'bg-amber-950/40 border-amber-500 shadow-md text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">Always Manual</span>
              {formSettings.approvalPolicy === 'always_manual' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed">
              Detects prompts but always pauses for your manual confirmation. Ideal for initial observation before enabling autonomous mode.
            </p>
          </div>
        </div>
      </div>

      {/* File Change Approval Automation */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-cyan-400" />
              <span>File Change Approval Automation</span>
            </h3>
            <p className="text-xs text-slate-400">
              Automatically handle verified Antigravity &apos;Accept all&apos; file-change approval dialogs according to your approval policy.
            </p>
          </div>
          <input
            type="checkbox"
            checked={formSettings.autoAcceptAllFileChanges !== false}
            onChange={(e) =>
              setFormSettings({ ...formSettings, autoAcceptAllFileChanges: e.target.checked })
            }
            className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
          />
        </div>
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          When enabled, AutoPilot AI continuously scans for multi-file modification banners across Antigravity IDE and VS Code + Copilot and invokes <span className="text-slate-200 font-semibold">&quot;Accept all&quot;</span> in accordance with your configured policy (<strong className="text-slate-300">{formSettings.approvalPolicy}</strong>). Destructive actions (<span className="text-rose-400 font-medium">Discard, Reject, Revert</span>) are permanently protected.
        </div>
      </div>

      {/* Multi-IDE Targeting & Preferences */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders size={18} className="text-purple-400" />
          <span>Multi-IDE Targeting &amp; Environment Filter</span>
        </h3>
        <p className="text-xs text-slate-400">
          Control which AI development environments AutoPilot AI monitors and automates.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {[
            { id: 'auto', label: 'Auto-Detect Active IDE', desc: 'Monitors Antigravity or VS Code' },
            { id: 'antigravity', label: 'Antigravity IDE Only', desc: 'Focuses only on Antigravity windows' },
            { id: 'vscode_copilot', label: 'VS Code + Copilot Only', desc: 'Focuses only on VS Code with Copilot' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFormSettings({ ...formSettings, targetIdeFilter: item.id as any })}
              className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer ${
                (formSettings.targetIdeFilter || 'auto') === item.id
                  ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                  : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-xs text-white">{item.label}</div>
              <div className="text-[11px] text-slate-400 mt-1">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Target Application & Window Instance Preferences */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders size={18} className="text-blue-400" />
          <span>Target Instance &amp; Monitoring Settings</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Target Window Instance */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="font-bold text-white block">Selected Antigravity Window</span>
            <span className="text-[11px] text-slate-400 block">
              Choose which Antigravity window to target when multiple instances or projects are open.
            </span>
            <select
              value={formSettings.selectedWindowHwnd || ''}
              onChange={(e) => {
                const hwnd = e.target.value ? Number(e.target.value) : null;
                setFormSettings({ ...formSettings, selectedWindowHwnd: hwnd });
                setSelectedWindow(hwnd);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Auto-Detect Active Window (Default)</option>
              {agentStatus.availableWindows?.map((w) => (
                <option key={w.hwnd} value={w.hwnd}>
                  {w.title} (PID: {w.pid})
                </option>
              ))}
            </select>
          </div>

          {/* Monitoring Interval */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Execution Timeout (seconds)</span>
              <span className="font-mono text-blue-400 font-bold">{formSettings.defaultTimeoutSeconds}s</span>
            </div>
            <span className="text-[11px] text-slate-400 block">
              Maximum wait time for a prompt or submit step before triggering a timeout alert.
            </span>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={formSettings.defaultTimeoutSeconds}
              onChange={(e) =>
                setFormSettings({ ...formSettings, defaultTimeoutSeconds: Number(e.target.value) })
              }
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Safety Guardrails and Log Redaction */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield size={18} className="text-purple-400" />
          <span>Security Controls &amp; Data Protection</span>
        </h3>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="font-bold text-white block">Redact Sensitive Information in Logs</span>
              <span className="text-[11px] text-slate-400">
                Automatically masks passwords, API tokens, and private secrets from logs and diagnostic reports.
              </span>
            </div>
            <input
              type="checkbox"
              checked={formSettings.redactSensitiveData}
              onChange={(e) =>
                setFormSettings({ ...formSettings, redactSensitiveData: e.target.checked })
              }
              className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="font-bold text-white block">Emergency Stop Hotkey</span>
              <span className="text-[11px] text-slate-400">
                Global Windows keyboard shortcut that immediately cancels all active automation.
              </span>
            </div>
            <kbd className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-mono text-xs font-bold">
              {formSettings.emergencyStopShortcut || 'Ctrl+Alt+S'}
            </kbd>
          </div>
        </div>
      </div>

      {/* Storage and Cleanup */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md flex items-center justify-between">
        <div>
          <span className="font-bold text-sm text-white block">Clear Execution History</span>
          <span className="text-xs text-slate-400">
            Purges past run records from local storage. Workflow templates remain preserved.
          </span>
        </div>
        <button
          onClick={handleClearRuns}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
        >
          <Trash2 size={14} />
          <span>Clear History</span>
        </button>
      </div>
    </div>
  );
};
