"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdeRegistry = void 0;
const antigravityAdapter_1 = require("./antigravityAdapter");
const vscodeCopilotAdapter_1 = require("./vscodeCopilotAdapter");
const fileChangeApprovalDetector_1 = require("../fileChangeApprovalDetector");
class IdeRegistry {
    psAdapter;
    adapters = new Map();
    constructor(psAdapter, fileChangeDetector) {
        this.psAdapter = psAdapter;
        const fcDetector = fileChangeDetector || new fileChangeApprovalDetector_1.FileChangeApprovalDetector(this.psAdapter);
        this.registerAdapter(new antigravityAdapter_1.AntigravityAdapter(this.psAdapter, fcDetector));
        this.registerAdapter(new vscodeCopilotAdapter_1.VscodeCopilotAdapter(this.psAdapter, fcDetector));
    }
    registerAdapter(adapter) {
        this.adapters.set(adapter.ideId, adapter);
    }
    getAdapter(ideId) {
        return this.adapters.get(ideId);
    }
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }
    resolveAdapterForWindow(win) {
        if (!win)
            return null;
        for (const adapter of this.adapters.values()) {
            if (adapter.matchesWindow(win)) {
                return adapter;
            }
        }
        // Default fallback to Antigravity
        return this.adapters.get('antigravity') || null;
    }
    getInitialConnectionInfos() {
        return this.getAllAdapters().map((adapter) => ({
            ideId: adapter.ideId,
            displayName: adapter.displayName,
            processName: adapter.processNames[0],
            pid: null,
            hwnd: null,
            windowTitle: null,
            windowClass: null,
            connectionStatus: 'disconnected',
            supportedCapabilities: adapter.defaultCapabilities,
            enabled: true,
        }));
    }
    async scanConnections(availableWindows) {
        const results = [];
        for (const adapter of this.adapters.values()) {
            const matched = availableWindows.find((w) => adapter.matchesWindow(w));
            let copilotStatus = undefined;
            if (adapter.ideId === 'vscode_copilot') {
                if (matched) {
                    copilotStatus = adapter.getCopilotStatus
                        ? await adapter.getCopilotStatus(matched.hwnd, matched.pid)
                        : 'connected';
                }
                else {
                    copilotStatus = 'not_detected';
                }
            }
            results.push({
                ideId: adapter.ideId,
                displayName: adapter.displayName,
                processName: adapter.processNames[0],
                pid: matched ? matched.pid : null,
                hwnd: matched ? matched.hwnd : null,
                windowTitle: matched ? matched.title : null,
                windowClass: matched ? matched.className : null,
                connectionStatus: matched ? 'connected' : 'disconnected',
                copilotStatus,
                supportedCapabilities: adapter.defaultCapabilities,
                enabled: true,
            });
        }
        return results;
    }
    static getDefaultIdeConfigs() {
        return {
            antigravity: {
                enabled: true,
                promptAutomation: true,
                fileChangeApproval: true,
                terminalApproval: true,
                recommendedOptionSelection: true,
                approvalPolicy: 'auto_safe_only',
                autoSubmitDelayMs: 250,
            },
            vscode_copilot: {
                enabled: true,
                promptAutomation: true,
                fileChangeApproval: true,
                terminalApproval: true,
                recommendedOptionSelection: true,
                approvalPolicy: 'auto_safe_only',
                autoSubmitDelayMs: 250,
            },
        };
    }
}
exports.IdeRegistry = IdeRegistry;
//# sourceMappingURL=ideRegistry.js.map