import {
  AgentStatus,
  AutoPilotAction,
  AutomationStateMachineState,
  TargetWindowInfo,
  FileChangeDetectionResult,
  FileChangeApprovalResult,
  SupportedIdeId,
  IdeConnectionInfo,
  PerIdeConfig,
  ActionCategory,
} from '../engine/types';
import { PowerShellAdapter } from './powershellAdapter';
import { DocumentStore } from '../storage/documentStore';
import { FileChangeApprovalService } from './fileChangeApprovalService';
import { SafetyGuard } from '../security/safetyGuard';
import { IdeRegistry } from './ide/ideRegistry';
import { UniversalActionDetector } from './ide/shared/universalActionDetector';

export class AgentService {
  private status: AgentStatus = {
    state: 'idle',
    targetProcessName: 'Antigravity IDE',
    targetPid: null,
    targetHwnd: null,
    targetWindowTitle: null,
    availableWindows: [],
    selectedHwnd: null,
    lastPromptDetected: false,
    lastPromptType: null,
    lastRecommendedOption: null,
    lastFileChangeDetected: false,
    lastFileChangeConfidence: 'NONE',
    lastFileChangeResult: null,
    lastActiveTimestamp: new Date().toISOString(),
    sessionDesktop: 'WinSta0\\Default',
    autoPilotEnabled: true,
    autoPilotMode: 'full_auto',
    approvalPolicy: 'auto_safe_only',
    autoSubmitDelayMs: 250,
    totalPromptsDetected: 0,
    totalPromptsAutoSubmitted: 0,
    consecutivePromptsHandled: 0,
    currentStepDescription: 'Engine idle',
    lastAutoAction: null,
    actionHistory: [],
    activeIdeId: 'antigravity',
    activeIdeName: 'Antigravity IDE',
    ideConnections: [],
    targetIdeFilter: 'auto',
  };

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isCycleInProgress = false;
  private lastHandledPromptKey: string = '';
  private lastHandledTimestamp: number = 0;
  private consecutiveCycleWithoutPrompt: number = 0;

  private docStore?: DocumentStore;
  private onStatusChange?: (status: AgentStatus) => void;
  private fileChangeService: FileChangeApprovalService;
  private ideRegistry: IdeRegistry;
  private ideConfigs: Record<SupportedIdeId, PerIdeConfig>;

  constructor(
    private psAdapter: PowerShellAdapter,
    docStoreOrStatusChange?: DocumentStore | ((status: AgentStatus) => void),
    onStatusChange?: (status: AgentStatus) => void,
    private onAutoAction?: (action: AutoPilotAction) => void,
    private onApprovalRequired?: (promptData: any) => void,
    fileChangeService?: FileChangeApprovalService,
    ideRegistry?: IdeRegistry
  ) {
    if (typeof docStoreOrStatusChange === 'function') {
      this.onStatusChange = docStoreOrStatusChange;
    } else if (docStoreOrStatusChange) {
      this.docStore = docStoreOrStatusChange;
      this.onStatusChange = onStatusChange;
      const settings = this.docStore.getSettings();
      this.status.approvalPolicy = settings.approvalPolicy || 'auto_safe_only';
      this.status.selectedHwnd = settings.selectedWindowHwnd || null;
      this.status.targetIdeFilter = settings.targetIdeFilter || 'auto';
    }
    this.fileChangeService = fileChangeService || new FileChangeApprovalService(this.psAdapter, this.docStore);
    this.ideRegistry = ideRegistry || new IdeRegistry(this.psAdapter, this.fileChangeService.getDetector());
    const settings = this.docStore ? this.docStore.getSettings() : null;
    this.ideConfigs = (settings && settings.ideConfigs) ? settings.ideConfigs : IdeRegistry.getDefaultIdeConfigs();
  }

  public getFileChangeService(): FileChangeApprovalService {
    return this.fileChangeService;
  }

