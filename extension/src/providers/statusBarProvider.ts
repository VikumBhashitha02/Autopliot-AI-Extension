import * as vscode from 'vscode';
import { AgentStatus } from '../../../electron/engine/types';

export class StatusBarProvider implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'autopilot-ai.openDashboard';
    this.updateStatus({
      state: 'idle',
      autoPilotEnabled: true,
      autoPilotMode: 'full_auto',
      approvalPolicy: 'auto_safe_only',
      activeIdeName: 'AutoPilot AI',
    } as any);
    this.statusBarItem.show();
  }

  public updateStatus(status: AgentStatus): void {
    if (!status.autoPilotEnabled || status.state === 'paused') {
      this.statusBarItem.text = '$(debug-pause) AutoPilot: Paused';
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        '**AutoPilot AI**: Monitoring Paused\n\nClick to open AutoPilot Dashboard'
      );
      this.statusBarItem.backgroundColor = undefined;
    } else if (status.state === 'monitoring' || status.state === 'idle') {
      const modeLabel = status.approvalPolicy === 'full_auto' ? 'Full Auto' : status.approvalPolicy === 'always_manual' ? 'Manual' : 'Safe';
      this.statusBarItem.text = `$(zap) AutoPilot: ${modeLabel}`;
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        `**AutoPilot AI**: Active (${modeLabel})\n\n- **Target IDE**: ${status.activeIdeName || 'Auto-Detect'}\n- **Process PID**: ${status.targetPid || 'Scanning...'}\n- **Window**: ${status.targetWindowTitle || 'Detecting...'}\n\nClick to open AutoPilot Dashboard`
      );
      this.statusBarItem.backgroundColor = undefined;
    } else if (status.state === 'submitting' || status.state === 'file_change_accepting' || status.state === 'running') {
      this.statusBarItem.text = '$(sync~spin) AutoPilot: Executing';
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        `**AutoPilot AI**: Executing Action...\n\n- **Step**: ${status.currentStepDescription || 'Working'}\n\nClick to open AutoPilot Dashboard`
      );
      this.statusBarItem.backgroundColor = undefined;
    } else if (status.state === 'awaiting_approval' || status.state === 'file_change_approval_required') {
      this.statusBarItem.text = '$(alert) AutoPilot: Approval Needed';
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        `**AutoPilot AI**: Manual Approval Required\n\n${status.currentStepDescription || 'Pending User Confirmation'}\n\nClick to review and authorize`
      );
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (status.state === 'error' || status.state === 'failed') {
      this.statusBarItem.text = '$(error) AutoPilot: Error';
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        `**AutoPilot AI**: Error encountered\n\n${status.error || 'Check logs for details'}`
      );
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}

