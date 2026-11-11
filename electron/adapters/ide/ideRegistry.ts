import { BaseIdeAdapter } from './baseIdeAdapter';
import { AntigravityAdapter } from './antigravityAdapter';
import { VscodeCopilotAdapter } from './vscodeCopilotAdapter';
import {
  SupportedIdeId,
  TargetWindowInfo,
  IdeConnectionInfo,
  PerIdeConfig,
  CopilotStatus,
} from '../../engine/types';
import { PowerShellAdapter } from '../powershellAdapter';
import { FileChangeApprovalDetector } from '../fileChangeApprovalDetector';

export class IdeRegistry {
  private adapters: Map<SupportedIdeId, BaseIdeAdapter> = new Map();

  constructor(
    private psAdapter: PowerShellAdapter,
    fileChangeDetector?: FileChangeApprovalDetector
  ) {
    const fcDetector = fileChangeDetector || new FileChangeApprovalDetector(this.psAdapter);
    this.registerAdapter(new AntigravityAdapter(this.psAdapter, fcDetector));
    this.registerAdapter(new VscodeCopilotAdapter(this.psAdapter, fcDetector));
  }

  public registerAdapter(adapter: BaseIdeAdapter): void {
    this.adapters.set(adapter.ideId, adapter);
  }

  public getAdapter(ideId: SupportedIdeId): BaseIdeAdapter | undefined {
    return this.adapters.get(ideId);
  }

  public getAllAdapters(): BaseIdeAdapter[] {
    return Array.from(this.adapters.values());
  }

  public resolveAdapterForWindow(win: TargetWindowInfo): BaseIdeAdapter | null {
    if (!win) return null;
    for (const adapter of this.adapters.values()) {
      if (adapter.matchesWindow(win)) {
        return adapter;
      }
    }
    // Default fallback to Antigravity
    return this.adapters.get('antigravity') || null;
  }

  public getInitialConnectionInfos(): IdeConnectionInfo[] {
    return this.getAllAdapters().map((adapter) => ({
      ideId: adapter.ideId,
      displayName: adapter.displayName,
      processName: adapter.processNames[0],
      pid: null,
      hwnd: null,
      windowTitle: null,
      windowClass: null,
      connectionStatus: 'disconnected',
      supportedCapabilities: adapter.defaultCapabilities,
      enabled: true,
    }));
  }

  public async scanConnections(availableWindows: TargetWindowInfo[]): Promise<IdeConnectionInfo[]> {
    const results: IdeConnectionInfo[] = [];

    for (const adapter of this.adapters.values()) {
      const matched = availableWindows.find((w) => adapter.matchesWindow(w));

      let copilotStatus: CopilotStatus | undefined = undefined;
      if (adapter.ideId === 'vscode_copilot') {
        if (matched) {
          copilotStatus = adapter.getCopilotStatus
            ? await adapter.getCopilotStatus(matched.hwnd, matched.pid)
            : 'connected';
        } else {
          copilotStatus = 'not_detected';
        }
      }

      results.push({
        ideId: adapter.ideId,
        displayName: adapter.displayName,
        processName: adapter.processNames[0],
        pid: matched ? matched.pid : null,
        hwnd: matched ? matched.hwnd : null,
        windowTitle: matched ? matched.title : null,
        windowClass: matched ? matched.className : null,
        connectionStatus: matched ? 'connected' : 'disconnected',
        copilotStatus,
        supportedCapabilities: adapter.defaultCapabilities,
        enabled: true,
      });
    }

    return results;
  }

  public static getDefaultIdeConfigs(): Record<SupportedIdeId, PerIdeConfig> {
    return {
      antigravity: {
        enabled: true,
        promptAutomation: true,
        fileChangeApproval: true,
        terminalApproval: true,
        recommendedOptionSelection: true,
        approvalPolicy: 'auto_safe_only',
        autoSubmitDelayMs: 250,
      },
      vscode_copilot: {
        enabled: true,
        promptAutomation: true,
        fileChangeApproval: true,
        terminalApproval: true,
        recommendedOptionSelection: true,
        approvalPolicy: 'auto_safe_only',
        autoSubmitDelayMs: 250,
      },
    };
  }
}
