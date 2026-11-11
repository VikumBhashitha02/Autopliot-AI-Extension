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
exports.AntigravityEnvironment = void 0;
const os = __importStar(require("os"));
function getVsCode() {
    try {
        return require('vscode');
    }
    catch {
        return null;
    }
}
class AntigravityEnvironment {
    /**
     * Performs verified detection of the host environment.
     * Can run safely both inside the VS Code / Antigravity Extension Host
     * and in test harnesses / CI environments.
     */
    static detect() {
        const vscode = getVsCode();
        const appName = vscode?.env?.appName || process.env.VSCODE_APP_NAME || 'Visual Studio Code';
        const appHost = vscode?.env?.appHost || process.env.VSCODE_APP_HOST || 'desktop';
        const uiKind = vscode?.env?.uiKind === 2 ? 'Web' : 'Desktop';
        const platform = os.platform();
        const isAntigravity = appName.toLowerCase().includes('antigravity') ||
            appHost.toLowerCase().includes('antigravity') ||
            Boolean(process.env.ANTIGRAVITY_APP) ||
            Boolean(process.env.GOOGLE_ANTIGRAVITY);
        const isDesktop = uiKind === 'Desktop';
        const supportsNativeProcessSpawning = isDesktop && (platform === 'win32' || platform === 'darwin' || platform === 'linux');
        return {
            isAntigravityHost: isAntigravity,
            appName,
            appHost,
            uiKind,
            platform,
            supportsNativeProcessSpawning,
            supportsVsixPackaging: true,
            supportsWebviewApi: true,
            capabilitiesSummary: isAntigravity
                ? `Running natively inside Google Antigravity IDE (${uiKind} host, platform: ${platform})`
                : `Running inside ${appName} with Google Antigravity external automation support enabled`,
        };
    }
    static isAntigravity() {
        return this.detect().isAntigravityHost;
    }
}
exports.AntigravityEnvironment = AntigravityEnvironment;
//# sourceMappingURL=antigravityEnvironment.js.map