import { TargetWindowInfo } from '../../../../electron/engine/types';
import { PowerShellRunResult } from '../../../../electron/adapters/powershellAdapter';

export interface PlatformCapabilities {
  supportsDesktopUia: boolean;
  supportsWindowEnumeration: boolean;
  supportsPromptSubtreeInspection: boolean;
  supportsRadioSelection: boolean;
  supportsButtonInvocation: boolean;
  supportsFileChangeApproval: boolean;
  platformName: 'windows' | 'macos' | 'linux';
  limitationMessage?: string;
}

export abstract class PlatformAdapter {
  abstract readonly platformName: 'windows' | 'macos' | 'linux';

  abstract getCapabilities(): PlatformCapabilities;

  abstract listTargetWindows(): Promise<TargetWindowInfo[]>;

  abstract inspectPromptSubtree(
    delaySeconds?: number,
    targetHwnd?: number,
    targetPid?: number,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult>;

  abstract selectAndCompletePrompt(
    targetSubstring?: string,
    delaySeconds?: number,
    targetHwnd?: number,
    targetPid?: number,
    approvalPolicy?: string,
    selectOnly?: boolean,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult>;

  abstract inspectFileChangeApproval(
    delaySeconds?: number,
    targetHwnd?: number,
    targetPid?: number,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult>;

  abstract executeFileChangeApproval(
    targetHwnd?: number,
    targetPid?: number,
    delaySeconds?: number,
    approvalPolicy?: string,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult>;
}
