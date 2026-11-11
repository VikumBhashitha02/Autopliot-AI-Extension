import { PowerShellAdapter } from './powershellAdapter';
import { SafetyGuard } from '../security/safetyGuard';
import {
  FileChangeDetectionResult,
  FileChangeCandidateButton,
  FileChangeContainerInfo,
} from '../engine/types';

export class FileChangeApprovalDetector {
  constructor(private psAdapter: PowerShellAdapter) {}

  public isAcceptAllButton(name: string): boolean {
    return SafetyGuard.isAcceptAllButtonName(name);
  }

  public isNegativeAction(name: string): boolean {
    return SafetyGuard.isNegativeFileAction(name);
  }

  public async detectFileChangeApproval(
    targetHwnd: number = 0,
    targetPid: number = 0,
    delaySeconds: number = 0
  ): Promise<FileChangeDetectionResult> {
    return this.detect(targetHwnd, targetPid, delaySeconds);
  }

  public async detect(
    targetHwnd: number = 0,
    targetPid: number = 0,
    delaySeconds: number = 0
  ): Promise<FileChangeDetectionResult> {
    try {
      const runRes = await this.psAdapter.inspectFileChangeApproval(
        delaySeconds,
        targetHwnd,
        targetPid
      );

      const raw = runRes.reportJson || {};
      return this.normalizeDetectionResult(raw, targetHwnd, targetPid);
    } catch (err: any) {
      return {
        timestamp: new Date().toISOString(),
        targetHwnd,
        processId: targetPid,
        windowTitle: '',
        windowClass: '',
        fileChangeApprovalFound: false,
        isAmbiguous: true,
        confidence: 'NONE',
        modifiedFiles: [],
        siblingActions: [],
        warnings: [`Detector exception: ${err.message}`],
        detectionEvidence: [],
      };
    }
  }

  public normalizeDetectionResult(
    raw: any,
    fallbackHwnd: number = 0,
    fallbackPid: number = 0
  ): FileChangeDetectionResult {
    const hwnd = Number(raw.TargetHwnd ?? raw.targetHwnd ?? fallbackHwnd);
    const pid = Number(raw.ProcessId ?? raw.processId ?? fallbackPid);
    const title = String(raw.WindowTitle ?? raw.windowTitle ?? '');
    const winClass = String(raw.WindowClass ?? raw.windowClass ?? '');
    const found = Boolean(raw.FileChangeApprovalFound ?? raw.fileChangeApprovalFound ?? false);
    const ambiguous = Boolean(raw.IsAmbiguous ?? raw.isAmbiguous ?? false);
    const confidence = (raw.Confidence ?? raw.confidence ?? 'NONE').toUpperCase() as
      | 'NONE'
      | 'LOW'
      | 'MEDIUM'
      | 'HIGH';

    let btn: FileChangeCandidateButton | undefined;
    const rawBtn = raw.ButtonFound ?? raw.buttonFound;
    if (rawBtn && rawBtn.Name) {
      btn = {
        name: String(rawBtn.Name ?? rawBtn.name ?? ''),
        automationId: String(rawBtn.AutomationId ?? rawBtn.automationId ?? ''),
        controlType: String(rawBtn.ControlType ?? rawBtn.controlType ?? 'Button'),
        className: String(rawBtn.ClassName ?? rawBtn.className ?? ''),
        boundingRectangle: String(rawBtn.BoundingRectangle ?? rawBtn.boundingRectangle ?? ''),
        isEnabled: Boolean(rawBtn.IsEnabled ?? rawBtn.isEnabled ?? true),
        supportsInvoke: Boolean(rawBtn.SupportsInvoke ?? rawBtn.supportsInvoke ?? true),
      };
    }

    let container: FileChangeContainerInfo | undefined;
    const rawContainer = raw.Container ?? raw.container;
    if (rawContainer && (rawContainer.ClassName || rawContainer.Name)) {
      container = {
        name: String(rawContainer.Name ?? rawContainer.name ?? ''),
        automationId: String(rawContainer.AutomationId ?? rawContainer.automationId ?? ''),
        className: String(rawContainer.ClassName ?? rawContainer.className ?? ''),
        controlType: String(rawContainer.ControlType ?? rawContainer.controlType ?? 'Pane'),
        boundingRectangle: String(rawContainer.BoundingRectangle ?? rawContainer.boundingRectangle ?? ''),
      };
    }

    const modifiedFiles: string[] = Array.isArray(raw.ModifiedFiles ?? raw.modifiedFiles)
      ? (raw.ModifiedFiles ?? raw.modifiedFiles).map(String)
      : [];

    const siblingActions: string[] = Array.isArray(raw.SiblingActions ?? raw.siblingActions)
      ? (raw.SiblingActions ?? raw.siblingActions).map(String)
      : [];

    const warnings: string[] = Array.isArray(raw.Warnings ?? raw.warnings)
      ? (raw.Warnings ?? raw.warnings).map(String)
      : [];

    const detectionEvidence: string[] = Array.isArray(raw.DetectionEvidence ?? raw.detectionEvidence)
      ? (raw.DetectionEvidence ?? raw.detectionEvidence).map(String)
      : [];

    return {
      timestamp: String(raw.Timestamp ?? raw.timestamp ?? new Date().toISOString()),
      targetHwnd: hwnd,
      processId: pid,
      windowTitle: title,
      windowClass: winClass,
      fileChangeApprovalFound: found,
      isAmbiguous: ambiguous,
      confidence,
      buttonFound: btn,
      container,
      modifiedFiles,
      siblingActions,
      warnings,
      detectionEvidence,
    };
  }
}

