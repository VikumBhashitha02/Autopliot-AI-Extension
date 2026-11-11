import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  WorkflowDefinition,
  WorkflowExecutionRecord,
  AgentStatus,
  AppSettings,
  TargetWindowInfo,
  SupportedIdeId,
  IdeConnectionInfo,
  PerIdeConfig,
} from '../../electron/engine/types';

export type NavigationTab =
  | 'autopilot'
  | 'rules'
  | 'dashboard'
  | 'builder'
  | 'agent'
  | 'prompts'
  | 'monitor'
  | 'logs'
  | 'library'
  | 'settings';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface AppLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SAFETY';
  category: string;
  message: string;
  metadata?: any;
}

interface AppContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  workflows: WorkflowDefinition[];
  selectedWorkflow: WorkflowDefinition | null;
  setSelectedWorkflow: (wf: WorkflowDefinition | null) => void;
  activeWorkflow: WorkflowDefinition | null;
  setActiveWorkflow: (wf: WorkflowDefinition | null) => void;
  runs: WorkflowExecutionRecord[];
  activeRun: WorkflowExecutionRecord | null;
  agentStatus: AgentStatus;
  setAgentStatus: (status: AgentStatus) => void;
  toggleAutoPilot: (enabled: boolean) => Promise<void>;
  changeAutoPilotMode: (mode: 'full_auto' | 'select_only' | 'manual') => Promise<void>;
  setApprovalPolicy: (policy: 'always_manual' | 'auto_safe_only' | 'full_auto') => Promise<void>;
  setSelectedWindow: (hwnd: number | null) => Promise<void>;
  refreshAvailableWindows: () => Promise<TargetWindowInfo[]>;
  changeAutoSubmitDelay: (delayMs: number) => Promise<void>;
  triggerAutoSubmitNow: (targetSubstring?: string) => Promise<any>;
  clearActionHistory: () => Promise<void>;
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
  logs: AppLogEntry[];
  addLog: (entry: Omit<AppLogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  refreshWorkflows: () => Promise<void>;
  saveWorkflow: (wf: WorkflowDefinition) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  refreshRuns: () => Promise<void>;
  executeWorkflow: (wfId: string) => Promise<void>;
  startWorkflowRun: (wfId: string) => Promise<void>;
  cancelExecution: (runId: string) => Promise<void>;
  cancelActiveRun: () => Promise<void>;
  pendingApproval: { stepId: string; prompt: string; metadata?: any } | null;
  respondApproval: (approved: boolean) => Promise<void>;
  requestApproval: (prompt: string) => Promise<boolean>;
  setTargetIdeFilter: (filter: SupportedIdeId | 'all' | 'auto') => Promise<void>;
  updatePerIdeConfig: (ideId: SupportedIdeId, config: Partial<PerIdeConfig>) => Promise<void>;
  inspectIde: (ideId: SupportedIdeId) => Promise<any>;
  refreshIdeConnections: () => Promise<IdeConnectionInfo[]>;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  defaultTimeoutSeconds: 15,
  defaultRetryLimit: 1,
  approvalPolicy: 'auto_safe_only',
  diagnosticsOutputDir: 'diagnostics',
  logLevel: 'info',
  autoStartMonitoring: true,
  emergencyStopShortcut: 'Ctrl+Alt+S',
  maxActionsPerMinute: 60,
  redactSensitiveData: true,
  selectedWindowHwnd: null,
};

