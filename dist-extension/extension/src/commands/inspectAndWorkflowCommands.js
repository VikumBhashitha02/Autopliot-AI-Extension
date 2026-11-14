"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInspectAndWorkflowCommands = registerInspectAndWorkflowCommands;
const vscode = __importStar(require("vscode"));
function registerInspectAndWorkflowCommands(context, agentService, docStore, workflowEngine, viewProvider) {
    const inspectPromptCmd = vscode.commands.registerCommand('autopilot-ai.inspectPrompt', async () => {
        try {
            vscode.window.showInformationMessage('AutoPilot AI: Probing active prompt...');
            const res = await agentService.probePrompt();
            if (res?.reportJson?.PromptFound) {
                const option = res.reportJson.TargetOptionFound !== 'None' ? res.reportJson.TargetOptionFound : 'No recommendation';
                vscode.window.showInformationMessage(`Prompt Detected! Option: ${option}, Submit: ${res.reportJson.SubmitButtonFound}`);
            }
            else {
                vscode.window.showInformationMessage('No active confirmation prompt currently detected.');
            }
            viewProvider.navigateTo('prompts');
        }
        catch (err) {
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
            }
            else {
                vscode.window.showInformationMessage('No pending file change approval banner detected.');
            }
            viewProvider.navigateTo('autopilot');
        }
        catch (err) {
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
        }
        catch (err) {
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
//# sourceMappingURL=inspectAndWorkflowCommands.js.map