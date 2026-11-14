"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntigravityAdapter = void 0;
const baseIdeAdapter_1 = require("./baseIdeAdapter");
const fileChangeApprovalDetector_1 = require("../fileChangeApprovalDetector");
class AntigravityAdapter extends baseIdeAdapter_1.BaseIdeAdapter {
    psAdapter;
    ideId = 'antigravity';
    displayName = 'Antigravity IDE';
    processNames = ['Antigravity', 'Antigravity IDE', 'electron'];
    defaultCapabilities = [
        'Prompt Submission',
        'Option Selection',
        'Accept All File Changes',
        'Terminal Command Approval',
    ];
    fileChangeDetector;
    constructor(psAdapter, fileChangeDetector) {
        super();
        this.psAdapter = psAdapter;
        this.fileChangeDetector = fileChangeDetector || new fileChangeApprovalDetector_1.FileChangeApprovalDetector(this.psAdapter);
    }
    async detectPrompt(hwnd, pid, targetSubstring) {
        return this.psAdapter.inspectPromptSubtree(0, hwnd, pid);
    }
    async detectFileChanges(hwnd, pid) {
        return this.fileChangeDetector.detectFileChangeApproval(hwnd, pid);
    }
    async detectTerminalApproval(hwnd, pid) {
        const prompt = await this.detectPrompt(hwnd, pid);
        if (prompt?.reportJson?.Buttons) {
            const runBtn = prompt.reportJson.Buttons.find((b) => {
                const lower = b.toLowerCase();
                return lower === 'run' || lower === 'run command' || lower === 'run in terminal';
            });
            if (runBtn) {
                return {
                    detected: true,
                    buttonName: runBtn,
                    category: 'TERMINAL_APPROVAL',
                };
            }
        }
        return { detected: false };
    }
    async executeAction(targetHwnd, targetPid, buttonName, category, policy = 'auto_safe_only') {
        return this.psAdapter.selectAndCompletePrompt('(Recommended)', 0, targetHwnd, targetPid, policy);
    }
}
exports.AntigravityAdapter = AntigravityAdapter;
//# sourceMappingURL=antigravityAdapter.js.map