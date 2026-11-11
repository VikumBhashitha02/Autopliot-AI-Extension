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
exports.StatusBarProvider = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarProvider {
    statusBarItem;
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'autopilot-ai.openDashboard';
        this.updateStatus({
            state: 'idle',
            autoPilotEnabled: true,
            autoPilotMode: 'full_auto',
            approvalPolicy: 'auto_safe_only',
            activeIdeName: 'AutoPilot AI',
        });
        this.statusBarItem.show();
    }
    updateStatus(status) {
        if (!status.autoPilotEnabled || status.state === 'paused') {
            this.statusBarItem.text = '$(debug-pause) AutoPilot: Paused';
            this.statusBarItem.tooltip = new vscode.MarkdownString('**AutoPilot AI**: Monitoring Paused\n\nClick to open AutoPilot Dashboard');
            this.statusBarItem.backgroundColor = undefined;
        }
        else if (status.state === 'monitoring' || status.state === 'idle') {
            const modeLabel = status.approvalPolicy === 'full_auto' ? 'Full Auto' : status.approvalPolicy === 'always_manual' ? 'Manual' : 'Safe';
            this.statusBarItem.text = `$(zap) AutoPilot: ${modeLabel}`;
            this.statusBarItem.tooltip = new vscode.MarkdownString(`**AutoPilot AI**: Active (${modeLabel})\n\n- **Target IDE**: ${status.activeIdeName || 'Auto-Detect'}\n- **Process PID**: ${status.targetPid || 'Scanning...'}\n- **Window**: ${status.targetWindowTitle || 'Detecting...'}\n\nClick to open AutoPilot Dashboard`);
            this.statusBarItem.backgroundColor = undefined;
        }
        else if (status.state === 'submitting' || status.state === 'file_change_accepting' || status.state === 'running') {
            this.statusBarItem.text = '$(sync~spin) AutoPilot: Executing';
            this.statusBarItem.tooltip = new vscode.MarkdownString(`**AutoPilot AI**: Executing Action...\n\n- **Step**: ${status.currentStepDescription || 'Working'}\n\nClick to open AutoPilot Dashboard`);
            this.statusBarItem.backgroundColor = undefined;
        }
        else if (status.state === 'awaiting_approval' || status.state === 'file_change_approval_required') {
            this.statusBarItem.text = '$(alert) AutoPilot: Approval Needed';
            this.statusBarItem.tooltip = new vscode.MarkdownString(`**AutoPilot AI**: Manual Approval Required\n\n${status.currentStepDescription || 'Pending User Confirmation'}\n\nClick to review and authorize`);
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else if (status.state === 'error' || status.state === 'failed') {
            this.statusBarItem.text = '$(error) AutoPilot: Error';
            this.statusBarItem.tooltip = new vscode.MarkdownString(`**AutoPilot AI**: Error encountered\n\n${status.error || 'Check logs for details'}`);
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBarProvider = StatusBarProvider;
//# sourceMappingURL=statusBarProvider.js.map