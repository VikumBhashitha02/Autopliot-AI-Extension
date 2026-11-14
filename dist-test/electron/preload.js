"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API = void 0;
const electron_1 = require("electron");
exports.API = {
    // Workflows
    getWorkflows: () => electron_1.ipcRenderer.invoke('workflows:getAll'),
    getWorkflow: (id) => electron_1.ipcRenderer.invoke('workflows:getById', id),
    saveWorkflow: (wf) => electron_1.ipcRenderer.invoke('workflows:save', wf),
    deleteWorkflow: (id) => electron_1.ipcRenderer.invoke('workflows:delete', id),
    executeWorkflow: (wfId, triggeredBy) => electron_1.ipcRenderer.invoke('workflows:execute', wfId, triggeredBy),
    validateWorkflow: (wf) => electron_1.ipcRenderer.invoke('workflows:validate', wf),
    // Runs & Execution
    getRuns: () => electron_1.ipcRenderer.invoke('runs:getAll'),
    getRun: (id) => electron_1.ipcRenderer.invoke('runs:getById', id),
    cancelRun: (id) => electron_1.ipcRenderer.invoke('runs:cancel', id),
    respondApproval: (stepId, approved) => electron_1.ipcRenderer.invoke('runs:respondApproval', stepId, approved),
    clearRuns: () => electron_1.ipcRenderer.invoke('storage:clearRuns'),
    // Agent & Target Application
    getAgentStatus: () => electron_1.ipcRenderer.invoke('agent:getStatus'),
    startAgentMonitoring: (intervalMs) => electron_1.ipcRenderer.invoke('agent:startMonitoring', intervalMs),
    stopAgentMonitoring: () => electron_1.ipcRenderer.invoke('agent:stopMonitoring'),
    scanTarget: () => electron_1.ipcRenderer.invoke('agent:scanTarget'),
    probePrompt: () => electron_1.ipcRenderer.invoke('agent:probePrompt'),
    setAutoPilotEnabled: (enabled) => electron_1.ipcRenderer.invoke('agent:setAutoPilotEnabled', enabled),
    setAutoPilotMode: (mode) => electron_1.ipcRenderer.invoke('agent:setAutoPilotMode', mode),
    setApprovalPolicy: (policy) => electron_1.ipcRenderer.invoke('agent:setApprovalPolicy', policy),
    setSelectedWindow: (hwnd) => electron_1.ipcRenderer.invoke('agent:setSelectedWindow', hwnd),
    listTargetWindows: () => electron_1.ipcRenderer.invoke('agent:listWindows'),
    setAutoSubmitDelay: (delayMs) => electron_1.ipcRenderer.invoke('agent:setAutoSubmitDelay', delayMs),
    triggerAutoSubmitNow: (targetSubstring) => electron_1.ipcRenderer.invoke('agent:triggerAutoSubmitNow', targetSubstring),
    clearActionHistory: () => electron_1.ipcRenderer.invoke('agent:clearHistory'),
    emergencyStop: () => electron_1.ipcRenderer.invoke('system:emergencyStop'),
    // File Change Approval
    inspectFileChanges: () => electron_1.ipcRenderer.invoke('fileChanges:inspect'),
    testAcceptAllDetection: () => electron_1.ipcRenderer.invoke('fileChanges:testDetect'),
    executeFileChangeApproval: () => electron_1.ipcRenderer.invoke('fileChanges:execute'),
    // Multi-IDE Automation
    getIdeConnections: () => electron_1.ipcRenderer.invoke('ide:getConnections'),
    setTargetIdeFilter: (filter) => electron_1.ipcRenderer.invoke('ide:setTargetFilter', filter),
    updatePerIdeConfig: (ideId, config) => electron_1.ipcRenderer.invoke('ide:updateConfig', ideId, config),
    inspectIde: (ideId) => electron_1.ipcRenderer.invoke('ide:inspect', ideId),
    // Diagnostics & UIA Scripts
    runDiagnosticInspect: (delaySeconds, targetHwnd, targetPid) => electron_1.ipcRenderer.invoke('diagnostics:runInspect', delaySeconds, targetHwnd, targetPid),
    runDiagnosticComplete: (targetSubstring, delaySeconds, targetHwnd, targetPid, policy) => electron_1.ipcRenderer.invoke('diagnostics:runComplete', targetSubstring, delaySeconds, targetHwnd, targetPid, policy),
    getDiagnosticReports: () => electron_1.ipcRenderer.invoke('diagnostics:getReports'),
    readDiagnosticReport: (fileName) => electron_1.ipcRenderer.invoke('diagnostics:readReport', fileName),
    // Settings
    getSettings: () => electron_1.ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('settings:save', settings),
    // Events
    onWorkflowEvent: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('workflow:event', handler);
        return () => electron_1.ipcRenderer.removeListener('workflow:event', handler);
    },
    onAgentStatusChange: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('agent:status', handler);
        return () => electron_1.ipcRenderer.removeListener('agent:status', handler);
    },
    onAutoAction: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('agent:auto-action', handler);
        return () => electron_1.ipcRenderer.removeListener('agent:auto-action', handler);
    },
    onSubscriptionStatusChange: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('subscription:status', handler);
        return () => electron_1.ipcRenderer.removeListener('subscription:status', handler);
    },
    // System Helpers
    openPath: (targetPath) => electron_1.ipcRenderer.invoke('system:openPath', targetPath),
};
electron_1.contextBridge.exposeInMainWorld('api', exports.API);
//# sourceMappingURL=preload.js.map