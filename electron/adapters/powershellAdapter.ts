import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { SafetyGuard } from '../security/safetyGuard';
import { TargetWindowInfo } from '../engine/types';

export interface PowerShellRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  reportJson?: any;
  summaryText?: string;
}

export class PowerShellAdapter {
  private diagnosticsDir: string;

  constructor(diagnosticsDir?: string) {
    this.diagnosticsDir = diagnosticsDir || path.join(process.cwd(), 'diagnostics');
  }

  public runScript(
    scriptRelativePath: string,
    args: string[] = [],
    timeoutMs: number = 30000,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let scriptFullPath = path.isAbsolute(scriptRelativePath)
        ? scriptRelativePath
        : path.join(this.diagnosticsDir, scriptRelativePath);

      if (!fs.existsSync(scriptFullPath) || scriptFullPath.includes('app.asar')) {
        const resourcesPath = (process as any).resourcesPath || '';
        const candidates = [
          path.resolve(__dirname, '../../diagnostics', scriptRelativePath),
          path.resolve(__dirname, '../diagnostics', scriptRelativePath),
          path.resolve(__dirname, '../../../diagnostics', scriptRelativePath),
          ...(resourcesPath ? [
            path.join(resourcesPath, 'app.asar.unpacked', 'diagnostics', scriptRelativePath),
            path.join(resourcesPath, 'diagnostics', scriptRelativePath),
          ] : []),
        ];
        for (const cand of candidates) {
          if (fs.existsSync(cand)) {
            scriptFullPath = cand;
            break;
          }
        }
      }

      if (scriptFullPath.includes('app.asar')) {
        const unpackedPath = scriptFullPath.replace('app.asar', 'app.asar.unpacked');
        if (fs.existsSync(unpackedPath)) {
          scriptFullPath = unpackedPath;
        }
      }

      if (!fs.existsSync(scriptFullPath)) {
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

      const child: ChildProcess = spawn('powershell.exe', spawnArgs, {
        cwd: path.dirname(scriptFullPath),
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGTERM');
        } catch { }
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer | string) => {
        const text = data.toString();
        stdout += text;
        if (onLog) {
          const lines = text.split('\n').filter((l: string) => l.trim().length > 0);
          for (const line of lines) {
            onLog(SafetyGuard.redactSensitive(line));
          }
        }
      });

      child.stderr?.on('data', (data: Buffer | string) => {
        const text = data.toString();
        stderr += text;
        if (onLog) {
          onLog(`[STDERR] ${SafetyGuard.redactSensitive(text)}`);
        }
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({
          exitCode: code,
          stdout: SafetyGuard.redactSensitive(stdout),
          stderr: SafetyGuard.redactSensitive(stderr),
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

  public async listTargetWindows(): Promise<TargetWindowInfo[]> {
    const res = await this.runScript('list_target_windows.ps1', [], 10000);
    if (!res.stdout) return [];
    try {
      const parsed = JSON.parse(res.stdout);
      if (Array.isArray(parsed)) {
        return parsed.map((w: any) => ({
          hwnd: Number(w.Hwnd || 0),
          pid: Number(w.Pid || 0),
          title: String(w.Title || ''),
          processName: String(w.ProcessName || 'Antigravity IDE'),
          className: String(w.ClassName || ''),
          isVisible: Boolean(w.IsVisible ?? true),
        }));
      } else if (parsed && parsed.Hwnd) {
        return [{
          hwnd: Number(parsed.Hwnd || 0),
          pid: Number(parsed.Pid || 0),
          title: String(parsed.Title || ''),
          processName: String(parsed.ProcessName || 'Antigravity IDE'),
          className: String(parsed.ClassName || ''),
          isVisible: Boolean(parsed.IsVisible ?? true),
        }];
      }
    } catch { }
    return [];
  }

  public async inspectPromptSubtree(
    delaySeconds: number = 0,
    targetHwndOrLog?: number | ((msg: string) => void),
    targetPid: number = 0,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult> {
    let hwnd = 0;
    let logCallback = onLog;

    if (typeof targetHwndOrLog === 'function') {
      logCallback = targetHwndOrLog;
    } else if (typeof targetHwndOrLog === 'number') {
      hwnd = targetHwndOrLog;
    }

    const args = ['-DelaySeconds', delaySeconds.toString()];
    if (hwnd > 0) args.push('-TargetHwnd', hwnd.toString());
    if (targetPid > 0) args.push('-TargetPid', targetPid.toString());

    const res = await this.runScript(
      'inspect_prompt_subtree.ps1',
      args,
      (delaySeconds + 20) * 1000,
      logCallback
    );

    const jsonPath = path.join(this.diagnosticsDir, 'phase0_1_prompt_report.json');
    const summaryPath = path.join(this.diagnosticsDir, 'phase0_1_prompt_summary.txt');

    if (fs.existsSync(jsonPath)) {
      try {
        res.reportJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch { }
    }
    if (fs.existsSync(summaryPath)) {
      try {
        res.summaryText = fs.readFileSync(summaryPath, 'utf-8');
      } catch { }
    }

    return res;
  }

  public async selectAndCompletePrompt(
    targetSubstring: string = '(Recommended)',
    delaySeconds: number = 0,
    targetHwndOrLog?: number | ((msg: string) => void),
    targetPid: number = 0,
    approvalPolicy: string = 'auto_safe_only',
    selectOnly: boolean = false,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult> {
    let hwnd = 0;
    let logCallback = onLog;

    if (typeof targetHwndOrLog === 'function') {
      logCallback = targetHwndOrLog;
    } else if (typeof targetHwndOrLog === 'number') {
      hwnd = targetHwndOrLog;
    }

    const args = [
      '-DelaySeconds', delaySeconds.toString(),
      '-TargetOptionSubstring', targetSubstring,
      '-ApprovalPolicy', approvalPolicy,
    ];
    if (hwnd > 0) args.push('-TargetHwnd', hwnd.toString());
    if (targetPid > 0) args.push('-TargetPid', targetPid.toString());
    if (selectOnly) args.push('-SelectOnly');

    const res = await this.runScript(
      'select_and_complete_prompt.ps1',
      args,
      (delaySeconds + 25) * 1000,
      logCallback
    );

    const jsonPath = path.join(this.diagnosticsDir, 'phase0_1_completion_report.json');
    const summaryPath = path.join(this.diagnosticsDir, 'phase0_1_completion_summary.txt');

    if (fs.existsSync(jsonPath)) {
      try {
        res.reportJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch { }
    }
    if (fs.existsSync(summaryPath)) {
      try {
        res.summaryText = fs.readFileSync(summaryPath, 'utf-8');
      } catch { }
    }

    return res;
  }

  public async inspectFileChangeApproval(
    delaySeconds: number = 0,
    targetHwnd: number = 0,
    targetPid: number = 0,
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult> {
    const args = ['-DelaySeconds', delaySeconds.toString()];
    if (targetHwnd > 0) args.push('-TargetHwnd', targetHwnd.toString());
    if (targetPid > 0) args.push('-TargetPid', targetPid.toString());

    const res = await this.runScript(
      'inspect_file_change_approval.ps1',
      args,
      (delaySeconds + 20) * 1000,
      onLog
    );

    const jsonPath = path.join(this.diagnosticsDir, 'phase0_1_file_change_report.json');
    const summaryPath = path.join(this.diagnosticsDir, 'phase0_1_file_change_summary.txt');

    if (fs.existsSync(jsonPath)) {
      try {
        res.reportJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch { }
    } else if (res.stdout) {
      try {
        res.reportJson = JSON.parse(res.stdout);
      } catch { }
    }

    if (fs.existsSync(summaryPath)) {
      try {
        res.summaryText = fs.readFileSync(summaryPath, 'utf-8');
      } catch { }
    }

    return res;
  }

  public async executeFileChangeApproval(
    targetHwnd: number = 0,
    targetPid: number = 0,
    delaySeconds: number = 0,
    approvalPolicy: string = 'auto_safe_only',
    onLog?: (msg: string) => void
  ): Promise<PowerShellRunResult> {
    const args = [
      '-DelaySeconds', delaySeconds.toString(),
      '-ApprovalPolicy', approvalPolicy,
    ];
    if (targetHwnd > 0) args.push('-TargetHwnd', targetHwnd.toString());
    if (targetPid > 0) args.push('-TargetPid', targetPid.toString());

    const res = await this.runScript(
      'execute_file_change_approval.ps1',
      args,
      (delaySeconds + 25) * 1000,
      onLog
    );

    const jsonPath = path.join(this.diagnosticsDir, 'phase0_1_file_change_completion_report.json');
    const summaryPath = path.join(this.diagnosticsDir, 'phase0_1_file_change_completion_summary.txt');

    if (fs.existsSync(jsonPath)) {
      try {
        res.reportJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch { }
    } else if (res.stdout) {
      try {
        res.reportJson = JSON.parse(res.stdout);
      } catch { }
    }

    if (fs.existsSync(summaryPath)) {
      try {
        res.summaryText = fs.readFileSync(summaryPath, 'utf-8');
      } catch { }
    }

    return res;
  }

  public getAvailableDiagnosticReports(): Array<{ name: string; sizeBytes: number; modifiedAt: string }> {
    if (!fs.existsSync(this.diagnosticsDir)) return [];
    const files = fs.readdirSync(this.diagnosticsDir);
    return files.map((file) => {
      const full = path.join(this.diagnosticsDir, file);
      const stat = fs.statSync(full);
      return {
        name: file,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    });
  }

  public readDiagnosticFile(fileName: string): string | null {
    const full = path.join(this.diagnosticsDir, path.basename(fileName));
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, 'utf-8');
  }
}
