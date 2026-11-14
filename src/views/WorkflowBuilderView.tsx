import React, { useState } from 'react';
import {
  Workflow as WorkflowIcon,
  Play,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  MousePointer,
  HelpCircle,
  Code2,
  Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WorkflowDefinition, WorkflowStep, StepType } from '../../electron/engine/types';

export const WorkflowBuilderView: React.FC = () => {
  const {
    workflows,
    selectedWorkflow,
    setSelectedWorkflow,
    saveWorkflow,
    executeWorkflow,
    setActiveTab,
    addToast,
  } = useApp();

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentWorkflow: WorkflowDefinition | undefined =
    selectedWorkflow || (workflows.length > 0 ? workflows[0] : undefined);

  const selectedStep: WorkflowStep | undefined = currentWorkflow?.steps.find(
    (s) => s.id === selectedStepId
  );

  const handleUpdateWorkflowMeta = (updates: Partial<WorkflowDefinition>) => {
    if (!currentWorkflow) return;
    const updated: WorkflowDefinition = {
      ...currentWorkflow,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setSelectedWorkflow(updated);
    setDirty(true);
  };

  const handleUpdateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    if (!currentWorkflow) return;
    const newSteps = currentWorkflow.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s));
    const updated: WorkflowDefinition = {
      ...currentWorkflow,
      steps: newSteps,
      updatedAt: new Date().toISOString(),
    };
    setSelectedWorkflow(updated);
    setDirty(true);
  };

  const handleAddStep = () => {
    if (!currentWorkflow) return;
    const newId = `step_${Date.now()}`;
    const newStep: WorkflowStep = {
      id: newId,
      name: `Step ${currentWorkflow.steps.length + 1}`,
      type: 'detect_prompt',
      enabled: true,
      timeoutSeconds: 15,
      retryLimit: 1,
      config: {
        processName: 'Antigravity IDE',
        delaySeconds: 1,
        targetOptionSubstring: '(Recommended)',
      },
    };
    const updated: WorkflowDefinition = {
      ...currentWorkflow,
      steps: [...currentWorkflow.steps, newStep],
      updatedAt: new Date().toISOString(),
    };
    setSelectedWorkflow(updated);
    setSelectedStepId(newId);
    setDirty(true);
  };

  const handleDeleteStep = (stepId: string) => {
    if (!currentWorkflow) return;
    const newSteps = currentWorkflow.steps.filter((s) => s.id !== stepId);
    const updated: WorkflowDefinition = {
      ...currentWorkflow,
      steps: newSteps,
      updatedAt: new Date().toISOString(),
    };
    setSelectedWorkflow(updated);
    if (selectedStepId === stepId) {
      setSelectedStepId(newSteps[0]?.id || null);
    }
    setDirty(true);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (!currentWorkflow) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentWorkflow.steps.length) return;
    const newSteps = [...currentWorkflow.steps];
    const [moved] = newSteps.splice(index, 1);
    newSteps.splice(newIndex, 0, moved);
    const updated: WorkflowDefinition = {
      ...currentWorkflow,
      steps: newSteps,
      updatedAt: new Date().toISOString(),
    };
    setSelectedWorkflow(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!currentWorkflow) return;
    await saveWorkflow(currentWorkflow);
    setDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleRunFullWorkflow = async () => {
    if (!currentWorkflow) return;
    if (dirty) {
      await handleSave();
    }
    await executeWorkflow(currentWorkflow.id);
    setActiveTab('monitor');
  };

  const getStepIcon = (type: StepType) => {
    switch (type) {
      case 'launch_app':
        return <Terminal size={16} className="text-purple-400" />;
      case 'wait_for_condition':
        return <Clock size={16} className="text-amber-400" />;
      case 'detect_prompt':
        return <Search size={16} className="text-blue-400" />;
      case 'inspect_ui':
        return <Layers size={16} className="text-cyan-400" />;
      case 'select_radio':
        return <MousePointer size={16} className="text-emerald-400" />;
      case 'invoke_button':
        return <Play size={16} className="text-indigo-400" />;
      case 'capture_snapshot':
        return <Code2 size={16} className="text-pink-400" />;
      case 'branch_condition':
        return <Sparkles size={16} className="text-orange-400" />;
      case 'user_approval':
        return <HelpCircle size={16} className="text-yellow-400" />;
      case 'write_log':
      default:
        return <Code2 size={16} className="text-slate-400" />;
    }
  };

  if (!currentWorkflow) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[600px] text-center">
        <WorkflowIcon size={48} className="text-slate-600 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-white mb-2">No Workflows Available</h2>
        <p className="text-slate-400 text-sm mb-4 max-w-md">
          Create your first automation workflow or load default templates from the Workflow Library.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800 backdrop-blur-md min-w-0">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <WorkflowIcon size={22} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <input
                type="text"
                value={currentWorkflow.name}
                onChange={(e) => handleUpdateWorkflowMeta({ name: e.target.value })}
                className="bg-transparent text-lg sm:text-xl font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none transition-colors truncate max-w-[200px] sm:max-w-xs md:max-w-none"
                placeholder="Workflow Name"
              />
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                v{currentWorkflow.version}
              </span>
              {dirty && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                  Unsaved Changes
                </span>
              )}
            </div>
            <input
              type="text"
              value={currentWorkflow.description}
              onChange={(e) => handleUpdateWorkflowMeta({ description: e.target.value })}
              className="bg-transparent text-xs text-slate-400 w-full mt-1 border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none truncate"
              placeholder="Workflow description..."
            />
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <select
            value={currentWorkflow.id}
            onChange={(e) => {
              const wf = workflows.find((w) => w.id === e.target.value);
              if (wf) setSelectedWorkflow(wf);
            }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 flex-1 sm:flex-none"
          >
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.steps.length} steps)
              </option>
            ))}
          </select>

          <button
            onClick={handleSave}
            className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {saveSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
            <span>{saveSuccess ? 'Saved!' : 'Save'}</span>
          </button>

          <button
            onClick={handleRunFullWorkflow}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Play size={16} className="fill-current" />
            <span>Run Workflow</span>
          </button>
        </div>
      </div>

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Steps Flow */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers size={16} className="text-blue-400" />
              <span>Step Sequence ({currentWorkflow.steps.length})</span>
            </h3>
            <button
              onClick={handleAddStep}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
            >
              <Plus size={14} />
              <span>Add Step</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {currentWorkflow.steps.map((step, idx) => {
              const isSelected = selectedStepId === step.id;
              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/60 shadow-md shadow-blue-900/20 ring-1 ring-blue-500/40'
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStepIcon(step.type)}
                        <span className="text-xs font-semibold text-slate-200">{step.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveStep(idx, 'up');
                        }}
                        disabled={idx === 0}
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveStep(idx, 'down');
                        }}
                        disabled={idx === currentWorkflow.steps.length - 1}
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStep(step.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        title="Delete Step"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono bg-slate-800/60 px-1.5 py-0.5 rounded text-slate-400">
                      {step.type}
                    </span>
                    <span>Timeout: {step.timeoutSeconds}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Step Config */}
        <div className="lg:col-span-7">
          {selectedStep ? (
            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-6 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {getStepIcon(selectedStep.type)}
                    <span>Configure: {selectedStep.name}</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-500">ID: {selectedStep.id}</span>
                </div>
              </div>

              {/* Form fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Step Name
                    </label>
                    <input
                      type="text"
                      value={selectedStep.name}
                      onChange={(e) => handleUpdateStep(selectedStep.id, { name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Step Type
                    </label>
                    <select
                      value={selectedStep.type}
                      onChange={(e) =>
                        handleUpdateStep(selectedStep.id, { type: e.target.value as StepType })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="detect_prompt">detect_prompt (Probe Antigravity Dialog)</option>
                      <option value="select_radio">select_radio (Select Recommended Option)</option>
                      <option value="invoke_button">invoke_button (Click Submit / Action)</option>
                      <option value="wait_for_condition">wait_for_condition (Wait for Window/PID)</option>
                      <option value="launch_app">launch_app (Run Process)</option>
                      <option value="inspect_ui">inspect_ui (UI Automation Inspector)</option>
                      <option value="user_approval">user_approval (Require Interactive Approval)</option>
                      <option value="branch_condition">branch_condition (Conditional Branch)</option>
                      <option value="capture_snapshot">capture_snapshot (Save UI Report)</option>
                      <option value="write_log">write_log (Record Audit Message)</option>
                    </select>
                  </div>
                </div>

                {/* Specific Config Parameters */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Step Configuration
                  </div>

                  {selectedStep.type === 'detect_prompt' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Target Option Substring</label>
                        <input
                          type="text"
                          value={selectedStep.config?.targetOptionSubstring || '(Recommended)'}
                          onChange={(e) =>
                            handleUpdateStep(selectedStep.id, {
                              config: { ...selectedStep.config, targetOptionSubstring: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Delay Before Probe (seconds)</label>
                        <input
                          type="number"
                          value={selectedStep.config?.delaySeconds || 0}
                          onChange={(e) =>
                            handleUpdateStep(selectedStep.id, {
                              config: { ...selectedStep.config, delaySeconds: parseInt(e.target.value) || 0 },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  {selectedStep.type === 'select_radio' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          Target Option Substring (e.g. "(Recommended)")
                        </label>
                        <input
                          type="text"
                          value={selectedStep.config?.targetSubstring || '(Recommended)'}
                          onChange={(e) =>
                            handleUpdateStep(selectedStep.id, {
                              config: { ...selectedStep.config, targetSubstring: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="autoComplete"
                          checked={selectedStep.config?.autoCompleteIfSubmitExists ?? true}
                          onChange={(e) =>
                            handleUpdateStep(selectedStep.id, {
                              config: { ...selectedStep.config, autoCompleteIfSubmitExists: e.target.checked },
                            })
                          }
                          className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <label htmlFor="autoComplete" className="text-xs text-slate-300">
                          Auto-Submit if Submit button discovered
                        </label>
                      </div>
                    </div>
                  )}

                  {selectedStep.type === 'invoke_button' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Button Name Pattern</label>
                        <input
                          type="text"
                          value={selectedStep.config?.buttonName || 'Submit'}
                          onChange={(e) =>
                            handleUpdateStep(selectedStep.id, {
                              config: { ...selectedStep.config, buttonName: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  {selectedStep.type === 'write_log' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Log Message</label>
                        <input
                          type="text"
                          value={selectedStep.config?.message || ''}
                          onChange={(e) =>
                            handleUpdateStep(selectedStep.id, {
                              config: { ...selectedStep.config, message: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  {selectedStep.type === 'user_approval' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Approval Prompt</label>
                        <input
                          type="text"
                          value={selectedStep.config?.prompt || 'Please confirm action.'}
                          onChange={(e) =>
                            handleUpdateStep(selectedStep.id, {
                              config: { ...selectedStep.config, prompt: e.target.value },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Execution policy */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Timeout (seconds)</label>
                    <input
                      type="number"
                      value={selectedStep.timeoutSeconds || 15}
                      onChange={(e) =>
                        handleUpdateStep(selectedStep.id, { timeoutSeconds: parseInt(e.target.value) || 15 })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Retry Limit</label>
                    <input
                      type="number"
                      value={selectedStep.retryLimit ?? 1}
                      onChange={(e) =>
                        handleUpdateStep(selectedStep.id, { retryLimit: parseInt(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500">
              <Layers size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Select a step from the sequence to configure its properties</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
