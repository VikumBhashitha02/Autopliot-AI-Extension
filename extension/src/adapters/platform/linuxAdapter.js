"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinuxAdapter = void 0;
const platformAdapter_1 = require("./platformAdapter");
class LinuxAdapter extends platformAdapter_1.PlatformAdapter {
    platformName = 'linux';
    getCapabilities() {
        return {
            supportsDesktopUia: false,
            supportsWindowEnumeration: false,
            supportsPromptSubtreeInspection: false,
            supportsRadioSelection: false,
            supportsButtonInvocation: false,
            supportsFileChangeApproval: false,
            platformName: 'linux',
            limitationMessage: 'Windows UIAutomation is not supported on Linux. Native VS Code Extension API commands and workspace automation remain fully operational.',
        };
    }
    async listTargetWindows() {
        return [];
    }
    async inspectPromptSubtree() {
        return {
            exitCode: 1,
            stdout: '',
            stderr: 'Linux does not support Windows UIAutomation inspection.',
            timedOut: false,
            durationMs: 0,
        };
    }
    async selectAndCompletePrompt() {
        return {
            exitCode: 1,
            stdout: '',
            stderr: 'Linux does not support Windows UIAutomation completion.',
            timedOut: false,
            durationMs: 0,
        };
    }
    async inspectFileChangeApproval() {
        return {
            exitCode: 1,
            stdout: '',
            stderr: 'Linux does not support Windows UIAutomation file change inspection.',
            timedOut: false,
            durationMs: 0,
        };
    }
    async executeFileChangeApproval() {
        return {
            exitCode: 1,
            stdout: '',
            stderr: 'Linux does not support Windows UIAutomation file change execution.',
            timedOut: false,
            durationMs: 0,
        };
    }
}
exports.LinuxAdapter = LinuxAdapter;
//# sourceMappingURL=linuxAdapter.js.map