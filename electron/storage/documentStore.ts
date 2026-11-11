import fs from 'fs';
import path from 'path';
import { WorkflowDefinition, WorkflowExecutionRecord, AppSettings } from '../engine/types';

function getAppUserDataPath(): string {
  try {
    const electron = require('electron');
    const appInstance = electron.app || electron.remote?.app;
    if (appInstance && typeof appInstance.getPath === 'function') {
      return appInstance.getPath('userData');
    }
  } catch {
    // Fallback in non-electron / test context
  }

  // Determine safe writable workspace or local paths
  const candidateDirs = [
    path.resolve(__dirname, '../../app_data'),
    path.resolve(__dirname, '../app_data'),
    path.join(process.cwd(), 'app_data'),
  ];

  for (const candidate of candidateDirs) {
    if (candidate.toLowerCase().includes('system32') || candidate.toLowerCase().includes('windows')) {
      continue;
    }
    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      const testFile = path.join(candidate, `.test_perm_${Date.now()}`);
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return candidate;
    } catch {
      // Continue to next candidate
    }
  }

  const os = require('os');
  return path.join(os.tmpdir(), 'autopilot_ai_data');
}

export class DocumentStore {
  private baseDir: string;
  private workflowsDir: string;
  private runsDir: string;
  private diagnosticsDir: string;
  private settingsFile: string;

  constructor(customStoragePath?: string, customDiagnosticsDir?: string) {
    const rootPath = customStoragePath || getAppUserDataPath();
    this.baseDir = customStoragePath ? customStoragePath : path.join(rootPath, 'autopilot_data');
    this.workflowsDir = path.join(this.baseDir, 'workflows');
    this.runsDir = path.join(this.baseDir, 'runs');
    const projectDiag = path.resolve(__dirname, '../../diagnostics');
    this.diagnosticsDir = customDiagnosticsDir || (fs.existsSync(projectDiag) ? projectDiag : path.join(rootPath, 'diagnostics'));
    this.settingsFile = path.join(this.baseDir, 'settings.json');

    this.ensureDirectories();
    this.migrateLegacyDataIfPresent();
    this.seedDefaultWorkflowsIfEmpty();
  }

  private migrateLegacyDataIfPresent(): void {
    try {
      const legacyDir = path.join(process.cwd(), 'app_data', 'autopilot_data');
      if (fs.existsSync(legacyDir) && path.resolve(legacyDir) !== path.resolve(this.baseDir)) {
        const legacyWf = path.join(legacyDir, 'workflows');
        if (fs.existsSync(legacyWf)) {
          const files = fs.readdirSync(legacyWf);
          for (const file of files) {
            const dest = path.join(this.workflowsDir, file);
            if (!fs.existsSync(dest)) {
              fs.copyFileSync(path.join(legacyWf, file), dest);
            }
          }
        }
        const legacySettings = path.join(legacyDir, 'settings.json');
        if (fs.existsSync(legacySettings) && !fs.existsSync(this.settingsFile)) {
          fs.copyFileSync(legacySettings, this.settingsFile);
        }
      }
    } catch (err: any) {
      console.warn('[DocumentStore] Migration check warning:', err?.message || err);
    }
  }

      private ensureDirectories(): void {
    const safeCreate = (dirPath: string) => {
      try {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      } catch (err: any) {
        console.warn(`[DocumentStore] Warning: Could not create directory ${dirPath}:`, err?.message || err);
      }
    };

    safeCreate(this.baseDir);
    safeCreate(this.workflowsDir);
    safeCreate(this.runsDir);

    try {
      if (!fs.existsSync(this.diagnosticsDir)) {
        fs.mkdirSync(this.diagnosticsDir, { recursive: true });
      }
    } catch {
      try {
        const os = require('os');
        this.diagnosticsDir = path.join(os.tmpdir(), 'autopilot_diagnostics');
        if (!fs.existsSync(this.diagnosticsDir)) {
          fs.mkdirSync(this.diagnosticsDir, { recursive: true });
        }
      } catch {
        // Silently continue
      }
    }
  }

