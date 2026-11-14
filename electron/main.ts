import { app, BrowserWindow, ipcMain, globalShortcut, shell, IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs';
import { DocumentStore } from './storage/documentStore';
import { PowerShellAdapter } from './adapters/powershellAdapter';
import { WorkflowEngine } from './engine/workflowEngine';
import { AgentService } from './adapters/agentService';
import { SafetyGuard } from './security/safetyGuard';

let mainWindow: BrowserWindow | null = null;
const docStore = new DocumentStore();
const psAdapter = new PowerShellAdapter(docStore.getDiagnosticsDir());

const engine = new WorkflowEngine(
  docStore,
  psAdapter,
  (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('workflow:event', event);
    }
  }
);

const agentService = new AgentService(
  psAdapter,
  docStore,
  (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:status', status);
    }
  },
  (action) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:auto-action', action);
    }
  },
  (approvalData) => {
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
      } else {
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
  }
);

function validateSender(event: IpcMainInvokeEvent): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Application window is not available');
  }
  if (event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error('Unauthorized IPC invocation: sender frame mismatch');
  }
}

process.on('uncaughtException', (err) => console.error('[UNCAUGHT EXCEPTION]', err));
process.on('unhandledRejection', (err) => console.error('[UNHANDLED REJECTION]', err));

