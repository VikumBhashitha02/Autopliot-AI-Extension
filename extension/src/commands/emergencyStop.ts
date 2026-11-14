import * as vscode from 'vscode';
import { WorkflowEngine } from '../../../electron/engine/workflowEngine';
import { AgentService } from '../../../electron/adapters/agentService';
import { StatusBarProvider } from '../providers/statusBarProvider';

export function registerEmergencyStopCommand(
  context: vscode.ExtensionContext,
  workflowEngine: WorkflowEngine,
  agentService: AgentService,
  statusBarProvider: StatusBarProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('autopilot-ai.emergencyStop', async () => {
    // 1. Cancel in-flight active workflow runs
    const activeIds = workflowEngine.getActiveRunIds();
    for (const runId of activeIds) {
      workflowEngine.cancelRun(runId);
    }

    // 2. Stop agent background monitoring
    agentService.stopMonitoring();

    // 3. Update status bar
    const status = agentService.getStatus();
    status.state = 'paused';
    statusBarProvider.updateStatus(status);

    vscode.window.showWarningMessage('⚡ AutoPilot AI: Emergency Stop Triggered! All active workflows and watchers halted.');
  });
}

