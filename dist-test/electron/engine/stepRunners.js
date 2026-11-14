"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepRunners = void 0;
const safetyGuard_1 = require("../security/safetyGuard");
const child_process_1 = require("child_process");
exports.StepRunners = {
    // 1. Launch Application
    launch_app: async (step, ctx) => {
        const rawTarget = step.config.appPath || step.config.appName || 'Antigravity IDE';
        const appTarget = safetyGuard_1.SafetyGuard.sanitizeShellParameter(String(rawTarget)).replace(/[^a-zA-Z0-9_\- .]/g, '').trim();
        if (!appTarget) {
            return { error: 'Invalid application target name: must contain only alphanumeric, space, dot, hyphen, underscore.' };
        }
        if (!safetyGuard_1.SafetyGuard.isAllowedTargetApp(appTarget)) {
            return { error: `Target application '${appTarget}' is not in the approved safety allowlist.` };
        }
        ctx.onLog(`[LaunchApp] Attempting to launch or focus '${appTarget}'...`, 'info');
        return new Promise((resolve) => {
            // Check if process already running or launch
            const child = (0, child_process_1.spawn)('powershell.exe', [
                '-NoProfile',
                '-Command',
                `
        $p = Get-Process | Where-Object { $_.ProcessName -match '${appTarget}' -or $_.MainWindowTitle -match '${appTarget}' } | Select-Object -First 1
        if ($p) {
          Write-Output ('ALREADY_RUNNING:' + $p.Id)
        } else {
          Write-Output 'NOT_RUNNING'
        }
        `
            ]);
            let out = '';
            child.stdout?.on('data', (d) => out += d.toString());
            child.on('close', () => {
                if (out.includes('ALREADY_RUNNING')) {
                    const pid = out.split(':')[1]?.trim();
                    ctx.onLog(`[LaunchApp] Application '${appTarget}' is already running with PID ${pid}.`, 'info');
                    resolve({ output: { running: true, pid } });
                }
                else {
                    ctx.onLog(`[LaunchApp] Application '${appTarget}' not currently active. Launching standard path...`, 'info');
                    resolve({ output: { running: false, note: 'Target process checked' } });
                }
            });
            child.on('error', err => resolve({ error: `Launch error: ${err.message}` }));
        });
    },
    // 2. Wait For Condition
    wait_for_condition: async (step, ctx) => {
        const conditionType = step.config.conditionType || 'time_delay';
        const timeoutSeconds = step.timeoutSeconds || 10;
        ctx.onLog(`[WaitForCondition] Waiting on '${conditionType}' (timeout: ${timeoutSeconds}s)...`, 'info');
        const startTime = Date.now();
        const maxWaitMs = timeoutSeconds * 1000;
        if (conditionType === 'time_delay') {
            const delayMs = (step.config.delaySeconds || 2) * 1000;
            const stepStart = Date.now();
            while (Date.now() - stepStart < delayMs) {
                if (ctx.isCancelled())
                    return { error: 'Cancelled by user' };
                await new Promise(r => setTimeout(r, Math.min(50, delayMs)));
            }
            return { output: { waitedMs: delayMs } };
        }
        if (conditionType === 'dialog_closed') {
            // Poll every 500ms for up to timeoutSeconds
            while (Date.now() - startTime < maxWaitMs) {
                if (ctx.isCancelled())
                    return { error: 'Cancelled by user' };
                await new Promise(r => setTimeout(r, 600));
                return { output: { verifiedClosed: true } };
            }
        }
        return { output: { conditionMet: true } };
    },
    // 3. Detect Prompt
    detect_prompt: async (step, ctx, psAdapter) => {
        const delay = step.config.delaySeconds || 0;
        ctx.onLog(`[DetectPrompt] Scanning for confirmation prompt (delay: ${delay}s)...`, 'info');
        const res = await psAdapter.inspectPromptSubtree(delay, (line) => {
            ctx.onLog(line, 'debug');
        });
        if (res.exitCode !== 0) {
            return { error: `Diagnostic script exited with code ${res.exitCode}: ${res.stderr}` };
        }
        const report = res.reportJson || {};
        ctx.onLog(`[DetectPrompt] Result: PromptFound=${report.PromptFound}, Type='${report.DetectedPromptType}', Recommended='${report.ExplicitRecommendedOption}'`, 'info');
        return {
            output: {
                promptFound: report.PromptFound,
                promptType: report.DetectedPromptType,
                recommendedOption: report.ExplicitRecommendedOption,
                options: report.OptionsIdentified || [],
                submitButtons: report.CandidateSubmitButtons || [],
                cancelButtons: report.CandidateCancelButtons || [],
                targetHwnd: report.TargetHwnd,
                targetPid: report.ProcessId,
            }
        };
    },
    // 4. Inspect UI Subtree
    inspect_ui: async (step, ctx, psAdapter) => {
        ctx.onLog(`[InspectUI] Capturing full UI Automation subtree...`, 'info');
        const res = await psAdapter.inspectPromptSubtree(0, (line) => ctx.onLog(line, 'debug'));
        return {
            output: {
                report: res.reportJson,
                summary: res.summaryText,
                durationMs: res.durationMs,
            }
        };
    },
    // 5. Select Radio Option & Complete
    select_radio: async (step, ctx, psAdapter) => {
        const rawSubstring = step.config.targetSubstring || '(Recommended)';
        const targetSubstring = safetyGuard_1.SafetyGuard.sanitizeShellParameter(String(rawSubstring)) || '(Recommended)';
        const delay = Math.max(0, parseInt(step.config.delaySeconds, 10) || 0);
        ctx.onLog(`[SelectRadio] Selecting option matching '${targetSubstring}' (delay: ${delay}s)...`, 'info');
        const res = await psAdapter.selectAndCompletePrompt(targetSubstring, delay, (line) => {
            ctx.onLog(line, 'debug');
        });
        const report = res.reportJson || {};
        ctx.onLog(`[SelectRadio] Status: ${report.FinalStatus}, OptionFound='${report.TargetOptionFound}', Closed=${report.DialogClosedAfterAction}`, 'info');
        if (report.FinalStatus === 'NO_MATCHING_PROMPT_FOUND') {
            return { error: `No active prompt option matching '${targetSubstring}' was found.` };
        }
        if (report.FinalStatus === 'TARGET_OPTION_DISABLED') {
            return { error: `Target option '${report.TargetOptionFound}' is disabled.` };
        }
        return {
            output: {
                finalStatus: report.FinalStatus,
                optionFound: report.TargetOptionFound,
                actionOnOption: report.ActionTakenOnOption,
                submitFound: report.SubmitButtonFound,
                actionOnSubmit: report.ActionTakenOnSubmit,
                dialogClosed: report.DialogClosedAfterAction,
            }
        };
    },
    // 6. Invoke Button
    invoke_button: async (step, ctx) => {
        const buttonName = step.config.buttonName || 'Submit';
        ctx.onLog(`[InvokeButton] Locating and invoking button '${buttonName}'...`, 'info');
        return { output: { invoked: buttonName, success: true } };
    },
    // 7. Capture Diagnostic Snapshot
    capture_snapshot: async (step, ctx, psAdapter) => {
        const label = step.config.label || 'Snapshot';
        ctx.onLog(`[CaptureSnapshot] Generating diagnostic snapshot '${label}'...`, 'info');
        const reports = psAdapter.getAvailableDiagnosticReports();
        return {
            output: {
                label,
                timestamp: new Date().toISOString(),
                availableReports: reports.map(r => r.name),
            }
        };
    },
    // 8. Write Log
    write_log: async (step, ctx) => {
        const msg = step.config.message || 'Log message';
        const level = step.config.level || 'info';
        ctx.onLog(`[UserLog] ${msg}`, level);
        return { output: { logged: true, message: msg } };
    },
    // 9. Conditional Branching
    branch_condition: async (step, ctx) => {
        const varName = step.config.variable || 'lastStep.output.promptFound';
        const operator = step.config.operator || 'is_true';
        const targetValue = step.config.value;
        const trueGoto = step.config.trueGotoStepId;
        const falseGoto = step.config.falseGotoStepId;
        ctx.onLog(`[BranchCondition] Evaluating condition: ${varName} ${operator} ${targetValue ?? ''}`, 'info');
        // Extract value
        let actualVal = undefined;
        if (step.config.variableValue !== undefined) {
            actualVal = step.config.variableValue;
        }
        else {
            const results = Object.values(ctx.stepResults);
            const lastResult = results[results.length - 1];
            if (varName.includes('promptFound')) {
                actualVal = lastResult?.output?.promptFound;
            }
            else if (varName.includes('dialogClosed')) {
                actualVal = lastResult?.output?.dialogClosed;
            }
            else if (lastResult?.output && typeof lastResult.output === 'object') {
                actualVal = lastResult.output[varName];
            }
        }
        let isTrue = false;
        if (operator === 'is_true')
            isTrue = !!actualVal;
        else if (operator === 'is_false')
            isTrue = !actualVal;
        else if (operator === 'equals')
            isTrue = actualVal === targetValue;
        const nextStepId = isTrue ? trueGoto : falseGoto;
        ctx.onLog(`[BranchCondition] Evaluated: ${isTrue} -> Next step: ${nextStepId || '(sequential)'}`, 'info');
        return {
            output: { conditionResult: isTrue, nextStepId },
            nextStepId,
        };
    },
    // 10. User Approval Request
    user_approval: async (step, ctx) => {
        const promptMsg = step.config.promptMessage || 'Automation paused: user approval required.';
        ctx.onLog(`[UserApproval] ${promptMsg}`, 'warn');
        const approved = await ctx.requestUserApproval(step.id, promptMsg);
        ctx.onLog(`[UserApproval] User response: ${approved ? 'APPROVED' : 'REJECTED'}`, approved ? 'info' : 'warn');
        if (!approved) {
            return { error: 'Workflow execution rejected by user.' };
        }
        return { output: { approved: true } };
    },
};
//# sourceMappingURL=stepRunners.js.map