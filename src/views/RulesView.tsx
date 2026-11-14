import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  Check,
  Clock,
  Zap,
  MousePointer,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const RulesView: React.FC = () => {
  const { agentStatus, changeAutoSubmitDelay, addToast } = useApp();

  const [currentDelay, setCurrentDelay] = useState(agentStatus.autoSubmitDelayMs || 250);
  const [allowRunCommands, setAllowRunCommands] = useState(true);
  const [allowConfirmationDialogs, setAllowConfirmationDialogs] = useState(true);
  const [preferRecommended, setPreferRecommended] = useState(true);
  const [playAudioChime, setPlayAudioChime] = useState(false);

  const handleSaveDelay = async (val: number) => {
    setCurrentDelay(val);
    await changeAutoSubmitDelay(val);
    addToast(`Response delay set to ${val}ms.`, 'success');
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-4xl mx-auto w-full min-w-0">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <Sliders size={22} className="text-blue-400 shrink-0" />
          <span>AutoPilot Rules &amp; Automation Preferences</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Configure how AutoPilot AI detects choices, handles confirmation buttons, and behaves during Antigravity tasks.
        </p>
      </div>

      {/* Response Speed & Delay */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Clock size={18} className="text-cyan-400" />
              <span>Auto-Submit Response Speed</span>
            </h2>
            <p className="text-xs text-slate-400">
              Delay before clicking the submit button once a prompt appears
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {currentDelay}ms
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {[
            { label: 'Instant', ms: 100, desc: 'Zero delay (0.1s)' },
            { label: 'Fast (Default)', ms: 250, desc: 'Responsive (0.25s)' },
            { label: 'Comfortable', ms: 750, desc: 'Slight pause (0.75s)' },
            { label: 'Deliberate', ms: 1500, desc: 'Inspectable (1.5s)' },
          ].map((item) => (
            <button
              key={item.ms}
              onClick={() => handleSaveDelay(item.ms)}
              className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer ${
                currentDelay === item.ms
                  ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                  : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-xs text-white">{item.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Option Selection Strategy */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 min-w-0">
        <div className="space-y-0.5">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <span>Option Selection Intelligence</span>
          </h2>
          <p className="text-xs text-slate-400">
            How AutoPilot selects choices when Antigravity offers multiple solutions
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 cursor-pointer hover:bg-slate-950/80 transition-colors">
            <input
              type="checkbox"
              checked={preferRecommended}
              onChange={(e) => setPreferRecommended(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
            <div className="space-y-0.5 min-w-0">
              <span className="text-xs font-semibold text-white block">
                Prioritize (Recommended) Solution Badges
              </span>
              <span className="text-[11px] text-slate-400 block leading-relaxed break-words">
                Automatically identifies markers like <code className="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">(Recommended)</code>, <code className="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">Yes, allow this time</code>, or <code className="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">Option 1</code>.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 cursor-pointer hover:bg-slate-950/80 transition-colors">
            <input
              type="checkbox"
              checked={allowRunCommands}
              onChange={(e) => setAllowRunCommands(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
            <div className="space-y-0.5 min-w-0">
              <span className="text-xs font-semibold text-white block">
                Auto-Submit Terminal Execution Prompts
              </span>
              <span className="text-[11px] text-slate-400 block leading-relaxed break-words">
                Automatically approves prompts asking to run non-destructive terminal inspection or diagnostic commands.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Button Matching Rules */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 min-w-0">
        <div className="space-y-0.5">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <MousePointer size={18} className="text-emerald-400" />
            <span>Candidate Button Matching Rules</span>
          </h2>
          <p className="text-xs text-slate-400">
            Action buttons approved for automated submission
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
          {[
            { label: 'Submit / Submit ↵ / Send', cat: 'PROMPT_SUBMISSION' },
            { label: 'Continue / Proceed', cat: 'CONTINUE_APPROVAL' },
            { label: 'Allow / Allow this time / Approve', cat: 'PERMISSION_APPROVAL' },
            { label: 'Yes, allow this time / Confirm', cat: 'CONFIRMATION' },
            { label: 'Accept all / Accept all changes', cat: 'FILE_CHANGE_APPROVAL' },
            { label: 'Accept all files / Apply changes', cat: 'FILE_CHANGE_APPROVAL' },
            { label: 'Run / Run command / Run in terminal', cat: 'TERMINAL_APPROVAL' },
            { label: 'Apply / Accept', cat: 'FILE_CHANGE_APPROVAL' },
          ].map((btn, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-slate-300"
            >
              <span className="truncate text-[11px]">{btn.label}</span>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0 ml-1">
                {btn.cat}
              </span>
            </div>
          ))}
        </div>

        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed">
          <ShieldCheck size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span>
            Permanent Safety Lock: Negative and destructive buttons such as <strong>Discard</strong>, <strong>Reject</strong>, <strong>Revert</strong>, <strong>Cancel</strong>, <strong>No</strong>, <strong>Don&apos;t Save</strong>, and <strong>Delete</strong> are permanently blocked across all IDEs and will never be invoked.
          </span>
        </div>
      </div>
    </div>
  );
};
