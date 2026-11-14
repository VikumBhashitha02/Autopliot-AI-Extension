import { DocumentStore } from '../../../electron/storage/documentStore';
import { AgentService } from '../../../electron/adapters/agentService';
import { StatusBarProvider } from './statusBarProvider';
import { AppSettings } from '../../../electron/engine/types';

function getVsCode(): any {
  try {
    return require('vscode');
  } catch {
    return null;
  }
}

export class ConfigurationSynchronizer {
  private static isSyncing = false;

  /**
   * Convert VS Code autopilot.mode to DocumentStore approvalPolicy
   */
  public static modeToApprovalPolicy(mode?: string): 'auto_safe_only' | 'full_auto' | 'always_manual' {
    switch (mode) {
      case 'full_auto':
        return 'full_auto';
      case 'manual_approval':
        return 'always_manual';
      case 'safe_auto':
      default:
        return 'auto_safe_only';
    }
  }

  /**
   * Convert DocumentStore approvalPolicy to VS Code autopilot.mode
   */
  public static approvalPolicyToMode(policy?: string): 'safe_auto' | 'full_auto' | 'manual_approval' {
    switch (policy) {
      case 'full_auto':
        return 'full_auto';
      case 'always_manual':
        return 'manual_approval';
      case 'auto_safe_only':
      default:
        return 'safe_auto';
    }
  }

  /**
   * Convert response speed enum to millisecond delay
   */
  public static speedToDelayMs(speed?: string): number {
    switch (speed) {
      case 'instant':
        return 100;
      case 'comfortable':
        return 750;
      case 'deliberate':
        return 1500;
      case 'fast':
      default:
        return 250;
    }
  }

  /**
   * Convert millisecond delay to response speed enum
   */
  public static delayMsToSpeed(delayMs: number): 'instant' | 'fast' | 'comfortable' | 'deliberate' {
    if (delayMs <= 150) return 'instant';
    if (delayMs <= 400) return 'fast';
    if (delayMs <= 1000) return 'comfortable';
    return 'deliberate';
  }

  /**
   * Sync configuration from VS Code workspace settings to DocumentStore and AgentService
   */
  public static syncFromVsCodeToStore(
    docStore: DocumentStore,
    agentService: AgentService,
    statusBarProvider?: StatusBarProvider
  ): AppSettings {
    try {
      const vscode = getVsCode();
      if (!vscode?.workspace) {
        return docStore.getSettings();
      }
      const config = vscode.workspace.getConfiguration('autopilot');
      const storeSettings = docStore.getSettings();

      const vsMode = config.get('mode') as string | undefined;
      const vsSpeed = config.get('responseSpeed') as string | undefined;
      const vsInterval = config.get('monitoringInterval') as number | undefined;
      const vsAutoStart = config.get('autoStartMonitoring') as boolean | undefined;
      const vsFileApproval = config.get('enableFileChangeApproval') as boolean | undefined;
      const vsTerminalApproval = config.get('enableTerminalApproval') as boolean | undefined;
      const vsConfidence = config.get('promptInspectionConfidenceThreshold') as number | undefined;

      const updates: Partial<AppSettings> = {};

      if (vsMode !== undefined) {
        updates.approvalPolicy = this.modeToApprovalPolicy(vsMode);
      }
      if (vsSpeed !== undefined) {
        updates.responseSpeed = vsSpeed as any;
      }
      if (vsInterval !== undefined && vsInterval >= 50 && vsInterval <= 5000) {
        updates.monitoringInterval = vsInterval;
      }
      if (vsAutoStart !== undefined) {
        updates.autoStartMonitoring = vsAutoStart;
      }
      if (vsFileApproval !== undefined) {
        updates.autoAcceptAllFileChanges = vsFileApproval;
      }
      if (vsTerminalApproval !== undefined) {
        updates.enableTerminalApproval = vsTerminalApproval;
      }
      if (vsConfidence !== undefined && vsConfidence >= 0.1 && vsConfidence <= 1.0) {
        updates.promptInspectionConfidenceThreshold = vsConfidence;
      }

      const merged = docStore.saveSettings(updates);

      // Apply to AgentService
      if (merged.approvalPolicy) {
        agentService.setApprovalPolicy(merged.approvalPolicy);
      }
      if (updates.responseSpeed) {
        agentService.setAutoSubmitDelayMs(this.speedToDelayMs(updates.responseSpeed));
      }

      if (statusBarProvider) {
        statusBarProvider.updateStatus(agentService.getStatus());
      }

      return merged;
    } catch (err) {
      console.warn('[AutoPilot AI] Failed to sync settings from VS Code config:', err);
      return docStore.getSettings();
    }
  }

