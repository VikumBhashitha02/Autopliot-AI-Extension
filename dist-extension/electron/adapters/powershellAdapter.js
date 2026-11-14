"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PowerShellAdapter = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const safetyGuard_1 = require("../security/safetyGuard");
class PowerShellAdapter {
    diagnosticsDir;
    constructor(diagnosticsDir) {
        this.diagnosticsDir = diagnosticsDir || path_1.default.join(process.cwd(), 'diagnostics');
    }
    runScript(scriptRelativePath, args = [], timeoutMs = 30000, onLog) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let scriptFullPath = path_1.default.isAbsolute(scriptRelativePath)
                ? scriptRelativePath
                : path_1.default.join(this.diagnosticsDir, scriptRelativePath);
            if (!fs_1.default.existsSync(scriptFullPath) || scriptFullPath.includes('app.asar')) {
                const resourcesPath = process.resourcesPath || '';
                const candidates = [
                    path_1.default.resolve(__dirname, '../../diagnostics', scriptRelativePath),
                    path_1.default.resolve(__dirname, '../diagnostics', scriptRelativePath),
                    path_1.default.resolve(__dirname, '../../../diagnostics', scriptRelativePath),
                    ...(resourcesPath ? [
                        path_1.default.join(resourcesPath, 'app.asar.unpacked', 'diagnostics', scriptRelativePath),
                        path_1.default.join(resourcesPath, 'diagnostics', scriptRelativePath),
                    ] : []),
                ];
                for (const cand of candidates) {
                    if (fs_1.default.existsSync(cand)) {
                        scriptFullPath = cand;
                        break;
                    }
                }
            }
            if (scriptFullPath.includes('app.asar')) {
                const unpackedPath = scriptFullPath.replace('app.asar', 'app.asar.unpacked');
                if (fs_1.default.existsSync(unpackedPath)) {
                    scriptFullPath = unpackedPath;
                }
            }
            if (!fs_1.default.existsSync(scriptFullPath)) {
                return resolve({
                    exitCode: 1,
                    stdout: '',
                    stderr: `Script not found: ${scriptFullPath}`,
                    timedOut: false,
                    durationMs: 0,
                });
            }
            const spawnArgs = [
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                scriptFullPath,
                ...args,
            ];
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            const child = (0, child_process_1.spawn)('powershell.exe', spawnArgs, {
                cwd: path_1.default.dirname(scriptFullPath),
                windowsHide: true,
            });
            const timer = setTimeout(() => {
                timedOut = true;
                try {
                    child.kill('SIGTERM');
                }
                catch { }
            }, timeoutMs);
            child.stdout?.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                if (onLog) {
                    const lines = text.split('\n').filter((l) => l.trim().length > 0);
                    for (const line of lines) {
                        onLog(safetyGuard_1.SafetyGuard.redactSensitive(line));
                    }
                }
            });
            child.stderr?.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                if (onLog) {
                    onLog(`[STDERR] ${safetyGuard_1.SafetyGuard.redactSensitive(text)}`);
                }
            });
            child.on('close', (code) => {
                clearTimeout(timer);
                const durationMs = Date.now() - startTime;
                resolve({
                    exitCode: code,
                    stdout: safetyGuard_1.SafetyGuard.redactSensitive(stdout),
                    stderr: safetyGuard_1.SafetyGuard.redactSensitive(stderr),
                    timedOut,
                    durationMs,
                });
            });
            child.on('error', (err) => {
                clearTimeout(timer);
                const durationMs = Date.now() - startTime;
                resolve({
                    exitCode: 1,
                    stdout: '',
                    stderr: `Spawn error: ${err.message}`,
                    timedOut,
                    durationMs,
                });
            });
        });
    }
    // --- Specific Diagnostic & Automation Helpers ---
    async listTargetWindows() {
        const res = await this.runScript('list_target_windows.ps1', [], 10000);
        if (!res.stdout)
            return [];
        try {
            const parsed = JSON.parse(res.stdout);
            if (Array.isArray(parsed)) {
                return parsed.map((w) => ({
                    hwnd: Number(w.Hwnd || 0),
                    pid: Number(w.Pid || 0),
                    title: String(w.Title || ''),
                    processName: String(w.ProcessName || 'Antigravity IDE'),
                    className: String(w.ClassName || ''),
                    isVisible: Boolean(w.IsVisible ?? true),
                }));
            }
            else if (parsed && parsed.Hwnd) {
                return [{
                        hwnd: Number(parsed.Hwnd || 0),
                        pid: Number(parsed.Pid || 0),
                        title: String(parsed.Title || ''),
                        processName: String(parsed.ProcessName || 'Antigravity IDE'),
                        className: String(parsed.ClassName || ''),
                        isVisible: Boolean(parsed.IsVisible ?? true),
                    }];
            }
        }
        catch { }
        return [];
    }
    async inspectPromptSubtree(delaySeconds = 0, targetHwndOrLog, targetPid = 0, onLog) {
        let hwnd = 0;
        let logCallback = onLog;
        if (typeof targetHwndOrLog === 'function') {
            logCallback = targetHwndOrLog;
        }
        else if (typeof targetHwndOrLog === 'number') {
            hwnd = targetHwndOrLog;
        }
        const args = ['-DelaySeconds', delaySeconds.toString()];
        if (hwnd > 0)
            args.push('-TargetHwnd', hwnd.toString());
        if (targetPid > 0)
            args.push('-TargetPid', targetPid.toString());
        const res = await this.runScript('inspect_prompt_subtree.ps1', args, (delaySeconds + 20) * 1000, logCallback);
        const jsonPath = path_1.default.join(this.diagnosticsDir, 'phase0_1_prompt_report.json');
        const summaryPath = path_1.default.join(this.diagnosticsDir, 'phase0_1_prompt_summary.txt');
        if (fs_1.default.existsSync(jsonPath)) {
            try {
                res.reportJson = JSON.parse(fs_1.default.readFileSync(jsonPath, 'utf-8'));
            }
            catch { }
        }
        if (fs_1.default.existsSync(summaryPath)) {
            try {
                res.summaryText = fs_1.default.readFileSync(summaryPath, 'utf-8');
            }
            catch { }
        }
        return res;
    }
    async selectAndCompletePrompt(targetSubstring = '(Recommended)', delaySeconds = 0, targetHwndOrLog, targetPid = 0, approvalPolicy = 'auto_safe_only', selectOnly = false, onLog) {
        let hwnd = 0;
        let logCallback = onLog;
        if (typeof targetHwndOrLog === 'function') {
            logCallback = targetHwndOrLog;
        }
        else if (typeof targetHwndOrLog === 'number') {
            hwnd = targetHwndOrLog;
        }
        const args = [
            '-DelaySeconds', delaySeconds.toString(),
            '-TargetOptionSubstring', targetSubstring,
            '-ApprovalPolicy', approvalPolicy,
        ];
        if (hwnd > 0)
            args.push('-TargetHwnd', hwnd.toString());
        if (targetPid > 0)
            args.push('-TargetPid', targetPid.toString());
        if (selectOnly)
            args.push('-SelectOnly');
        const res = await this.runScript('select_and_complete_prompt.ps1', args, (delaySeconds + 25) * 1000, logCallback);
        const jsonPath = path_1.default.join(this.diagnosticsDir, 'phase0_1_completion_report.json');
        const summaryPath = path_1.default.join(this.diagnosticsDir, 'phase0_1_completion_summary.txt');
        if (fs_1.default.existsSync(jsonPath)) {
            try {
                res.reportJson = JSON.parse(fs_1.default.readFileSync(jsonPath, 'utf-8'));
            }
            catch { }
        }
        if (fs_1.default.existsSync(summaryPath)) {
            try {
                res.summaryText = fs_1.default.readFileSync(summaryPath, 'utf-8');
            }
            catch { }
        }
        return res;
    }
    async inspectFileChangeApproval(delaySeconds = 0, targetHwnd = 0, targetPid = 0, onLog) {
        const args = ['-DelaySeconds', delaySeconds.toString()];
        if (targetHwnd > 0)
            args.push('-TargetHwnd', targetHwnd.toString());
        if (targetPid > 0)
            args.push('-TargetPid', targetPid.toString());
        const res = await this.runScript('inspect_file_change_approval.ps1', args, (delaySeconds + 20) * 1000, onLog);
        const jsonPath = path_1.default.join(this.diagnosticsDir, 'phase0_1_file_change_report.json');
        const summaryPath = path_1.default.join(this.diagnosticsDir, 'phase0_1_file_change_summary.txt');
        if (fs_1.default.existsSync(jsonPath)) {
            try {
                res.reportJson = JSON.parse(fs_1.default.readFileSync(jsonPath, 'utf-8'));
            }
            catch { }
        }
        else if (res.stdout) {
            try {
                res.reportJson = JSON.parse(res.stdout);
            }
            catch { }
        }
        if (fs_1.default.existsSync(summaryPath)) {
            try {
                res.summaryText = fs_1.default.readFileSync(summaryPath, 'utf-8');
            }
            catch { }
        }
        return res;
    }
    async executeFileChangeApproval(targetHwnd = 0, targetPid = 0, delaySeconds = 0, approvalPolicy = 'auto_safe_only', onLog) {
        const args = [
            '-DelaySeconds', delaySeconds.toString(),
            '-ApprovalPolicy', approvalPolicy,
        ];
        if (targetHwnd > 0)
            args.push('-TargetHwnd', targetHwnd.toString());
        if (targetPid > 0)
            args.push('-TargetPid', targetPid.toString());
        const res = await this.runScript('execute_file_change_approval.ps1', args, (delaySeconds + 25) * 1000, onLog);
        const jsonPath = path_1.default.join(this.diagnosticsDir, 'phase0_1_file_change_completion_report.json');
        const summaryPath = path_1.default.join(this.diagnosticsDir, 'phase0_1_file_change_completion_summary.txt');
        if (fs_1.default.existsSync(jsonPath)) {
            try {
                res.reportJson = JSON.parse(fs_1.default.readFileSync(jsonPath, 'utf-8'));
            }
            catch { }
        }
        else if (res.stdout) {
            try {
                res.reportJson = JSON.parse(res.stdout);
            }
            catch { }
        }
        if (fs_1.default.existsSync(summaryPath)) {
            try {
                res.summaryText = fs_1.default.readFileSync(summaryPath, 'utf-8');
            }
            catch { }
        }
        return res;
    }
    getAvailableDiagnosticReports() {
        if (!fs_1.default.existsSync(this.diagnosticsDir))
            return [];
        const files = fs_1.default.readdirSync(this.diagnosticsDir);
        return files.map((file) => {
            const full = path_1.default.join(this.diagnosticsDir, file);
            const stat = fs_1.default.statSync(full);
            return {
                name: file,
                sizeBytes: stat.size,
                modifiedAt: stat.mtime.toISOString(),
            };
        });
    }
    readDiagnosticFile(fileName) {
        const full = path_1.default.join(this.diagnosticsDir, path_1.default.basename(fileName));
        if (!fs_1.default.existsSync(full))
            return null;
        return fs_1.default.readFileSync(full, 'utf-8');
    }
}
exports.PowerShellAdapter = PowerShellAdapter;
//# sourceMappingURL=powershellAdapter.js.map