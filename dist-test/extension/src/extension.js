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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const documentStore_1 = require("../../electron/storage/documentStore");
const powershellAdapter_1 = require("../../electron/adapters/powershellAdapter");
const workflowEngine_1 = require("../../electron/engine/workflowEngine");
const agentService_1 = require("../../electron/adapters/agentService");
const autopilotViewProvider_1 = require("./providers/autopilotViewProvider");
const statusBarProvider_1 = require("./providers/statusBarProvider");
const emergencyStop_1 = require("./commands/emergencyStop");
const monitoringCommands_1 = require("./commands/monitoringCommands");
const inspectAndWorkflowCommands_1 = require("./commands/inspectAndWorkflowCommands");
const antigravityEnvironment_1 = require("./adapters/ide/antigravityEnvironment");
let agentServiceInstance = null;
let workflowEngineInstance = null;
let statusBarProviderInstance = null;
async function activate(context) {
    const envInfo = antigravityEnvironment_1.AntigravityEnvironment.detect();
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
    }
    catch (err) {
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
    const docStore = new documentStore_1.DocumentStore(storageDir || undefined, diagnosticsDir);
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(diagnosticsDir);
    const statusBarProvider = new statusBarProvider_1.StatusBarProvider();
    statusBarProviderInstance = statusBarProvider;
    context.subscriptions.push(statusBarProvider);
    let viewProvider = null;
    const workflowEngine = new workflowEngine_1.WorkflowEngine(docStore, psAdapter, (event) => {
        viewProvider?.postMessage('workflow:event', event);
    });
    workflowEngineInstance = workflowEngine;
    const agentService = new agentService_1.AgentService(psAdapter, docStore, (status) => {
        statusBarProvider.updateStatus(status);
        viewProvider?.postMessage('agent:status', status);
    }, (action) => {
        viewProvider?.postMessage('agent:auto-action', action);
    }, (approvalData) => {
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
    });
    agentServiceInstance = agentService;
    // 3. Register Webview Provider for the Sidebar
    viewProvider = new autopilotViewProvider_1.AutoPilotViewProvider(context.extensionUri, docStore, agentService, workflowEngine, psAdapter, statusBarProvider);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(autopilotViewProvider_1.AutoPilotViewProvider.viewType, viewProvider, { webviewOptions: { retainContextWhenHidden: true } }));
    // 4. Register Commands
    const emergencyStopCmd = (0, emergencyStop_1.registerEmergencyStopCommand)(context, workflowEngine, agentService, statusBarProvider);
    context.subscriptions.push(emergencyStopCmd);
    const monitoringCmds = (0, monitoringCommands_1.registerMonitoringCommands)(context, agentService, statusBarProvider);
    context.subscriptions.push(...monitoringCmds);
    const inspectCmds = (0, inspectAndWorkflowCommands_1.registerInspectAndWorkflowCommands)(context, agentService, docStore, workflowEngine, viewProvider);
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
function deactivate() {
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
//# sourceMappingURL=extension.js.map