  public setFileChangeService(service: FileChangeApprovalService): void {
    this.fileChangeService = service;
  }

  public getStatus(): AgentStatus {
    return { ...this.status };
  }

  public setApprovalPolicy(policy: 'always_manual' | 'auto_safe_only' | 'full_auto'): AgentStatus {
    this.status.approvalPolicy = policy;
    if (policy === 'always_manual') {
      this.status.autoPilotMode = 'manual';
    } else if (policy === 'auto_safe_only') {
      this.status.autoPilotMode = 'full_auto';
    } else {
      this.status.autoPilotMode = 'full_auto';
    }
    if (this.docStore) {
      this.docStore.saveSettings({ approvalPolicy: policy });
    }
    this.notify();
    return this.getStatus();
  }

  public setSelectedWindow(windowOrHwnd: Partial<TargetWindowInfo> | number | null): AgentStatus {
    if (windowOrHwnd === null) {
      this.status.selectedHwnd = null;
      this.status.selectedWindow = undefined;
    } else if (typeof windowOrHwnd === 'number') {
      this.status.selectedHwnd = windowOrHwnd;
      const matched = this.status.availableWindows?.find((w) => w.hwnd === windowOrHwnd);
      if (matched) {
        this.status.selectedWindow = matched;
        this.status.targetPid = matched.pid;
        this.status.targetHwnd = matched.hwnd;
        this.status.targetWindowTitle = matched.title;
        this.status.targetProcessName = matched.processName;
      }
    } else {
      this.status.selectedHwnd = windowOrHwnd.hwnd || null;
      this.status.selectedWindow = windowOrHwnd as TargetWindowInfo;
      this.status.targetPid = windowOrHwnd.pid || null;
      this.status.targetHwnd = windowOrHwnd.hwnd || null;
      this.status.targetWindowTitle = windowOrHwnd.title || null;
      this.status.targetProcessName = windowOrHwnd.processName || 'Antigravity IDE';
    }
    if (this.docStore) {
      this.docStore.saveSettings({ selectedWindowHwnd: this.status.selectedHwnd });
    }
    this.notify();
    return this.getStatus();
  }

  public async listAvailableWindows(): Promise<TargetWindowInfo[]> {
    const windows = await this.psAdapter.listTargetWindows();
    this.status.availableWindows = windows;
    this.notify();
    return windows;
  }


  public async startMonitoring(intervalMs: number = 2000): Promise<AgentStatus> {
    this.transitionState('monitoring', 'Started real-time Antigravity desktop monitoring');
    this.fileChangeService.resetCancel();

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Run first scan immediately
    await this.runMonitorCycle();

    this.pollTimer = setInterval(async () => {
      await this.runMonitorCycle();
    }, Math.max(1000, intervalMs));

    return this.getStatus();
  }

  public stopMonitoring(): AgentStatus {
    this.fileChangeService.cancel();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.transitionState('idle', 'Monitoring stopped by user');
    return this.getStatus();
  }

  public setAutoPilotEnabled(enabled: boolean): AgentStatus {
    this.status.autoPilotEnabled = enabled;
    if (!enabled && this.status.state === 'monitoring') {
      this.transitionState('paused', 'AutoPilot paused');
    } else if (enabled && this.status.state === 'paused') {
      this.transitionState('monitoring', 'AutoPilot resumed');
    }
    this.notify();
    return this.getStatus();
  }

  public setAutoPilotMode(mode: 'full_auto' | 'select_only' | 'manual'): AgentStatus {
    this.status.autoPilotMode = mode;
    if (mode === 'manual') {
      this.status.approvalPolicy = 'always_manual';
    } else if (mode === 'full_auto' && this.status.approvalPolicy === 'always_manual') {
      this.status.approvalPolicy = 'auto_safe_only';
    }
    this.notify();
    return this.getStatus();
  }

  public setAutoSubmitDelayMs(delayMs: number): AgentStatus {
    this.status.autoSubmitDelayMs = delayMs;
    this.notify();
    return this.getStatus();
  }