  private atomicWrite(filePath: string, data: string): void {
    const tmpPath = `${filePath}.tmp_${Date.now()}`;
    fs.writeFileSync(tmpPath, data, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  }

  // --- Workflows ---

  public getAllWorkflows(): WorkflowDefinition[] {
    const files = fs.readdirSync(this.workflowsDir).filter(f => f.endsWith('.json'));
    const workflows: WorkflowDefinition[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.workflowsDir, file), 'utf-8');
        workflows.push(JSON.parse(content));
      } catch (err) {
        console.error(`Error reading workflow ${file}:`, err);
      }
    }
    return workflows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getWorkflowById(id: string): WorkflowDefinition | null {
    const file = path.join(this.workflowsDir, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      return null;
    }
  }

  public saveWorkflow(wf: WorkflowDefinition): WorkflowDefinition {
    const updated = {
      ...wf,
      updatedAt: new Date().toISOString(),
    };
    const file = path.join(this.workflowsDir, `${wf.id}.json`);
    this.atomicWrite(file, JSON.stringify(updated, null, 2));
    return updated;
  }

  public deleteWorkflow(id: string): boolean {
    const file = path.join(this.workflowsDir, `${id}.json`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
    return false;
  }

  // --- Execution Runs ---

  public getAllRuns(): WorkflowExecutionRecord[] {
    const files = fs.readdirSync(this.runsDir).filter(f => f.endsWith('.json'));
    const runs: WorkflowExecutionRecord[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.runsDir, file), 'utf-8');
        runs.push(JSON.parse(content));
      } catch (err) {
        console.error(`Error reading run ${file}:`, err);
      }
    }
    return runs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  public getRunById(id: string): WorkflowExecutionRecord | null {
    const file = path.join(this.runsDir, `${id}.json`);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      return null;
    }
  }

  public saveRun(run: WorkflowExecutionRecord): void {
    const file = path.join(this.runsDir, `${run.id}.json`);
    this.atomicWrite(file, JSON.stringify(run, null, 2));
  }

  public clearAllRuns(): boolean {
    const files = fs.readdirSync(this.runsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(this.runsDir, file));
      } catch (err) {
        console.error(`Error deleting run file ${file}:`, err);
      }
    }
    return true;
  }

  // --- Settings ---

  public getSettings(): AppSettings {
    const defaultSettings: AppSettings = {
      theme: 'dark',
      defaultTimeoutSeconds: 30,
      defaultRetryLimit: 1,
      approvalPolicy: 'always_manual',
      diagnosticsOutputDir: this.diagnosticsDir,
      logLevel: 'info',
      autoStartMonitoring: false,
      emergencyStopShortcut: 'Ctrl+Alt+S',
      maxActionsPerMinute: 6,
      redactSensitiveData: true,
      autoAcceptAllFileChanges: true,
    };

    if (!fs.existsSync(this.settingsFile)) {
      this.atomicWrite(this.settingsFile, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.settingsFile, 'utf-8'));
      const merged = { ...defaultSettings, ...parsed };
      if (merged.autoAcceptAllFileChanges === undefined) {
        merged.autoAcceptAllFileChanges = true;
      }
      return merged;
    } catch {
      return defaultSettings;
    }
  }

  public saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    this.atomicWrite(this.settingsFile, JSON.stringify(updated, null, 2));
    return updated;
  }

  public getDiagnosticsDir(): string {
    return this.diagnosticsDir;
  }

  // --- Seed Initial Workflows ---

  private seedDefaultWorkflowsIfEmpty(): void {
    const existing = fs.readdirSync(this.workflowsDir).filter(f => f.endsWith('.json'));
    if (existing.length > 0) return;

    const defaultWf1: WorkflowDefinition = {
      id: 'wf_antigravity_recommended',
      name: 'Antigravity Auto-Approve Recommended Option',
      description: 'Detects active confirmation dialog in Antigravity IDE, validates (Recommended) radio option, and safely auto-selects and completes it.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      enabled: true,
      targetApp: 'Antigravity IDE',
      approvalPolicy: 'auto_safe_only',
      tags: ['antigravity', 'recommendation', 'prompt'],
      steps: [
        {
          id: 'step_1',
          name: 'Verify Antigravity Window Live',
          type: 'detect_prompt',
          enabled: true,
          timeoutSeconds: 15,
          retryLimit: 1,
          config: {
            processName: 'Antigravity IDE',
            delaySeconds: 1,
            targetOptionSubstring: '(Recommended)',
          },
        },
        {
          id: 'step_2',
          name: 'Inspect Subtree & Option Elements',
          type: 'inspect_ui',
          enabled: true,
          timeoutSeconds: 10,
          retryLimit: 0,
          config: {
            delaySeconds: 0,
          },
        },
        {
          id: 'step_3',
          name: 'Select Recommended Radio Option',
          type: 'select_radio',
          enabled: true,
          timeoutSeconds: 10,
          retryLimit: 1,
          config: {
            targetSubstring: '(Recommended)',
            autoCompleteIfSubmitExists: true,
          },
        },
        {
          id: 'step_4',
          name: 'Verify Dialog Closed',
          type: 'wait_for_condition',
          enabled: true,
          timeoutSeconds: 5,
          retryLimit: 0,
          config: {
            conditionType: 'dialog_closed',
          },
        },
        {
          id: 'step_5',
          name: 'Log Execution Summary',
          type: 'write_log',
          enabled: true,
          timeoutSeconds: 2,
          retryLimit: 0,
          config: {
            message: 'Successfully processed and completed Antigravity prompt safely.',
            level: 'info',
          },
        },
      ],
    };

    const defaultWf2: WorkflowDefinition = {
      id: 'wf_antigravity_healthcheck',
      name: 'Safe Diagnostic UI Automation Healthcheck',
      description: 'Runs read-only Windows UI Automation scan against Antigravity window to capture accessible hierarchy without modifying state.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      enabled: true,
      targetApp: 'Antigravity IDE',
      approvalPolicy: 'always_manual',
      tags: ['diagnostic', 'read-only', 'healthcheck'],
      steps: [
        {
          id: 'step_diag_1',
          name: 'Run Subtree Diagnostic Probe',
          type: 'detect_prompt',
          enabled: true,
          timeoutSeconds: 10,
          retryLimit: 0,
          config: {
            delaySeconds: 0,
          },
        },
        {
          id: 'step_diag_2',
          name: 'Snapshot Diagnostic Artifacts',
          type: 'capture_snapshot',
          enabled: true,
          timeoutSeconds: 5,
          retryLimit: 0,
          config: {
            label: 'Scheduled Diagnostic Scan',
          },
        },
      ],
    };

    this.saveWorkflow(defaultWf1);
    this.saveWorkflow(defaultWf2);
  }
}
