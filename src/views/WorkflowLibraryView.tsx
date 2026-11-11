import React, { useState } from 'react';
import {
  FolderKanban,
  Play,
  Edit3,
  Copy,
  Trash2,
  Plus,
  Download,
  Upload,
  Search,
  CheckCircle2,
  Tag,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WorkflowDefinition } from '../../electron/engine/types';

export const WorkflowLibraryView: React.FC = () => {
  const {
    workflows,
    setSelectedWorkflow,
    saveWorkflow,
    deleteWorkflow,
    executeWorkflow,
    setActiveTab,
    addToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [isImporting, setIsImporting] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Extract unique tags
  const allTags = Array.from(
    new Set(workflows.flatMap((w) => w.tags || []))
  );

  const filteredWorkflows = workflows.filter((w) => {
    const matchesSearch =
      searchQuery === '' ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'ALL' || (w.tags && w.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  const handleRunNow = async (w: WorkflowDefinition) => {
    await executeWorkflow(w.id);
    setActiveTab('monitor');
  };

  const handleEdit = (w: WorkflowDefinition) => {
    setSelectedWorkflow(w);
    setActiveTab('builder');
  };

  const handleDuplicate = async (w: WorkflowDefinition) => {
    const duplicated: WorkflowDefinition = {
      ...w,
      id: `wf_${Date.now()}`,
      name: `${w.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveWorkflow(duplicated);
    addToast(`Duplicated workflow: ${w.name}`, 'success');
  };

  const handleExport = (w: WorkflowDefinition) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(w, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${w.name.toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCreateNew = async () => {
    const newWorkflow: WorkflowDefinition = {
      id: `wf_${Date.now()}`,
      name: 'Custom Workflow',
      description: 'User configured automation workflow.',
      version: 1,
      enabled: true,
      targetApp: 'Antigravity IDE',
      approvalPolicy: 'always_manual',
      steps: [
        {
          id: 'step_1',
          name: 'Inspect Prompt Subtree',
          type: 'detect_prompt',
          enabled: true,
          timeoutSeconds: 15,
          retryLimit: 1,
          config: { targetOptionSubstring: '(Recommended)' },
        },
      ],
      tags: ['custom', 'antigravity'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveWorkflow(newWorkflow);
    setSelectedWorkflow(newWorkflow);
    setActiveTab('builder');
  };

  const handleImportSubmit = async () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importJsonText);
      if (!parsed.name || !Array.isArray(parsed.steps)) {
        throw new Error('Invalid workflow JSON format: must contain name and steps array.');
      }
      const imported: WorkflowDefinition = {
        ...parsed,
        id: `wf_${Date.now()}`,
        version: parsed.version || 1,
        enabled: parsed.enabled ?? true,
        targetApp: parsed.targetApp || 'Antigravity IDE',
        approvalPolicy: parsed.approvalPolicy || 'always_manual',
        tags: parsed.tags || ['imported'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveWorkflow(imported);
      setIsImporting(false);
      setImportJsonText('');
      addToast(`Imported workflow: ${imported.name}`, 'success');
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse JSON.');
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800 backdrop-blur-md min-w-0">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <FolderKanban size={24} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Workflow Library</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                {workflows.length} Templates &amp; Routines
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate max-w-xl">
              Browse pre-configured routines, import automation definitions, and manage custom workflows.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsImporting(true)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <Upload size={14} />
            <span>Import JSON</span>
          </button>

          <button
            onClick={handleCreateNew}
            className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Import Workflow Definition</h3>
              <button
                onClick={() => setIsImporting(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Paste a valid AutoPilot workflow JSON string below:
            </p>
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste workflow JSON here..."
              rows={8}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
            {importError && (
              <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                {importError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsImporting(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
              >
                Import Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search workflows by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedTag('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              selectedTag === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All Tags
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedTag === tag
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Workflows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredWorkflows.map((workflow) => (
          <div
            key={workflow.id}
            className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 backdrop-blur-md transition-all hover:shadow-xl hover:shadow-slate-950/50 group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                      {workflow.name}
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      v{workflow.version} &bull; {workflow.targetApp}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                {workflow.description}
              </p>

              {/* Tags */}
              {workflow.tags && (
                <div className="flex flex-wrap gap-1.5">
                  {workflow.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 border border-slate-800"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Layers size={13} className="text-blue-400" />
                  {workflow.steps.length} Steps
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={13} className="text-slate-500" />
                  {workflow.steps.reduce((acc, s) => acc + (s.timeoutSeconds || 15), 0)}s max
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleRunNow(workflow)}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <Play size={13} className="fill-current" />
                  <span>Run Now</span>
                </button>

                <button
                  onClick={() => handleEdit(workflow)}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>Edit Steps</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-slate-500 text-xs pt-1 px-1">
                <button
                  onClick={() => handleDuplicate(workflow)}
                  className="hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                  title="Duplicate Workflow"
                >
                  <Copy size={13} />
                  <span>Clone</span>
                </button>

                <button
                  onClick={() => handleExport(workflow)}
                  className="hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                  title="Export JSON"
                >
                  <Download size={13} />
                  <span>Export</span>
                </button>

                <button
                  onClick={() => deleteWorkflow(workflow.id)}
                  className="hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                  title="Delete Workflow"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
