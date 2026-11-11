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
exports.AutoPilotViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const safetyGuard_1 = require("../../../electron/security/safetyGuard");
const configurationSynchronizer_1 = require("./configurationSynchronizer");
class AutoPilotViewProvider {
    _extensionUri;
    _docStore;
    _agentService;
    _workflowEngine;
    _psAdapter;
    _statusBarProvider;
    static viewType = 'autopilot-ai.mainView';
    _view;
    constructor(_extensionUri, _docStore, _agentService, _workflowEngine, _psAdapter, _statusBarProvider) {
        this._extensionUri = _extensionUri;
        this._docStore = _docStore;
        this._agentService = _agentService;
        this._workflowEngine = _workflowEngine;
        this._psAdapter = _psAdapter;
        this._statusBarProvider = _statusBarProvider;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'dist-webview'),
            ],
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (message) => {
            const { id, channel, args = [] } = message;
            try {
                const result = await this._handleChannelMessage(channel, args);
                if (id) {
                    webviewView.webview.postMessage({ id, result, success: true });
                }
            }
            catch (err) {
                if (id) {
                    webviewView.webview.postMessage({ id, error: err?.message || String(err), success: false });
                }
            }
        });
        // Push initial status
        this.postMessage('agent:status', this._agentService.getStatus());
    }
    postMessage(channel, data) {
        if (this._view && this._view.visible) {
            this._view.webview.postMessage({ event: channel, data });
        }
    }
    navigateTo(tab) {
        if (this._view) {
            this._view.show?.(true);
            this.postMessage('navigation:tab', tab);
        }
    }
    async _handleChannelMessage(channel, args) {
        switch (channel) {
            // Workflows
            case 'workflows:getAll':
                return this._docStore.getAllWorkflows();
            case 'workflows:getById':
                return this._docStore.getWorkflowById(args[0]);
            case 'workflows:save': {
                const val = safetyGuard_1.SafetyGuard.validateWorkflowSchema(args[0]);
                if (!val.valid)
                    throw new Error(val.errors.join('; '));
                return this._docStore.saveWorkflow(args[0]);
            }
            case 'workflows:delete':
                return this._docStore.deleteWorkflow(args[0]);
            case 'workflows:execute': {
                const wf = this._docStore.getWorkflowById(args[0]);
                if (!wf)
                    throw new Error(`Workflow '${args[0]}' not found`);
                return this._workflowEngine.executeWorkflow(wf, (args[1] || 'manual'));
            }
            case 'workflows:validate':
                return safetyGuard_1.SafetyGuard.validateWorkflowSchema(args[0]);
            // Runs & Execution
            case 'runs:getAll':
                return this._docStore.getAllRuns();
            case 'runs:getById':
                return this._docStore.getRunById(args[0]);
            case 'runs:cancel':
                return this._workflowEngine.cancelRun(args[0]);
            case 'runs:respondApproval': {
                const [stepId, approved] = args;
                if (stepId === 'file_change_approval') {
                    if (approved) {
                        return this._agentService.executePendingFileChangeApproval();
                    }
                    else {
                        this._agentService.rejectFileChangeApproval();
                        return false;
                    }
                }
                return this._workflowEngine.respondToApproval(stepId, approved);
            }
            case 'storage:clearRuns':
                return this._docStore.clearAllRuns();
            // Agent
            case 'agent:getStatus':
                return this._agentService.getStatus();
            case 'agent:startMonitoring': {
                const res = await this._agentService.startMonitoring(args[0]);
                this._statusBarProvider.updateStatus(res);
                return res;
            }
            case 'agent:stopMonitoring': {
                const res = this._agentService.stopMonitoring();
                this._statusBarProvider.updateStatus(res);
                return res;
            }
            case 'agent:scanTarget':
                return this._agentService.scanTargetWindow();
            case 'agent:probePrompt':
                return this._agentService.probePrompt();
            case 'agent:setAutoPilotEnabled': {
                const res = this._agentService.setAutoPilotEnabled(args[0]);
                this._statusBarProvider.updateStatus(res);
                return res;
            }
            case 'agent:setAutoPilotMode': {
                const res = this._agentService.setAutoPilotMode(args[0]);
                this._statusBarProvider.updateStatus(res);
                return res;
            }
            case 'agent:setApprovalPolicy': {
                this._docStore.saveSettings({ approvalPolicy: args[0] });
                const res = this._agentService.setApprovalPolicy(args[0]);
                this._statusBarProvider.updateStatus(res);
                return res;
            }
            case 'agent:setSelectedWindow':
                this._docStore.saveSettings({ selectedWindowHwnd: args[0] });
                return this._agentService.setSelectedWindow(args[0]);
            case 'agent:listWindows':
                return this._psAdapter.listTargetWindows();
            case 'agent:setAutoSubmitDelay':
                return this._agentService.setAutoSubmitDelayMs(args[0]);
            case 'agent:triggerAutoSubmitNow':
                return this._agentService.executeAutoPilotCycle(args[0] || '(Recommended)');
            case 'agent:clearHistory':
                return this._agentService.clearActionHistory();
            case 'system:emergencyStop': {
                const activeIds = this._workflowEngine.getActiveRunIds();
                for (const runId of activeIds) {
                    this._workflowEngine.cancelRun(runId);
                }
                this._agentService.stopMonitoring();
                const status = this._agentService.getStatus();
                status.state = 'paused';
                this._statusBarProvider.updateStatus(status);
                return true;
            }
            // File Change Approval
            case 'fileChanges:inspect':
                return this._agentService.inspectFileChanges();
            case 'fileChanges:testDetect':
                return this._agentService.testAcceptAllDetection();
            case 'fileChanges:execute':
                return this._agentService.executePendingFileChangeApproval();
            // Multi-IDE Automation
            case 'ide:getConnections':
                return this._agentService.getIdeConnections();
            case 'ide:setTargetFilter':
                return this._agentService.setTargetIdeFilter(args[0]);
            case 'ide:updateConfig':
                return this._agentService.updatePerIdeConfig(args[0], args[1]);
            case 'ide:inspect':
                return this._agentService.inspectIde(args[0]);
            // Diagnostics
            case 'diagnostics:runInspect':
                return this._psAdapter.inspectPromptSubtree(args[0] || 0, args[1] || 0, args[2] || 0);
            case 'diagnostics:runComplete': {
                const sanitized = safetyGuard_1.SafetyGuard.sanitizeShellParameter(String(args[0] || '(Recommended)'));
                return this._psAdapter.selectAndCompletePrompt(sanitized, args[1] || 0, args[2] || 0, args[3] || 0, args[4] || 'auto_safe_only');
            }
            case 'diagnostics:getReports':
                return this._psAdapter.getAvailableDiagnosticReports();
            case 'diagnostics:readReport':
                return this._psAdapter.readDiagnosticFile(args[0]);
            // Settings
            case 'settings:get':
                return this._docStore.getSettings();
            case 'settings:save': {
                const updated = this._docStore.saveSettings(args[0]);
                if (updated.approvalPolicy) {
                    this._agentService.setApprovalPolicy(updated.approvalPolicy);
                }
                if (updated.selectedWindowHwnd !== undefined) {
                    this._agentService.setSelectedWindow(updated.selectedWindowHwnd);
                }
                // Bidirectionally synchronize settings with VS Code configuration
                configurationSynchronizer_1.ConfigurationSynchronizer.syncFromStoreToVsCode(args[0]).catch((err) => {
                    console.warn('[AutoPilot AI] Background config sync warning:', err);
                });
                this._statusBarProvider.updateStatus(this._agentService.getStatus());
                return updated;
            }
            // System
            case 'system:openPath':
                return vscode.env.openExternal(vscode.Uri.file(args[0]));
            default:
                throw new Error(`Unsupported AutoPilot IPC channel: ${channel}`);
        }
    }
    _getHtmlForWebview(webview) {
        const distPath = path.join(this._extensionUri.fsPath, 'dist');
        const indexHtmlPath = path.join(distPath, 'index.html');
        let html = '';
        if (fs.existsSync(indexHtmlPath)) {
            html = fs.readFileSync(indexHtmlPath, 'utf-8');
            // Convert relative assets (./assets/..., /assets/..., assets/..., and local bundled files) to webview URIs
            html = html.replace(/(src|href)=["']((?:\.?\/)?assets\/[^"']+|(?:\.?\/)?[^"':]+\.(?:png|jpg|jpeg|svg|ico|css|js))["']/gi, (match, attr, assetPath) => {
                if (/^(?:https?:|\/\/|data:)/i.test(assetPath)) {
                    return match;
                }
                const cleanPath = assetPath.replace(/^(\.\/|\/)/, '');
                const fileOnDisk = vscode.Uri.file(path.join(distPath, cleanPath));
                if (fs.existsSync(fileOnDisk.fsPath)) {
                    const webviewUri = webview.asWebviewUri(fileOnDisk);
                    return `${attr}="${webviewUri}"`;
                }
                return match;
            });
            // Ensure Content-Security-Policy is enforced for the webview
            const cspSource = webview.cspSource;
            const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'unsafe-inline' ${cspSource}; style-src 'unsafe-inline' ${cspSource} https://fonts.googleapis.com; font-src ${cspSource} https://fonts.gstatic.com;">`;
            if (!html.includes('http-equiv="Content-Security-Policy"') && html.includes('<head>')) {
                html = html.replace('<head>', `<head>\n  ${cspMeta}`);
            }
        }
        else {
            // Fallback placeholder while building
            html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoPilot AI</title>
  <style>
    body { background-color: #020617; color: #f8fafc; font-family: sans-serif; padding: 24px; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    h2 { color: #38bdf8; margin-top: 0; }
    button { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚡ AutoPilot AI</h2>
    <p>Visual Studio Code &amp; Google Antigravity Automation Extension active.</p>
    <button onclick="window.api.emergencyStop()">Emergency Stop</button>
  </div>
</body>
</html>`;
        }
        // Inject the VS Code Webview RPC bridge before any other script
        const rpcBridge = `
<script>
  (function() {
    const vscode = acquireVsCodeApi();
    let requestId = 0;
    const pendingRequests = new Map();
    const eventListeners = new Map();

    window.addEventListener('message', function(event) {
      const data = event.data;
      if (data.id && pendingRequests.has(data.id)) {
        const { resolve, reject } = pendingRequests.get(data.id);
        pendingRequests.delete(data.id);
        if (data.success) {
          resolve(data.result);
        } else {
          reject(new Error(data.error || 'Request failed'));
        }
      } else if (data.event) {
        const listeners = eventListeners.get(data.event) || [];
        listeners.forEach(fn => {
          try { fn(data.data); } catch (e) { console.error(e); }
        });
      }
    });

    function callRpc(channel, ...args) {
      return new Promise((resolve, reject) => {
        const id = 'req_' + (++requestId) + '_' + Date.now();
        pendingRequests.set(id, { resolve, reject });
        vscode.postMessage({ id, channel, args });
      });
    }

    function addEventListener(channel, callback) {
      if (!eventListeners.has(channel)) {
        eventListeners.set(channel, []);
      }
      eventListeners.get(channel).push(callback);
      return function() {
        const arr = eventListeners.get(channel) || [];
        const idx = arr.indexOf(callback);
        if (idx !== -1) arr.splice(idx, 1);
      };
    }

    window.api = {
      // Workflows
      getWorkflows: () => callRpc('workflows:getAll'),
      getWorkflow: (id) => callRpc('workflows:getById', id),
      saveWorkflow: (wf) => callRpc('workflows:save', wf),
      deleteWorkflow: (id) => callRpc('workflows:delete', id),
      executeWorkflow: (wfId, triggeredBy) => callRpc('workflows:execute', wfId, triggeredBy),
      validateWorkflow: (wf) => callRpc('workflows:validate', wf),

      // Runs & Execution
      getRuns: () => callRpc('runs:getAll'),
      getRun: (id) => callRpc('runs:getById', id),
      cancelRun: (id) => callRpc('runs:cancel', id),
      respondApproval: (stepId, approved) => callRpc('runs:respondApproval', stepId, approved),
      clearRuns: () => callRpc('storage:clearRuns'),

      // Agent
      getAgentStatus: () => callRpc('agent:getStatus'),
      startAgentMonitoring: (intervalMs) => callRpc('agent:startMonitoring', intervalMs),
      stopAgentMonitoring: () => callRpc('agent:stopMonitoring'),
      scanTarget: () => callRpc('agent:scanTarget'),
      probePrompt: () => callRpc('agent:probePrompt'),
      setAutoPilotEnabled: (enabled) => callRpc('agent:setAutoPilotEnabled', enabled),
      setAutoPilotMode: (mode) => callRpc('agent:setAutoPilotMode', mode),
      setApprovalPolicy: (policy) => callRpc('agent:setApprovalPolicy', policy),
      setSelectedWindow: (hwnd) => callRpc('agent:setSelectedWindow', hwnd),
      listTargetWindows: () => callRpc('agent:listWindows'),
      setAutoSubmitDelay: (delayMs) => callRpc('agent:setAutoSubmitDelay', delayMs),
      triggerAutoSubmitNow: (targetSubstring) => callRpc('agent:triggerAutoSubmitNow', targetSubstring),
      clearActionHistory: () => callRpc('agent:clearHistory'),
      emergencyStop: () => callRpc('system:emergencyStop'),

      // File Change Approval
      inspectFileChanges: () => callRpc('fileChanges:inspect'),
      testAcceptAllDetection: () => callRpc('fileChanges:testDetect'),
      executeFileChangeApproval: () => callRpc('fileChanges:execute'),

      // Multi-IDE Automation
      getIdeConnections: () => callRpc('ide:getConnections'),
      setTargetIdeFilter: (filter) => callRpc('ide:setTargetFilter', filter),
      updatePerIdeConfig: (ideId, config) => callRpc('ide:updateConfig', ideId, config),
      inspectIde: (ideId) => callRpc('ide:inspect', ideId),

      // Diagnostics
      runDiagnosticInspect: (delay, hwnd, pid) => callRpc('diagnostics:runInspect', delay, hwnd, pid),
      runDiagnosticComplete: (target, delay, hwnd, pid, policy) => callRpc('diagnostics:runComplete', target, delay, hwnd, pid, policy),
      getDiagnosticReports: () => callRpc('diagnostics:getReports'),
      readDiagnosticReport: (fileName) => callRpc('diagnostics:readReport', fileName),

      // Settings
      getSettings: () => callRpc('settings:get'),
      saveSettings: (settings) => callRpc('settings:save', settings),

      // Events
      onWorkflowEvent: (callback) => addEventListener('workflow:event', callback),
      onAgentStatusChange: (callback) => addEventListener('agent:status', callback),
      onAutoAction: (callback) => addEventListener('agent:auto-action', callback),

      // System
      openPath: (targetPath) => callRpc('system:openPath', targetPath),
    };
  })();
</script>`;
        // Inject RPC bridge into head
        if (html.includes('<head>')) {
            html = html.replace('<head>', '<head>' + rpcBridge);
        }
        else {
            html = rpcBridge + html;
        }
        return html;
    }
}
exports.AutoPilotViewProvider = AutoPilotViewProvider;
//# sourceMappingURL=autopilotViewProvider.js.map