import { BaseIdeAdapter } from './baseIdeAdapter';
import {
  SupportedIdeId,
  FileChangeDetectionResult,
  ActionCategory,
} from '../../engine/types';
import { PowerShellAdapter } from '../powershellAdapter';
import { FileChangeApprovalDetector } from '../fileChangeApprovalDetector';

export class AntigravityAdapter extends BaseIdeAdapter {
  readonly ideId: SupportedIdeId = 'antigravity';
  readonly displayName: string = 'Antigravity IDE';
  readonly processNames: string[] = ['Antigravity', 'Antigravity IDE', 'electron'];
  readonly defaultCapabilities: string[] = [
    'Prompt Submission',
    'Option Selection',
    'Accept All File Changes',
    'Terminal Command Approval',
  ];

  private fileChangeDetector: FileChangeApprovalDetector;

  constructor(private psAdapter: PowerShellAdapter, fileChangeDetector?: FileChangeApprovalDetector) {
    super();
    this.fileChangeDetector = fileChangeDetector || new FileChangeApprovalDetector(this.psAdapter);
  }

  public async detectPrompt(hwnd: number, pid: number, targetSubstring?: string): Promise<any> {
    return this.psAdapter.inspectPromptSubtree(0, hwnd, pid);
  }

  public async detectFileChanges(hwnd: number, pid: number): Promise<FileChangeDetectionResult> {
    return this.fileChangeDetector.detectFileChangeApproval(hwnd, pid);
  }

  public async detectTerminalApproval(hwnd: number, pid: number): Promise<any> {
    const prompt = await this.detectPrompt(hwnd, pid);
    if (prompt?.reportJson?.Buttons) {
      const runBtn = prompt.reportJson.Buttons.find((b: string) => {
        const lower = b.toLowerCase();
        return lower === 'run' || lower === 'run command' || lower === 'run in terminal';
      });
      if (runBtn) {
        return {
          detected: true,
          buttonName: runBtn,
          category: 'TERMINAL_APPROVAL' as ActionCategory,
        };
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
    return this.psAdapter.selectAndCompletePrompt('(Recommended)', 0, targetHwnd, targetPid, policy as any);
  }
}

