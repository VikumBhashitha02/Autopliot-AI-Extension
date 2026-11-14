"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowsAdapter = void 0;
const platformAdapter_1 = require("./platformAdapter");
class WindowsAdapter extends platformAdapter_1.PlatformAdapter {
    psAdapter;
    platformName = 'windows';
    constructor(psAdapter) {
        super();
        this.psAdapter = psAdapter;
    }
    getCapabilities() {
        return {
            supportsDesktopUia: true,
            supportsWindowEnumeration: true,
            supportsPromptSubtreeInspection: true,
            supportsRadioSelection: true,
            supportsButtonInvocation: true,
            supportsFileChangeApproval: true,
            platformName: 'windows',
        };
    }
    async listTargetWindows() {
        return this.psAdapter.listTargetWindows();
    }
    async inspectPromptSubtree(delaySeconds = 0, targetHwnd = 0, targetPid = 0, onLog) {
        return this.psAdapter.inspectPromptSubtree(delaySeconds, targetHwnd, targetPid, onLog);
    }
    async selectAndCompletePrompt(targetSubstring = '(Recommended)', delaySeconds = 0, targetHwnd = 0, targetPid = 0, approvalPolicy = 'auto_safe_only', selectOnly = false, onLog) {
        return this.psAdapter.selectAndCompletePrompt(targetSubstring, delaySeconds, targetHwnd, targetPid, approvalPolicy, selectOnly, onLog);
    }
    async inspectFileChangeApproval(delaySeconds = 0, targetHwnd = 0, targetPid = 0, onLog) {
        return this.psAdapter.inspectFileChangeApproval(delaySeconds, targetHwnd, targetPid, onLog);
    }
    async executeFileChangeApproval(targetHwnd = 0, targetPid = 0, delaySeconds = 0, approvalPolicy = 'auto_safe_only', onLog) {
        return this.psAdapter.executeFileChangeApproval(targetHwnd, targetPid, delaySeconds, approvalPolicy, onLog);
    }
}
exports.WindowsAdapter = WindowsAdapter;
//# sourceMappingURL=windowsAdapter.js.map