  /**
   * Sync settings from DocumentStore / Webview update to VS Code configuration
   */
  public static async syncFromStoreToVsCode(settings: Partial<AppSettings>): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const vscode = getVsCode();
      if (!vscode?.workspace) return;
      const config = vscode.workspace.getConfiguration('autopilot');

      if (settings.approvalPolicy !== undefined) {
        const mode = this.approvalPolicyToMode(settings.approvalPolicy);
        if (config.get('mode') !== mode) {
          await config.update('mode', mode, vscode.ConfigurationTarget.Global);
        }
      }

      if (settings.responseSpeed !== undefined) {
        if (config.get('responseSpeed') !== settings.responseSpeed) {
          await config.update('responseSpeed', settings.responseSpeed, vscode.ConfigurationTarget.Global);
        }
      }

      if (settings.monitoringInterval !== undefined) {
        if (config.get('monitoringInterval') !== settings.monitoringInterval) {
          await config.update('monitoringInterval', settings.monitoringInterval, vscode.ConfigurationTarget.Global);
        }
      }

      if (settings.autoStartMonitoring !== undefined) {
        if (config.get('autoStartMonitoring') !== settings.autoStartMonitoring) {
          await config.update('autoStartMonitoring', settings.autoStartMonitoring, vscode.ConfigurationTarget.Global);
        }
      }

      if (settings.autoAcceptAllFileChanges !== undefined) {
        if (config.get('enableFileChangeApproval') !== settings.autoAcceptAllFileChanges) {
          await config.update('enableFileChangeApproval', settings.autoAcceptAllFileChanges, vscode.ConfigurationTarget.Global);
        }
      }

      if (settings.enableTerminalApproval !== undefined) {
        if (config.get('enableTerminalApproval') !== settings.enableTerminalApproval) {
          await config.update('enableTerminalApproval', settings.enableTerminalApproval, vscode.ConfigurationTarget.Global);
        }
      }

      if (settings.promptInspectionConfidenceThreshold !== undefined) {
        if (config.get('promptInspectionConfidenceThreshold') !== settings.promptInspectionConfidenceThreshold) {
          await config.update('promptInspectionConfidenceThreshold', settings.promptInspectionConfidenceThreshold, vscode.ConfigurationTarget.Global);
        }
      }
    } catch (err) {
      console.warn('[AutoPilot AI] Failed to sync settings to VS Code config:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Register the bidirectional configuration listener on the ExtensionContext
   */
  public static register(
    context: any,
    docStore: DocumentStore,
    agentService: AgentService,
    statusBarProvider: StatusBarProvider,
    onSettingsChanged?: (settings: AppSettings) => void
  ): { dispose: () => void } {
    // 1. Initial sync on extension activation
    const initial = this.syncFromVsCodeToStore(docStore, agentService, statusBarProvider);

    const vscode = getVsCode();
    if (!vscode?.workspace) {
      return { dispose: () => {} };
    }

    // 2. Listen for VS Code Settings changes
    const configListener = vscode.workspace.onDidChangeConfiguration(async (e: any) => {
      if (this.isSyncing) return;
      if (e.affectsConfiguration('autopilot')) {
        const updated = this.syncFromVsCodeToStore(docStore, agentService, statusBarProvider);
        if (onSettingsChanged) {
          onSettingsChanged(updated);
        }
      }
    });

    if (context?.subscriptions) {
      context.subscriptions.push(configListener);
    }
    return configListener;
  }
}
