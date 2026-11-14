"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafetyGuard = void 0;
const path_1 = __importDefault(require("path"));
class SafetyGuard {
    static ALLOWED_STEP_TYPES = new Set([
        'launch_app',
        'wait_for_condition',
        'detect_prompt',
        'inspect_ui',
        'select_radio',
        'invoke_button',
        'capture_snapshot',
        'write_log',
        'branch_condition',
        'user_approval',
    ]);
    static SENSITIVE_PATTERNS = [
        /(password|passwd|pwd)[\s:=]+([^\s,;]+)/gi,
        /(secret|token|api[_-]?key|bearer)[\s:=]+([^\s,;]+)/gi,
        /([a-zA-Z0-9_\-\.]{20,}\.[a-zA-Z0-9_\-\.]{20,})/g, // long tokens
    ];
    static DANGEROUS_COMMAND_STRINGS = [
        'rm -rf',
        'format ',
        'mkfs',
        'del /f /s /q c:',
        'rd /s /q c:',
        'shutdown',
        ':(){ :|:& };:',
        'drop database',
        'truncate table',
    ];
    static ALLOWED_TARGET_APPS = [
        'Antigravity',
        'Antigravity IDE',
        'Code',
        'Code.exe',
        'Visual Studio Code',
        'notepad',
        'notepad.exe',
        'explorer',
        'explorer.exe',
    ];
    static isAllowedTargetApp(appName) {
        if (!appName || typeof appName !== 'string')
            return false;
        const clean = appName.trim().toLowerCase();
        return this.ALLOWED_TARGET_APPS.some((allowed) => {
            const lowAllowed = allowed.toLowerCase();
            return clean === lowAllowed || clean.includes(lowAllowed);
        });
    }
    static sanitizeShellParameter(param) {
        if (!param || typeof param !== 'string')
            return '';
        // Strip PowerShell script block delimiters, semicolons, pipe, backticks, dollar signs, and quotes
        return param.replace(/[`$;|&><"'{}\r\n]/g, '').trim();
    }
    static validateStepType(type) {
        return this.ALLOWED_STEP_TYPES.has(type);
    }
    static validateWorkflowSchema(wf) {
        const errors = [];
        if (!wf || typeof wf !== 'object') {
            return { valid: false, errors: ['Workflow definition must be an object'] };
        }
        if (!wf.id || typeof wf.id !== 'string') {
            errors.push('Missing or invalid workflow ID');
        }
        else if (!/^[a-zA-Z0-9_\-]+$/.test(wf.id)) {
            errors.push('Workflow ID must only contain alphanumeric characters, underscores, and hyphens');
        }
        if (!wf.name || typeof wf.name !== 'string')
            errors.push('Missing or invalid workflow Name');
        if (wf.targetApp && !this.isAllowedTargetApp(wf.targetApp)) {
            errors.push(`Target application '${wf.targetApp}' is not in the approved safety allowlist`);
        }
        if (wf.approvalPolicy && !['always_manual', 'auto_safe_only', 'full_auto'].includes(wf.approvalPolicy)) {
            errors.push(`Invalid approval policy: ${wf.approvalPolicy}`);
        }
        if (!Array.isArray(wf.steps)) {
            errors.push('Workflow steps must be an array');
        }
        else {
            const stepIds = new Set();
            for (const step of wf.steps) {
                if (!step.id) {
                    errors.push('Step missing ID');
                }
                else if (!/^[a-zA-Z0-9_\-]+$/.test(step.id)) {
                    errors.push(`Step ID '${step.id}' contains invalid characters`);
                }
                else if (stepIds.has(step.id)) {
                    errors.push(`Duplicate step ID: ${step.id}`);
                }
                if (step.id)
                    stepIds.add(step.id);
                if (!this.validateStepType(step.type)) {
                    errors.push(`Step '${step.id}' has unpermitted type: ${step.type}`);
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }
    static sanitizePath(baseDir, userPath) {
        const normalized = path_1.default.normalize(userPath);
        if (normalized.includes('..') || path_1.default.isAbsolute(normalized)) {
            throw new Error(`Potential path traversal rejected: ${userPath}`);
        }
        const fullPath = path_1.default.resolve(baseDir, normalized);
        if (!fullPath.startsWith(path_1.default.resolve(baseDir))) {
            throw new Error(`Path escaped root boundary: ${userPath}`);
        }
        return fullPath;
    }
    static redactSensitive(text) {
        if (!text || typeof text !== 'string')
            return text;
        let redacted = text;
        for (const pattern of this.SENSITIVE_PATTERNS) {
            redacted = redacted.replace(pattern, '$1: [REDACTED]');
        }
        return redacted;
    }
    static isDestructiveCommand(cmd) {
        if (!cmd)
            return false;
        const lower = cmd.toLowerCase();
        for (const dangerous of this.DANGEROUS_COMMAND_STRINGS) {
            if (lower.includes(dangerous))
                return true;
        }
        return false;
    }
    static isRecommendationOption(text) {
        if (!text || typeof text !== 'string')
            return false;
        const lower = text.toLowerCase();
        return (lower.includes('(recommended)') ||
            lower.includes('[recommended]') ||
            lower.includes('recommended') ||
            lower.includes('default'));
    }
    static shouldAutoApprove(policy, actionType, targetSubstring) {
        if (policy === 'always_manual')
            return false;
        if (policy === 'full_auto')
            return true;
        // auto_safe_only: only auto-approve explicit recommendations or safe continuation buttons
        if (actionType === 'select_radio') {
            return this.isRecommendationOption(targetSubstring || '');
        }
        if (actionType === 'invoke_button') {
            const target = (targetSubstring || '').toLowerCase();
            return (target.includes('submit') ||
                target.includes('continue') ||
                target.includes('apply') ||
                target.includes('confirm') ||
                target.includes('ok') ||
                target.length === 0);
        }
        return false;
    }
    static isAcceptAllButtonName(text) {
        if (!text || typeof text !== 'string')
            return false;
        const clean = text.trim().toLowerCase();
        if (clean === 'accept all' ||
            clean === 'accept all changes' ||
            clean === 'accept all files' ||
            clean === 'accept all edits' ||
            clean === 'accept all...' ||
            clean.startsWith('accept all')) {
            return true;
        }
        return false;
    }
    static isNegativeFileAction(text) {
        if (!text || typeof text !== 'string')
            return false;
        const clean = text.trim().toLowerCase();
        return (clean.includes('discard') ||
            clean.includes('reject') ||
            clean.includes('revert') ||
            clean === 'cancel' ||
            clean === 'no' ||
            clean.includes("don't save"));
    }
    static isDestructiveOrRejection(text) {
        if (!text || typeof text !== 'string')
            return false;
        const clean = text.trim().toLowerCase();
        return (clean.includes('discard') ||
            clean.includes('reject') ||
            clean.includes('revert') ||
            clean === 'cancel' ||
            clean === 'no' ||
            clean.includes("don't save") ||
            clean.includes('dont save') ||
            clean.includes('delete') ||
            clean.includes('abort') ||
            clean.includes('deny') ||
            clean.includes('close without saving'));
    }
    static isSupportedIde(ideId) {
        return ideId === 'antigravity' || ideId === 'vscode_copilot';
    }
    static classifyActionCategory(buttonText, context) {
        if (!buttonText || typeof buttonText !== 'string')
            return 'CONFIRMATION';
        const clean = buttonText.trim().toLowerCase();
        if (this.isDestructiveOrRejection(clean)) {
            if (clean.includes('delete') || clean.includes('format') || clean.includes('destroy')) {
                return 'DESTRUCTIVE';
            }
            return 'REJECTION';
        }
        if (this.isAcceptAllButtonName(clean) ||
            clean === 'apply changes' ||
            clean === 'apply' ||
            clean === 'accept' ||
            context?.isFileChange) {
            return 'FILE_CHANGE_APPROVAL';
        }
        if (clean === 'run' ||
            clean === 'run command' ||
            clean === 'run in terminal' ||
            clean === 'execute' ||
            context?.isTerminal) {
            return 'TERMINAL_APPROVAL';
        }
        if (clean === 'allow' ||
            clean === 'allow this time' ||
            clean === 'yes, allow this time' ||
            clean === 'approve') {
            return 'PERMISSION_APPROVAL';
        }
        if (clean === 'continue' || clean === 'proceed') {
            return 'CONTINUE_APPROVAL';
        }
        if (clean === 'submit' ||
            clean === 'submit ↵' ||
            clean === 'send' ||
            clean === 'send prompt' ||
            clean === 'submit prompt' ||
            clean === 'generate' ||
            context?.isPrompt) {
            return 'PROMPT_SUBMISSION';
        }
        if (clean === 'confirm' || clean === 'ok' || clean === 'yes') {
            return 'CONFIRMATION';
        }
        return 'CONFIRMATION';
    }
    static evaluateFileChangePolicy(policy, confidence, isAmbiguous) {
        if (policy === 'always_manual') {
            return { canAutoApprove: false, requiresManualApproval: true };
        }
        if (policy === 'full_auto') {
            if (isAmbiguous) {
                return { canAutoApprove: false, requiresManualApproval: true };
            }
            return { canAutoApprove: confidence === 'HIGH' || confidence === 'MEDIUM', requiresManualApproval: false };
        }
        // auto_safe_only
        if (isAmbiguous || confidence !== 'HIGH') {
            return { canAutoApprove: false, requiresManualApproval: true };
        }
        return { canAutoApprove: true, requiresManualApproval: false };
    }
}
exports.SafetyGuard = SafetyGuard;
//# sourceMappingURL=safetyGuard.js.map