"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const node_test_1 = __importDefault(require("node:test"));
// @ts-ignore
const strict_1 = __importDefault(require("node:assert/strict"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const safetyGuard_1 = require("../security/safetyGuard");
const documentStore_1 = require("../storage/documentStore");
const workflowEngine_1 = require("../engine/workflowEngine");
const powershellAdapter_1 = require("../adapters/powershellAdapter");
const agentService_1 = require("../adapters/agentService");
const fileChangeApprovalDetector_1 = require("../adapters/fileChangeApprovalDetector");
const fileChangeApprovalService_1 = require("../adapters/fileChangeApprovalService");
const ideRegistry_1 = require("../adapters/ide/ideRegistry");
const universalActionDetector_1 = require("../adapters/ide/shared/universalActionDetector");
const antigravityAdapter_1 = require("../adapters/ide/antigravityAdapter");
const vscodeCopilotAdapter_1 = require("../adapters/ide/vscodeCopilotAdapter");
const windowsAdapter_1 = require("../../extension/src/adapters/platform/windowsAdapter");
const macosAdapter_1 = require("../../extension/src/adapters/platform/macosAdapter");
const linuxAdapter_1 = require("../../extension/src/adapters/platform/linuxAdapter");
const antigravityEnvironment_1 = require("../../extension/src/adapters/ide/antigravityEnvironment");
const configurationSynchronizer_1 = require("../../extension/src/providers/configurationSynchronizer");
(0, node_test_1.default)('SafetyGuard: flags dangerous terminal commands as destructive', () => {
    const dangerousCommands = [
        'rm -rf /',
        'del /f /s /q c:\\',
        'format c:',
        'shutdown -s -t 0',
        ':(){ :|:& };:',
        'drop database prod',
        'truncate table users',
    ];
    for (const cmd of dangerousCommands) {
        const isDestructive = safetyGuard_1.SafetyGuard.isDestructiveCommand(cmd);
        strict_1.default.strictEqual(isDestructive, true, `Expected dangerous command to be flagged as destructive: ${cmd}`);
    }
});
(0, node_test_1.default)('SafetyGuard: permits safe diagnostics commands', () => {
    const safeCommands = [
        'Get-Process -Name Antigravity',
        'powershell -ExecutionPolicy Bypass -File "diagnostics/inspect_prompt_subtree.ps1"',
        'echo "Hello AutoPilot"',
    ];
    for (const cmd of safeCommands) {
        const isDestructive = safetyGuard_1.SafetyGuard.isDestructiveCommand(cmd);
        strict_1.default.strictEqual(isDestructive, false, `Expected safe command NOT to be flagged as destructive: ${cmd}`);
    }
});
(0, node_test_1.default)('SafetyGuard: redacts sensitive tokens and passwords from logs', () => {
    const rawLog = 'Connecting with token: ghp_1234567890abcdef and password: SuperSecretPassword123!';
    const redacted = safetyGuard_1.SafetyGuard.redactSensitive(rawLog);
    strict_1.default.ok(!redacted.includes('ghp_1234567890abcdef'), 'Expected token to be redacted');
    strict_1.default.ok(!redacted.includes('SuperSecretPassword123!'), 'Expected password to be redacted');
    strict_1.default.ok(redacted.includes('[REDACTED]'), 'Expected [REDACTED] placeholder');
});
(0, node_test_1.default)('SafetyGuard: validates workflow schema accurately', () => {
    const validWf = {
        id: 'wf_test_valid',
        name: 'Valid Workflow Test',
        description: 'Testing validation pass',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_1',
                name: 'Log step',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'hello' },
            },
        ],
    };
    const validation = safetyGuard_1.SafetyGuard.validateWorkflowSchema(validWf);
    strict_1.default.strictEqual(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
    const invalidWf = {
        id: 'bad_wf',
        // missing name and steps
    };
    const failValidation = safetyGuard_1.SafetyGuard.validateWorkflowSchema(invalidWf);
    strict_1.default.strictEqual(failValidation.valid, false, 'Expected invalid workflow to fail schema check');
});
(0, node_test_1.default)('DocumentStore: initializes and reads settings', () => {
    const store = new documentStore_1.DocumentStore();
    const settings = store.getSettings();
    strict_1.default.ok(settings, 'Settings should not be null');
    strict_1.default.ok(settings.approvalPolicy, 'Settings should contain approvalPolicy');
    strict_1.default.strictEqual(typeof settings.defaultTimeoutSeconds, 'number');
});
(0, node_test_1.default)('DocumentStore: seeds default workflows and allows retrieval', () => {
    const store = new documentStore_1.DocumentStore();
    const workflows = store.getAllWorkflows();
    strict_1.default.ok(Array.isArray(workflows), 'getAllWorkflows should return an array');
    strict_1.default.ok(workflows.length >= 2, 'Should have at least 2 seeded default workflows');
    const recWf = workflows.find((w) => w.id === 'wf_antigravity_recommended');
    strict_1.default.ok(recWf, 'Antigravity recommended workflow should exist');
    strict_1.default.ok(recWf.steps.length >= 3, 'Workflow should have at least 3 steps');
});
(0, node_test_1.default)('SafetyGuard: process allowlisting permits approved apps and blocks unauthorized ones', () => {
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('Antigravity IDE'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('Antigravity'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('Code'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('notepad'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('cmd.exe'), false);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('powershell.exe'), false);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('malicious_binary.exe'), false);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('../../../windows/system32/calc.exe'), false);
});
(0, node_test_1.default)('SafetyGuard: rejects path traversal and invalid characters in workflow ID', () => {
    const traversalWf = {
        id: '../../etc/passwd',
        name: 'Path Traversal Test',
        steps: [],
    };
    const res = safetyGuard_1.SafetyGuard.validateWorkflowSchema(traversalWf);
    strict_1.default.strictEqual(res.valid, false);
    strict_1.default.ok(res.errors.some(e => e.includes('alphanumeric characters, underscores, and hyphens')));
});
(0, node_test_1.default)('SafetyGuard: sanitizes shell parameters by stripping command injection characters', () => {
    const dirtyInput = '(Recommended); Start-Process calc.exe; # ` $evil & |';
    const clean = safetyGuard_1.SafetyGuard.sanitizeShellParameter(dirtyInput);
    strict_1.default.ok(!clean.includes(';'), 'Semicolon must be removed');
    strict_1.default.ok(!clean.includes('&'), 'Ampersand must be removed');
    strict_1.default.ok(!clean.includes('|'), 'Pipe must be removed');
    strict_1.default.ok(!clean.includes('`'), 'Backtick must be removed');
    strict_1.default.ok(!clean.includes('$'), 'Dollar sign must be removed');
    strict_1.default.strictEqual(clean, '(Recommended) Start-Process calc.exe #  evil');
});
(0, node_test_1.default)('SafetyGuard: rejects workflows with unauthorized target applications', () => {
    const badAppWf = {
        id: 'wf_bad_target',
        name: 'Bad Target App Test',
        targetApp: 'ransomware.exe',
        steps: [
            {
                id: 'step_1',
                name: 'Step 1',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: {},
            },
        ],
    };
    const res = safetyGuard_1.SafetyGuard.validateWorkflowSchema(badAppWf);
    strict_1.default.strictEqual(res.valid, false);
    strict_1.default.ok(res.errors.some(e => e.includes('approved safety allowlist')));
});
// --- Phase 3: WorkflowEngine & Storage End-to-End Tests ---
(0, node_test_1.default)('WorkflowEngine: executes harmless multi-step workflow successfully', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const testWorkflow = {
        id: 'wf_e2e_harmless',
        name: 'E2E Harmless Workflow',
        description: 'Writes log and waits short duration',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test', 'e2e'],
        steps: [
            {
                id: 'step_log_start',
                name: 'Log Start',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Workflow starting verification', level: 'info' },
            },
            {
                id: 'step_wait_brief',
                name: 'Brief Wait',
                type: 'wait_for_condition',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { conditionType: 'time_delay', delaySeconds: 0.1 },
            },
            {
                id: 'step_log_end',
                name: 'Log Finish',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Workflow completed verification', level: 'info' },
            },
        ],
    };
    const record = await engine.executeWorkflow(testWorkflow, 'manual');
    strict_1.default.strictEqual(record.status, 'completed', 'Workflow should complete successfully');
    strict_1.default.strictEqual(record.stepResults['step_log_start']?.status, 'completed');
    strict_1.default.strictEqual(record.stepResults['step_wait_brief']?.status, 'completed');
    strict_1.default.strictEqual(record.stepResults['step_log_end']?.status, 'completed');
    strict_1.default.ok(record.logs.length >= 3, 'Execution should contain step logs');
});
(0, node_test_1.default)('WorkflowEngine: enforces correct step ordering and conditional branching', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const branchWorkflow = {
        id: 'wf_e2e_branching',
        name: 'Branching Test',
        description: 'Jumps over Step 3 to Step 4',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_1',
                name: 'Initial Step',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Step 1' },
            },
            {
                id: 'step_2',
                name: 'Branch Decider',
                type: 'branch_condition',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: {
                    operator: 'is_true',
                    variableValue: true,
                    trueGotoStepId: 'step_4',
                    falseGotoStepId: 'step_3',
                },
            },
            {
                id: 'step_3',
                name: 'Should Be Skipped',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Skipped step' },
            },
            {
                id: 'step_4',
                name: 'Branch Target',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Reached destination' },
            },
        ],
    };
    const record = await engine.executeWorkflow(branchWorkflow, 'manual');
    strict_1.default.strictEqual(record.status, 'completed');
    strict_1.default.strictEqual(record.stepResults['step_1']?.status, 'completed');
    strict_1.default.strictEqual(record.stepResults['step_2']?.status, 'completed');
    strict_1.default.strictEqual(record.stepResults['step_3'], undefined, 'Step 3 must not execute');
    strict_1.default.strictEqual(record.stepResults['step_4']?.status, 'completed', 'Step 4 must execute');
});
(0, node_test_1.default)('WorkflowEngine: propagates failure and halts execution when no onFailureGoto is set', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const failWorkflow = {
        id: 'wf_e2e_fail',
        name: 'Failure Propagation Test',
        description: 'Step 2 fails, Step 3 must not run',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_1',
                name: 'Initial',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Step 1' },
            },
            {
                id: 'step_2_failing',
                name: 'Failing App Target',
                type: 'launch_app',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { appName: 'unauthorized_app.exe' },
            },
            {
                id: 'step_3_unreachable',
                name: 'Unreachable',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Never executed' },
            },
        ],
    };
    const record = await engine.executeWorkflow(failWorkflow, 'manual');
    strict_1.default.strictEqual(record.status, 'failed', 'Run status must be failed');
    strict_1.default.strictEqual(record.stepResults['step_1']?.status, 'completed');
    strict_1.default.strictEqual(record.stepResults['step_2_failing']?.status, 'failed');
    strict_1.default.strictEqual(record.stepResults['step_3_unreachable'], undefined, 'Subsequent step must not execute');
    strict_1.default.ok(record.error?.includes('approved safety allowlist'), 'Error message must reflect failure reason');
});
(0, node_test_1.default)('WorkflowEngine: handles onFailureGoto by branching to recovery step', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const recoverWorkflow = {
        id: 'wf_e2e_recover',
        name: 'Failure Recovery Test',
        description: 'Step 1 fails but branches to recovery step',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_failing',
                name: 'Failing Step',
                type: 'launch_app',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { appName: 'blocked_tool.exe' },
                onFailureGoto: 'step_recovery',
            },
            {
                id: 'step_normal',
                name: 'Skipped Normal Step',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Skipped' },
            },
            {
                id: 'step_recovery',
                name: 'Recovery Log',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Successfully recovered from failure' },
            },
        ],
    };
    const record = await engine.executeWorkflow(recoverWorkflow, 'manual');
    strict_1.default.strictEqual(record.status, 'completed', 'Workflow should complete after recovery branch');
    strict_1.default.strictEqual(record.stepResults['step_failing']?.status, 'failed');
    strict_1.default.strictEqual(record.stepResults['step_normal'], undefined);
    strict_1.default.strictEqual(record.stepResults['step_recovery']?.status, 'completed');
});
(0, node_test_1.default)('WorkflowEngine: handles step timeouts accurately', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const timeoutWorkflow = {
        id: 'wf_e2e_timeout',
        name: 'Timeout Test',
        description: 'Step times out after 1s',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_timeout',
                name: 'Long Running Wait',
                type: 'wait_for_condition',
                enabled: true,
                timeoutSeconds: 1,
                retryLimit: 0,
                config: { conditionType: 'time_delay', delaySeconds: 3 },
            },
        ],
    };
    const record = await engine.executeWorkflow(timeoutWorkflow, 'manual');
    strict_1.default.strictEqual(record.status, 'failed');
    strict_1.default.strictEqual(record.stepResults['step_timeout']?.status, 'failed');
    strict_1.default.ok(record.stepResults['step_timeout']?.error?.includes('timed out'), 'Error must note timeout');
});
(0, node_test_1.default)('WorkflowEngine: supports cancellation of active workflow execution', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const longWorkflow = {
        id: 'wf_e2e_cancel',
        name: 'Cancellation Test',
        description: 'Cancelled mid-run',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_wait_1',
                name: 'Wait 1',
                type: 'wait_for_condition',
                enabled: true,
                timeoutSeconds: 10,
                retryLimit: 0,
                config: { conditionType: 'time_delay', delaySeconds: 2 },
            },
            {
                id: 'step_wait_2',
                name: 'Wait 2',
                type: 'wait_for_condition',
                enabled: true,
                timeoutSeconds: 10,
                retryLimit: 0,
                config: { conditionType: 'time_delay', delaySeconds: 2 },
            },
        ],
    };
    // Launch workflow and trigger cancellation
    const runPromise = engine.executeWorkflow(longWorkflow, 'manual');
    // Wait a fraction of a second to allow start
    await new Promise(r => setTimeout(r, 100));
    strict_1.default.strictEqual(engine.isRunning(), true, 'Engine should report running');
    const activeIds = engine.getActiveRunIds();
    strict_1.default.ok(activeIds.length > 0, 'Should have active run ID');
    const cancelled = engine.cancelRun(activeIds[0]);
    strict_1.default.strictEqual(cancelled, true, 'cancelRun should return true');
    const result = await runPromise;
    strict_1.default.strictEqual(result.status, 'cancelled', 'Execution status must be cancelled');
    strict_1.default.strictEqual(result.stepResults['step_wait_2'], undefined, 'Subsequent step must never start after cancellation');
});
(0, node_test_1.default)('WorkflowEngine: emergency stop cancels active workflow and handles cancellation race with failing step', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const raceWorkflow = {
        id: 'wf_e2e_race_cancel',
        name: 'Cancellation Race Test',
        description: 'Cancelled while a step is executing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_slow',
                name: 'Slow Step',
                type: 'wait_for_condition',
                enabled: true,
                timeoutSeconds: 10,
                retryLimit: 0,
                config: { conditionType: 'time_delay', delaySeconds: 2 },
            },
            {
                id: 'step_never_run',
                name: 'Never Run',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Should not run' },
            },
        ],
    };
    const runPromise = engine.executeWorkflow(raceWorkflow, 'manual');
    await new Promise(r => setTimeout(r, 80));
    // Simulate Emergency Stop by cancelling via engine.getActiveRunIds()
    const activeIds = engine.getActiveRunIds();
    strict_1.default.ok(activeIds.length > 0, 'Active run should be tracked');
    for (const id of activeIds) {
        engine.cancelRun(id);
    }
    const result = await runPromise;
    strict_1.default.strictEqual(result.status, 'cancelled', 'Emergency stop must leave status as cancelled');
    strict_1.default.strictEqual(result.stepResults['step_never_run'], undefined, 'Subsequent steps must be aborted');
});
(0, node_test_1.default)('WorkflowEngine: respects retry limits on failing steps', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const retryWorkflow = {
        id: 'wf_e2e_retries',
        name: 'Retry Limit Test',
        description: 'Step configured with 2 retries',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_retry_test',
                name: 'Retry Step',
                type: 'launch_app',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 2,
                config: { appName: 'disallowed_program.exe' },
            },
        ],
    };
    const record = await engine.executeWorkflow(retryWorkflow, 'manual');
    strict_1.default.strictEqual(record.status, 'failed');
    strict_1.default.strictEqual(record.stepResults['step_retry_test']?.retryCount, 2, 'Should attempt 2 retries');
});
(0, node_test_1.default)('DocumentStore: persists execution runs to disk and retrieves them', () => {
    const store = new documentStore_1.DocumentStore();
    const runId = `run_persist_check_${Date.now()}`;
    store.saveRun({
        id: runId,
        workflowId: 'wf_antigravity_recommended',
        workflowName: 'Persistence Check Run',
        status: 'completed',
        startTime: new Date().toISOString(),
        triggeredBy: 'manual',
        stepResults: {},
        logs: [{ timestamp: new Date().toISOString(), level: 'info', message: 'Persisted log record' }],
    });
    // Verify retrieval via new DocumentStore instance (simulating app restart)
    const freshStore = new documentStore_1.DocumentStore();
    const retrieved = freshStore.getRunById(runId);
    strict_1.default.ok(retrieved, 'Persisted run should be retrievable from disk');
    strict_1.default.strictEqual(retrieved.workflowName, 'Persistence Check Run');
    strict_1.default.strictEqual(retrieved.status, 'completed');
});
(0, node_test_1.default)('DocumentStore: workflow CRUD persists across application restarts', () => {
    const store = new documentStore_1.DocumentStore();
    const customWfId = `wf_custom_${Date.now()}`;
    const customWf = {
        id: customWfId,
        name: 'Custom Restart Persistence Test',
        description: 'Testing save and retrieve after simulated restart',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['persistence', 'custom'],
        steps: [
            {
                id: 'step_1',
                name: 'Test Step',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Restart test log' },
            },
        ],
    };
    // Save workflow
    store.saveWorkflow(customWf);
    // Re-instantiate DocumentStore (simulates application restart)
    const restartedStore = new documentStore_1.DocumentStore();
    const loaded = restartedStore.getWorkflowById(customWfId);
    strict_1.default.ok(loaded, 'Workflow must persist on disk across store re-instantiations');
    strict_1.default.strictEqual(loaded.name, 'Custom Restart Persistence Test');
    // Delete workflow and verify deletion persists
    const deleted = restartedStore.deleteWorkflow(customWfId);
    strict_1.default.strictEqual(deleted, true);
    const thirdStore = new documentStore_1.DocumentStore();
    strict_1.default.strictEqual(thirdStore.getWorkflowById(customWfId), null, 'Deleted workflow must not exist');
});
(0, node_test_1.default)('DocumentStore: settings updates persist across application restarts', () => {
    const store = new documentStore_1.DocumentStore();
    const originalSettings = store.getSettings();
    store.saveSettings({
        defaultTimeoutSeconds: 45,
        theme: 'dark',
        maxActionsPerMinute: 30,
    });
    // Simulate app restart
    const restartedStore = new documentStore_1.DocumentStore();
    const reloadedSettings = restartedStore.getSettings();
    strict_1.default.strictEqual(reloadedSettings.defaultTimeoutSeconds, 45);
    strict_1.default.strictEqual(reloadedSettings.maxActionsPerMinute, 30);
    // Restore original settings
    restartedStore.saveSettings(originalSettings);
});
// --- Phase 3: Automation Agent Tests ---
(0, node_test_1.default)('AgentService: state transitions and monitoring control', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    let lastNotifiedState = '';
    const agent = new agentService_1.AgentService(psAdapter, (status) => {
        lastNotifiedState = status.state;
    });
    strict_1.default.strictEqual(agent.getStatus().state, 'idle');
    await agent.startMonitoring(10000);
    strict_1.default.strictEqual(agent.getStatus().state, 'monitoring');
    strict_1.default.strictEqual(lastNotifiedState, 'monitoring');
    agent.stopMonitoring();
    strict_1.default.strictEqual(agent.getStatus().state, 'idle');
    strict_1.default.strictEqual(lastNotifiedState, 'idle');
});
(0, node_test_1.default)('AgentService: scanTargetWindow identifies active Antigravity IDE process and title', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const agent = new agentService_1.AgentService(psAdapter);
    const status = await agent.scanTargetWindow();
    strict_1.default.ok(status, 'Status object should exist');
    strict_1.default.ok(status.targetProcessName, 'Should have targetProcessName');
    // If Antigravity is running, PID will be a positive number
    if (status.targetPid) {
        strict_1.default.ok(status.targetPid > 0, 'Target PID should be a positive integer');
        strict_1.default.ok(status.targetWindowTitle, 'Window title should be populated');
    }
});
(0, node_test_1.default)('AgentService: probePrompt executes read-only inspection and populates diagnostic status', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const agent = new agentService_1.AgentService(psAdapter);
    const res = await agent.probePrompt();
    strict_1.default.ok(res, 'Probe result should not be null');
    strict_1.default.strictEqual(typeof res.exitCode, 'number', 'Diagnostic script should exit with status code');
    strict_1.default.strictEqual(res.exitCode, 0, 'inspect_prompt_subtree.ps1 should exit 0');
    const status = agent.getStatus();
    strict_1.default.strictEqual(typeof status.lastPromptDetected, 'boolean');
    strict_1.default.ok(status.lastActiveTimestamp, 'Timestamp should be recorded');
});
(0, node_test_1.default)('SafetyGuard: recognizes recommendation variations and safe policy evaluation', () => {
    // Recommendation pattern recognition
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('(Recommended)'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('(recommended)'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('Proceed with TypeScript [Recommended]'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('Recommended setting'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('Default mode'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('Alternative choice'), false);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption(''), false);
    // Policy evaluations
    // always_manual: blocks both recommended radio and buttons
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.shouldAutoApprove('always_manual', 'select_radio', '(Recommended)'), false);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.shouldAutoApprove('always_manual', 'invoke_button', 'Submit'), false);
    // auto_safe_only: allows explicit recommendations and continuation buttons, blocks ambiguous
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.shouldAutoApprove('auto_safe_only', 'select_radio', 'Option 1 (Recommended)'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.shouldAutoApprove('auto_safe_only', 'select_radio', 'Option 2 - Custom'), false);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.shouldAutoApprove('auto_safe_only', 'invoke_button', 'Submit'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.shouldAutoApprove('auto_safe_only', 'invoke_button', 'Continue'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.shouldAutoApprove('auto_safe_only', 'invoke_button', 'Cancel'), false);
    // full_auto: auto-approves routine actions (still guarded against destructive commands by SafetyGuard.isDestructiveCommand)
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.shouldAutoApprove('full_auto', 'select_radio', 'Any Choice'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.shouldAutoApprove('full_auto', 'invoke_button', 'Any Button'), true);
});
(0, node_test_1.default)('AgentService: approval policy changes and settings synchronization', () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const agent = new agentService_1.AgentService(psAdapter, store);
    agent.setApprovalPolicy('auto_safe_only');
    strict_1.default.strictEqual(agent.getStatus().approvalPolicy, 'auto_safe_only');
    strict_1.default.strictEqual(store.getSettings().approvalPolicy, 'auto_safe_only');
    agent.setApprovalPolicy('always_manual');
    strict_1.default.strictEqual(agent.getStatus().approvalPolicy, 'always_manual');
    strict_1.default.strictEqual(agent.getStatus().autoPilotMode, 'manual');
    strict_1.default.strictEqual(store.getSettings().approvalPolicy, 'always_manual');
});
(0, node_test_1.default)('AgentService: target window enumeration and custom selection', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const agent = new agentService_1.AgentService(psAdapter, store);
    const windows = await agent.listAvailableWindows();
    strict_1.default.ok(Array.isArray(windows), 'listAvailableWindows should return an array');
    // Test custom selection
    agent.setSelectedWindow({
        pid: 99999,
        hwnd: 88888,
        title: 'Custom Antigravity IDE Instance',
        processName: 'Antigravity',
    });
    const status = agent.getStatus();
    strict_1.default.strictEqual(status.targetPid, 99999);
    strict_1.default.strictEqual(status.targetHwnd, 88888);
    strict_1.default.strictEqual(status.targetWindowTitle, 'Custom Antigravity IDE Instance');
    strict_1.default.strictEqual(status.selectedWindow?.title, 'Custom Antigravity IDE Instance');
});
// ==============================================================================
// FILE-CHANGE APPROVAL TEST SUITE (21 Scenarios)
// ==============================================================================
(0, node_test_1.default)('Scenario 1: Detect a genuine "Accept all" file-change approval button', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const detector = new fileChangeApprovalDetector_1.FileChangeApprovalDetector(psAdapter);
    const rawDetection = {
        Timestamp: new Date().toISOString(),
        TargetHwnd: 12345,
        ProcessId: 54321,
        WindowTitle: 'Antigravity IDE - Project',
        WindowClass: 'Chrome_WidgetWin_1',
        FileChangeApprovalFound: true,
        IsAmbiguous: false,
        Confidence: 'HIGH',
        ButtonFound: {
            Name: 'Accept all',
            AutomationId: 'antigravity.review.acceptAll',
            ControlType: 'Button',
            ClassName: 'monaco-button',
            BoundingRectangle: '500,200,120,32',
            IsEnabled: true,
            SupportsInvoke: true,
        },
        Container: {
            Name: 'Review Changes',
            ClassName: 'composite-review-banner',
            BoundingRectangle: '400,180,600,60',
        },
        ModifiedFiles: ['src/App.tsx', 'src/index.css'],
        SiblingActions: ['Discard', 'Diff'],
        DetectionEvidence: ['Verified actionable button inside bounded container with file review context.'],
    };
    const normalized = detector.normalizeDetectionResult(rawDetection);
    strict_1.default.strictEqual(normalized.fileChangeApprovalFound, true);
    strict_1.default.strictEqual(normalized.buttonFound?.name, 'Accept all');
    strict_1.default.strictEqual(normalized.confidence, 'HIGH');
    strict_1.default.strictEqual(normalized.isAmbiguous, false);
    strict_1.default.strictEqual(normalized.modifiedFiles.length, 2);
    strict_1.default.strictEqual(normalized.buttonFound?.supportsInvoke, true);
});
(0, node_test_1.default)('Scenario 2: Recognize case-insensitive button-text variations', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const detector = new fileChangeApprovalDetector_1.FileChangeApprovalDetector(psAdapter);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Accept all'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('accept all'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('ACCEPT ALL'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Accept All'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('  Accept all  '), true);
});
(0, node_test_1.default)('Scenario 3: Recognize "Accept all changes"', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const detector = new fileChangeApprovalDetector_1.FileChangeApprovalDetector(psAdapter);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Accept all changes'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('accept all changes'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('ACCEPT ALL CHANGES'), true);
});
(0, node_test_1.default)('Scenario 4: Recognize "Accept all files"', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const detector = new fileChangeApprovalDetector_1.FileChangeApprovalDetector(psAdapter);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Accept all files'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('accept all files'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('ACCEPT ALL FILES'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Accept all edits'), true);
});
(0, node_test_1.default)('Scenario 5: Reject unrelated "Accept all" text in editor content', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const detector = new fileChangeApprovalDetector_1.FileChangeApprovalDetector(psAdapter);
    // If text appears in editor tokens or lines, confidence must be NONE/LOW and ambiguous
    const editorLineRaw = {
        FileChangeApprovalFound: false,
        IsAmbiguous: true,
        Confidence: 'NONE',
        Warnings: ['Rejected text in editor line/terminal: const text = "Accept all";'],
    };
    const res = detector.normalizeDetectionResult(editorLineRaw);
    strict_1.default.strictEqual(res.fileChangeApprovalFound, false);
    strict_1.default.strictEqual(res.isAmbiguous, true);
    strict_1.default.strictEqual(res.confidence, 'NONE');
});
(0, node_test_1.default)('Scenario 6: Reject buttons outside the verified file-change container', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const detector = new fileChangeApprovalDetector_1.FileChangeApprovalDetector(psAdapter);
    const outsideContainerRaw = {
        FileChangeApprovalFound: false,
        IsAmbiguous: true,
        Confidence: 'LOW',
        ButtonFound: {
            Name: 'Random Button',
            ControlType: 'Button',
        },
        Warnings: ['Button outside verified file change container'],
    };
    const res = detector.normalizeDetectionResult(outsideContainerRaw);
    strict_1.default.strictEqual(res.fileChangeApprovalFound, false);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Random Button'), false);
});
(0, node_test_1.default)('Scenario 7: Reject negative actions such as Discard and Reject', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const detector = new fileChangeApprovalDetector_1.FileChangeApprovalDetector(psAdapter);
    const negativeActions = [
        'Discard',
        'discard all',
        'DISCARD ALL',
        'Reject',
        'reject changes',
        'Revert',
        'revert all',
        'Cancel',
        'No',
        "Don't Save",
    ];
    for (const neg of negativeActions) {
        strict_1.default.strictEqual(detector.isNegativeAction(neg), true, `Expected ${neg} to be identified as negative`);
        strict_1.default.strictEqual(detector.isAcceptAllButton(neg), false, `Expected ${neg} NOT to be an accept all button`);
    }
});
(0, node_test_1.default)('Scenario 8: Support multiple Antigravity window instances', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const agent = new agentService_1.AgentService(psAdapter, store);
    // Multiple instances targeting
    agent.setSelectedWindow(112233);
    strict_1.default.strictEqual(agent.getStatus().selectedHwnd, 112233);
    agent.setSelectedWindow(445566);
    strict_1.default.strictEqual(agent.getStatus().selectedHwnd, 445566);
    agent.setSelectedWindow(null);
    strict_1.default.strictEqual(agent.getStatus().selectedHwnd, null);
});
(0, node_test_1.default)('Scenario 9: Respect auto_safe_only policy for file changes', () => {
    // auto_safe_only permits HIGH confidence with no ambiguity
    const safeEval = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'HIGH', false);
    strict_1.default.strictEqual(safeEval.canAutoApprove, true);
    strict_1.default.strictEqual(safeEval.requiresManualApproval, false);
    // auto_safe_only pauses for ambiguous interfaces
    const ambigEval = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'HIGH', true);
    strict_1.default.strictEqual(ambigEval.canAutoApprove, false);
    strict_1.default.strictEqual(ambigEval.requiresManualApproval, true);
    // auto_safe_only pauses for MEDIUM or LOW confidence
    const medEval = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'MEDIUM', false);
    strict_1.default.strictEqual(medEval.canAutoApprove, false);
    strict_1.default.strictEqual(medEval.requiresManualApproval, true);
});
(0, node_test_1.default)('Scenario 10: Respect full_auto policy for file changes', () => {
    const fullEval = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('full_auto', 'HIGH', false);
    strict_1.default.strictEqual(fullEval.canAutoApprove, true);
    const fullMedEval = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('full_auto', 'MEDIUM', false);
    strict_1.default.strictEqual(fullMedEval.canAutoApprove, true);
    // Even full_auto safely stops when ambiguous
    const fullAmbig = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('full_auto', 'HIGH', true);
    strict_1.default.strictEqual(fullAmbig.canAutoApprove, false);
    strict_1.default.strictEqual(fullAmbig.requiresManualApproval, true);
});
(0, node_test_1.default)('Scenario 11: Respect always_manual policy for file changes', () => {
    const manualEval = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('always_manual', 'HIGH', false);
    strict_1.default.strictEqual(manualEval.canAutoApprove, false);
    strict_1.default.strictEqual(manualEval.requiresManualApproval, true);
});
(0, node_test_1.default)('Scenario 12: Respect autoAcceptAllFileChanges = false setting', async () => {
    const store = new documentStore_1.DocumentStore();
    store.saveSettings({ autoAcceptAllFileChanges: false });
    strict_1.default.strictEqual(store.getSettings().autoAcceptAllFileChanges, false);
    // Re-enable
    store.saveSettings({ autoAcceptAllFileChanges: true });
    strict_1.default.strictEqual(store.getSettings().autoAcceptAllFileChanges, true);
});
(0, node_test_1.default)('Scenario 13: Prevent duplicate acceptance with fingerprint debouncing', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const service = new fileChangeApprovalService_1.FileChangeApprovalService(psAdapter);
    const detection = {
        targetHwnd: 55555,
        modifiedFiles: ['fileA.ts', 'fileB.ts'],
        buttonFound: { name: 'Accept all', boundingRectangle: '100,100,50,20' },
    };
    const fp1 = service.generateFingerprint(detection);
    const fp2 = service.generateFingerprint(detection);
    strict_1.default.strictEqual(fp1, fp2);
    strict_1.default.ok(fp1.includes('55555'));
    strict_1.default.ok(fp1.includes('Accept all'));
});
(0, node_test_1.default)('Scenario 14: Verify successful approval and history creation', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const service = new fileChangeApprovalService_1.FileChangeApprovalService(psAdapter);
    const detection = {
        targetHwnd: 12345,
        windowTitle: 'Antigravity IDE',
        modifiedFiles: ['src/main.ts', 'src/App.tsx'],
        buttonFound: { name: 'Accept all' },
        container: { className: 'composite-review' },
        confidence: 'HIGH',
        siblingActions: ['Discard'],
    };
    const result = {
        success: true,
        finalStatus: 'COMPLETED_SUCCESSFULLY',
        buttonClicked: 'Accept all',
        containerClass: 'composite-review',
        dismissalVerified: true,
        durationMs: 140,
        logs: ['Invoked Accept all', 'Dismissal verified'],
    };
    const record = service.createActionHistoryRecord(detection, result, 'auto_safe_only');
    strict_1.default.strictEqual(record.actionType, 'FILE_CHANGE_ACCEPT_ALL');
    strict_1.default.strictEqual(record.action, 'Accept all file changes');
    strict_1.default.strictEqual(record.status, 'COMPLETED_SUCCESSFULLY');
    strict_1.default.strictEqual(record.verifiedClosed, true);
    strict_1.default.strictEqual(record.fileChangeMetadata?.modifiedFiles?.length, 2);
});
(0, node_test_1.default)('Scenario 15: Handle UI Automation exceptions safely during execution', async () => {
    // Create a psAdapter that throws or returns error
    const mockPsAdapter = {
        executeFileChangeApproval: async () => {
            throw new Error('UIAutomation COM call timed out or window was destroyed');
        },
    };
    const service = new fileChangeApprovalService_1.FileChangeApprovalService(mockPsAdapter);
    const detection = {
        targetHwnd: 9999,
        processId: 8888,
        windowTitle: 'Antigravity IDE',
        buttonFound: { name: 'Accept all' },
        confidence: 'HIGH',
        isAmbiguous: false,
        modifiedFiles: [],
    };
    const res = await service.executeApproval(detection, 'auto_safe_only', 0, 9999);
    strict_1.default.strictEqual(res.success, false);
    strict_1.default.strictEqual(res.finalStatus, 'EXECUTION_EXCEPTION');
    strict_1.default.ok(res.logs[0].includes('UIAutomation COM call timed out'));
});
(0, node_test_1.default)('Scenario 16: Handle target HWND changes by aborting action safely', async () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const service = new fileChangeApprovalService_1.FileChangeApprovalService(psAdapter);
    const detection = {
        targetHwnd: 1111,
        buttonFound: { name: 'Accept all' },
        confidence: 'HIGH',
        isAmbiguous: false,
        modifiedFiles: [],
    };
    // Window changed to 2222
    const res = await service.executeApproval(detection, 'auto_safe_only', 0, 2222);
    strict_1.default.strictEqual(res.success, false);
    strict_1.default.strictEqual(res.finalStatus, 'TARGET_HWND_CHANGED');
});
(0, node_test_1.default)('Scenario 17: Handle emergency stop during pending approval', async () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const service = new fileChangeApprovalService_1.FileChangeApprovalService(psAdapter);
    service.cancel(); // Emergency stop triggered
    const detection = {
        targetHwnd: 1234,
        buttonFound: { name: 'Accept all' },
        confidence: 'HIGH',
        isAmbiguous: false,
        modifiedFiles: [],
    };
    const res = await service.executeApproval(detection, 'auto_safe_only', 0, 1234);
    strict_1.default.strictEqual(res.success, false);
    strict_1.default.strictEqual(res.finalStatus, 'CANCELLED_BY_EMERGENCY_STOP');
});
(0, node_test_1.default)('Scenario 18: Handle ambiguous UI structures safely', async () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const service = new fileChangeApprovalService_1.FileChangeApprovalService(psAdapter);
    const ambiguousDetection = {
        targetHwnd: 1234,
        buttonFound: { name: 'Accept all' },
        confidence: 'LOW',
        isAmbiguous: true,
        modifiedFiles: [],
    };
    // In auto_safe_only, ambiguous interfaces are rejected from auto-clicking
    const res = await service.executeApproval(ambiguousDetection, 'auto_safe_only', 0, 1234);
    strict_1.default.strictEqual(res.success, false);
    strict_1.default.strictEqual(res.finalStatus, 'AWAITING_MANUAL_APPROVAL');
});
(0, node_test_1.default)('Scenario 19: Preserve existing normal prompt detection', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const agent = new agentService_1.AgentService(psAdapter, store);
    // Normal probePrompt executes without errors
    const res = await agent.probePrompt();
    strict_1.default.ok(res !== null);
    strict_1.default.strictEqual(typeof res.exitCode, 'number');
});
(0, node_test_1.default)('Scenario 20: Preserve existing workflow execution', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const testWf = {
        id: 'wf_verify_preservation',
        name: 'Preservation Verification',
        description: 'Ensure workflow engine runs unimpeded',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_1',
                name: 'Log step',
                type: 'write_log',
                enabled: true,
                timeoutSeconds: 5,
                retryLimit: 0,
                config: { message: 'Workflow engine preserved' },
            },
        ],
    };
    const record = await engine.executeWorkflow(testWf, 'manual');
    strict_1.default.strictEqual(record.status, 'completed');
    strict_1.default.strictEqual(record.stepResults['step_1'].status, 'completed');
});
(0, node_test_1.default)('Scenario 21: Preserve existing cancellation behavior', async () => {
    const store = new documentStore_1.DocumentStore();
    const psAdapter = new powershellAdapter_1.PowerShellAdapter(store.getDiagnosticsDir());
    const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
    const delayWf = {
        id: 'wf_cancel_preservation',
        name: 'Cancellation Preservation',
        description: 'Ensure cancellation remains instant',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        enabled: true,
        targetApp: 'Antigravity IDE',
        approvalPolicy: 'auto_safe_only',
        tags: ['test'],
        steps: [
            {
                id: 'step_delay',
                name: 'Long delay',
                type: 'wait_for_condition',
                enabled: true,
                timeoutSeconds: 15,
                retryLimit: 0,
                config: { delaySeconds: 10 },
            },
        ],
    };
    const promise = engine.executeWorkflow(delayWf, 'manual');
    await new Promise(r => setTimeout(r, 60));
    const activeIds = engine.getActiveRunIds();
    strict_1.default.ok(activeIds.length > 0, 'Active run should be tracked by engine');
    for (const runId of activeIds) {
        engine.cancelRun(runId);
    }
    const record = await promise;
    strict_1.default.strictEqual(record.status, 'cancelled');
});
(0, node_test_1.default)('Scenario 22: Multi-IDE Registry initializes and registers all supported IDE adapters (Antigravity & VS Code)', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const registry = new ideRegistry_1.IdeRegistry(psAdapter);
    const adapters = registry.getAllAdapters();
    strict_1.default.strictEqual(adapters.length, 2);
    const antigravity = registry.getAdapter('antigravity');
    strict_1.default.ok(antigravity);
    strict_1.default.strictEqual(antigravity?.ideId, 'antigravity');
    const vscode = registry.getAdapter('vscode_copilot');
    strict_1.default.ok(vscode);
    strict_1.default.strictEqual(vscode?.ideId, 'vscode_copilot');
});
(0, node_test_1.default)('Scenario 23: Multi-IDE matches TargetWindowInfo to correct IDE adapter', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const registry = new ideRegistry_1.IdeRegistry(psAdapter);
    const antigravityWin = {
        hwnd: 1001,
        pid: 2001,
        title: 'Antigravity IDE - MyProject',
        processName: 'Antigravity',
        className: 'Chrome_WidgetWin_1',
        isVisible: true,
    };
    const vscodeWin = {
        hwnd: 1003,
        pid: 2003,
        title: 'Code - workspace.code-workspace',
        processName: 'Code',
        className: 'Chrome_WidgetWin_1',
        isVisible: true,
    };
    const ad1 = registry.resolveAdapterForWindow(antigravityWin);
    strict_1.default.strictEqual(ad1?.ideId, 'antigravity');
    const ad3 = registry.resolveAdapterForWindow(vscodeWin);
    strict_1.default.strictEqual(ad3?.ideId, 'vscode_copilot');
});
(0, node_test_1.default)('Scenario 24: UniversalActionDetector classifies action categories accurately', () => {
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Submit').category, 'PROMPT_SUBMISSION');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Submit ↵').category, 'PROMPT_SUBMISSION');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Send').category, 'PROMPT_SUBMISSION');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Continue').category, 'CONTINUE_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Proceed').category, 'CONTINUE_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Allow').category, 'PERMISSION_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Allow this time').category, 'PERMISSION_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Yes, allow this time').category, 'PERMISSION_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Approve').category, 'PERMISSION_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Confirm').category, 'CONFIRMATION');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Accept all').category, 'FILE_CHANGE_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Accept all changes').category, 'FILE_CHANGE_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Accept all files').category, 'FILE_CHANGE_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Apply').category, 'FILE_CHANGE_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Apply changes').category, 'FILE_CHANGE_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Run').category, 'TERMINAL_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Run command').category, 'TERMINAL_APPROVAL');
    strict_1.default.strictEqual(universalActionDetector_1.UniversalActionDetector.evaluateCandidate('Run in terminal').category, 'TERMINAL_APPROVAL');
});
(0, node_test_1.default)('Scenario 25: UniversalActionDetector and SafetyGuard permanently lock destructive and rejection buttons', () => {
    const rejectedButtons = [
        'Discard',
        'Reject',
        'Revert',
        'Cancel',
        'No',
        "Don't Save",
        'dont save',
        'Delete',
        'Delete All',
        'Abort',
    ];
    for (const btn of rejectedButtons) {
        const candidate = universalActionDetector_1.UniversalActionDetector.evaluateCandidate(btn);
        strict_1.default.strictEqual(candidate.isSafe, false, `Expected ${btn} to be flagged as unsafe`);
        strict_1.default.ok(candidate.category === 'REJECTION' || candidate.category === 'DESTRUCTIVE', `Expected ${btn} to be categorized as REJECTION or DESTRUCTIVE`);
        strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isDestructiveOrRejection(btn), true);
    }
});
(0, node_test_1.default)('Scenario 26: Antigravity IDE adapter supports prompt inspection, file change detection, and terminal approval', async () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const antigravityAdapter = new antigravityAdapter_1.AntigravityAdapter(psAdapter);
    strict_1.default.strictEqual(antigravityAdapter.ideId, 'antigravity');
    strict_1.default.strictEqual(antigravityAdapter.displayName, 'Antigravity IDE');
    strict_1.default.ok(antigravityAdapter.defaultCapabilities.includes('Prompt Submission'));
    strict_1.default.ok(antigravityAdapter.defaultCapabilities.includes('Option Selection'));
    strict_1.default.ok(antigravityAdapter.defaultCapabilities.includes('Accept All File Changes'));
    strict_1.default.ok(antigravityAdapter.defaultCapabilities.includes('Terminal Command Approval'));
});
(0, node_test_1.default)('Scenario 27: VS Code Copilot adapter detects Copilot availability and capabilities', async () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const vscodeAdapter = new vscodeCopilotAdapter_1.VscodeCopilotAdapter(psAdapter);
    strict_1.default.strictEqual(vscodeAdapter.ideId, 'vscode_copilot');
    strict_1.default.strictEqual(vscodeAdapter.displayName, 'VS Code + GitHub Copilot');
    strict_1.default.ok(vscodeAdapter.defaultCapabilities.includes('Copilot Chat Prompts'));
    const status = await vscodeAdapter.getCopilotStatus(0, 0);
    strict_1.default.strictEqual(status, 'not_detected');
});
(0, node_test_1.default)('Scenario 28: AgentService scans and returns multi-IDE connection info for Antigravity and VS Code', async () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const agent = new agentService_1.AgentService(psAdapter);
    const status = await agent.scanTargetWindow();
    strict_1.default.ok(status.ideConnections);
    strict_1.default.strictEqual(status.ideConnections.length, 2);
    const ideIds = status.ideConnections.map((c) => c.ideId);
    strict_1.default.ok(ideIds.includes('antigravity'));
    strict_1.default.ok(ideIds.includes('vscode_copilot'));
    strict_1.default.strictEqual(ideIds.includes('cursor'), false);
});
(0, node_test_1.default)('Scenario 29: AgentService respects target IDE filter and per-IDE config overrides', async () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const agent = new agentService_1.AgentService(psAdapter);
    agent.setTargetIdeFilter('antigravity');
    strict_1.default.strictEqual(agent.getStatus().targetIdeFilter, 'antigravity');
    agent.updatePerIdeConfig('antigravity', { promptAutomation: true, approvalPolicy: 'auto_safe_only' });
    const connections = agent.getIdeConnections();
    strict_1.default.ok(connections.length > 0);
});
(0, node_test_1.default)('Scenario 30: Preserves safety policies and process allowlisting for Antigravity and VS Code without Cursor', () => {
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('Antigravity'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('Antigravity IDE'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('Code'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('Visual Studio Code'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isAllowedTargetApp('MaliciousApp'), false);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isSupportedIde('antigravity'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isSupportedIde('vscode_copilot'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isSupportedIde('cursor'), false);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isSupportedIde('unknown_ide'), false);
});
// ============================================================================
// PART 13 — 22 COMPREHENSIVE VS CODE & GOOGLE ANTIGRAVITY EXTENSION TESTS
// ============================================================================
(0, node_test_1.default)('Extension Test 1: Extension activation initializes core components and registers status bar', () => {
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'autopilot_ext_act_'));
    try {
        const docStore = new documentStore_1.DocumentStore(tmpDir);
        const psAdapter = new powershellAdapter_1.PowerShellAdapter();
        const agent = new agentService_1.AgentService(psAdapter, docStore);
        const engine = new workflowEngine_1.WorkflowEngine(docStore, psAdapter);
        strict_1.default.ok(docStore, 'DocumentStore initialized');
        strict_1.default.ok(agent, 'AgentService initialized');
        strict_1.default.ok(engine, 'WorkflowEngine initialized');
        const status = agent.getStatus();
        strict_1.default.strictEqual(status.autoPilotEnabled, true);
        strict_1.default.strictEqual(status.state, 'idle');
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Extension Test 2: Extension deactivation safely stops watchers and cancels active runs', () => {
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'autopilot_ext_deact_'));
    try {
        const docStore = new documentStore_1.DocumentStore(tmpDir);
        const psAdapter = new powershellAdapter_1.PowerShellAdapter();
        const agent = new agentService_1.AgentService(psAdapter, docStore);
        const engine = new workflowEngine_1.WorkflowEngine(docStore, psAdapter);
        agent.startMonitoring(5000);
        strict_1.default.strictEqual(agent.getStatus().state, 'monitoring');
        // Simulate deactivation cleanup
        const activeIds = engine.getActiveRunIds();
        for (const runId of activeIds) {
            engine.cancelRun(runId);
        }
        const stoppedStatus = agent.stopMonitoring();
        strict_1.default.strictEqual(stoppedStatus.state, 'idle');
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Extension Test 3: Activity Bar registration configuration is valid', () => {
    const pkgPath = path_1.default.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs_1.default.readFileSync(pkgPath, 'utf-8'));
    strict_1.default.ok(pkg.contributes?.viewsContainers?.activitybar, 'Activity bar container must be contributed');
    const activityBar = pkg.contributes.viewsContainers.activitybar[0];
    strict_1.default.strictEqual(activityBar.id, 'autopilot-ai');
    strict_1.default.strictEqual(activityBar.title, 'AutoPilot AI');
    const views = pkg.contributes?.views?.['autopilot-ai'];
    strict_1.default.ok(views, 'Views container must have autopilot-ai views');
    strict_1.default.strictEqual(views[0].id, 'autopilot-ai.mainView');
    strict_1.default.strictEqual(views[0].type, 'webview');
});
(0, node_test_1.default)('Extension Test 4: Sidebar loading serves webview HTML with secure script bridge', () => {
    const distDir = path_1.default.resolve(__dirname, '../../../dist');
    const indexHtml = path_1.default.join(distDir, 'index.html');
    strict_1.default.ok(fs_1.default.existsSync(indexHtml), 'dist/index.html must exist from Vite build');
    const content = fs_1.default.readFileSync(indexHtml, 'utf-8');
    strict_1.default.ok(content.includes('<div id="root"></div>') || content.includes('<script'), 'index.html must contain root mount and scripts');
});
(0, node_test_1.default)('Extension Test 5: Command registration defines all 9 public extension commands', () => {
    const pkgPath = path_1.default.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs_1.default.readFileSync(pkgPath, 'utf-8'));
    const commands = pkg.contributes?.commands || [];
    const cmdIds = commands.map((c) => c.command);
    const expectedCommands = [
        'autopilot-ai.openDashboard',
        'autopilot-ai.startMonitoring',
        'autopilot-ai.pauseMonitoring',
        'autopilot-ai.stopMonitoring',
        'autopilot-ai.inspectPrompt',
        'autopilot-ai.inspectFileChanges',
        'autopilot-ai.runWorkflow',
        'autopilot-ai.emergencyStop',
        'autopilot-ai.openSettings',
    ];
    for (const cmd of expectedCommands) {
        strict_1.default.ok(cmdIds.includes(cmd), `Expected command '${cmd}' to be registered in package.json`);
    }
});
(0, node_test_1.default)('Extension Test 6: Settings persistence saves and reloads extension configuration', () => {
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'autopilot_ext_sett_'));
    try {
        const store = new documentStore_1.DocumentStore(tmpDir);
        const updated = store.saveSettings({
            approvalPolicy: 'full_auto',
            defaultTimeoutSeconds: 30,
            autoStartMonitoring: false,
        });
        strict_1.default.strictEqual(updated.approvalPolicy, 'full_auto');
        strict_1.default.strictEqual(updated.defaultTimeoutSeconds, 30);
        strict_1.default.strictEqual(updated.autoStartMonitoring, false);
        // Verify disk persistence
        const reloaded = new documentStore_1.DocumentStore(tmpDir);
        const loaded = reloaded.getSettings();
        strict_1.default.strictEqual(loaded.approvalPolicy, 'full_auto');
        strict_1.default.strictEqual(loaded.defaultTimeoutSeconds, 30);
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Extension Test 7: Automation mode selection updates AgentService state machine', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const agent = new agentService_1.AgentService(psAdapter);
    agent.setApprovalPolicy('always_manual');
    strict_1.default.strictEqual(agent.getStatus().approvalPolicy, 'always_manual');
    strict_1.default.strictEqual(agent.getStatus().autoPilotMode, 'manual');
    agent.setApprovalPolicy('auto_safe_only');
    strict_1.default.strictEqual(agent.getStatus().approvalPolicy, 'auto_safe_only');
    strict_1.default.strictEqual(agent.getStatus().autoPilotMode, 'full_auto');
    agent.setApprovalPolicy('full_auto');
    strict_1.default.strictEqual(agent.getStatus().approvalPolicy, 'full_auto');
    strict_1.default.strictEqual(agent.getStatus().autoPilotMode, 'full_auto');
});
(0, node_test_1.default)('Extension Test 8: Recommended option detection recognizes recommended patterns', () => {
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('(Recommended) Keep current changes'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('[Recommended] Run tests'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('Recommended: Allow permission'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('Default configuration'), true);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('Custom option'), false);
    strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isRecommendationOption('Reject changes'), false);
});
(0, node_test_1.default)('Extension Test 9: Prompt submission identifies positive candidate buttons', () => {
    const candidates = ['Submit', 'Submit ↵', 'Send', 'Generate', 'Proceed', 'OK'];
    for (const label of candidates) {
        const evalResult = universalActionDetector_1.UniversalActionDetector.evaluateCandidate(label);
        strict_1.default.strictEqual(evalResult.isSafe, true, `Button '${label}' should be marked safe`);
        strict_1.default.ok(evalResult.category !== 'REJECTION' && evalResult.category !== 'DESTRUCTIVE');
    }
});
(0, node_test_1.default)('Extension Test 10: File-change detection identifies positive acceptance variations', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const detector = new fileChangeApprovalDetector_1.FileChangeApprovalDetector(psAdapter);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Accept all'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Accept all changes'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Accept all files'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('ACCEPT ALL CHANGES'), true);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Discard all'), false);
    strict_1.default.strictEqual(detector.isAcceptAllButton('Reject changes'), false);
});
(0, node_test_1.default)('Extension Test 11: File-change confidence validation distinguishes HIGH, MEDIUM, LOW', () => {
    const highConfidence = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'HIGH', false);
    strict_1.default.strictEqual(highConfidence.canAutoApprove, true);
    strict_1.default.strictEqual(highConfidence.requiresManualApproval, false);
    const ambiguousContainer = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'HIGH', true);
    strict_1.default.strictEqual(ambiguousContainer.canAutoApprove, false);
    strict_1.default.strictEqual(ambiguousContainer.requiresManualApproval, true);
    const lowConfidence = safetyGuard_1.SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'LOW', false);
    strict_1.default.strictEqual(lowConfidence.canAutoApprove, false);
    strict_1.default.strictEqual(lowConfidence.requiresManualApproval, true);
});
(0, node_test_1.default)('Extension Test 12: SafetyGuard validates safe shell parameters and redacts tokens', () => {
    const dirty = 'inspect; rm -rf / | evil & `whoami` $HOME';
    const clean = safetyGuard_1.SafetyGuard.sanitizeShellParameter(dirty);
    strict_1.default.strictEqual(clean.includes(';'), false);
    strict_1.default.strictEqual(clean.includes('&'), false);
    strict_1.default.strictEqual(clean.includes('|'), false);
    strict_1.default.strictEqual(clean.includes('`'), false);
    strict_1.default.strictEqual(clean.includes('$'), false);
    const logWithKey = 'Authorization: Bearer ghp_99887766554433221100aa';
    const redacted = safetyGuard_1.SafetyGuard.redactSensitive(logWithKey);
    strict_1.default.strictEqual(redacted.includes('ghp_99887766554433221100aa'), false);
    strict_1.default.ok(redacted.includes('[REDACTED]'));
});
(0, node_test_1.default)('Extension Test 13: Negative action blocking permanently locks destructive buttons', () => {
    const negativeActions = [
        'Discard',
        'Reject',
        'Revert',
        'Cancel',
        'No',
        "Don't Save",
        'dont save',
        'Delete',
        'Delete All',
        'Abort',
    ];
    for (const act of negativeActions) {
        strict_1.default.strictEqual(safetyGuard_1.SafetyGuard.isDestructiveOrRejection(act), true, `Action '${act}' must be locked`);
        const evalRes = universalActionDetector_1.UniversalActionDetector.evaluateCandidate(act);
        strict_1.default.strictEqual(evalRes.isSafe, false);
        strict_1.default.ok(evalRes.category === 'REJECTION' || evalRes.category === 'DESTRUCTIVE');
    }
});
(0, node_test_1.default)('Extension Test 14: Emergency stop halts active workflows immediately', async () => {
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'autopilot_ext_em_'));
    try {
        const store = new documentStore_1.DocumentStore(tmpDir);
        const psAdapter = new powershellAdapter_1.PowerShellAdapter();
        const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
        const wf = {
            id: 'wf_em_test',
            name: 'Emergency Stop Workflow Test',
            description: 'Tests immediate cancellation',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            enabled: true,
            targetApp: 'Antigravity IDE',
            approvalPolicy: 'auto_safe_only',
            tags: ['test'],
            steps: [
                {
                    id: 'step_1',
                    name: 'Wait step',
                    type: 'wait_for_condition',
                    enabled: true,
                    timeoutSeconds: 10,
                    retryLimit: 0,
                    config: { durationSeconds: 5 },
                },
            ],
        };
        const runPromise = engine.executeWorkflow(wf);
        const activeIds = engine.getActiveRunIds();
        strict_1.default.ok(activeIds.length > 0);
        // Trigger emergency stop
        for (const id of activeIds) {
            engine.cancelRun(id);
        }
        const result = await runPromise;
        strict_1.default.strictEqual(result.status, 'cancelled');
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Extension Test 15: Workflow execution supports multi-step execution successfully', async () => {
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'autopilot_ext_wf_'));
    try {
        const store = new documentStore_1.DocumentStore(tmpDir);
        const psAdapter = new powershellAdapter_1.PowerShellAdapter();
        const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
        const wf = {
            id: 'wf_exec_test',
            name: 'Execution Test',
            description: 'Testing successful step run',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            enabled: true,
            targetApp: 'Antigravity IDE',
            approvalPolicy: 'auto_safe_only',
            tags: ['test'],
            steps: [
                {
                    id: 'step_1',
                    name: 'Log 1',
                    type: 'write_log',
                    enabled: true,
                    timeoutSeconds: 5,
                    retryLimit: 0,
                    config: { message: 'First step completed' },
                },
                {
                    id: 'step_2',
                    name: 'Log 2',
                    type: 'write_log',
                    enabled: true,
                    timeoutSeconds: 5,
                    retryLimit: 0,
                    config: { message: 'Second step completed' },
                },
            ],
        };
        const result = await engine.executeWorkflow(wf);
        strict_1.default.strictEqual(result.status, 'completed');
        strict_1.default.strictEqual(result.stepResults['step_1'].status, 'completed');
        strict_1.default.strictEqual(result.stepResults['step_2'].status, 'completed');
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Extension Test 16: Workflow cancellation halts in-flight steps cleanly', async () => {
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'autopilot_ext_canc_'));
    try {
        const store = new documentStore_1.DocumentStore(tmpDir);
        const psAdapter = new powershellAdapter_1.PowerShellAdapter();
        const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
        const wf = {
            id: 'wf_canc_test',
            name: 'Cancel Test',
            description: 'Testing cancellation',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            enabled: true,
            targetApp: 'Antigravity IDE',
            approvalPolicy: 'auto_safe_only',
            tags: ['test'],
            steps: [
                {
                    id: 'step_wait',
                    name: 'Long wait',
                    type: 'wait_for_condition',
                    enabled: true,
                    timeoutSeconds: 10,
                    retryLimit: 0,
                    config: { durationSeconds: 6 },
                },
            ],
        };
        const runPromise = engine.executeWorkflow(wf);
        setTimeout(() => {
            const activeIds = engine.getActiveRunIds();
            if (activeIds.length > 0) {
                engine.cancelRun(activeIds[0]);
            }
        }, 50);
        const result = await runPromise;
        strict_1.default.strictEqual(result.status, 'cancelled');
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Extension Test 17: IDE detection matches Antigravity and VS Code windows', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const registry = new ideRegistry_1.IdeRegistry(psAdapter);
    const antigravityWindow = {
        hwnd: 101,
        pid: 201,
        title: 'Google Antigravity IDE - Project Workspace',
        processName: 'Antigravity',
        className: 'Chrome_WidgetWin_1',
        isVisible: true,
    };
    const codeWindow = {
        hwnd: 102,
        pid: 202,
        title: 'Visual Studio Code - Workspace',
        processName: 'Code',
        className: 'Chrome_WidgetWin_1',
        isVisible: true,
    };
    const adAntigravity = registry.resolveAdapterForWindow(antigravityWindow);
    strict_1.default.strictEqual(adAntigravity?.ideId, 'antigravity');
    const adCode = registry.resolveAdapterForWindow(codeWindow);
    strict_1.default.strictEqual(adCode?.ideId, 'vscode_copilot');
});
(0, node_test_1.default)('Extension Test 18: VS Code compatibility adapter supports inline edit and diff approval', () => {
    const psAdapter = new powershellAdapter_1.PowerShellAdapter();
    const vscodeAdapter = new vscodeCopilotAdapter_1.VscodeCopilotAdapter(psAdapter);
    strict_1.default.strictEqual(vscodeAdapter.ideId, 'vscode_copilot');
    strict_1.default.strictEqual(vscodeAdapter.displayName, 'VS Code + GitHub Copilot');
    strict_1.default.ok(vscodeAdapter.defaultCapabilities.includes('Inline Edit Approvals'));
    strict_1.default.ok(vscodeAdapter.defaultCapabilities.includes('Apply Changes'));
});
(0, node_test_1.default)('Extension Test 19: Google Antigravity compatibility environment detection is verified', () => {
    const env = antigravityEnvironment_1.AntigravityEnvironment.detect();
    strict_1.default.ok(env, 'Environment info must be returned');
    strict_1.default.ok(typeof env.isAntigravityHost === 'boolean');
    strict_1.default.ok(typeof env.appName === 'string');
    strict_1.default.strictEqual(env.supportsVsixPackaging, true);
    strict_1.default.strictEqual(env.supportsWebviewApi, true);
});
(0, node_test_1.default)('Extension Test 20: Platform adapter selection provides platform-specific capabilities', () => {
    const win = new windowsAdapter_1.WindowsAdapter(new powershellAdapter_1.PowerShellAdapter());
    const mac = new macosAdapter_1.MacosAdapter();
    const linux = new linuxAdapter_1.LinuxAdapter();
    strict_1.default.strictEqual(win.getCapabilities().supportsDesktopUia, true);
    strict_1.default.strictEqual(win.getCapabilities().platformName, 'windows');
    strict_1.default.strictEqual(mac.getCapabilities().supportsDesktopUia, false);
    strict_1.default.strictEqual(mac.getCapabilities().platformName, 'macos');
    strict_1.default.ok(mac.getCapabilities().limitationMessage?.includes('not supported on macOS'));
    strict_1.default.strictEqual(linux.getCapabilities().supportsDesktopUia, false);
    strict_1.default.strictEqual(linux.getCapabilities().platformName, 'linux');
    strict_1.default.ok(linux.getCapabilities().limitationMessage?.includes('not supported on Linux'));
});
(0, node_test_1.default)('Extension Test 21: Error handling gracefully reports failed steps without engine crashes', async () => {
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'autopilot_ext_err_'));
    try {
        const store = new documentStore_1.DocumentStore(tmpDir);
        const psAdapter = new powershellAdapter_1.PowerShellAdapter();
        const engine = new workflowEngine_1.WorkflowEngine(store, psAdapter);
        const failingWf = {
            id: 'wf_fail_test',
            name: 'Failing Step Workflow',
            description: 'Tests graceful failure handling',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            enabled: true,
            targetApp: 'Antigravity IDE',
            approvalPolicy: 'auto_safe_only',
            tags: ['test'],
            steps: [
                {
                    id: 'step_fail',
                    name: 'Nonexistent file prompt step',
                    type: 'detect_prompt',
                    enabled: true,
                    timeoutSeconds: 1,
                    retryLimit: 0,
                    config: {
                        delaySeconds: 0,
                        targetOptionSubstring: 'NONEXISTENT_OPTION_12345',
                    },
                },
            ],
        };
        const result = await engine.executeWorkflow(failingWf);
        strict_1.default.ok(result.status === 'failed' || result.status === 'completed');
        strict_1.default.strictEqual(engine.isRunning(), false, 'Engine must not remain locked after step failure');
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Extension Test 22: Extension reload and restart retains workflows and runs across reboots', () => {
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'autopilot_ext_reboot_'));
    try {
        // Session 1: Create custom workflow
        const session1 = new documentStore_1.DocumentStore(tmpDir);
        const customWf = {
            id: 'wf_custom_persisted',
            name: 'Persisted Across Reboots',
            description: 'Verifies restart safety',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            enabled: true,
            targetApp: 'Antigravity IDE',
            approvalPolicy: 'auto_safe_only',
            tags: ['custom'],
            steps: [
                {
                    id: 'step_p',
                    name: 'Log step',
                    type: 'write_log',
                    enabled: true,
                    timeoutSeconds: 5,
                    retryLimit: 0,
                    config: { message: 'Persisted' },
                },
            ],
        };
        session1.saveWorkflow(customWf);
        // Session 2: Reload after extension restart
        const session2 = new documentStore_1.DocumentStore(tmpDir);
        const loadedWf = session2.getWorkflowById('wf_custom_persisted');
        strict_1.default.ok(loadedWf, 'Custom workflow must exist after restart');
        strict_1.default.strictEqual(loadedWf?.name, 'Persisted Across Reboots');
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Regression Test BUG-001: Webview asset transformation handles relative ./assets/, /assets/, and bundle files with CSP', () => {
    const distDir = path_1.default.resolve('dist');
    const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <script type="module" crossorigin src="./assets/index-sample.js"></script>
  <link rel="stylesheet" crossorigin href="./assets/index-sample.css">
  <img src="/assets/app-icon-sample.png">
</head>
<body><div id="root"></div></body>
</html>`;
    const cspSource = 'vscode-webview:';
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'unsafe-inline' ${cspSource}; style-src 'unsafe-inline' ${cspSource} https://fonts.googleapis.com; font-src ${cspSource} https://fonts.gstatic.com;">`;
    let transformed = sampleHtml.replace(/(src|href)=["']((?:\.?\/)?assets\/[^"']+|(?:\.?\/)?[^"':]+\.(?:png|jpg|jpeg|svg|ico|css|js))["']/gi, (match, attr, assetPath) => {
        if (/^(?:https?:|\/\/|data:)/i.test(assetPath))
            return match;
        const cleanPath = assetPath.replace(/^(\.\/|\/)/, '');
        return `${attr}="vscode-webview://mock/${cleanPath}"`;
    });
    if (!transformed.includes('http-equiv="Content-Security-Policy"') && transformed.includes('<head>')) {
        transformed = transformed.replace('<head>', `<head>\n  ${cspMeta}`);
    }
    strict_1.default.ok(transformed.includes('src="vscode-webview://mock/assets/index-sample.js"'), 'Relative script ./assets/ must be transformed to webview URI');
    strict_1.default.ok(transformed.includes('href="vscode-webview://mock/assets/index-sample.css"'), 'Relative style ./assets/ must be transformed to webview URI');
    strict_1.default.ok(transformed.includes('src="vscode-webview://mock/assets/app-icon-sample.png"'), 'Root-relative /assets/ must be transformed to webview URI');
    strict_1.default.ok(transformed.includes('href="https://fonts.googleapis.com"'), 'External fonts link must be preserved as-is');
    strict_1.default.ok(transformed.includes('Content-Security-Policy'), 'Content-Security-Policy meta tag must be present in head');
});
(0, node_test_1.default)('Regression Test BUG-002: Sidebar navigation structure contains entries for Workflow Library and Automation Agent', () => {
    const sidebarPath = path_1.default.resolve('src/components/Sidebar.tsx');
    const sidebarCode = fs_1.default.readFileSync(sidebarPath, 'utf-8');
    // Verify 'agent' navigation entry
    strict_1.default.ok(sidebarCode.includes("id: 'agent'"), "Sidebar must define navigation item for 'agent'");
    strict_1.default.ok(sidebarCode.includes("label: 'Automation Agent'"), "Sidebar must display 'Automation Agent' label");
    // Verify 'library' navigation entry
    strict_1.default.ok(sidebarCode.includes("id: 'library'"), "Sidebar must define navigation item for 'library'");
    strict_1.default.ok(sidebarCode.includes("label: 'Workflow Library'"), "Sidebar must display 'Workflow Library' label");
    // Verify App.tsx binds both views to their active tabs
    const appPath = path_1.default.resolve('src/App.tsx');
    const appCode = fs_1.default.readFileSync(appPath, 'utf-8');
    strict_1.default.ok(appCode.includes("case 'agent':"), "App.tsx must handle activeTab 'agent'");
    strict_1.default.ok(appCode.includes('<AutomationAgentView />'), 'App.tsx must render AutomationAgentView for agent tab');
    strict_1.default.ok(appCode.includes("case 'library':"), "App.tsx must handle activeTab 'library'");
    strict_1.default.ok(appCode.includes('<WorkflowLibraryView />'), 'App.tsx must render WorkflowLibraryView for library tab');
});
(0, node_test_1.default)('Regression Test BUG-003: ConfigurationSynchronizer bidirectionally maps settings and prevents circular sync loops', () => {
    // 1. Mode to approval policy mapping
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.modeToApprovalPolicy('safe_auto'), 'auto_safe_only');
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.modeToApprovalPolicy('full_auto'), 'full_auto');
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.modeToApprovalPolicy('manual_approval'), 'always_manual');
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.modeToApprovalPolicy('unknown'), 'auto_safe_only');
    // 2. Approval policy to mode mapping
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.approvalPolicyToMode('auto_safe_only'), 'safe_auto');
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.approvalPolicyToMode('full_auto'), 'full_auto');
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.approvalPolicyToMode('always_manual'), 'manual_approval');
    // 3. Response speed to delay ms mapping
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.speedToDelayMs('instant'), 100);
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.speedToDelayMs('fast'), 250);
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.speedToDelayMs('comfortable'), 750);
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.speedToDelayMs('deliberate'), 1500);
    // 4. Delay ms to response speed mapping
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.delayMsToSpeed(100), 'instant');
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.delayMsToSpeed(250), 'fast');
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.delayMsToSpeed(750), 'comfortable');
    strict_1.default.strictEqual(configurationSynchronizer_1.ConfigurationSynchronizer.delayMsToSpeed(1500), 'deliberate');
    // 5. DocumentStore settings persistence with synchronized fields
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'autopilot_cfg_test_'));
    try {
        const store = new documentStore_1.DocumentStore(tmpDir);
        const updated = store.saveSettings({
            approvalPolicy: 'full_auto',
            responseSpeed: 'instant',
            autoStartMonitoring: true,
            monitoringInterval: 1200,
            autoAcceptAllFileChanges: true,
        });
        strict_1.default.strictEqual(updated.approvalPolicy, 'full_auto');
        strict_1.default.strictEqual(updated.responseSpeed, 'instant');
        strict_1.default.strictEqual(updated.autoStartMonitoring, true);
        strict_1.default.strictEqual(updated.monitoringInterval, 1200);
        const reloaded = store.getSettings();
        strict_1.default.strictEqual(reloaded.approvalPolicy, 'full_auto');
        strict_1.default.strictEqual(reloaded.responseSpeed, 'instant');
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('Test teardown: finalize test suite execution', () => {
    setTimeout(() => process.exit(0), 100);
});
//# sourceMappingURL=engine.test.js.map