  public clearActionHistory(): AgentStatus {
    this.status.actionHistory = [];
    this.status.consecutivePromptsHandled = 0;
    this.notify();
    return this.getStatus();
  }



  public async scanTargetWindow(): Promise<AgentStatus> {
    try {
      const windows = await this.psAdapter.listTargetWindows();
      this.status.availableWindows = windows;

      // Scan all IDE connections across the available windows
      const connections = await this.ideRegistry.scanConnections(windows);
      this.status.ideConnections = connections;

      // Filter available windows if user specified a target IDE filter
      let candidateWindows = windows;
      if (this.status.targetIdeFilter && this.status.targetIdeFilter !== 'all' && this.status.targetIdeFilter !== 'auto') {
        const filterAdapter = this.ideRegistry.getAdapter(this.status.targetIdeFilter);
        if (filterAdapter) {
          candidateWindows = windows.filter((w) => filterAdapter.matchesWindow(w));
        }
      }

      if (candidateWindows.length > 0) {
        // If a specific window was selected and is still valid, use it
        let chosen = this.status.selectedHwnd
          ? candidateWindows.find((w) => w.hwnd === this.status.selectedHwnd)
          : null;

        // Otherwise pick the most active/visible one
        if (!chosen) {
          chosen = candidateWindows[0];
        }

        this.status.targetHwnd = chosen.hwnd;
        this.status.targetPid = chosen.pid;
        this.status.targetWindowTitle = chosen.title;
        this.status.targetProcessName = chosen.processName;

        const matchedAdapter = this.ideRegistry.resolveAdapterForWindow(chosen);
        if (matchedAdapter) {
          this.status.activeIdeId = matchedAdapter.ideId;
          this.status.activeIdeName = matchedAdapter.displayName;
        } else {
          this.status.activeIdeId = 'antigravity';
          this.status.activeIdeName = 'Antigravity IDE';
        }

        this.status.lastActiveTimestamp = new Date().toISOString();
        this.status.error = undefined;
      } else {
        // Fallback: check standard processes
        this.status.targetPid = null;
        this.status.targetWindowTitle = null;
        this.status.activeIdeId = null;
        this.status.activeIdeName = null;
      }
    } catch (err: any) {
      this.status.error = err.message;
    }

    this.notify();
    return this.getStatus();
  }

  private async runMonitorCycle(): Promise<void> {
    if (this.isCycleInProgress) return;
    this.isCycleInProgress = true;

    try {
      await this.scanTargetWindow();

      if (!this.status.targetPid) {
        if (this.status.state === 'monitoring') {
          this.status.currentStepDescription = `Waiting for supported IDE window (${this.status.activeIdeName || 'Antigravity / VS Code'}) to appear...`;
          this.notify();
        }
        return;
      }

      if (!this.status.autoPilotEnabled) {
        return;
      }

      const activeIdeId = this.status.activeIdeId || 'antigravity';
      const perIde = this.ideConfigs[activeIdeId] || {
        enabled: true,
        promptAutomation: true,
        fileChangeApproval: true,
        terminalApproval: true,
        recommendedOptionSelection: true,
      };

      if (!perIde.enabled) {
        return;
      }

      const settings = this.docStore ? this.docStore.getSettings() : null;
      const autoAcceptFiles = (settings ? settings.autoAcceptAllFileChanges !== false : true) && perIde.fileChangeApproval !== false;

      // Type B: Inspect & handle file change approval interface if enabled
      if (autoAcceptFiles) {
        const fcHandled = await this.executeFileChangeCycle();
        if (fcHandled || this.status.lastFileChangeDetected) {
          return;
        }
      }

      if (!perIde.promptAutomation) {
        return;
      }

      // Type A: Check policy for normal prompt approval
      const effectivePolicy = perIde.approvalPolicy || this.status.approvalPolicy;
      if (effectivePolicy === 'always_manual' || this.status.autoPilotMode === 'manual') {
        await this.probePrompt();
        return;
      }

      // Execute auto-pilot handling for normal prompts
      await this.executeAutoPilotCycle();

    } catch (err: any) {
      this.status.error = err.message;
      this.transitionState('error', `Cycle error: ${err.message}`);
    } finally {
      this.isCycleInProgress = false;
    }
  }

