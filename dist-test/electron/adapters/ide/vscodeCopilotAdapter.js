"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VscodeCopilotAdapter = void 0;
const baseIdeAdapter_1 = require("./baseIdeAdapter");
const fileChangeApprovalDetector_1 = require("../fileChangeApprovalDetector");
const universalActionDetector_1 = require("./shared/universalActionDetector");
const safetyGuard_1 = require("../../security/safetyGuard");
class VscodeCopilotAdapter extends baseIdeAdapter_1.BaseIdeAdapter {
    psAdapter;
    ideId = 'vscode_copilot';
    displayName = 'VS Code + GitHub Copilot';
    processNames = ['Code', 'Code.exe', 'Visual Studio Code'];
    defaultCapabilities = [
        'Copilot Chat Prompts',
        'Inline Edit Approvals',
        'Apply Changes',
        'Terminal Command Approval',
        'Dialog Confirmation',
    ];
    fileChangeDetector;
    constructor(psAdapter, fileChangeDetector) {
        super();
        this.psAdapter = psAdapter;
        this.fileChangeDetector = fileChangeDetector || new fileChangeApprovalDetector_1.FileChangeApprovalDetector(this.psAdapter);
    }
    async getCopilotStatus(hwnd, pid) {
        if (!hwnd && !pid)
            return 'not_detected';
        try {
            const res = await this.psAdapter.inspectPromptSubtree(0, hwnd, pid);
            const title = (res?.reportJson?.WindowTitle || '').toLowerCase();
            const rawText = JSON.stringify(res?.reportJson || {}).toLowerCase();
            if (title.includes('copilot') || rawText.includes('copilot') || rawText.includes('chat')) {
                return 'connected';
            }
            if (rawText.includes('code') || title.includes('code')) {
                return 'interface_unavailable';
            }
            return 'not_detected';
        }
        catch {
            return 'not_detected';
        }
    }
    async detectPrompt(hwnd, pid, targetSubstring) {
        const res = await this.psAdapter.inspectPromptSubtree(0, hwnd, pid);
        if (res?.reportJson) {
            res.reportJson.Ide = 'vscode_copilot';
            res.reportJson.IdeDisplayName = this.displayName;
        }
        return res;
    }
    async detectFileChanges(hwnd, pid) {
        const res = await this.fileChangeDetector.detectFileChangeApproval(hwnd, pid);
        if (res.fileChangeApprovalFound) {
            res.detectionEvidence.push('VS Code Copilot inline diff / review container identified');
        }
        return res;
    }
    async detectTerminalApproval(hwnd, pid) {
        const prompt = await this.detectPrompt(hwnd, pid);
        if (prompt?.reportJson?.Buttons) {
            for (const btn of prompt.reportJson.Buttons) {
                if (safetyGuard_1.SafetyGuard.isDestructiveOrRejection(btn))
                    continue;
                const candidate = universalActionDetector_1.UniversalActionDetector.evaluateCandidate(btn, 'VS Code Terminal Confirmation');
                if (candidate.category === 'TERMINAL_APPROVAL') {
                    return {
                        detected: true,
                        buttonName: btn,
                        category: 'TERMINAL_APPROVAL',
                        confidence: candidate.confidence,
                    };
                }
            }
        }
        return { detected: false };
    }
    async executeAction(targetHwnd, targetPid, buttonName, category, policy = 'auto_safe_only') {
        if (safetyGuard_1.SafetyGuard.isDestructiveOrRejection(buttonName)) {
            throw new Error(`Execution blocked: Action '${buttonName}' is destructive or rejection.`);
        }
        return this.psAdapter.selectAndCompletePrompt('(Recommended)', 0, targetHwnd, targetPid, policy);
    }
}
exports.VscodeCopilotAdapter = VscodeCopilotAdapter;
//# sourceMappingURL=vscodeCopilotAdapter.js.map