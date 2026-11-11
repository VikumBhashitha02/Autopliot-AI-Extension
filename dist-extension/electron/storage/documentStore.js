"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function getAppUserDataPath() {
    try {
        const electron = require('electron');
        const appInstance = electron.app || electron.remote?.app;
        if (appInstance && typeof appInstance.getPath === 'function') {
            return appInstance.getPath('userData');
        }
    }
    catch {
        // Fallback in non-electron / test context
    }
    // Determine safe writable workspace or local paths
    const candidateDirs = [
        path_1.default.resolve(__dirname, '../../app_data'),
        path_1.default.resolve(__dirname, '../app_data'),
        path_1.default.join(process.cwd(), 'app_data'),
    ];
    for (const candidate of candidateDirs) {
        if (candidate.toLowerCase().includes('system32') || candidate.toLowerCase().includes('windows')) {
            continue;
        }
        try {
            if (!fs_1.default.existsSync(candidate)) {
                fs_1.default.mkdirSync(candidate, { recursive: true });
            }
            const testFile = path_1.default.join(candidate, `.test_perm_${Date.now()}`);
            fs_1.default.writeFileSync(testFile, 'ok');
            fs_1.default.unlinkSync(testFile);
            return candidate;
        }
        catch {
            // Continue to next candidate
        }
    }
    const os = require('os');
    return path_1.default.join(os.tmpdir(), 'autopilot_ai_data');
}
class DocumentStore {
    baseDir;
    workflowsDir;
    runsDir;
    diagnosticsDir;
    settingsFile;
    constructor(customStoragePath, customDiagnosticsDir) {
        const rootPath = customStoragePath || getAppUserDataPath();
        this.baseDir = customStoragePath ? customStoragePath : path_1.default.join(rootPath, 'autopilot_data');
        this.workflowsDir = path_1.default.join(this.baseDir, 'workflows');
        this.runsDir = path_1.default.join(this.baseDir, 'runs');
        const projectDiag = path_1.default.resolve(__dirname, '../../diagnostics');
        this.diagnosticsDir = customDiagnosticsDir || (fs_1.default.existsSync(projectDiag) ? projectDiag : path_1.default.join(rootPath, 'diagnostics'));
        this.settingsFile = path_1.default.join(this.baseDir, 'settings.json');
        this.ensureDirectories();
        this.migrateLegacyDataIfPresent();
        this.seedDefaultWorkflowsIfEmpty();
    }
    migrateLegacyDataIfPresent() {
        try {
            const legacyDir = path_1.default.join(process.cwd(), 'app_data', 'autopilot_data');
            if (fs_1.default.existsSync(legacyDir) && path_1.default.resolve(legacyDir) !== path_1.default.resolve(this.baseDir)) {
                const legacyWf = path_1.default.join(legacyDir, 'workflows');
                if (fs_1.default.existsSync(legacyWf)) {
                    const files = fs_1.default.readdirSync(legacyWf);
                    for (const file of files) {
                        const dest = path_1.default.join(this.workflowsDir, file);
                        if (!fs_1.default.existsSync(dest)) {
                            fs_1.default.copyFileSync(path_1.default.join(legacyWf, file), dest);
                        }
                    }
                }
                const legacySettings = path_1.default.join(legacyDir, 'settings.json');
                if (fs_1.default.existsSync(legacySettings) && !fs_1.default.existsSync(this.settingsFile)) {
                    fs_1.default.copyFileSync(legacySettings, this.settingsFile);
                }
            }
        }
        catch (err) {
            console.warn('[DocumentStore] Migration check warning:', err?.message || err);
        }
    }
    ensureDirectories() {
        const safeCreate = (dirPath) => {
            try {
                if (!fs_1.default.existsSync(dirPath)) {
                    fs_1.default.mkdirSync(dirPath, { recursive: true });
                }
            }
            catch (err) {
                console.warn(`[DocumentStore] Warning: Could not create directory ${dirPath}:`, err?.message || err);
            }
        };
        safeCreate(this.baseDir);
        safeCreate(this.workflowsDir);
        safeCreate(this.runsDir);
        try {
            if (!fs_1.default.existsSync(this.diagnosticsDir)) {
                fs_1.default.mkdirSync(this.diagnosticsDir, { recursive: true });
            }
        }
        catch {
            try {
                const os = require('os');
                this.diagnosticsDir = path_1.default.join(os.tmpdir(), 'autopilot_diagnostics');
                if (!fs_1.default.existsSync(this.diagnosticsDir)) {
                    fs_1.default.mkdirSync(this.diagnosticsDir, { recursive: true });
                }
            }
            catch {
                // Silently continue
            }
        }
    }
    atomicWrite(filePath, data) {
        const tmpPath = `${filePath}.tmp_${Date.now()}`;
        fs_1.default.writeFileSync(tmpPath, data, 'utf-8');
        fs_1.default.renameSync(tmpPath, filePath);
    }
    // --- Workflows ---
    getAllWorkflows() {
        const files = fs_1.default.readdirSync(this.workflowsDir).filter(f => f.endsWith('.json'));
        const workflows = [];
        for (const file of files) {
            try {
                const content = fs_1.default.readFileSync(path_1.default.join(this.workflowsDir, file), 'utf-8');
                workflows.push(JSON.parse(content));
            }
            catch (err) {
                console.error(`Error reading workflow ${file}:`, err);
            }
        }
        return workflows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    getWorkflowById(id) {
        const file = path_1.default.join(this.workflowsDir, `${id}.json`);
        if (!fs_1.default.existsSync(file))
            return null;
        try {
            return JSON.parse(fs_1.default.readFileSync(file, 'utf-8'));
        }
        catch {
            return null;
        }
    }
    saveWorkflow(wf) {
        const updated = {
            ...wf,
            updatedAt: new Date().toISOString(),
        };
        const file = path_1.default.join(this.workflowsDir, `${wf.id}.json`);
        this.atomicWrite(file, JSON.stringify(updated, null, 2));
        return updated;
    }
    deleteWorkflow(id) {
        const file = path_1.default.join(this.workflowsDir, `${id}.json`);
        if (fs_1.default.existsSync(file)) {
            fs_1.default.unlinkSync(file);
            return true;
        }
        return false;
    }
    // --- Execution Runs ---
    getAllRuns() {
        const files = fs_1.default.readdirSync(this.runsDir).filter(f => f.endsWith('.json'));
        const runs = [];
        for (const file of files) {
            try {
                const content = fs_1.default.readFileSync(path_1.default.join(this.runsDir, file), 'utf-8');
                runs.push(JSON.parse(content));
            }
            catch (err) {
                console.error(`Error reading run ${file}:`, err);
            }
        }
        return runs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }
    getRunById(id) {
        const file = path_1.default.join(this.runsDir, `${id}.json`);
        if (!fs_1.default.existsSync(file))
            return null;
        try {
            return JSON.parse(fs_1.default.readFileSync(file, 'utf-8'));
        }
        catch {
            return null;
        }
    }
    saveRun(run) {
        const file = path_1.default.join(this.runsDir, `${run.id}.json`);
        this.atomicWrite(file, JSON.stringify(run, null, 2));
    }
    clearAllRuns() {
        const files = fs_1.default.readdirSync(this.runsDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                fs_1.default.unlinkSync(path_1.default.join(this.runsDir, file));
            }
            catch (err) {
                console.error(`Error deleting run file ${file}:`, err);
            }
        }
        return true;
    }
    // --- Settings ---
    getSettings() {
        const defaultSettings = {
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
        if (!fs_1.default.existsSync(this.settingsFile)) {
            this.atomicWrite(this.settingsFile, JSON.stringify(defaultSettings, null, 2));
            return defaultSettings;
        }
        try {
            const parsed = JSON.parse(fs_1.default.readFileSync(this.settingsFile, 'utf-8'));
            const merged = { ...defaultSettings, ...parsed };
            if (merged.autoAcceptAllFileChanges === undefined) {
                merged.autoAcceptAllFileChanges = true;
            }
            return merged;
        }
        catch {
            return defaultSettings;
        }
    }
    saveSettings(settings) {
        const current = this.getSettings();
        const updated = { ...current, ...settings };
        this.atomicWrite(this.settingsFile, JSON.stringify(updated, null, 2));
        return updated;
    }
    getDiagnosticsDir() {
        return this.diagnosticsDir;
    }
    // --- Seed Initial Workflows ---
    seedDefaultWorkflowsIfEmpty() {
        const existing = fs_1.default.readdirSync(this.workflowsDir).filter(f => f.endsWith('.json'));
        if (existing.length > 0)
            return;
        const defaultWf1 = {
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
        const defaultWf2 = {
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
exports.DocumentStore = DocumentStore;
//# sourceMappingURL=documentStore.js.map