  public async inspectFileChanges(): Promise<FileChangeDetectionResult> {
    const targetHwnd = this.status.selectedHwnd || this.status.targetHwnd || 0;
    const targetPid = this.status.targetPid || 0;
    const res = await this.fileChangeService.detectPendingChanges(targetHwnd, targetPid);
    this.status.lastFileChangeDetected = res.fileChangeApprovalFound;
    this.status.lastFileChangeConfidence = res.confidence;
    this.status.lastFileChangeResult = res;
    this.status.lastActiveTimestamp = new Date().toISOString();
    this.notify();
    return res;
  }

  public async testAcceptAllDetection(): Promise<FileChangeDetectionResult> {
    return this.inspectFileChanges();
  }

  public async executeFileChangeCycle(): Promise<FileChangeApprovalResult | null> {
    try {
      const targetHwnd = this.status.selectedHwnd || this.status.targetHwnd || 0;
      const targetPid = this.status.targetPid || 0;
      const policy = this.status.approvalPolicy || 'auto_safe_only';

      const detection = await this.fileChangeService.detectPendingChanges(targetHwnd, targetPid);

      if (!detection || !detection.fileChangeApprovalFound) {
        this.status.lastFileChangeDetected = false;
        this.status.lastFileChangeResult = null;
        return null;
      }

      this.status.lastFileChangeDetected = true;
      this.status.lastFileChangeConfidence = detection.confidence;
      this.status.lastFileChangeResult = detection;
      this.status.totalPromptsDetected++;

      if (policy === 'always_manual' || this.status.autoPilotMode === 'manual') {
        this.transitionState('file_change_approval_required', 'File changes detected — manual user authorization required');
        if (this.onApprovalRequired) {
          this.onApprovalRequired({
            type: 'file_change_approval',
            PromptFound: true,
            WindowTitle: detection.windowTitle,
            TargetHwnd: detection.targetHwnd,
            TargetPid: detection.processId,
            ButtonName: detection.buttonFound?.name || 'Accept all',
            ModifiedFiles: detection.modifiedFiles,
            Confidence: detection.confidence,
            Action: 'Accept all file changes',
          });
        }
        return null;
      }

      const policyEval = SafetyGuard.evaluateFileChangePolicy(policy, detection.confidence, detection.isAmbiguous);

      if (!policyEval.canAutoApprove) {
        if (policyEval.requiresManualApproval) {
          this.transitionState('file_change_ambiguous', 'File-change interface is ambiguous — pausing safely for approval');
          if (this.onApprovalRequired) {
            this.onApprovalRequired({
              type: 'file_change_approval',
              PromptFound: true,
              WindowTitle: detection.windowTitle,
              TargetHwnd: detection.targetHwnd,
              TargetPid: detection.processId,
              ButtonName: detection.buttonFound?.name || 'Accept all',
              ModifiedFiles: detection.modifiedFiles,
              Confidence: detection.confidence,
              Action: 'Accept all file changes',
            });
          }
        } else {
          this.transitionState('file_change_failed', 'File change approval disallowed under current safety policy');
        }
        return null;
      }

      this.transitionState('file_change_accepting', `Invoking '${detection.buttonFound?.name || 'Accept all'}'...`);
      const execRes = await this.fileChangeService.executeApproval(
        detection,
        policy,
        this.status.autoSubmitDelayMs,
        this.status.targetHwnd || targetHwnd
      );

      if (execRes.success) {
        this.transitionState('file_change_accepted', 'File changes accepted & verified successfully.');
        this.status.totalPromptsAutoSubmitted++;
        this.status.consecutivePromptsHandled++;

        const action = this.fileChangeService.createActionHistoryRecord(detection, execRes, policy);
        action.ideId = this.status.activeIdeId || 'antigravity';
        action.ideName = this.status.activeIdeName || 'Antigravity IDE';
        action.actionCategory = 'FILE_CHANGE_APPROVAL';
        this.status.lastAutoAction = action;
        this.status.actionHistory.unshift(action);
        if (this.status.actionHistory.length > 50) {
          this.status.actionHistory.pop();
        }

        if (this.onAutoAction) {
          this.onAutoAction(action);
        }

        this.transitionState(
          'waiting_for_next_prompt',
          `Successfully accepted file changes (${detection.modifiedFiles.length} file(s)). Monitoring for next prompt...`
        );
      } else {
        this.transitionState('file_change_failed', `Accept all failed: ${execRes.finalStatus}`);
      }

      this.status.lastActiveTimestamp = new Date().toISOString();
      this.notify();
      return execRes;
    } catch (err: any) {
      this.status.error = err.message;
      this.transitionState('error', `File change cycle error: ${err.message}`);
      return null;
    }
  }

