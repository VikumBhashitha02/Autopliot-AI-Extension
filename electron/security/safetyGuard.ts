import path from 'path';
import { StepType, WorkflowDefinition, ActionCategory, SupportedIdeId } from '../engine/types';

export class SafetyGuard {
  private static readonly ALLOWED_STEP_TYPES: Set<StepType> = new Set([
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

  private static readonly SENSITIVE_PATTERNS = [
    /(password|passwd|pwd)[\s:=]+([^\s,;]+)/gi,
    /(secret|token|api[_-]?key|bearer)[\s:=]+([^\s,;]+)/gi,
    /([a-zA-Z0-9_\-\.]{20,}\.[a-zA-Z0-9_\-\.]{20,})/g, // long tokens
  ];

  private static readonly DANGEROUS_COMMAND_STRINGS = [
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

  private static readonly ALLOWED_TARGET_APPS: string[] = [
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

  public static isAllowedTargetApp(appName: string): boolean {
    if (!appName || typeof appName !== 'string') return false;
    const clean = appName.trim().toLowerCase();
    return this.ALLOWED_TARGET_APPS.some((allowed) => {
      const lowAllowed = allowed.toLowerCase();
      return clean === lowAllowed || clean.includes(lowAllowed);
    });
  }

  public static sanitizeShellParameter(param: string): string {
    if (!param || typeof param !== 'string') return '';
    // Strip PowerShell script block delimiters, semicolons, pipe, backticks, dollar signs, and quotes
    return param.replace(/[`$;|&><"'{}\r\n]/g, '').trim();
  }

  public static validateStepType(type: string): boolean {
    return this.ALLOWED_STEP_TYPES.has(type as StepType);
  }

  public static validateWorkflowSchema(wf: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!wf || typeof wf !== 'object') {
      return { valid: false, errors: ['Workflow definition must be an object'] };
    }
    if (!wf.id || typeof wf.id !== 'string') {
      errors.push('Missing or invalid workflow ID');
    } else if (!/^[a-zA-Z0-9_\-]+$/.test(wf.id)) {
      errors.push('Workflow ID must only contain alphanumeric characters, underscores, and hyphens');
    }

    if (!wf.name || typeof wf.name !== 'string') errors.push('Missing or invalid workflow Name');

    if (wf.targetApp && !this.isAllowedTargetApp(wf.targetApp)) {
      errors.push(`Target application '${wf.targetApp}' is not in the approved safety allowlist`);
    }

    if (wf.approvalPolicy && !['always_manual', 'auto_safe_only', 'full_auto'].includes(wf.approvalPolicy)) {
      errors.push(`Invalid approval policy: ${wf.approvalPolicy}`);
    }

    if (!Array.isArray(wf.steps)) {
      errors.push('Workflow steps must be an array');
    } else {
      const stepIds = new Set<string>();
      for (const step of wf.steps) {
        if (!step.id) {
          errors.push('Step missing ID');
        } else if (!/^[a-zA-Z0-9_\-]+$/.test(step.id)) {
          errors.push(`Step ID '${step.id}' contains invalid characters`);
        } else if (stepIds.has(step.id)) {
          errors.push(`Duplicate step ID: ${step.id}`);
        }
        if (step.id) stepIds.add(step.id);

        if (!this.validateStepType(step.type)) {
          errors.push(`Step '${step.id}' has unpermitted type: ${step.type}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public static sanitizePath(baseDir: string, userPath: string): string {
    const normalized = path.normalize(userPath);
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error(`Potential path traversal rejected: ${userPath}`);
    }
    const fullPath = path.resolve(baseDir, normalized);
    if (!fullPath.startsWith(path.resolve(baseDir))) {
      throw new Error(`Path escaped root boundary: ${userPath}`);
    }
    return fullPath;
  }

  public static redactSensitive(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let redacted = text;
    for (const pattern of this.SENSITIVE_PATTERNS) {
      redacted = redacted.replace(pattern, '$1: [REDACTED]');
    }
    return redacted;
  }

  public static isDestructiveCommand(cmd: string): boolean {
    if (!cmd) return false;
    const lower = cmd.toLowerCase();
    for (const dangerous of this.DANGEROUS_COMMAND_STRINGS) {
      if (lower.includes(dangerous)) return true;
    }
    return false;
  }

  public static isRecommendationOption(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return (
      lower.includes('(recommended)') ||
      lower.includes('[recommended]') ||
      lower.includes('recommended') ||
      lower.includes('default')
    );
  }

  public static shouldAutoApprove(
    policy: 'always_manual' | 'auto_safe_only' | 'full_auto',
    actionType: string,
    targetSubstring?: string
  ): boolean {
    if (policy === 'always_manual') return false;
    if (policy === 'full_auto') return true;
    // auto_safe_only: only auto-approve explicit recommendations or safe continuation buttons
    if (actionType === 'select_radio') {
      return this.isRecommendationOption(targetSubstring || '');
    }
    if (actionType === 'invoke_button') {
      const target = (targetSubstring || '').toLowerCase();
      return (
        target.includes('submit') ||
        target.includes('continue') ||
        target.includes('apply') ||
        target.includes('confirm') ||
        target.includes('ok') ||
        target.length === 0
      );
    }
    return false;
  }

  public static isAcceptAllButtonName(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim().toLowerCase();
    if (
      clean === 'accept all' ||
      clean === 'accept all changes' ||
      clean === 'accept all files' ||
      clean === 'accept all edits' ||
      clean === 'accept all...' ||
      clean.startsWith('accept all')
    ) {
      return true;
    }
    return false;
  }

  public static isNegativeFileAction(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim().toLowerCase();
    return (
      clean.includes('discard') ||
      clean.includes('reject') ||
      clean.includes('revert') ||
      clean === 'cancel' ||
      clean === 'no' ||
      clean.includes("don't save")
    );
  }

  public static isDestructiveOrRejection(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim().toLowerCase();
    return (
      clean.includes('discard') ||
      clean.includes('reject') ||
      clean.includes('revert') ||
      clean === 'cancel' ||
      clean === 'no' ||
      clean.includes("don't save") ||
      clean.includes('dont save') ||
      clean.includes('delete') ||
      clean.includes('abort') ||
      clean.includes('deny') ||
      clean.includes('close without saving')
    );
  }

  public static isSupportedIde(ideId: string): boolean {
    return ideId === 'antigravity' || ideId === 'vscode_copilot';
  }

  public static classifyActionCategory(buttonText: string, context?: { isTerminal?: boolean; isFileChange?: boolean; isPrompt?: boolean }): ActionCategory {
    if (!buttonText || typeof buttonText !== 'string') return 'CONFIRMATION';
    const clean = buttonText.trim().toLowerCase();

    if (this.isDestructiveOrRejection(clean)) {
      if (clean.includes('delete') || clean.includes('format') || clean.includes('destroy')) {
        return 'DESTRUCTIVE';
      }
      return 'REJECTION';
    }

    if (
      this.isAcceptAllButtonName(clean) ||
      clean === 'apply changes' ||
      clean === 'apply' ||
      clean === 'accept' ||
      context?.isFileChange
    ) {
      return 'FILE_CHANGE_APPROVAL';
    }

    if (
      clean === 'run' ||
      clean === 'run command' ||
      clean === 'run in terminal' ||
      clean === 'execute' ||
      context?.isTerminal
    ) {
      return 'TERMINAL_APPROVAL';
    }

    if (
      clean === 'allow' ||
      clean === 'allow this time' ||
      clean === 'yes, allow this time' ||
      clean === 'approve'
    ) {
      return 'PERMISSION_APPROVAL';
    }

    if (clean === 'continue' || clean === 'proceed') {
      return 'CONTINUE_APPROVAL';
    }

    if (
      clean === 'submit' ||
      clean === 'submit ↵' ||
      clean === 'send' ||
      clean === 'send prompt' ||
      clean === 'submit prompt' ||
      clean === 'generate' ||
      context?.isPrompt
    ) {
      return 'PROMPT_SUBMISSION';
    }

    if (clean === 'confirm' || clean === 'ok' || clean === 'yes') {
      return 'CONFIRMATION';
    }

    return 'CONFIRMATION';
  }

  public static evaluateFileChangePolicy(
    policy: 'always_manual' | 'auto_safe_only' | 'full_auto',
    confidence: string,
    isAmbiguous: boolean
  ): { canAutoApprove: boolean; requiresManualApproval: boolean } {
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


