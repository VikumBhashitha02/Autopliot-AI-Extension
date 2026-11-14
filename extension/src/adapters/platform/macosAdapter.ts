import { PlatformAdapter, PlatformCapabilities } from './platformAdapter';
import { TargetWindowInfo } from '../../../../electron/engine/types';
import { PowerShellRunResult } from '../../../../electron/adapters/powershellAdapter';

export class MacosAdapter extends PlatformAdapter {
  readonly platformName: 'macos' = 'macos';

  public getCapabilities(): PlatformCapabilities {
    return {
      supportsDesktopUia: false,
      supportsWindowEnumeration: false,
      supportsPromptSubtreeInspection: false,
      supportsRadioSelection: false,
      supportsButtonInvocation: false,
      supportsFileChangeApproval: false,
      platformName: 'macos',
      limitationMessage: 'Windows UIAutomation is not supported on macOS. Native VS Code Extension API commands and workspace automation remain fully operational.',
    };
  }

  public async listTargetWindows(): Promise<TargetWindowInfo[]> {
    return [];
  }

  public async inspectPromptSubtree(): Promise<PowerShellRunResult> {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'macOS does not support Windows UIAutomation inspection.',
      timedOut: false,
      durationMs: 0,
    };
  }

  public async selectAndCompletePrompt(): Promise<PowerShellRunResult> {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'macOS does not support Windows UIAutomation completion.',
      timedOut: false,
      durationMs: 0,
    };
  }

  public async inspectFileChangeApproval(): Promise<PowerShellRunResult> {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'macOS does not support Windows UIAutomation file change inspection.',
      timedOut: false,
      durationMs: 0,
    };
  }

  public async executeFileChangeApproval(): Promise<PowerShellRunResult> {
    return {
      exitCode: 1,
      stdout: '',
      stderr: 'macOS does not support Windows UIAutomation file change execution.',
      timedOut: false,
      durationMs: 0,
    };
  }
}