  public async executePendingFileChangeApproval(): Promise<FileChangeApprovalResult | null> {
    let detection = this.status.lastFileChangeResult;
    if (!detection) {
      const targetHwnd = this.status.selectedHwnd || this.status.targetHwnd || 0;
      const targetPid = this.status.targetPid || 0;
      detection = await this.fileChangeService.detectPendingChanges(targetHwnd, targetPid);
    }

    if (!detection || !detection.fileChangeApprovalFound) {
      return null;
    }

    this.transitionState('file_change_accepting', `Manual authorization granted: Invoking '${detection.buttonFound?.name || 'Accept all'}'...`);

    const execRes = await this.fileChangeService.executeApproval(
      detection,
      'full_auto',
      this.status.autoSubmitDelayMs,
      detection.targetHwnd
    );

    if (execRes.success) {
      this.transitionState('file_change_accepted', 'File changes accepted & verified successfully.');
      this.status.totalPromptsAutoSubmitted++;
      this.status.consecutivePromptsHandled++;

      const action = this.fileChangeService.createActionHistoryRecord(detection, execRes, this.status.approvalPolicy);
      action.ideId = this.status.activeIdeId || 'antigravity';
      action.ideName = this.status.activeIdeName || 'Antigravity IDE';
      action.actionCategory = 'FILE_CHANGE_APPROVAL';
      this.status.lastAutoAction = action;
      this.status.actionHistory.unshift(action);
      if (this.status.actionHistory.length > 50) this.status.actionHistory.pop();
      if (this.onAutoAction) this.onAutoAction(action);

      this.transitionState(
        'waiting_for_next_prompt',
        `Successfully accepted file changes. Monitoring for next prompt...`
      );
    } else {
      this.transitionState('file_change_failed', `Manual approval execution failed: ${execRes.finalStatus}`);
    }

    this.notify();
    return execRes;
  }

  public rejectFileChangeApproval(): void {
    this.status.lastFileChangeResult = null;
    this.transitionState('monitoring', 'File change approval rejected by user. Resumed monitoring...');
    this.notify();
  }

