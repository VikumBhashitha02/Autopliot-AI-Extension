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
exports.registerMonitoringCommands = registerMonitoringCommands;
const vscode = __importStar(require("vscode"));
function registerMonitoringCommands(context, agentService, statusBarProvider) {
    const startCmd = vscode.commands.registerCommand('autopilot-ai.startMonitoring', async () => {
        try {
            const status = await agentService.startMonitoring(1800);
            statusBarProvider.updateStatus(status);
            vscode.window.showInformationMessage('⚡ AutoPilot AI: Monitoring Started.');
        }
        catch (err) {
            vscode.window.showErrorMessage(`AutoPilot monitoring failed to start: ${err.message}`);
        }
    });
    const pauseCmd = vscode.commands.registerCommand('autopilot-ai.pauseMonitoring', async () => {
        try {
            const status = agentService.setAutoPilotEnabled(false);
            statusBarProvider.updateStatus(status);
            vscode.window.showInformationMessage('⚡ AutoPilot AI: Monitoring Paused.');
        }
        catch (err) {
            vscode.window.showErrorMessage(`AutoPilot pause failed: ${err.message}`);
        }
    });
    const stopCmd = vscode.commands.registerCommand('autopilot-ai.stopMonitoring', async () => {
        try {
            const status = agentService.stopMonitoring();
            statusBarProvider.updateStatus(status);
            vscode.window.showInformationMessage('⚡ AutoPilot AI: Monitoring Stopped.');
        }
        catch (err) {
            vscode.window.showErrorMessage(`AutoPilot stop failed: ${err.message}`);
        }
    });
    return [startCmd, pauseCmd, stopCmd];
}
//# sourceMappingURL=monitoringCommands.js.map