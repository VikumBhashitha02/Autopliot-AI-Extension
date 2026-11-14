import {
  WorkflowDefinition,
  AppSettings,
  WorkflowExecutionRecord,
  AgentStatus,
  AutoPilotAction,
  TargetWindowInfo,
  SupportedIdeId,
  IdeConnectionInfo,
  PerIdeConfig,
} from '../../electron/engine/types';

declare global {
  interface Window {
    api: {
      // Workflows
      getWorkflows: () => Promise<WorkflowDefinition[]>;
      getWorkflow: (id: string) => Promise<WorkflowDefinition | null>;
      saveWorkflow: (wf: WorkflowDefinition) => Promise<WorkflowDefinition>;
      deleteWorkflow: (id: string) => Promise<boolean>;
      executeWorkflow: (wfId: string, triggeredBy?: string) => Promise<WorkflowExecutionRecord>;
      validateWorkflow: (wf: any) => Promise<{ valid: boolean; errors: string[] }>;

      // Runs & Execution
      getRuns: () => Promise<WorkflowExecutionRecord[]>;
      getRun: (id: string) => Promise<WorkflowExecutionRecord | null>;
      cancelRun: (id: string) => Promise<boolean>;
      respondApproval: (stepId: string, approved: boolean) => Promise<boolean>;
      clearRuns: () => Promise<boolean>;

      // Agent
      getAgentStatus: () => Promise<AgentStatus>;
      startAgentMonitoring: (intervalMs?: number) => Promise<AgentStatus>;
      stopAgentMonitoring: () => Promise<AgentStatus>;
      scanTarget: () => Promise<AgentStatus>;
      probePrompt: () => Promise<any>;
      setAutoPilotEnabled: (enabled: boolean) => Promise<AgentStatus>;
      setAutoPilotMode: (mode: string) => Promise<AgentStatus>;
      setApprovalPolicy: (policy: string) => Promise<AgentStatus>;
      setSelectedWindow: (hwnd: number | null) => Promise<AgentStatus>;
      listTargetWindows: () => Promise<TargetWindowInfo[]>;
      setAutoSubmitDelay: (delayMs: number) => Promise<AgentStatus>;
      triggerAutoSubmitNow: (targetSubstring?: string) => Promise<any>;
      clearActionHistory: () => Promise<AgentStatus>;
      emergencyStop: () => Promise<boolean>;

      // File Change Approval
      inspectFileChanges: () => Promise<any>;
      testAcceptAllDetection: () => Promise<any>;
      executeFileChangeApproval: () => Promise<any>;

      // Multi-IDE Automation
      getIdeConnections: () => Promise<IdeConnectionInfo[]>;
      setTargetIdeFilter: (filter: SupportedIdeId | 'all' | 'auto') => Promise<AgentStatus>;
      updatePerIdeConfig: (ideId: SupportedIdeId, config: Partial<PerIdeConfig>) => Promise<AgentStatus>;
      inspectIde: (ideId: SupportedIdeId) => Promise<any>;

      // Diagnostics
      runDiagnosticInspect: (delaySeconds?: number, targetHwnd?: number, targetPid?: number) => Promise<any>;
      runDiagnosticComplete: (targetSubstring?: string, delaySeconds?: number, targetHwnd?: number, targetPid?: number, policy?: string) => Promise<any>;
      getDiagnosticReports: () => Promise<Array<{ name: string; sizeBytes: number; modifiedAt: string }>>;
      readDiagnosticReport: (fileName: string) => Promise<string | null>;

      // Settings
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings>;

      // Events
      onWorkflowEvent: (callback: (event: any) => void) => () => void;
      onAgentStatusChange: (callback: (status: AgentStatus) => void) => () => void;
      onAutoAction: (callback: (action: AutoPilotAction) => void) => () => void;

      // System
      openPath: (targetPath: string) => Promise<string>;
    };
  }
}