  public async executeAutoPilotCycle(targetSubstring: string = '(Recommended)'): Promise<any> {
    try {
      this.transitionState('prompt_detected', 'Scanning for active confirmation or recommendation prompt...');

      const targetHwnd = this.status.selectedHwnd || this.status.targetHwnd || 0;
      const targetPid = this.status.targetPid || 0;
      const policy = this.status.approvalPolicy || 'auto_safe_only';
      const selectOnly = this.status.autoPilotMode === 'select_only';

      this.transitionState('analyzing', 'Inspecting UI Automation hierarchy for options & buttons...');

      const res = await this.psAdapter.selectAndCompletePrompt(
        targetSubstring,
        0,
        targetHwnd,
        targetPid,
        policy,
        selectOnly
      );

      const rep = res.reportJson;

      if (rep && rep.PromptFound) {
        this.status.lastPromptDetected = true;
        this.status.targetHwnd = rep.TargetHwnd || this.status.targetHwnd;
        this.status.lastRecommendedOption = rep.TargetOptionFound !== 'None' ? rep.TargetOptionFound : null;
        this.status.totalPromptsDetected++;

        // Debounce protection: prevent duplicate submission of the exact same dialog within 3 seconds
        const promptKey = `${rep.TargetHwnd}_${rep.TargetOptionFound}_${rep.SubmitButtonFound}`;
        const now = Date.now();
        if (promptKey === this.lastHandledPromptKey && now - this.lastHandledTimestamp < 3000) {
          this.transitionState('waiting_for_next_prompt', 'Previous prompt recently submitted; awaiting IDE transition...');
          return res;
        }

        // Check if policy requires approval for ambiguous options
        if (rep.FinalStatus === 'AWAITING_APPROVAL_AMBIGUOUS_OPTIONS' || rep.FinalStatus === 'AWAITING_APPROVAL_ALWAYS_MANUAL') {
          this.transitionState('awaiting_approval', 'Prompt requires manual confirmation (no explicit recommendation marked)');
          if (this.onApprovalRequired) {
            this.onApprovalRequired(rep);
          }
          return res;
        }

        if (rep.FinalStatus === 'COMPLETED_SUCCESSFULLY' || rep.FinalStatus === 'SUBMITTED_WAITING_RESPONSE' || rep.FinalStatus === 'OPTION_SELECTED_NO_SUBMIT_BUTTON') {
          this.transitionState('submitting', `Invoking ${rep.SubmitButtonFound || 'action'}...`);
          this.transitionState('verifying', 'Verifying dialog dismissal & application state...');

          this.status.totalPromptsAutoSubmitted++;
          this.status.consecutivePromptsHandled++;
          this.lastHandledPromptKey = promptKey;
          this.lastHandledTimestamp = now;
          this.consecutiveCycleWithoutPrompt = 0;

          const detectedCategory = SafetyGuard.classifyActionCategory(rep.SubmitButtonFound || 'Submit', {
            isPrompt: true,
            isTerminal: rep.PromptType === 'terminal_command',
          });

          const action: AutoPilotAction = {
            id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            title: rep.WindowTitle || `${this.status.activeIdeName || 'Antigravity'} Prompt`,
            optionSelected: rep.TargetOptionFound !== 'None' ? rep.TargetOptionFound : 'Recommended Choice',
            buttonClicked: rep.SubmitButtonFound !== 'None' ? rep.SubmitButtonFound : 'Submit',
            status: rep.FinalStatus,
            durationMs: res.durationMs || 0,
            verifiedClosed: rep.DialogClosedAfterAction ?? true,
            policyApplied: policy,
            targetHwnd: rep.TargetHwnd,
            windowTitle: rep.WindowTitle,
            ideId: this.status.activeIdeId || 'antigravity',
            ideName: this.status.activeIdeName || 'Antigravity IDE',
            actionCategory: detectedCategory,
          };

          this.status.lastAutoAction = action;
          this.status.actionHistory.unshift(action);
          if (this.status.actionHistory.length > 50) {
            this.status.actionHistory.pop();
          }

          if (this.onAutoAction) {
            this.onAutoAction(action);
          }

          // Transition to waiting for next prompt
          this.transitionState(
            'waiting_for_next_prompt',
            `Successfully submitted '${action.title}'. Continuously monitoring for next prompt...`
          );
        } else {
          this.transitionState('unsupported_prompt', `Prompt detected but action could not be completed: ${rep.FinalStatus}`);
        }

        this.status.lastActiveTimestamp = new Date().toISOString();
        this.notify();
        return res;
      } else {
        // No prompt visible in this cycle
        this.status.lastPromptDetected = false;
        this.consecutiveCycleWithoutPrompt++;

        // If we recently completed prompts and nothing has appeared for multiple cycles, state returns to monitoring
        if (this.status.state !== 'monitoring') {
          this.transitionState('monitoring', 'Active and monitoring for new Antigravity prompts...');
        }
        this.notify();
      }
      return res;
    } catch (err: any) {
      this.status.error = err.message;
      this.transitionState('error', `AutoPilot cycle error: ${err.message}`);
      return null;
    }
  }