function createWindow(): void {
  const windowIcon = path.join(__dirname, '../dist/app-icon.png');
  mainWindow = new BrowserWindow({
    icon: fs.existsSync(windowIcon) ? windowIcon : undefined,
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#020617',
    title: 'AutoPilot AI — Workflow Automation',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
      shell.openExternal(url);
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

  const distPath = path.join(__dirname, '../dist/index.html');
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.warn('[MAIN] Could not connect to dev server, falling back to dist:', err);
      mainWindow?.loadFile(distPath);
    });
  } else if (fs.existsSync(distPath)) {
    console.log('[MAIN] Loading local production bundle:', distPath);
    mainWindow.loadFile(distPath);
  } else {
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
function registerEmergencyStop(): void {
  const settings = docStore.getSettings();
  const shortcut = settings.emergencyStopShortcut || 'Ctrl+Alt+S';

  globalShortcut.unregisterAll();
  try {
    globalShortcut.register(shortcut, () => {
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
  } catch (err) {
    console.error('Failed to register global emergency stop:', err);
  }
}

// --- IPC Registration ---

function registerIpcHandlers(): void {
  // Workflows
  ipcMain.handle('workflows:getAll', async (event) => {
    validateSender(event);
    return docStore.getAllWorkflows();
  });
  ipcMain.handle('workflows:getById', async (event, id: string) => {
    validateSender(event);
    return docStore.getWorkflowById(id);
  });
  ipcMain.handle('workflows:save', async (event, wf) => {
    validateSender(event);
    const validated = SafetyGuard.validateWorkflowSchema(wf);
    if (!validated.valid) throw new Error(validated.errors.join('; '));
    return docStore.saveWorkflow(wf);
  });
  ipcMain.handle('workflows:delete', async (event, id: string) => {
    validateSender(event);
    return docStore.deleteWorkflow(id);
  });
  ipcMain.handle('workflows:validate', async (event, wf) => {
    validateSender(event);
    return SafetyGuard.validateWorkflowSchema(wf);
  });
  ipcMain.handle('workflows:execute', async (event, wfId: string, triggeredBy = 'manual') => {
    validateSender(event);
    const wf = docStore.getWorkflowById(wfId);
    if (!wf) throw new Error(`Workflow '${wfId}' not found`);
    return engine.executeWorkflow(wf, triggeredBy as any);
  });

  // Runs
  ipcMain.handle('runs:getAll', async (event) => {
    validateSender(event);
    return docStore.getAllRuns();
  });
  ipcMain.handle('runs:getById', async (event, id: string) => {
    validateSender(event);
    return docStore.getRunById(id);
  });
  ipcMain.handle('runs:cancel', async (event, id: string) => {
    validateSender(event);
    return engine.cancelRun(id);
  });
  ipcMain.handle('runs:respondApproval', async (event, stepId: string, approved: boolean) => {
    validateSender(event);
    if (stepId === 'file_change_approval') {
      if (approved) {
        return agentService.executePendingFileChangeApproval();
      } else {
        agentService.rejectFileChangeApproval();
        return false;
      }
    }
    return engine.respondToApproval(stepId, approved);
  });

  // File Change Approval
  ipcMain.handle('fileChanges:inspect', async (event) => {
    validateSender(event);
    return agentService.inspectFileChanges();
  });
  ipcMain.handle('fileChanges:testDetect', async (event) => {
    validateSender(event);
    return agentService.testAcceptAllDetection();
  });
  ipcMain.handle('fileChanges:execute', async (event) => {
    validateSender(event);
    return agentService.executePendingFileChangeApproval();
  });

  // Agent
  ipcMain.handle('agent:getStatus', async (event) => {
    validateSender(event);
    return agentService.getStatus();
  });
  ipcMain.handle('agent:startMonitoring', async (event, intervalMs?: number) => {
    validateSender(event);
    return agentService.startMonitoring(intervalMs);
  });
  ipcMain.handle('agent:stopMonitoring', async (event) => {
    validateSender(event);
    return agentService.stopMonitoring();
  });
  ipcMain.handle('agent:scanTarget', async (event) => {
    validateSender(event);
    return agentService.scanTargetWindow();
  });
  ipcMain.handle('agent:probePrompt', async (event) => {
    validateSender(event);
    return agentService.probePrompt();
  });
  ipcMain.handle('agent:setAutoPilotEnabled', async (event, enabled: boolean) => {
    validateSender(event);
    return agentService.setAutoPilotEnabled(enabled);
  });
  ipcMain.handle('agent:setAutoPilotMode', async (event, mode: any) => {
    validateSender(event);
    return agentService.setAutoPilotMode(mode);
  });
  ipcMain.handle('agent:setAutoSubmitDelay', async (event, delayMs: number) => {
    validateSender(event);
    return agentService.setAutoSubmitDelayMs(delayMs);
  });
  ipcMain.handle('agent:triggerAutoSubmitNow', async (event, targetSubstring?: string) => {
    validateSender(event);
    return agentService.executeAutoPilotCycle(targetSubstring || '');
  });
  ipcMain.handle('agent:clearHistory', async (event) => {
    validateSender(event);
    return agentService.clearActionHistory();
  });
  ipcMain.handle('agent:setApprovalPolicy', async (event, policy: any) => {
    validateSender(event);
    docStore.saveSettings({ approvalPolicy: policy });
    return agentService.setApprovalPolicy(policy);
  });
  ipcMain.handle('agent:setSelectedWindow', async (event, hwnd: number | null) => {
    validateSender(event);
    docStore.saveSettings({ selectedWindowHwnd: hwnd });
    return agentService.setSelectedWindow(hwnd);
  });
  ipcMain.handle('agent:listWindows', async (event) => {
    validateSender(event);
    return psAdapter.listTargetWindows();
  });

  // Multi-IDE Automation
  ipcMain.handle('ide:getConnections', async (event) => {
    validateSender(event);
    return agentService.getIdeConnections();
  });
  ipcMain.handle('ide:setTargetFilter', async (event, filter: any) => {
    validateSender(event);
    return agentService.setTargetIdeFilter(filter);
  });
  ipcMain.handle('ide:updateConfig', async (event, ideId: any, config: any) => {
    validateSender(event);
    return agentService.updatePerIdeConfig(ideId, config);
  });
  ipcMain.handle('ide:inspect', async (event, ideId: any) => {
    validateSender(event);
    return agentService.inspectIde(ideId);
  });

  // Diagnostics
  ipcMain.handle('diagnostics:runInspect', async (event, delay = 0, targetHwnd = 0, targetPid = 0) => {
    validateSender(event);
    return psAdapter.inspectPromptSubtree(delay, targetHwnd, targetPid);
  });
  ipcMain.handle('diagnostics:runComplete', async (event, targetSub = '(Recommended)', delay = 0, targetHwnd = 0, targetPid = 0, policy = 'auto_safe_only') => {
    validateSender(event);
    const sanitizedTarget = SafetyGuard.sanitizeShellParameter(String(targetSub)) || '(Recommended)';
    const clampedDelay = Math.max(0, parseInt(String(delay), 10) || 0);
    return psAdapter.selectAndCompletePrompt(sanitizedTarget, clampedDelay, targetHwnd, targetPid, policy);
  });
  ipcMain.handle('diagnostics:getReports', async (event) => {
    validateSender(event);
    return psAdapter.getAvailableDiagnosticReports();
  });
  ipcMain.handle('diagnostics:readReport', async (event, fileName: string) => {
    validateSender(event);
    return psAdapter.readDiagnosticFile(fileName);
  });

  // Settings
  ipcMain.handle('settings:get', async (event) => {
    validateSender(event);
    return docStore.getSettings();
  });
  ipcMain.handle('settings:save', async (event, newSettings) => {
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
  ipcMain.handle('system:openPath', async (event, targetPath: string) => {
    validateSender(event);
    const safeAllowedRoots = [
      process.cwd(),
      docStore.getDiagnosticsDir(),
    ];
    const resolved = path.resolve(targetPath);
    const isAllowed = safeAllowedRoots.some(root => resolved.startsWith(path.resolve(root)));
    if (!isAllowed) {
      throw new Error('Access denied: target path is outside allowed application boundaries.');
    }
    return shell.openPath(resolved);
  });
  ipcMain.handle('system:emergencyStop', async (event) => {
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
  ipcMain.handle('storage:clearRuns', async (event) => {
    validateSender(event);
    return docStore.clearAllRuns();
  });
}

// Avoid Windows cache lock conflicts on simultaneous runs
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[MAIN] Another instance of AutoPilot AI is already running. Quitting duplicate.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    registerIpcHandlers();
    createWindow();
    registerEmergencyStop();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('will-quit', async () => {
    globalShortcut.unregisterAll();
    agentService.stopMonitoring();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

