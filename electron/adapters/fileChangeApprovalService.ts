import { PowerShellAdapter } from './powershellAdapter';
import { SafetyGuard } from '../security/safetyGuard';
import { DocumentStore } from '../storage/documentStore';
import { FileChangeApprovalDetector } from './fileChangeApprovalDetector';
import {
  FileChangeDetectionResult,
  FileChangeApprovalResult,
  AutoPilotAction,
} from '../engine/types';

export class FileChangeApprovalService {
  private detector: FileChangeApprovalDetector;
  private isCancelled: boolean = false;
  private lastExecutedFingerprint: string = '';
  private lastExecutedTimestamp: number = 0;

  constructor(
    private psAdapter: PowerShellAdapter,
    private docStore?: DocumentStore,
    detector?: FileChangeApprovalDetector
  ) {
    this.detector = detector || new FileChangeApprovalDetector(psAdapter);
  }

  public getDetector(): FileChangeApprovalDetector {
    return this.detector;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  public resetCancel(): void {
    this.isCancelled = false;
  }

  public async detectPendingChanges(
    targetHwnd: number = 0,
    targetPid: number = 0
  ): Promise<FileChangeDetectionResult> {
    return this.detector.detect(targetHwnd, targetPid);
  }

  public generateFingerprint(detection: FileChangeDetectionResult): string {
    const hwnd = detection.targetHwnd || 0;
    const btn = detection.buttonFound?.name || '';
    const bounds = detection.buttonFound?.boundingRectangle || '';
    const files = detection.modifiedFiles.sort().join('|');
    return `${hwnd}_${btn}_${bounds}_${files}`;
  }

  public isDuplicateExecution(detection: FileChangeDetectionResult): boolean {
    const fp = this.generateFingerprint(detection);
    const now = Date.now();
    // Prevent duplicate approval of the exact same dialog within 5 seconds
    return fp === this.lastExecutedFingerprint && now - this.lastExecutedTimestamp < 5000;
  }

  public async executeApproval(
    detection: FileChangeDetectionResult,
    policy: 'always_manual' | 'auto_safe_only' | 'full_auto',
    delayMs: number = 250,
    currentTargetHwnd?: number
  ): Promise<FileChangeApprovalResult> {
    const startTime = Date.now();

    // Verification 1: Check cancellation / emergency stop
    if (this.isCancelled) {
      return {
        timestamp: new Date().toISOString(),
        targetHwnd: detection.targetHwnd,
        processId: detection.processId,
        windowTitle: detection.windowTitle,
        success: false,
        finalStatus: 'CANCELLED_BY_EMERGENCY_STOP',
        buttonClicked: detection.buttonFound?.name || '',
        containerClass: detection.container?.className || '',
        dismissalVerified: false,
        durationMs: 0,
        logs: ['Execution aborted: Emergency stop / cancellation active.'],
      };
    }

    // Verification 2: Check target window stability
    if (currentTargetHwnd && currentTargetHwnd > 0 && detection.targetHwnd > 0 && currentTargetHwnd !== detection.targetHwnd) {
      return {
        timestamp: new Date().toISOString(),
        targetHwnd: detection.targetHwnd,
        processId: detection.processId,
        windowTitle: detection.windowTitle,
        success: false,
        finalStatus: 'TARGET_HWND_CHANGED',
        buttonClicked: detection.buttonFound?.name || '',
        containerClass: detection.container?.className || '',
        dismissalVerified: false,
        durationMs: 0,
        logs: [`Target window changed from HWND ${detection.targetHwnd} to ${currentTargetHwnd}. Aborting action.`],
      };
    }

    // Verification 3: Check button name against safety guard
    const btnName = detection.buttonFound?.name || '';
    if (!this.detector.isAcceptAllButton(btnName)) {
      return {
        timestamp: new Date().toISOString(),
        targetHwnd: detection.targetHwnd,
        processId: detection.processId,
        windowTitle: detection.windowTitle,
        success: false,
        finalStatus: 'UNAPPROVED_BUTTON_NAME',
        buttonClicked: btnName,
        containerClass: detection.container?.className || '',
        dismissalVerified: false,
        durationMs: 0,
        logs: [`Button name '${btnName}' is not a recognized 'Accept all' action.`],
      };
    }

    // Verification 4: NEVER execute negative actions
    if (this.detector.isNegativeAction(btnName)) {
      return {
        timestamp: new Date().toISOString(),
        targetHwnd: detection.targetHwnd,
        processId: detection.processId,
        windowTitle: detection.windowTitle,
        success: false,
        finalStatus: 'NEGATIVE_ACTION_REJECTED',
        buttonClicked: btnName,
        containerClass: detection.container?.className || '',
        dismissalVerified: false,
        durationMs: 0,
        logs: [`Negative action '${btnName}' permanently blocked by SafetyGuard.`],
      };
    }

    // Verification 5: Policy checks
    const evalRes = SafetyGuard.evaluateFileChangePolicy(policy, detection.confidence, detection.isAmbiguous);
    if (!evalRes.canAutoApprove) {
      return {
        timestamp: new Date().toISOString(),
        targetHwnd: detection.targetHwnd,
        processId: detection.processId,
        windowTitle: detection.windowTitle,
        success: false,
        finalStatus: evalRes.requiresManualApproval ? 'AWAITING_MANUAL_APPROVAL' : 'POLICY_DISALLOWED',
        buttonClicked: btnName,
        containerClass: detection.container?.className || '',
        dismissalVerified: false,
        durationMs: 0,
        logs: [`Action requires manual approval or policy disallowed under ${policy}.`],
      };
    }

    // Verification 6: Debounce duplicate execution
    if (this.isDuplicateExecution(detection)) {
      return {
        timestamp: new Date().toISOString(),
        targetHwnd: detection.targetHwnd,
        processId: detection.processId,
        windowTitle: detection.windowTitle,
        success: true,
        finalStatus: 'DUPLICATE_EXECUTION_SKIPPED',
        buttonClicked: btnName,
        containerClass: detection.container?.className || '',
        dismissalVerified: true,
        durationMs: 0,
        logs: ['Identical file-change approval was recently executed; skipping duplicate invocation.'],
      };
    }

    // Apply configured response delay
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Check cancellation immediately before invocation
    if (this.isCancelled) {
      return {
        timestamp: new Date().toISOString(),
        targetHwnd: detection.targetHwnd,
        processId: detection.processId,
        windowTitle: detection.windowTitle,
        success: false,
        finalStatus: 'CANCELLED_BEFORE_INVOCATION',
        buttonClicked: btnName,
        containerClass: detection.container?.className || '',
        dismissalVerified: false,
        durationMs: Date.now() - startTime,
        logs: ['Cancelled by emergency stop immediately before invocation.'],
      };
    }

    // Invoke via PowerShell STA adapter
    try {
      const psRes = await this.psAdapter.executeFileChangeApproval(
        detection.targetHwnd,
        detection.processId,
        0,
        policy
      );

      const rep = psRes.reportJson || {};
      const success = Boolean(rep.Success ?? rep.success ?? false);
      const finalStatus = String(rep.FinalStatus ?? rep.finalStatus ?? (success ? 'COMPLETED_SUCCESSFULLY' : 'INVOCATION_FAILED'));
      const dismissed = Boolean(rep.DismissalVerified ?? rep.dismissalVerified ?? success);
      const clicked = String(rep.ButtonClicked ?? rep.buttonClicked ?? btnName);
      const containerCls = String(rep.ContainerClass ?? rep.containerClass ?? detection.container?.className ?? '');
      const logs = Array.isArray(rep.Logs ?? rep.logs) ? (rep.Logs ?? rep.logs).map(String) : [];

      const durationMs = Date.now() - startTime;

      if (success) {
        this.lastExecutedFingerprint = this.generateFingerprint(detection);
        this.lastExecutedTimestamp = Date.now();
      }

      return {
        timestamp: new Date().toISOString(),
        targetHwnd: detection.targetHwnd,
        processId: detection.processId,
        windowTitle: detection.windowTitle,
        success,
        finalStatus,
        buttonClicked: clicked,
        containerClass: containerCls,
        dismissalVerified: dismissed,
        durationMs,
        logs,
      };
    } catch (err: any) {
      return {
        timestamp: new Date().toISOString(),
        targetHwnd: detection.targetHwnd,
        processId: detection.processId,
        windowTitle: detection.windowTitle,
        success: false,
        finalStatus: 'EXECUTION_EXCEPTION',
        buttonClicked: btnName,
        containerClass: detection.container?.className || '',
        dismissalVerified: false,
        durationMs: Date.now() - startTime,
        logs: [`Execution exception: ${err.message}`],
      };
    }
  }

  public createActionHistoryRecord(
    detection: FileChangeDetectionResult,
    result: FileChangeApprovalResult,
    policy: 'always_manual' | 'auto_safe_only' | 'full_auto'
  ): AutoPilotAction {
    return {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      title: detection.windowTitle || 'Antigravity File Change Approval',
      optionSelected: detection.modifiedFiles.length > 0
        ? `Accept Changes (${detection.modifiedFiles.length} file${detection.modifiedFiles.length > 1 ? 's' : ''})`
        : 'Accept All File Changes',
      buttonClicked: result.buttonClicked || detection.buttonFound?.name || 'Accept all',
      status: result.finalStatus,
      durationMs: result.durationMs,
      verifiedClosed: result.dismissalVerified,
      policyApplied: policy,
      targetHwnd: detection.targetHwnd,
      windowTitle: detection.windowTitle,
      actionType: 'FILE_CHANGE_ACCEPT_ALL',
      action: 'Accept all file changes',
      targetProcess: 'Antigravity IDE',
      actionCategory: 'FILE_CHANGE_APPROVAL',
      detectedButton: result.buttonClicked || detection.buttonFound?.name || 'Accept all',
      executionTimeMs: result.durationMs,
      fileChangeMetadata: {
        modifiedFiles: detection.modifiedFiles,
        containerClass: detection.container?.className,
        confidence: detection.confidence,
        siblingActions: detection.siblingActions,
      },
    };
  }
}