  public async probePrompt(): Promise<any> {
    try {
      this.transitionState('analyzing', 'Probing prompt subtree...');
      const targetHwnd = this.status.selectedHwnd || this.status.targetHwnd || 0;
      const targetPid = this.status.targetPid || 0;

      const res = await this.psAdapter.inspectPromptSubtree(0, targetHwnd, targetPid);
      if (res.reportJson) {
        this.status.lastPromptDetected = !!res.reportJson.PromptFound;
        this.status.lastPromptType = res.reportJson.DetectedPromptType || null;
        this.status.lastRecommendedOption = res.reportJson.ExplicitRecommendedOption || null;
        this.status.targetHwnd = res.reportJson.TargetHwnd || this.status.targetHwnd;
        this.status.lastActiveTimestamp = new Date().toISOString();

        if (res.reportJson.PromptFound) {
          this.transitionState('prompt_detected', `Detected: ${res.reportJson.DetectedPromptType}`);
        } else {
          this.transitionState('monitoring', 'Inspection complete: no prompt dialog visible');
        }
      }
      return res;
    } catch (err: any) {
      this.status.error = err.message;
      this.transitionState('error', `Probe error: ${err.message}`);
      return null;
    }
  }

  public getIdeRegistry(): IdeRegistry {
    return this.ideRegistry;
  }

  public getIdeConnections(): IdeConnectionInfo[] {
    if (this.status.ideConnections && this.status.ideConnections.length > 0) {
      return this.status.ideConnections;
    }
    return this.ideRegistry.getInitialConnectionInfos();
  }

  public setTargetIdeFilter(filter: SupportedIdeId | 'all' | 'auto'): AgentStatus {
    this.status.targetIdeFilter = filter;
    if (this.docStore) {
      this.docStore.saveSettings({ targetIdeFilter: filter });
    }
    this.scanTargetWindow();
    return this.getStatus();
  }

  public updatePerIdeConfig(ideId: SupportedIdeId, config: Partial<PerIdeConfig>): AgentStatus {
    if (!this.ideConfigs[ideId]) {
      this.ideConfigs[ideId] = IdeRegistry.getDefaultIdeConfigs()[ideId];
    }
    this.ideConfigs[ideId] = { ...this.ideConfigs[ideId], ...config };
    if (this.docStore) {
      this.docStore.saveSettings({ ideConfigs: this.ideConfigs });
    }
    this.notify();
    return this.getStatus();
  }

  public async inspectIde(ideId: SupportedIdeId): Promise<any> {
    const adapter = this.ideRegistry.getAdapter(ideId);
    if (!adapter) {
      throw new Error(`Unsupported IDE: ${ideId}`);
    }
    const matched = (this.status.availableWindows || []).find((w) => adapter.matchesWindow(w));
    const hwnd = matched ? matched.hwnd : 0;
    const pid = matched ? matched.pid : 0;
    return adapter.detectPrompt(hwnd, pid);
  }

  private transitionState(newState: AutomationStateMachineState, description?: string): void {
    this.status.state = newState;
    if (description) {
      this.status.currentStepDescription = description;
    }
    this.notify();
  }

  private notify(): void {
    if (this.onStatusChange) {
      this.onStatusChange(this.getStatus());
    }
  }
}
