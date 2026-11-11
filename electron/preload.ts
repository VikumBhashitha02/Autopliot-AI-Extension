import { contextBridge, ipcRenderer } from 'electron';
import { WorkflowDefinition, AppSettings } from './engine/types';

export const API = {
  // Workflows
  getWorkflows: (): Promise<WorkflowDefinition[]> => ipcRenderer.invoke('workflows:getAll'),
  getWorkflow: (id: string): Promise<WorkflowDefinition | null> => ipcRenderer.invoke('workflows:getById', id),
  saveWorkflow: (wf: WorkflowDefinition): Promise<WorkflowDefinition> => ipcRenderer.invoke('workflows:save', wf),
  deleteWorkflow: (id: string): Promise<boolean> => ipcRenderer.invoke('workflows:delete', id),
  executeWorkflow: (wfId: string, triggeredBy?: string): Promise<any> => ipcRenderer.invoke('workflows:execute', wfId, triggeredBy),
  validateWorkflow: (wf: any): Promise<{ valid: boolean; errors: string[] }> => ipcRenderer.invoke('workflows:validate', wf),

  // Runs & Execution
  getRuns: (): Promise<any[]> => ipcRenderer.invoke('runs:getAll'),
  getRun: (id: string): Promise<any> => ipcRenderer.invoke('runs:getById', id),
  cancelRun: (id: string): Promise<boolean> => ipcRenderer.invoke('runs:cancel', id),
  respondApproval: (stepId: string, approved: boolean): Promise<boolean> => ipcRenderer.invoke('runs:respondApproval', stepId, approved),
  clearRuns: (): Promise<boolean> => ipcRenderer.invoke('storage:clearRuns'),

  // Agent & Target Application
  getAgentStatus: (): Promise<any> => ipcRenderer.invoke('agent:getStatus'),
  startAgentMonitoring: (intervalMs?: number): Promise<any> => ipcRenderer.invoke('agent:startMonitoring', intervalMs),
  stopAgentMonitoring: (): Promise<any> => ipcRenderer.invoke('agent:stopMonitoring'),
  scanTarget: (): Promise<any> => ipcRenderer.invoke('agent:scanTarget'),
  probePrompt: (): Promise<any> => ipcRenderer.invoke('agent:probePrompt'),
  setAutoPilotEnabled: (enabled: boolean): Promise<any> => ipcRenderer.invoke('agent:setAutoPilotEnabled', enabled),
  setAutoPilotMode: (mode: string): Promise<any> => ipcRenderer.invoke('agent:setAutoPilotMode', mode),
  setApprovalPolicy: (policy: string): Promise<any> => ipcRenderer.invoke('agent:setApprovalPolicy', policy),
  setSelectedWindow: (hwnd: number | null): Promise<any> => ipcRenderer.invoke('agent:setSelectedWindow', hwnd),
  listTargetWindows: (): Promise<any[]> => ipcRenderer.invoke('agent:listWindows'),
  setAutoSubmitDelay: (delayMs: number): Promise<any> => ipcRenderer.invoke('agent:setAutoSubmitDelay', delayMs),
  triggerAutoSubmitNow: (targetSubstring?: string): Promise<any> => ipcRenderer.invoke('agent:triggerAutoSubmitNow', targetSubstring),
  clearActionHistory: (): Promise<any> => ipcRenderer.invoke('agent:clearHistory'),
  emergencyStop: (): Promise<boolean> => ipcRenderer.invoke('system:emergencyStop'),

  // File Change Approval
  inspectFileChanges: (): Promise<any> => ipcRenderer.invoke('fileChanges:inspect'),
  testAcceptAllDetection: (): Promise<any> => ipcRenderer.invoke('fileChanges:testDetect'),
  executeFileChangeApproval: (): Promise<any> => ipcRenderer.invoke('fileChanges:execute'),

  // Multi-IDE Automation
  getIdeConnections: (): Promise<any[]> => ipcRenderer.invoke('ide:getConnections'),
  setTargetIdeFilter: (filter: string): Promise<any> => ipcRenderer.invoke('ide:setTargetFilter', filter),
  updatePerIdeConfig: (ideId: string, config: any): Promise<any> => ipcRenderer.invoke('ide:updateConfig', ideId, config),
  inspectIde: (ideId: string): Promise<any> => ipcRenderer.invoke('ide:inspect', ideId),

  // Diagnostics & UIA Scripts
  runDiagnosticInspect: (delaySeconds?: number, targetHwnd?: number, targetPid?: number): Promise<any> =>
    ipcRenderer.invoke('diagnostics:runInspect', delaySeconds, targetHwnd, targetPid),
  runDiagnosticComplete: (targetSubstring?: string, delaySeconds?: number, targetHwnd?: number, targetPid?: number, policy?: string): Promise<any> =>
    ipcRenderer.invoke('diagnostics:runComplete', targetSubstring, delaySeconds, targetHwnd, targetPid, policy),
  getDiagnosticReports: (): Promise<any[]> => ipcRenderer.invoke('diagnostics:getReports'),
  readDiagnosticReport: (fileName: string): Promise<string | null> => ipcRenderer.invoke('diagnostics:readReport', fileName),

  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:save', settings),

  // Events
  onWorkflowEvent: (callback: (event: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('workflow:event', handler);
    return () => ipcRenderer.removeListener('workflow:event', handler);
  },
  onAgentStatusChange: (callback: (status: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('agent:status', handler);
    return () => ipcRenderer.removeListener('agent:status', handler);
  },
  onAutoAction: (callback: (action: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('agent:auto-action', handler);
    return () => ipcRenderer.removeListener('agent:auto-action', handler);
  },
  onSubscriptionStatusChange: (callback: (status: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('subscription:status', handler);
    return () => ipcRenderer.removeListener('subscription:status', handler);
  },

  // System Helpers
  openPath: (targetPath: string) => ipcRenderer.invoke('system:openPath', targetPath),
};

contextBridge.exposeInMainWorld('api', API);
