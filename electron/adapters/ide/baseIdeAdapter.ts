import {
  SupportedIdeId,
  TargetWindowInfo,
  FileChangeDetectionResult,
  ActionCategory,
  CopilotStatus,
} from '../../engine/types';

export abstract class BaseIdeAdapter {
  abstract readonly ideId: SupportedIdeId;
  abstract readonly displayName: string;
  abstract readonly processNames: string[];
  abstract readonly defaultCapabilities: string[];

  public matchesWindow(win: TargetWindowInfo): boolean {
    if (!win) return false;
    const pName = (win.processName || '').toLowerCase();
    const title = (win.title || '').toLowerCase();

    return this.processNames.some(
      (proc) =>
        pName.includes(proc.toLowerCase()) ||
        title.includes(proc.toLowerCase()) ||
        (this.ideId === 'antigravity' && (title.includes('antigravity') || pName.includes('antigravity'))) ||
        (this.ideId === 'vscode_copilot' && (title.includes('visual studio code') || title.includes('code') || pName === 'code'))
    );
  }

  abstract detectPrompt(hwnd: number, pid: number, targetSubstring?: string): Promise<any>;

  abstract detectFileChanges(hwnd: number, pid: number): Promise<FileChangeDetectionResult>;

  abstract detectTerminalApproval(hwnd: number, pid: number): Promise<any>;

  public async getCopilotStatus?(hwnd: number, pid: number): Promise<CopilotStatus>;

  abstract executeAction(
    targetHwnd: number,
    targetPid: number,
    buttonName: string,
    category: ActionCategory,
    policy?: string
  ): Promise<any>;
}