const initialAgentStatus: AgentStatus = {
  state: 'idle',
  targetProcessName: 'Antigravity IDE',
  targetPid: null,
  targetHwnd: null,
  targetWindowTitle: null,
  availableWindows: [],
  selectedHwnd: null,
  lastPromptDetected: false,
  lastPromptType: null,
  lastRecommendedOption: null,
  lastActiveTimestamp: new Date().toISOString(),
  sessionDesktop: 'WinSta0\\Default',
  autoPilotEnabled: true,
  autoPilotMode: 'full_auto',
  approvalPolicy: 'auto_safe_only',
  autoSubmitDelayMs: 250,
  totalPromptsDetected: 0,
  totalPromptsAutoSubmitted: 0,
  consecutivePromptsHandled: 0,
  currentStepDescription: 'AutoPilot extension active',
  lastAutoAction: null,
  actionHistory: [],
  activeIdeId: 'antigravity',
  activeIdeName: 'Antigravity IDE',
  ideConnections: [],
  targetIdeFilter: 'auto',
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('autopilot');
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [runs, setRuns] = useState<WorkflowExecutionRecord[]>([]);
  const [activeRun, setActiveRun] = useState<WorkflowExecutionRecord | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>(initialAgentStatus);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [pendingApproval, setPendingApproval] = useState<{ stepId: string; prompt: string; metadata?: any } | null>(null);
  const approvalResolverRef = React.useRef<((val: boolean) => void) | null>(null);

  const addToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addLog = (entry: Omit<AppLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: AppLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setLogs((prev) => [newEntry, ...prev].slice(0, 500));
  };

  const clearLogs = () => setLogs([]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  const refreshWorkflows = async () => {
    if (!window.api || !window.api.getWorkflows) return;
    try {
      const data = await window.api.getWorkflows();
      setWorkflows(data || []);
      if (data && data.length > 0 && !selectedWorkflow) {
        setSelectedWorkflow(data[0]);
      }
    } catch (err: any) {
      console.error('Failed to load workflows:', err);
    }
  };

  const saveWorkflow = async (wf: WorkflowDefinition) => {
    if (!window.api) return;
    try {
      const saved = await window.api.saveWorkflow(wf);
      await refreshWorkflows();
      setSelectedWorkflow(saved);
      addToast(`Workflow '${saved.name}' saved successfully.`, 'success');
      addLog({ level: 'INFO', category: 'WORKFLOW', message: `Saved workflow '${saved.name}' (v${saved.version})` });
    } catch (err: any) {
      addToast(`Failed to save workflow: ${err.message}`, 'error');
      addLog({ level: 'ERROR', category: 'WORKFLOW', message: `Save failed: ${err.message}` });
      throw err;
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!window.api) return;
    try {
      await window.api.deleteWorkflow(id);
      await refreshWorkflows();
      if (selectedWorkflow?.id === id) {
        setSelectedWorkflow(null);
      }
      addToast('Workflow deleted.', 'info');
    } catch (err: any) {
      addToast(`Failed to delete workflow: ${err.message}`, 'error');
    }
  };

  const refreshRuns = async () => {
    if (!window.api || !window.api.getRuns) return;
    try {
      const data = await window.api.getRuns();
      setRuns(data || []);
      const running = (data || []).find((r) => r.status === 'running');
      if (running) {
        setActiveRun(running);
      } else if (activeRun && activeRun.status === 'running') {
        const updated = (data || []).find((r) => r.id === activeRun.id);
        setActiveRun(updated || null);
      }
    } catch (err: any) {
      console.error('Failed to load runs:', err);
    }
  };

  const loadSettings = async () => {
    if (!window.api || !window.api.getSettings) return;
    try {
      const s = await window.api.getSettings();
      if (s) {
        setSettings(s);
        if (s.theme && (s.theme === 'dark' || s.theme === 'light')) {
          setTheme(s.theme);
          document.documentElement.classList.toggle('dark', s.theme === 'dark');
        }
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    }
  };

  const updateSettings = async (partial: Partial<AppSettings>) => {
    if (!window.api || !window.api.saveSettings) return;
    try {
      const updated = await window.api.saveSettings(partial);
      setSettings(updated);
      addToast('Settings updated successfully.', 'success');
    } catch (err: any) {
      addToast(`Failed to save settings: ${err.message}`, 'error');
    }
  };

  const toggleAutoPilot = async (enabled: boolean) => {
    if (!window.api) return;
    try {
      const st = await window.api.setAutoPilotEnabled(enabled);
      setAgentStatus(st);
      addToast(enabled ? 'Live AutoPilot monitoring enabled.' : 'Live AutoPilot monitoring paused.', enabled ? 'success' : 'info');
    } catch (err: any) {
      addToast(`Failed to toggle AutoPilot: ${err.message}`, 'error');
    }
  };

  const changeAutoPilotMode = async (mode: 'full_auto' | 'select_only' | 'manual') => {
    if (!window.api) return;
    try {
      const st = await window.api.setAutoPilotMode(mode);
      setAgentStatus(st);
      addToast(`AutoPilot mode switched to: ${mode.toUpperCase().replace('_', ' ')}`, 'info');
    } catch (err: any) {
      addToast(`Failed to update AutoPilot mode: ${err.message}`, 'error');
    }
  };

  const setApprovalPolicy = async (policy: 'always_manual' | 'auto_safe_only' | 'full_auto') => {
    if (!window.api) return;
    try {
      const st = await window.api.setApprovalPolicy(policy);
      setAgentStatus(st);
      addToast(`Policy set to: ${policy.toUpperCase().replace('_', ' ')}`, 'info');
    } catch (err: any) {
      addToast(`Failed to set approval policy: ${err.message}`, 'error');
    }
  };

  const setSelectedWindow = async (hwnd: number | null) => {
    if (!window.api) return;
    try {
      const st = await window.api.setSelectedWindow(hwnd);
      setAgentStatus(st);
      addToast(hwnd ? `Attached to window handle: ${hwnd}` : 'Reset to auto-detect target window', 'info');
    } catch (err: any) {
      addToast(`Failed to select window: ${err.message}`, 'error');
    }
  };

  const refreshAvailableWindows = async (): Promise<TargetWindowInfo[]> => {
    if (!window.api) return [];
    try {
      return await window.api.listTargetWindows();
    } catch (err: any) {
      console.error('Failed to list target windows:', err);
      return [];
    }
  };

  const changeAutoSubmitDelay = async (delayMs: number) => {
    if (!window.api) return;
    try {
      const st = await window.api.setAutoSubmitDelay(delayMs);
      setAgentStatus(st);
    } catch (err: any) {
      console.error('Failed to set delay:', err);
    }
  };

  const triggerAutoSubmitNow = async (targetSubstring?: string) => {
    if (!window.api) return;
    try {
      addToast('Triggering immediate submission scan...', 'info');
      const res = await window.api.triggerAutoSubmitNow(targetSubstring);
      addToast('AutoPilot action finished.', 'success');
      return res;
    } catch (err: any) {
      addToast(`Action failed: ${err.message}`, 'error');
    }
  };

  const clearActionHistory = async () => {
    if (!window.api) return;
    try {
      const st = await window.api.clearActionHistory();
      setAgentStatus(st);
      addToast('Action history cleared.', 'info');
    } catch (err: any) {
      addToast(`Failed to clear history: ${err.message}`, 'error');
    }
  };

  const setTargetIdeFilter = async (filter: SupportedIdeId | 'all' | 'auto') => {
    if (!window.api || !window.api.setTargetIdeFilter) return;
    try {
      const st = await window.api.setTargetIdeFilter(filter);
      setAgentStatus(st);
      addToast(`IDE filter updated: ${filter.toUpperCase()}`, 'info');
    } catch (err: any) {
      addToast(`Failed to set target IDE filter: ${err.message}`, 'error');
    }
  };

  const updatePerIdeConfig = async (ideId: SupportedIdeId, config: Partial<PerIdeConfig>) => {
    if (!window.api || !window.api.updatePerIdeConfig) return;
    try {
      const st = await window.api.updatePerIdeConfig(ideId, config);
      setAgentStatus(st);
      addToast(`Updated configuration for ${ideId}`, 'success');
    } catch (err: any) {
      addToast(`Failed to update IDE config: ${err.message}`, 'error');
    }
  };

  const inspectIde = async (ideId: SupportedIdeId) => {
    if (!window.api || !window.api.inspectIde) return null;
    try {
      addToast(`Inspecting ${ideId}...`, 'info');
      const res = await window.api.inspectIde(ideId);
      addToast(`Inspection complete for ${ideId}`, 'success');
      return res;
    } catch (err: any) {
      addToast(`Failed to inspect IDE: ${err.message}`, 'error');
      return null;
    }
  };

  const refreshIdeConnections = async () => {
    if (!window.api || !window.api.getIdeConnections) return [];
    return window.api.getIdeConnections();
  };

  const executeWorkflow = async (wfId: string) => {
    if (!window.api) return;
    try {
      addToast('Launching workflow execution...', 'info');
      setActiveTab('monitor');
      const runRecord = await window.api.executeWorkflow(wfId, 'manual');
      setActiveRun(runRecord);
      await refreshRuns();
    } catch (err: any) {
      addToast(`Workflow execution failed: ${err.message}`, 'error');
    }
  };

  const cancelExecution = async (runId: string) => {
    if (!window.api) return;
    try {
      await window.api.cancelRun(runId);
      addToast(`Workflow run cancelled.`, 'warning');
      await refreshRuns();
    } catch (err: any) {
      addToast(`Failed to cancel run: ${err.message}`, 'error');
    }
  };

  const cancelActiveRun = async () => {
    if (activeRun) {
      await cancelExecution(activeRun.id);
    }
  };

  const requestApproval = (prompt: string): Promise<boolean> => {
    return new Promise((resolve) => {
      approvalResolverRef.current = resolve;
      setPendingApproval({ stepId: 'manual_approval', prompt });
    });
  };

  const respondApproval = async (approved: boolean) => {
    if (approvalResolverRef.current) {
      approvalResolverRef.current(approved);
      approvalResolverRef.current = null;
    }
    if (pendingApproval && window.api?.respondApproval) {
      try {
        await window.api.respondApproval(pendingApproval.stepId, approved);
      } catch (err: any) {
        console.error('Failed to respond to backend approval:', err);
      }
    }
    setPendingApproval(null);
  };

  useEffect(() => {
    refreshWorkflows();
    refreshRuns();
    loadSettings();

    if (!window.api) return;

    window.api.getAgentStatus().then((st: AgentStatus) => {
      if (st) setAgentStatus(st);
    }).catch(() => {});

    const unsubWorkflow = window.api.onWorkflowEvent((event: any) => {
      if (event.type === 'run_started') {
        setActiveRun(event.data);
        addToast(`Started workflow: ${event.data.workflowName}`, 'info');
      } else if (event.type === 'step_started') {
        setActiveRun((prev) => prev ? { ...prev, currentStepId: event.data.stepId } : null);
      } else if (event.type === 'run_completed') {
        setActiveRun(event.data);
        const isSuccess = event.data.status === 'completed';
        addToast(
          `Workflow '${event.data.workflowName}' ${event.data.status}!`,
          isSuccess ? 'success' : 'error'
        );
        refreshRuns();
      } else if (event.type === 'approval_required') {
        setPendingApproval({
          stepId: event.data.stepId,
          prompt: event.data.prompt,
          metadata: event.data.metadata,
        });
      }
    });

    const unsubAgent = window.api.onAgentStatusChange((status: AgentStatus) => {
      setAgentStatus(status);
    });

    const unsubAutoAction = window.api.onAutoAction?.((action: any) => {
      addToast(`⚡ Auto-Submitted: ${action.title} (${action.buttonClicked})`, 'success');
      addLog({
        level: 'INFO',
        category: 'AUTOPILOT',
        message: `Auto-submitted prompt: ${action.title} [${action.buttonClicked}] (Status: ${action.status})`,
        metadata: action,
      });
    });

    // Auto-start background monitoring immediately
    window.api.startAgentMonitoring(1800).catch(() => {});

    return () => {
      unsubWorkflow();
      unsubAgent();
      if (unsubAutoAction) unsubAutoAction();
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        workflows,
        selectedWorkflow,
        setSelectedWorkflow,
        activeWorkflow: selectedWorkflow,
        setActiveWorkflow: setSelectedWorkflow,
        runs,
        activeRun,
        agentStatus,
        setAgentStatus,
        toggleAutoPilot,
        changeAutoPilotMode,
        setApprovalPolicy,
        setSelectedWindow,
        refreshAvailableWindows,
        changeAutoSubmitDelay,
        triggerAutoSubmitNow,
        clearActionHistory,
        settings,
        updateSettings,
        theme,
        toggleTheme,
        toasts,
        addToast,
        removeToast,
        logs,
        addLog,
        clearLogs,
        refreshWorkflows,
        saveWorkflow,
        deleteWorkflow,
        refreshRuns,
        executeWorkflow,
        startWorkflowRun: executeWorkflow,
        cancelExecution,
        cancelActiveRun,
        pendingApproval,
        respondApproval,
        requestApproval,
        setTargetIdeFilter,
        updatePerIdeConfig,
        inspectIde,
        refreshIdeConnections,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
