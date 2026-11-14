"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileChangeApprovalDetector = void 0;
const safetyGuard_1 = require("../security/safetyGuard");
class FileChangeApprovalDetector {
    psAdapter;
    constructor(psAdapter) {
        this.psAdapter = psAdapter;
    }
    isAcceptAllButton(name) {
        return safetyGuard_1.SafetyGuard.isAcceptAllButtonName(name);
    }
    isNegativeAction(name) {
        return safetyGuard_1.SafetyGuard.isNegativeFileAction(name);
    }
    async detectFileChangeApproval(targetHwnd = 0, targetPid = 0, delaySeconds = 0) {
        return this.detect(targetHwnd, targetPid, delaySeconds);
    }
    async detect(targetHwnd = 0, targetPid = 0, delaySeconds = 0) {
        try {
            const runRes = await this.psAdapter.inspectFileChangeApproval(delaySeconds, targetHwnd, targetPid);
            const raw = runRes.reportJson || {};
            return this.normalizeDetectionResult(raw, targetHwnd, targetPid);
        }
        catch (err) {
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
    normalizeDetectionResult(raw, fallbackHwnd = 0, fallbackPid = 0) {
        const hwnd = Number(raw.TargetHwnd ?? raw.targetHwnd ?? fallbackHwnd);
        const pid = Number(raw.ProcessId ?? raw.processId ?? fallbackPid);
        const title = String(raw.WindowTitle ?? raw.windowTitle ?? '');
        const winClass = String(raw.WindowClass ?? raw.windowClass ?? '');
        const found = Boolean(raw.FileChangeApprovalFound ?? raw.fileChangeApprovalFound ?? false);
        const ambiguous = Boolean(raw.IsAmbiguous ?? raw.isAmbiguous ?? false);
        const confidence = (raw.Confidence ?? raw.confidence ?? 'NONE').toUpperCase();
        let btn;
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
        let container;
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
        const modifiedFiles = Array.isArray(raw.ModifiedFiles ?? raw.modifiedFiles)
            ? (raw.ModifiedFiles ?? raw.modifiedFiles).map(String)
            : [];
        const siblingActions = Array.isArray(raw.SiblingActions ?? raw.siblingActions)
            ? (raw.SiblingActions ?? raw.siblingActions).map(String)
            : [];
        const warnings = Array.isArray(raw.Warnings ?? raw.warnings)
            ? (raw.Warnings ?? raw.warnings).map(String)
            : [];
        const detectionEvidence = Array.isArray(raw.DetectionEvidence ?? raw.detectionEvidence)
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
exports.FileChangeApprovalDetector = FileChangeApprovalDetector;
//# sourceMappingURL=fileChangeApprovalDetector.js.map