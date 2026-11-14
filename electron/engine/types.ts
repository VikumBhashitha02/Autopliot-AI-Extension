export type StepType =
  | 'launch_app'
  | 'wait_for_condition'
  | 'detect_prompt'
  | 'inspect_ui'
  | 'select_radio'
  | 'invoke_button'
  | 'capture_snapshot'
  | 'write_log'
  | 'branch_condition'
  | 'user_approval';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_approval'
  | 'cancelled';

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  description?: string;
  enabled: boolean;
  timeoutSeconds: number;
  retryLimit: number;
  config: Record<string, any>;
  onSuccessGoto?: string;
  onFailureGoto?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  enabled: boolean;
  targetApp: string;
  approvalPolicy: 'always_manual' | 'auto_safe_only' | 'full_auto';
  tags: string[];
  steps: WorkflowStep[];
}

export interface StepExecutionResult {
  stepId: string;
  stepName: string;
  type: StepType;
  status: StepStatus;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  retryCount: number;
  output?: any;
  error?: string;
  logs: string[];
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

export interface WorkflowExecutionRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  currentStepId?: string;
  triggeredBy: 'manual' | 'agent' | 'scheduler';
  stepResults: Record<string, StepExecutionResult>;
  error?: string;
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    stepId?: string;
  }>;
}

export type SupportedIdeId = 'antigravity' | 'vscode_copilot';

export type ActionCategory =
  | 'PROMPT_SUBMISSION'
  | 'CONTINUE_APPROVAL'
  | 'PERMISSION_APPROVAL'
  | 'CONFIRMATION'
  | 'FILE_CHANGE_APPROVAL'
  | 'TERMINAL_APPROVAL'
  | 'REJECTION'
  | 'DESTRUCTIVE';

export type CopilotStatus = 'connected' | 'not_detected' | 'interface_unavailable' | 'unsupported';

export interface IdeConnectionInfo {
  ideId: SupportedIdeId;
  displayName: string;
  processName: string;
  pid: number | null;
  hwnd: number | null;
  windowTitle: string | null;
  windowClass: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'monitoring';
  copilotStatus?: CopilotStatus;
  supportedCapabilities: string[];
  enabled: boolean;
}

export interface PerIdeConfig {
  enabled: boolean;
  promptAutomation: boolean;
  fileChangeApproval: boolean;
  terminalApproval: boolean;
  recommendedOptionSelection: boolean;
  approvalPolicy?: 'always_manual' | 'auto_safe_only' | 'full_auto';
  autoSubmitDelayMs?: number;
}

export interface AutoPilotAction {
  id: string;
  timestamp: string;
  title: string;
  optionSelected: string;
  buttonClicked: string;
  status: string;
  durationMs: number;
  verifiedClosed?: boolean;
  policyApplied?: 'always_manual' | 'auto_safe_only' | 'full_auto';
  retryCount?: number;
  targetHwnd?: number;
  windowTitle?: string;
  failureReason?: string;
  actionType?: string;
  action?: string;
  targetProcess?: string;
  detectedButton?: string;
  executionTimeMs?: number;
  ideId?: SupportedIdeId;
  ideName?: string;
  actionCategory?: ActionCategory;
  fileChangeMetadata?: {
    modifiedFiles?: string[];
    containerClass?: string;
    confidence?: string;
    siblingActions?: string[];
  };
}

export type AutomationStateMachineState =
  | 'idle'
  | 'monitoring'
  | 'prompt_detected'
  | 'analyzing'
  | 'selecting_option'
  | 'submitting'
  | 'verifying'
  | 'waiting_for_next_prompt'
  | 'awaiting_approval'
  | 'unsupported_prompt'
  | 'file_change_detected'
  | 'file_change_analyzing'
  | 'file_change_approval_required'
  | 'file_change_accepting'
  | 'file_change_accepted'
  | 'file_change_ambiguous'
  | 'file_change_failed'
  | 'completed'
  | 'timed_out'
  | 'failed'
  | 'cancelled'
  | 'running'
  | 'paused'
  | 'error';

export interface TargetWindowInfo {
  hwnd: number;
  pid: number;
  title: string;
  processName: string;
  className: string;
  isVisible: boolean;
}

export interface FileChangeCandidateButton {
  name: string;
  automationId: string;
  controlType: string;
  className: string;
  boundingRectangle: string;
  isEnabled: boolean;
  supportsInvoke: boolean;
}

export interface FileChangeContainerInfo {
  name: string;
  automationId: string;
  className: string;
  controlType: string;
  boundingRectangle: string;
}

export interface FileChangeDetectionResult {
  timestamp: string;
  targetHwnd: number;
  processId: number;
  windowTitle: string;
  windowClass: string;
  fileChangeApprovalFound: boolean;
  isAmbiguous: boolean;
  confidence: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  buttonFound?: FileChangeCandidateButton;
  container?: FileChangeContainerInfo;
  modifiedFiles: string[];
  siblingActions: string[];
  warnings: string[];
  detectionEvidence: string[];
}

export interface FileChangeApprovalResult {
  timestamp: string;
  targetHwnd: number;
  processId: number;
  windowTitle: string;
  success: boolean;
  finalStatus: string;
  buttonClicked: string;
  containerClass: string;
  dismissalVerified: boolean;
  durationMs: number;
  logs: string[];
}

export interface AgentStatus {
  state: AutomationStateMachineState;
  targetProcessName: string;
  targetPid: number | null;
  targetHwnd: number | null;
  targetWindowTitle: string | null;
  availableWindows: TargetWindowInfo[];
  selectedHwnd: number | null;
  selectedWindow?: TargetWindowInfo;
  lastPromptDetected: boolean;
  lastPromptType: string | null;
  lastRecommendedOption: string | null;
  lastFileChangeDetected?: boolean;
  lastFileChangeConfidence?: string;
  lastFileChangeResult?: FileChangeDetectionResult | null;
  lastActiveTimestamp: string;
  sessionDesktop: string;
  autoPilotEnabled: boolean;
  autoPilotMode: 'full_auto' | 'select_only' | 'manual';
  approvalPolicy: 'always_manual' | 'auto_safe_only' | 'full_auto';
  autoSubmitDelayMs: number;
  totalPromptsDetected: number;
  totalPromptsAutoSubmitted: number;
  consecutivePromptsHandled: number;
  currentStepDescription?: string;
  lastVerificationStatus?: string;
  lastAutoAction: AutoPilotAction | null;
  actionHistory: AutoPilotAction[];
  activeIdeId?: SupportedIdeId | null;
  activeIdeName?: string | null;
  ideConnections?: IdeConnectionInfo[];
  targetIdeFilter?: SupportedIdeId | 'all' | 'auto';
  error?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  defaultTimeoutSeconds: number;
  defaultRetryLimit: number;
  approvalPolicy: 'always_manual' | 'auto_safe_only' | 'full_auto';
  diagnosticsOutputDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  autoStartMonitoring: boolean;
  emergencyStopShortcut: string;
  maxActionsPerMinute: number;
  redactSensitiveData: boolean;
  selectedWindowHwnd?: number | null;
  autoAcceptAllFileChanges?: boolean;
  ideConfigs?: Record<SupportedIdeId, PerIdeConfig>;
  targetIdeFilter?: SupportedIdeId | 'all' | 'auto';
  responseSpeed?: 'instant' | 'fast' | 'comfortable' | 'deliberate';
  monitoringInterval?: number;
  enableTerminalApproval?: boolean;
  promptInspectionConfidenceThreshold?: number;
}
