import { BaseIdeAdapter } from './baseIdeAdapter';
import {
  SupportedIdeId,
  FileChangeDetectionResult,
  ActionCategory,
  CopilotStatus,
} from '../../engine/types';
import { PowerShellAdapter } from '../powershellAdapter';
import { FileChangeApprovalDetector } from '../fileChangeApprovalDetector';
import { UniversalActionDetector } from './shared/universalActionDetector';
import { SafetyGuard } from '../../security/safetyGuard';

export class VscodeCopilotAdapter extends BaseIdeAdapter {
  readonly ideId: SupportedIdeId = 'vscode_copilot';
  readonly displayName: string = 'VS Code + GitHub Copilot';
  readonly processNames: string[] = ['Code', 'Code.exe', 'Visual Studio Code'];
  readonly defaultCapabilities: string[] = [
    'Copilot Chat Prompts',
    'Inline Edit Approvals',
    'Apply Changes',
    'Terminal Command Approval',
    'Dialog Confirmation',
  ];

  private fileChangeDetector: FileChangeApprovalDetector;

  constructor(private psAdapter: PowerShellAdapter, fileChangeDetector?: FileChangeApprovalDetector) {
    super();
    this.fileChangeDetector = fileChangeDetector || new FileChangeApprovalDetector(this.psAdapter);
  }

  public async getCopilotStatus(hwnd: number, pid: number): Promise<CopilotStatus> {
    if (!hwnd && !pid) return 'not_detected';
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
    } catch {
      return 'not_detected';
    }
  }

  public async detectPrompt(hwnd: number, pid: number, targetSubstring?: string): Promise<any> {
    const res = await this.psAdapter.inspectPromptSubtree(0, hwnd, pid);
    if (res?.reportJson) {
      res.reportJson.Ide = 'vscode_copilot';
      res.reportJson.IdeDisplayName = this.displayName;
    }
    return res;
  }

  public async detectFileChanges(hwnd: number, pid: number): Promise<FileChangeDetectionResult> {
    const res = await this.fileChangeDetector.detectFileChangeApproval(hwnd, pid);
    if (res.fileChangeApprovalFound) {
      res.detectionEvidence.push('VS Code Copilot inline diff / review container identified');
    }
    return res;
  }

  public async detectTerminalApproval(hwnd: number, pid: number): Promise<any> {
    const prompt = await this.detectPrompt(hwnd, pid);
    if (prompt?.reportJson?.Buttons) {
      for (const btn of prompt.reportJson.Buttons) {
        if (SafetyGuard.isDestructiveOrRejection(btn)) continue;
        const candidate = UniversalActionDetector.evaluateCandidate(btn, 'VS Code Terminal Confirmation');
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

  public async executeAction(
    targetHwnd: number,
    targetPid: number,
    buttonName: string,
    category: ActionCategory,
    policy: string = 'auto_safe_only'
  ): Promise<any> {
    if (SafetyGuard.isDestructiveOrRejection(buttonName)) {
      throw new Error(`Execution blocked: Action '${buttonName}' is destructive or rejection.`);
    }

    return this.psAdapter.selectAndCompletePrompt('(Recommended)', 0, targetHwnd, targetPid, policy as any);
  }
}

