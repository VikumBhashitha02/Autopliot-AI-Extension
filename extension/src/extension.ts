import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentStore } from '../../electron/storage/documentStore';
import { PowerShellAdapter } from '../../electron/adapters/powershellAdapter';
import { WorkflowEngine } from '../../electron/engine/workflowEngine';
import { AgentService } from '../../electron/adapters/agentService';
import { AutoPilotViewProvider } from './providers/autopilotViewProvider';
import { StatusBarProvider } from './providers/statusBarProvider';
import { registerEmergencyStopCommand } from './commands/emergencyStop';
import { registerMonitoringCommands } from './commands/monitoringCommands';
import { registerInspectAndWorkflowCommands } from './commands/inspectAndWorkflowCommands';
import { AntigravityEnvironment } from './adapters/ide/antigravityEnvironment';

let agentServiceInstance: AgentService | null = null;
let workflowEngineInstance: WorkflowEngine | null = null;
let statusBarProviderInstance: StatusBarProvider | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const envInfo = AntigravityEnvironment.detect();
  const hostLabel = envInfo.isAntigravityHost ? 'Google Antigravity IDE' : (envInfo.appName || 'Visual Studio Code');
  console.log(`[AutoPilot AI] Activating AutoPilot AI extension on ${hostLabel} (Platform: ${envInfo.platform})`);

  // 1. Storage setup: Use context.globalStorageUri with fallback to project app_data
  let storageDir = '';
  try {
    if (context.globalStorageUri) {
      storageDir = context.globalStorageUri.fsPath;
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
    }
  } catch (err) {
    console.warn('[AutoPilot AI] Failed to initialize globalStorageUri, using fallback:', err);
  }

  // 2. Diagnostics directory location
  const candidates = [
    path.join(context.extensionPath, 'diagnostics'),
    path.join(context.extensionPath, 'dist', 'diagnostics'),
    path.resolve(process.cwd(), 'diagnostics'),
  ];
  let diagnosticsDir = candidates[0];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      diagnosticsDir = cand;
      break;
    }
  }

  const docStore = new DocumentStore(storageDir || undefined, diagnosticsDir);
  const psAdapter = new PowerShellAdapter(diagnosticsDir);
  const statusBarProvider = new StatusBarProvider();
  statusBarProviderInstance = statusBarProvider;
  context.subscriptions.push(statusBarProvider);

  let viewProvider: AutoPilotViewProvider | null = null;

  const workflowEngine = new WorkflowEngine(
    docStore,
    psAdapter,
    (event) => {
      viewProvider?.postMessage('workflow:event', event);
    }
  );
  workflowEngineInstance = workflowEngine;

  const agentService = new AgentService(
    psAdapter,
    docStore,
    (status) => {
      statusBarProvider.updateStatus(status);
      viewProvider?.postMessage('agent:status', status);
    },
    (action) => {
      viewProvider?.postMessage('agent:auto-action', action);
    },
    (approvalData) => {
      viewProvider?.postMessage('workflow:event', {
        type: 'approval_required',
        runId: 'agent',
        data: {
          stepId: approvalData.type === 'file_change_approval' ? 'file_change_approval' : 'agent_approval',
          prompt: approvalData.type === 'file_change_approval'
            ? `Approval Required: Accept file changes in '${approvalData.WindowTitle || 'Antigravity IDE'}'?`
            : `Approval Required: Action in '${approvalData.WindowTitle || 'Antigravity'}' has no explicit recommendation. Proceed with submission?`,
          metadata: approvalData,
        },
      });
    }
  );
  agentServiceInstance = agentService;

  // 3. Register Webview Provider for the Sidebar
  viewProvider = new AutoPilotViewProvider(
    context.extensionUri,
    docStore,
    agentService,
    workflowEngine,
    psAdapter,
    statusBarProvider
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AutoPilotViewProvider.viewType,
      viewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // 4. Register Commands
  const emergencyStopCmd = registerEmergencyStopCommand(context, workflowEngine, agentService, statusBarProvider);
  context.subscriptions.push(emergencyStopCmd);

  const monitoringCmds = registerMonitoringCommands(context, agentService, statusBarProvider);
  context.subscriptions.push(...monitoringCmds);

  const inspectCmds = registerInspectAndWorkflowCommands(context, agentService, docStore, workflowEngine, viewProvider);
  context.subscriptions.push(...inspectCmds);

  // 5. Auto-start monitoring if configured in settings
  const settings = docStore.getSettings();
  if (settings.autoStartMonitoring !== false) {
    agentService.startMonitoring(1800).catch((err) => {
      console.warn('[AutoPilot AI] Auto-start monitoring warning:', err);
    });
  }

  // 6. Report successful activation
  vscode.window.setStatusBarMessage(`$(zap) AutoPilot AI active (${hostLabel})`, 4000);
}

export function deactivate(): void {
  console.log('[AutoPilot AI] Deactivating AutoPilot AI extension...');
  if (workflowEngineInstance) {
    const activeIds = workflowEngineInstance.getActiveRunIds();
    for (const runId of activeIds) {
      workflowEngineInstance.cancelRun(runId);
    }
  }
  if (agentServiceInstance) {
    agentServiceInstance.stopMonitoring();
  }
}

