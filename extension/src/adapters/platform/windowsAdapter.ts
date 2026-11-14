import { PlatformAdapter, PlatformCapabilities } from './platformAdapter';
import { TargetWindowInfo } from '../../../../electron/engine/types';
import { PowerShellAdapter, PowerShellRunResult } from '../../../../electron/adapters/powershellAdapter';

export class WindowsAdapter extends PlatformAdapter {
  readonly platformName: 'windows' = 'windows';

  constructor(private psAdapter: PowerShellAdapter) {
    super();
  }

  public getCapabilities(): PlatformCapabilities {
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

  public async listTargetWindows(): Promise<TargetWindowInfo[]> {
    return this.psAdapter.listTargetWindows();
  }

  public async inspectPromptSubtree(
    delaySeconds: number = 0,
    targetHwnd: number = 0,
    targetPid: number = 0,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult> {
    return this.psAdapter.inspectPromptSubtree(delaySeconds, targetHwnd, targetPid, onLog);
  }

  public async selectAndCompletePrompt(
    targetSubstring: string = '(Recommended)',
    delaySeconds: number = 0,
    targetHwnd: number = 0,
    targetPid: number = 0,
    approvalPolicy: string = 'auto_safe_only',
    selectOnly: boolean = false,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult> {
    return this.psAdapter.selectAndCompletePrompt(
      targetSubstring,
      delaySeconds,
      targetHwnd,
      targetPid,
      approvalPolicy,
      selectOnly,
      onLog
    );
  }

  public async inspectFileChangeApproval(
    delaySeconds: number = 0,
    targetHwnd: number = 0,
    targetPid: number = 0,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult> {
    return this.psAdapter.inspectFileChangeApproval(delaySeconds, targetHwnd, targetPid, onLog);
  }

  public async executeFileChangeApproval(
    targetHwnd: number = 0,
    targetPid: number = 0,
    delaySeconds: number = 0,
    approvalPolicy: string = 'auto_safe_only',
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult> {
    return this.psAdapter.executeFileChangeApproval(targetHwnd, targetPid, delaySeconds, approvalPolicy, onLog);
  }
}
