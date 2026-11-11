"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const documentStore_1 = require("./storage/documentStore");
const powershellAdapter_1 = require("./adapters/powershellAdapter");
const workflowEngine_1 = require("./engine/workflowEngine");
const agentService_1 = require("./adapters/agentService");
const safetyGuard_1 = require("./security/safetyGuard");
let mainWindow = null;
const docStore = new documentStore_1.DocumentStore();
const psAdapter = new powershellAdapter_1.PowerShellAdapter(docStore.getDiagnosticsDir());
const engine = new workflowEngine_1.WorkflowEngine(docStore, psAdapter, (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('workflow:event', event);
    }
});
const agentService = new agentService_1.AgentService(psAdapter, docStore, (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:status', status);
    }
}, (action) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:auto-action', action);
    }
}, (approvalData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (approvalData.type === 'file_change_approval') {
            const filesSummary = approvalData.ModifiedFiles && approvalData.ModifiedFiles.length > 0
                ? ` (${approvalData.ModifiedFiles.length} file${approvalData.ModifiedFiles.length > 1 ? 's' : ''}: ${approvalData.ModifiedFiles.slice(0, 3).join(', ')}${approvalData.ModifiedFiles.length > 3 ? '...' : ''})`
                : '';
            mainWindow.webContents.send('workflow:event', {
                type: 'approval_required',
                runId: 'agent',
                data: {
                    stepId: 'file_change_approval',
                    prompt: `Approval Required: Accept all file changes in '${approvalData.WindowTitle || 'Antigravity IDE'}'${filesSummary}?`,
                    metadata: approvalData,
                },
            });
        }
        else {
            mainWindow.webContents.send('workflow:event', {
                type: 'approval_required',
                runId: 'agent',
                data: {
                    stepId: 'agent_approval',
                    prompt: `Approval Required: Action in '${approvalData.WindowTitle || 'Antigravity'}' has no explicit recommendation. Proceed with submission?`,
                    metadata: approvalData,
                },
            });
        }
    }
});
function validateSender(event) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Application window is not available');
    }
    if (event.senderFrame !== mainWindow.webContents.mainFrame) {
        throw new Error('Unauthorized IPC invocation: sender frame mismatch');
    }
}
process.on('uncaughtException', (err) => console.error('[UNCAUGHT EXCEPTION]', err));
process.on('unhandledRejection', (err) => console.error('[UNHANDLED REJECTION]', err));
function createWindow() {
    const windowIcon = path_1.default.join(__dirname, '../dist/app-icon.png');
    mainWindow = new electron_1.BrowserWindow({
        icon: fs_1.default.existsSync(windowIcon) ? windowIcon : undefined,
        width: 1380,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        backgroundColor: '#020617',
        title: 'AutoPilot AI — Workflow Automation',
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
        },
        frame: true,
        show: true,
    });
    // Strict navigation security
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            electron_1.shell.openExternal(url);
        }
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const currentUrl = mainWindow?.webContents.getURL();
        if (currentUrl && url !== currentUrl) {
            event.preventDefault();
        }
    });
    mainWindow.once('ready-to-show', () => {
        console.log('[MAIN] AutoPilot AI window ready-to-show');
        mainWindow?.show();
        mainWindow?.focus();
    });
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[MAIN] AutoPilot AI window did-finish-load');
        if (mainWindow && !mainWindow.isVisible()) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error('[MAIN] Failed to load UI:', errorCode, errorDescription);
    });
    const distPath = path_1.default.join(__dirname, '../dist/index.html');
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        mainWindow.loadURL(devServerUrl).catch((err) => {
            console.warn('[MAIN] Could not connect to dev server, falling back to dist:', err);
            mainWindow?.loadFile(distPath);
        });
    }
    else if (fs_1.default.existsSync(distPath)) {
        console.log('[MAIN] Loading local production bundle:', distPath);
        mainWindow.loadFile(distPath);
    }
    else {
        mainWindow.loadURL('http://localhost:5173').catch(() => {
            mainWindow?.loadFile(distPath);
        });
    }
    mainWindow.on('close', () => console.log('[MAIN] AutoPilot AI window event: close'));
    mainWindow.on('closed', () => {
        console.log('[MAIN] AutoPilot AI window event: closed');
        mainWindow = null;
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error('[MAIN] Render process gone:', details);
    });
    mainWindow.webContents.on('console-message', (_event, level, message) => {
        console.log('[RENDERER CONSOLE L' + level + ']', message);
    });
}
// Global Emergency Stop Shortcut
function registerEmergencyStop() {
    const settings = docStore.getSettings();
    const shortcut = settings.emergencyStopShortcut || 'Ctrl+Alt+S';
    electron_1.globalShortcut.unregisterAll();
    try {
        electron_1.globalShortcut.register(shortcut, () => {
            console.warn(`[EMERGENCY STOP] '${shortcut}' pressed! Halting all active workflows...`);
            // Cancel any active runs from in-memory engine and document store
            const activeIds = engine.getActiveRunIds();
            for (const runId of activeIds) {
                engine.cancelRun(runId);
            }
            const runs = docStore.getAllRuns().filter(r => r.status === 'running');
            for (const run of runs) {
                engine.cancelRun(run.id);
            }
            agentService.stopMonitoring();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('workflow:event', {
                    type: 'log',
                    runId: 'system',
                    data: { timestamp: new Date().toISOString(), level: 'error', message: 'EMERGENCY STOP TRIGGERED! All operations halted.' }
                });
            }
        });
    }
    catch (err) {
        console.error('Failed to register global emergency stop:', err);
    }
}
// --- IPC Registration ---
function registerIpcHandlers() {
    // Workflows
    electron_1.ipcMain.handle('workflows:getAll', async (event) => {
        validateSender(event);
        return docStore.getAllWorkflows();
    });
    electron_1.ipcMain.handle('workflows:getById', async (event, id) => {
        validateSender(event);
        return docStore.getWorkflowById(id);
    });
    electron_1.ipcMain.handle('workflows:save', async (event, wf) => {
        validateSender(event);
        const validated = safetyGuard_1.SafetyGuard.validateWorkflowSchema(wf);
        if (!validated.valid)
            throw new Error(validated.errors.join('; '));
        return docStore.saveWorkflow(wf);
    });
    electron_1.ipcMain.handle('workflows:delete', async (event, id) => {
        validateSender(event);
        return docStore.deleteWorkflow(id);
    });
    electron_1.ipcMain.handle('workflows:validate', async (event, wf) => {
        validateSender(event);
        return safetyGuard_1.SafetyGuard.validateWorkflowSchema(wf);
    });
    electron_1.ipcMain.handle('workflows:execute', async (event, wfId, triggeredBy = 'manual') => {
        validateSender(event);
        const wf = docStore.getWorkflowById(wfId);
        if (!wf)
            throw new Error(`Workflow '${wfId}' not found`);
        return engine.executeWorkflow(wf, triggeredBy);
    });
    // Runs
    electron_1.ipcMain.handle('runs:getAll', async (event) => {
        validateSender(event);
        return docStore.getAllRuns();
    });
    electron_1.ipcMain.handle('runs:getById', async (event, id) => {
        validateSender(event);
        return docStore.getRunById(id);
    });
    electron_1.ipcMain.handle('runs:cancel', async (event, id) => {
        validateSender(event);
        return engine.cancelRun(id);
    });
    electron_1.ipcMain.handle('runs:respondApproval', async (event, stepId, approved) => {
        validateSender(event);
        if (stepId === 'file_change_approval') {
            if (approved) {
                return agentService.executePendingFileChangeApproval();
            }
            else {
                agentService.rejectFileChangeApproval();
                return false;
            }
        }
        return engine.respondToApproval(stepId, approved);
    });
    // File Change Approval
    electron_1.ipcMain.handle('fileChanges:inspect', async (event) => {
        validateSender(event);
        return agentService.inspectFileChanges();
    });
    electron_1.ipcMain.handle('fileChanges:testDetect', async (event) => {
        validateSender(event);
        return agentService.testAcceptAllDetection();
    });
    electron_1.ipcMain.handle('fileChanges:execute', async (event) => {
        validateSender(event);
        return agentService.executePendingFileChangeApproval();
    });
    // Agent
    electron_1.ipcMain.handle('agent:getStatus', async (event) => {
        validateSender(event);
        return agentService.getStatus();
    });
    electron_1.ipcMain.handle('agent:startMonitoring', async (event, intervalMs) => {
        validateSender(event);
        return agentService.startMonitoring(intervalMs);
    });
    electron_1.ipcMain.handle('agent:stopMonitoring', async (event) => {
        validateSender(event);
        return agentService.stopMonitoring();
    });
    electron_1.ipcMain.handle('agent:scanTarget', async (event) => {
        validateSender(event);
        return agentService.scanTargetWindow();
    });
    electron_1.ipcMain.handle('agent:probePrompt', async (event) => {
        validateSender(event);
        return agentService.probePrompt();
    });
    electron_1.ipcMain.handle('agent:setAutoPilotEnabled', async (event, enabled) => {
        validateSender(event);
        return agentService.setAutoPilotEnabled(enabled);
    });
    electron_1.ipcMain.handle('agent:setAutoPilotMode', async (event, mode) => {
        validateSender(event);
        return agentService.setAutoPilotMode(mode);
    });
    electron_1.ipcMain.handle('agent:setAutoSubmitDelay', async (event, delayMs) => {
        validateSender(event);
        return agentService.setAutoSubmitDelayMs(delayMs);
    });
    electron_1.ipcMain.handle('agent:triggerAutoSubmitNow', async (event, targetSubstring) => {
        validateSender(event);
        return agentService.executeAutoPilotCycle(targetSubstring || '');
    });
    electron_1.ipcMain.handle('agent:clearHistory', async (event) => {
        validateSender(event);
        return agentService.clearActionHistory();
    });
    electron_1.ipcMain.handle('agent:setApprovalPolicy', async (event, policy) => {
        validateSender(event);
        docStore.saveSettings({ approvalPolicy: policy });
        return agentService.setApprovalPolicy(policy);
    });
    electron_1.ipcMain.handle('agent:setSelectedWindow', async (event, hwnd) => {
        validateSender(event);
        docStore.saveSettings({ selectedWindowHwnd: hwnd });
        return agentService.setSelectedWindow(hwnd);
    });
    electron_1.ipcMain.handle('agent:listWindows', async (event) => {
        validateSender(event);
        return psAdapter.listTargetWindows();
    });
    // Multi-IDE Automation
    electron_1.ipcMain.handle('ide:getConnections', async (event) => {
        validateSender(event);
        return agentService.getIdeConnections();
    });
    electron_1.ipcMain.handle('ide:setTargetFilter', async (event, filter) => {
        validateSender(event);
        return agentService.setTargetIdeFilter(filter);
    });
    electron_1.ipcMain.handle('ide:updateConfig', async (event, ideId, config) => {
        validateSender(event);
        return agentService.updatePerIdeConfig(ideId, config);
    });
    electron_1.ipcMain.handle('ide:inspect', async (event, ideId) => {
        validateSender(event);
        return agentService.inspectIde(ideId);
    });
    // Diagnostics
    electron_1.ipcMain.handle('diagnostics:runInspect', async (event, delay = 0, targetHwnd = 0, targetPid = 0) => {
        validateSender(event);
        return psAdapter.inspectPromptSubtree(delay, targetHwnd, targetPid);
    });
    electron_1.ipcMain.handle('diagnostics:runComplete', async (event, targetSub = '(Recommended)', delay = 0, targetHwnd = 0, targetPid = 0, policy = 'auto_safe_only') => {
        validateSender(event);
        const sanitizedTarget = safetyGuard_1.SafetyGuard.sanitizeShellParameter(String(targetSub)) || '(Recommended)';
        const clampedDelay = Math.max(0, parseInt(String(delay), 10) || 0);
        return psAdapter.selectAndCompletePrompt(sanitizedTarget, clampedDelay, targetHwnd, targetPid, policy);
    });
    electron_1.ipcMain.handle('diagnostics:getReports', async (event) => {
        validateSender(event);
        return psAdapter.getAvailableDiagnosticReports();
    });
    electron_1.ipcMain.handle('diagnostics:readReport', async (event, fileName) => {
        validateSender(event);
        return psAdapter.readDiagnosticFile(fileName);
    });
    // Settings
    electron_1.ipcMain.handle('settings:get', async (event) => {
        validateSender(event);
        return docStore.getSettings();
    });
    electron_1.ipcMain.handle('settings:save', async (event, newSettings) => {
        validateSender(event);
        const updated = docStore.saveSettings(newSettings);
        if (updated.approvalPolicy) {
            agentService.setApprovalPolicy(updated.approvalPolicy);
        }
        if (updated.selectedWindowHwnd !== undefined) {
            agentService.setSelectedWindow(updated.selectedWindowHwnd);
        }
        registerEmergencyStop();
        return updated;
    });
    // System
    electron_1.ipcMain.handle('system:openPath', async (event, targetPath) => {
        validateSender(event);
        const safeAllowedRoots = [
            process.cwd(),
            docStore.getDiagnosticsDir(),
        ];
        const resolved = path_1.default.resolve(targetPath);
        const isAllowed = safeAllowedRoots.some(root => resolved.startsWith(path_1.default.resolve(root)));
        if (!isAllowed) {
            throw new Error('Access denied: target path is outside allowed application boundaries.');
        }
        return electron_1.shell.openPath(resolved);
    });
    electron_1.ipcMain.handle('system:emergencyStop', async (event) => {
        validateSender(event);
        const activeIds = engine.getActiveRunIds();
        for (const runId of activeIds) {
            engine.cancelRun(runId);
        }
        const runs = docStore.getAllRuns().filter(r => r.status === 'running');
        for (const run of runs) {
            engine.cancelRun(run.id);
        }
        agentService.stopMonitoring();
        return true;
    });
    electron_1.ipcMain.handle('storage:clearRuns', async (event) => {
        validateSender(event);
        return docStore.clearAllRuns();
    });
}
// Avoid Windows cache lock conflicts on simultaneous runs
electron_1.app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('[MAIN] Another instance of AutoPilot AI is already running. Quitting duplicate.');
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
    electron_1.app.whenReady().then(async () => {
        registerIpcHandlers();
        createWindow();
        registerEmergencyStop();
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0)
                createWindow();
        });
    });
    electron_1.app.on('will-quit', async () => {
        electron_1.globalShortcut.unregisterAll();
        agentService.stopMonitoring();
    });
    electron_1.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin')
            electron_1.app.quit();
    });
}
//# sourceMappingURL=main.js.map