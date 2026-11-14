import * as vscode from 'vscode';
import { AgentService } from '../../../electron/adapters/agentService';
import { DocumentStore } from '../../../electron/storage/documentStore';
import { WorkflowEngine } from '../../../electron/engine/workflowEngine';
import { AutoPilotViewProvider } from '../providers/autopilotViewProvider';

export function registerInspectAndWorkflowCommands(
  context: vscode.ExtensionContext,
  agentService: AgentService,
  docStore: DocumentStore,
  workflowEngine: WorkflowEngine,
  viewProvider: AutoPilotViewProvider
): vscode.Disposable[] {
  const inspectPromptCmd = vscode.commands.registerCommand('autopilot-ai.inspectPrompt', async () => {
    try {
      vscode.window.showInformationMessage('AutoPilot AI: Probing active prompt...');
      const res = await agentService.probePrompt();
      if (res?.reportJson?.PromptFound) {
        const option = res.reportJson.TargetOptionFound !== 'None' ? res.reportJson.TargetOptionFound : 'No recommendation';
        vscode.window.showInformationMessage(`Prompt Detected! Option: ${option}, Submit: ${res.reportJson.SubmitButtonFound}`);
      } else {
        vscode.window.showInformationMessage('No active confirmation prompt currently detected.');
      }
      viewProvider.navigateTo('prompts');
    } catch (err: any) {
      vscode.window.showErrorMessage(`Prompt inspection failed: ${err.message}`);
    }
  });

  const inspectFileChangesCmd = vscode.commands.registerCommand('autopilot-ai.inspectFileChanges', async () => {
    try {
      vscode.window.showInformationMessage('AutoPilot AI: Inspecting file changes & review banners...');
      const res = await agentService.inspectFileChanges();
      if (res?.fileChangeApprovalFound) {
        const files = res.modifiedFiles && res.modifiedFiles.length > 0 ? ` (${res.modifiedFiles.length} files)` : '';
        vscode.window.showInformationMessage(`File Change Approval Detected: '${res.buttonFound?.name || 'Accept all'}'${files} [Confidence: ${res.confidence}]`);
      } else {
        vscode.window.showInformationMessage('No pending file change approval banner detected.');
      }
      viewProvider.navigateTo('autopilot');
    } catch (err: any) {
      vscode.window.showErrorMessage(`File change inspection failed: ${err.message}`);
    }
  });

  const runWorkflowCmd = vscode.commands.registerCommand('autopilot-ai.runWorkflow', async () => {
    try {
      const workflows = docStore.getAllWorkflows();
      if (workflows.length === 0) {
        vscode.window.showWarningMessage('No workflows available to execute.');
        return;
      }
      const items = workflows.map((wf) => ({
        label: wf.name,
        description: `${wf.steps.length} steps | Policy: ${wf.approvalPolicy}`,
        detail: wf.description,
        workflowId: wf.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select an AutoPilot AI workflow to execute',
      });

      if (selected) {
        const wf = docStore.getWorkflowById(selected.workflowId);
        if (wf) {
          vscode.window.showInformationMessage(`Launching AutoPilot workflow: ${wf.name}`);
          viewProvider.navigateTo('monitor');
          await workflowEngine.executeWorkflow(wf, 'manual');
        }
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Workflow run failed: ${err.message}`);
    }
  });

  const openSettingsCmd = vscode.commands.registerCommand('autopilot-ai.openSettings', () => {
    viewProvider.navigateTo('settings');
  });

  const openDashboardCmd = vscode.commands.registerCommand('autopilot-ai.openDashboard', () => {
    viewProvider.navigateTo('dashboard');
  });

  return [inspectPromptCmd, inspectFileChangesCmd, runWorkflowCmd, openSettingsCmd, openDashboardCmd];
}

