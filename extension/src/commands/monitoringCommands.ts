import * as vscode from 'vscode';
import { AgentService } from '../../../electron/adapters/agentService';
import { StatusBarProvider } from '../providers/statusBarProvider';

export function registerMonitoringCommands(
  context: vscode.ExtensionContext,
  agentService: AgentService,
  statusBarProvider: StatusBarProvider
): vscode.Disposable[] {
  const startCmd = vscode.commands.registerCommand('autopilot-ai.startMonitoring', async () => {
    try {
      const status = await agentService.startMonitoring(1800);
      statusBarProvider.updateStatus(status);
      vscode.window.showInformationMessage('⚡ AutoPilot AI: Monitoring Started.');
    } catch (err: any) {
      vscode.window.showErrorMessage(`AutoPilot monitoring failed to start: ${err.message}`);
    }
  });

  const pauseCmd = vscode.commands.registerCommand('autopilot-ai.pauseMonitoring', async () => {
    try {
      const status = agentService.setAutoPilotEnabled(false);
      statusBarProvider.updateStatus(status);
      vscode.window.showInformationMessage('⚡ AutoPilot AI: Monitoring Paused.');
    } catch (err: any) {
      vscode.window.showErrorMessage(`AutoPilot pause failed: ${err.message}`);
    }
  });

  const stopCmd = vscode.commands.registerCommand('autopilot-ai.stopMonitoring', async () => {
    try {
      const status = agentService.stopMonitoring();
      statusBarProvider.updateStatus(status);
      vscode.window.showInformationMessage('⚡ AutoPilot AI: Monitoring Stopped.');
    } catch (err: any) {
      vscode.window.showErrorMessage(`AutoPilot stop failed: ${err.message}`);
    }
  });

  return [startCmd, pauseCmd, stopCmd];
}

