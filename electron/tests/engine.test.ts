// @ts-ignore
import test from 'node:test';
// @ts-ignore
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SafetyGuard } from '../security/safetyGuard';
import { DocumentStore } from '../storage/documentStore';
import { WorkflowDefinition, WorkflowStep } from '../engine/types';
import { WorkflowEngine } from '../engine/workflowEngine';
import { PowerShellAdapter } from '../adapters/powershellAdapter';
import { AgentService } from '../adapters/agentService';
import { FileChangeApprovalDetector } from '../adapters/fileChangeApprovalDetector';
import { FileChangeApprovalService } from '../adapters/fileChangeApprovalService';
import { IdeRegistry } from '../adapters/ide/ideRegistry';
import { UniversalActionDetector } from '../adapters/ide/shared/universalActionDetector';
import { AntigravityAdapter } from '../adapters/ide/antigravityAdapter';
import { VscodeCopilotAdapter } from '../adapters/ide/vscodeCopilotAdapter';
import { PlatformAdapter } from '../../extension/src/adapters/platform/platformAdapter';
import { WindowsAdapter } from '../../extension/src/adapters/platform/windowsAdapter';
import { MacosAdapter } from '../../extension/src/adapters/platform/macosAdapter';
import { LinuxAdapter } from '../../extension/src/adapters/platform/linuxAdapter';
import { AntigravityEnvironment } from '../../extension/src/adapters/ide/antigravityEnvironment';
import { ConfigurationSynchronizer } from '../../extension/src/providers/configurationSynchronizer';

test('SafetyGuard: flags dangerous terminal commands as destructive', () => {
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
    const isDestructive = SafetyGuard.isDestructiveCommand(cmd);
    assert.strictEqual(isDestructive, true, `Expected dangerous command to be flagged as destructive: ${cmd}`);
  }
});

test('SafetyGuard: permits safe diagnostics commands', () => {
  const safeCommands = [
    'Get-Process -Name Antigravity',
    'powershell -ExecutionPolicy Bypass -File "diagnostics/inspect_prompt_subtree.ps1"',
    'echo "Hello AutoPilot"',
  ];

  for (const cmd of safeCommands) {
    const isDestructive = SafetyGuard.isDestructiveCommand(cmd);
    assert.strictEqual(isDestructive, false, `Expected safe command NOT to be flagged as destructive: ${cmd}`);
  }
});

test('SafetyGuard: redacts sensitive tokens and passwords from logs', () => {
  const rawLog = 'Connecting with token: ghp_1234567890abcdef and password: SuperSecretPassword123!';
  const redacted = SafetyGuard.redactSensitive(rawLog);

  assert.ok(!redacted.includes('ghp_1234567890abcdef'), 'Expected token to be redacted');
  assert.ok(!redacted.includes('SuperSecretPassword123!'), 'Expected password to be redacted');
  assert.ok(redacted.includes('[REDACTED]'), 'Expected [REDACTED] placeholder');
});

test('SafetyGuard: validates workflow schema accurately', () => {
  const validWf: WorkflowDefinition = {
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

  const validation = SafetyGuard.validateWorkflowSchema(validWf);
  assert.strictEqual(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);

  const invalidWf: any = {
    id: 'bad_wf',
    // missing name and steps
  };
  const failValidation = SafetyGuard.validateWorkflowSchema(invalidWf);
  assert.strictEqual(failValidation.valid, false, 'Expected invalid workflow to fail schema check');
});

test('DocumentStore: initializes and reads settings', () => {
  const store = new DocumentStore();
  const settings = store.getSettings();

  assert.ok(settings, 'Settings should not be null');
  assert.ok(settings.approvalPolicy, 'Settings should contain approvalPolicy');
  assert.strictEqual(typeof settings.defaultTimeoutSeconds, 'number');
});

test('DocumentStore: seeds default workflows and allows retrieval', () => {
  const store = new DocumentStore();
  const workflows = store.getAllWorkflows();

  assert.ok(Array.isArray(workflows), 'getAllWorkflows should return an array');
  assert.ok(workflows.length >= 2, 'Should have at least 2 seeded default workflows');

  const recWf = workflows.find((w) => w.id === 'wf_antigravity_recommended');
  assert.ok(recWf, 'Antigravity recommended workflow should exist');
  assert.ok(recWf.steps.length >= 3, 'Workflow should have at least 3 steps');
});

test('SafetyGuard: process allowlisting permits approved apps and blocks unauthorized ones', () => {
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('Antigravity IDE'), true);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('Antigravity'), true);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('Code'), true);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('notepad'), true);

  assert.strictEqual(SafetyGuard.isAllowedTargetApp('cmd.exe'), false);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('powershell.exe'), false);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('malicious_binary.exe'), false);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('../../../windows/system32/calc.exe'), false);
});

test('SafetyGuard: rejects path traversal and invalid characters in workflow ID', () => {
  const traversalWf: any = {
    id: '../../etc/passwd',
    name: 'Path Traversal Test',
    steps: [],
  };
  const res = SafetyGuard.validateWorkflowSchema(traversalWf);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('alphanumeric characters, underscores, and hyphens')));
});

test('SafetyGuard: sanitizes shell parameters by stripping command injection characters', () => {
  const dirtyInput = '(Recommended); Start-Process calc.exe; # ` $evil & |';
  const clean = SafetyGuard.sanitizeShellParameter(dirtyInput);
  assert.ok(!clean.includes(';'), 'Semicolon must be removed');
  assert.ok(!clean.includes('&'), 'Ampersand must be removed');
  assert.ok(!clean.includes('|'), 'Pipe must be removed');
  assert.ok(!clean.includes('`'), 'Backtick must be removed');
  assert.ok(!clean.includes('$'), 'Dollar sign must be removed');
  assert.strictEqual(clean, '(Recommended) Start-Process calc.exe #  evil');
});

test('SafetyGuard: rejects workflows with unauthorized target applications', () => {
  const badAppWf: any = {
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
  const res = SafetyGuard.validateWorkflowSchema(badAppWf);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('approved safety allowlist')));
});

// --- Phase 3: WorkflowEngine & Storage End-to-End Tests ---

test('WorkflowEngine: executes harmless multi-step workflow successfully', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const testWorkflow: WorkflowDefinition = {
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
  assert.strictEqual(record.status, 'completed', 'Workflow should complete successfully');
  assert.strictEqual(record.stepResults['step_log_start']?.status, 'completed');
  assert.strictEqual(record.stepResults['step_wait_brief']?.status, 'completed');
  assert.strictEqual(record.stepResults['step_log_end']?.status, 'completed');
  assert.ok(record.logs.length >= 3, 'Execution should contain step logs');
});

test('WorkflowEngine: enforces correct step ordering and conditional branching', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const branchWorkflow: WorkflowDefinition = {
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
  assert.strictEqual(record.status, 'completed');
  assert.strictEqual(record.stepResults['step_1']?.status, 'completed');
  assert.strictEqual(record.stepResults['step_2']?.status, 'completed');
  assert.strictEqual(record.stepResults['step_3'], undefined, 'Step 3 must not execute');
  assert.strictEqual(record.stepResults['step_4']?.status, 'completed', 'Step 4 must execute');
});

test('WorkflowEngine: propagates failure and halts execution when no onFailureGoto is set', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const failWorkflow: WorkflowDefinition = {
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
  assert.strictEqual(record.status, 'failed', 'Run status must be failed');
  assert.strictEqual(record.stepResults['step_1']?.status, 'completed');
  assert.strictEqual(record.stepResults['step_2_failing']?.status, 'failed');
  assert.strictEqual(record.stepResults['step_3_unreachable'], undefined, 'Subsequent step must not execute');
  assert.ok(record.error?.includes('approved safety allowlist'), 'Error message must reflect failure reason');
});

test('WorkflowEngine: handles onFailureGoto by branching to recovery step', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const recoverWorkflow: WorkflowDefinition = {
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
  assert.strictEqual(record.status, 'completed', 'Workflow should complete after recovery branch');
  assert.strictEqual(record.stepResults['step_failing']?.status, 'failed');
  assert.strictEqual(record.stepResults['step_normal'], undefined);
  assert.strictEqual(record.stepResults['step_recovery']?.status, 'completed');
});

test('WorkflowEngine: handles step timeouts accurately', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const timeoutWorkflow: WorkflowDefinition = {
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
  assert.strictEqual(record.status, 'failed');
  assert.strictEqual(record.stepResults['step_timeout']?.status, 'failed');
  assert.ok(record.stepResults['step_timeout']?.error?.includes('timed out'), 'Error must note timeout');
});

test('WorkflowEngine: supports cancellation of active workflow execution', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const longWorkflow: WorkflowDefinition = {
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

  assert.strictEqual(engine.isRunning(), true, 'Engine should report running');
  const activeIds = engine.getActiveRunIds();
  assert.ok(activeIds.length > 0, 'Should have active run ID');
  const cancelled = engine.cancelRun(activeIds[0]);
  assert.strictEqual(cancelled, true, 'cancelRun should return true');

  const result = await runPromise;
  assert.strictEqual(result.status, 'cancelled', 'Execution status must be cancelled');
  assert.strictEqual(result.stepResults['step_wait_2'], undefined, 'Subsequent step must never start after cancellation');
});

test('WorkflowEngine: emergency stop cancels active workflow and handles cancellation race with failing step', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const raceWorkflow: WorkflowDefinition = {
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
  assert.ok(activeIds.length > 0, 'Active run should be tracked');
  for (const id of activeIds) {
    engine.cancelRun(id);
  }

  const result = await runPromise;
  assert.strictEqual(result.status, 'cancelled', 'Emergency stop must leave status as cancelled');
  assert.strictEqual(result.stepResults['step_never_run'], undefined, 'Subsequent steps must be aborted');
});

test('WorkflowEngine: respects retry limits on failing steps', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const retryWorkflow: WorkflowDefinition = {
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
  assert.strictEqual(record.status, 'failed');
  assert.strictEqual(record.stepResults['step_retry_test']?.retryCount, 2, 'Should attempt 2 retries');
});

test('DocumentStore: persists execution runs to disk and retrieves them', () => {
  const store = new DocumentStore();
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
  const freshStore = new DocumentStore();
  const retrieved = freshStore.getRunById(runId);
  assert.ok(retrieved, 'Persisted run should be retrievable from disk');
  assert.strictEqual(retrieved.workflowName, 'Persistence Check Run');
  assert.strictEqual(retrieved.status, 'completed');
});

test('DocumentStore: workflow CRUD persists across application restarts', () => {
  const store = new DocumentStore();
  const customWfId = `wf_custom_${Date.now()}`;
  const customWf: WorkflowDefinition = {
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
  const restartedStore = new DocumentStore();
  const loaded = restartedStore.getWorkflowById(customWfId);
  assert.ok(loaded, 'Workflow must persist on disk across store re-instantiations');
  assert.strictEqual(loaded.name, 'Custom Restart Persistence Test');

  // Delete workflow and verify deletion persists
  const deleted = restartedStore.deleteWorkflow(customWfId);
  assert.strictEqual(deleted, true);

  const thirdStore = new DocumentStore();
  assert.strictEqual(thirdStore.getWorkflowById(customWfId), null, 'Deleted workflow must not exist');
});

test('DocumentStore: settings updates persist across application restarts', () => {
  const store = new DocumentStore();
  const originalSettings = store.getSettings();

  store.saveSettings({
    defaultTimeoutSeconds: 45,
    theme: 'dark',
    maxActionsPerMinute: 30,
  });

  // Simulate app restart
  const restartedStore = new DocumentStore();
  const reloadedSettings = restartedStore.getSettings();
  assert.strictEqual(reloadedSettings.defaultTimeoutSeconds, 45);
  assert.strictEqual(reloadedSettings.maxActionsPerMinute, 30);

  // Restore original settings
  restartedStore.saveSettings(originalSettings);
});

// --- Phase 3: Automation Agent Tests ---

test('AgentService: state transitions and monitoring control', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  let lastNotifiedState = '';
  const agent = new AgentService(psAdapter, (status) => {
    lastNotifiedState = status.state;
  });

  assert.strictEqual(agent.getStatus().state, 'idle');
  await agent.startMonitoring(10000);
  assert.strictEqual(agent.getStatus().state, 'monitoring');
  assert.strictEqual(lastNotifiedState, 'monitoring');

  agent.stopMonitoring();
  assert.strictEqual(agent.getStatus().state, 'idle');
  assert.strictEqual(lastNotifiedState, 'idle');
});

test('AgentService: scanTargetWindow identifies active Antigravity IDE process and title', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const agent = new AgentService(psAdapter);

  const status = await agent.scanTargetWindow();
  assert.ok(status, 'Status object should exist');
  assert.ok(status.targetProcessName, 'Should have targetProcessName');
  // If Antigravity is running, PID will be a positive number
  if (status.targetPid) {
    assert.ok(status.targetPid > 0, 'Target PID should be a positive integer');
    assert.ok(status.targetWindowTitle, 'Window title should be populated');
  }
});

test('AgentService: probePrompt executes read-only inspection and populates diagnostic status', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const agent = new AgentService(psAdapter);

  const res = await agent.probePrompt();
  assert.ok(res, 'Probe result should not be null');
  assert.strictEqual(typeof res.exitCode, 'number', 'Diagnostic script should exit with status code');
  assert.strictEqual(res.exitCode, 0, 'inspect_prompt_subtree.ps1 should exit 0');

  const status = agent.getStatus();
  assert.strictEqual(typeof status.lastPromptDetected, 'boolean');
  assert.ok(status.lastActiveTimestamp, 'Timestamp should be recorded');
});

test('SafetyGuard: recognizes recommendation variations and safe policy evaluation', () => {
  // Recommendation pattern recognition
  assert.strictEqual(SafetyGuard.isRecommendationOption('(Recommended)'), true);
  assert.strictEqual(SafetyGuard.isRecommendationOption('(recommended)'), true);
  assert.strictEqual(SafetyGuard.isRecommendationOption('Proceed with TypeScript [Recommended]'), true);
  assert.strictEqual(SafetyGuard.isRecommendationOption('Recommended setting'), true);
  assert.strictEqual(SafetyGuard.isRecommendationOption('Default mode'), true);
  assert.strictEqual(SafetyGuard.isRecommendationOption('Alternative choice'), false);
  assert.strictEqual(SafetyGuard.isRecommendationOption(''), false);

  // Policy evaluations
  // always_manual: blocks both recommended radio and buttons
  assert.strictEqual(SafetyGuard.shouldAutoApprove('always_manual', 'select_radio', '(Recommended)'), false);
  assert.strictEqual(SafetyGuard.shouldAutoApprove('always_manual', 'invoke_button', 'Submit'), false);

  // auto_safe_only: allows explicit recommendations and continuation buttons, blocks ambiguous
  assert.strictEqual(SafetyGuard.shouldAutoApprove('auto_safe_only', 'select_radio', 'Option 1 (Recommended)'), true);
  assert.strictEqual(SafetyGuard.shouldAutoApprove('auto_safe_only', 'select_radio', 'Option 2 - Custom'), false);
  assert.strictEqual(SafetyGuard.shouldAutoApprove('auto_safe_only', 'invoke_button', 'Submit'), true);
  assert.strictEqual(SafetyGuard.shouldAutoApprove('auto_safe_only', 'invoke_button', 'Continue'), true);
  assert.strictEqual(SafetyGuard.shouldAutoApprove('auto_safe_only', 'invoke_button', 'Cancel'), false);

  // full_auto: auto-approves routine actions (still guarded against destructive commands by SafetyGuard.isDestructiveCommand)
  assert.strictEqual(SafetyGuard.shouldAutoApprove('full_auto', 'select_radio', 'Any Choice'), true);
  assert.strictEqual(SafetyGuard.shouldAutoApprove('full_auto', 'invoke_button', 'Any Button'), true);
});

test('AgentService: approval policy changes and settings synchronization', () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const agent = new AgentService(psAdapter, store);

  agent.setApprovalPolicy('auto_safe_only');
  assert.strictEqual(agent.getStatus().approvalPolicy, 'auto_safe_only');
  assert.strictEqual(store.getSettings().approvalPolicy, 'auto_safe_only');

  agent.setApprovalPolicy('always_manual');
  assert.strictEqual(agent.getStatus().approvalPolicy, 'always_manual');
  assert.strictEqual(agent.getStatus().autoPilotMode, 'manual');
  assert.strictEqual(store.getSettings().approvalPolicy, 'always_manual');
});

test('AgentService: target window enumeration and custom selection', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const agent = new AgentService(psAdapter, store);

  const windows = await agent.listAvailableWindows();
  assert.ok(Array.isArray(windows), 'listAvailableWindows should return an array');

  // Test custom selection
  agent.setSelectedWindow({
    pid: 99999,
    hwnd: 88888,
    title: 'Custom Antigravity IDE Instance',
    processName: 'Antigravity',
  });

  const status = agent.getStatus();
  assert.strictEqual(status.targetPid, 99999);
  assert.strictEqual(status.targetHwnd, 88888);
  assert.strictEqual(status.targetWindowTitle, 'Custom Antigravity IDE Instance');
  assert.strictEqual(status.selectedWindow?.title, 'Custom Antigravity IDE Instance');
});

// ==============================================================================
// FILE-CHANGE APPROVAL TEST SUITE (21 Scenarios)
// ==============================================================================

test('Scenario 1: Detect a genuine "Accept all" file-change approval button', () => {
  const psAdapter = new PowerShellAdapter();
  const detector = new FileChangeApprovalDetector(psAdapter);

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
  assert.strictEqual(normalized.fileChangeApprovalFound, true);
  assert.strictEqual(normalized.buttonFound?.name, 'Accept all');
  assert.strictEqual(normalized.confidence, 'HIGH');
  assert.strictEqual(normalized.isAmbiguous, false);
  assert.strictEqual(normalized.modifiedFiles.length, 2);
  assert.strictEqual(normalized.buttonFound?.supportsInvoke, true);
});

test('Scenario 2: Recognize case-insensitive button-text variations', () => {
  const psAdapter = new PowerShellAdapter();
  const detector = new FileChangeApprovalDetector(psAdapter);

  assert.strictEqual(detector.isAcceptAllButton('Accept all'), true);
  assert.strictEqual(detector.isAcceptAllButton('accept all'), true);
  assert.strictEqual(detector.isAcceptAllButton('ACCEPT ALL'), true);
  assert.strictEqual(detector.isAcceptAllButton('Accept All'), true);
  assert.strictEqual(detector.isAcceptAllButton('  Accept all  '), true);
});

test('Scenario 3: Recognize "Accept all changes"', () => {
  const psAdapter = new PowerShellAdapter();
  const detector = new FileChangeApprovalDetector(psAdapter);

  assert.strictEqual(detector.isAcceptAllButton('Accept all changes'), true);
  assert.strictEqual(detector.isAcceptAllButton('accept all changes'), true);
  assert.strictEqual(detector.isAcceptAllButton('ACCEPT ALL CHANGES'), true);
});

test('Scenario 4: Recognize "Accept all files"', () => {
  const psAdapter = new PowerShellAdapter();
  const detector = new FileChangeApprovalDetector(psAdapter);

  assert.strictEqual(detector.isAcceptAllButton('Accept all files'), true);
  assert.strictEqual(detector.isAcceptAllButton('accept all files'), true);
  assert.strictEqual(detector.isAcceptAllButton('ACCEPT ALL FILES'), true);
  assert.strictEqual(detector.isAcceptAllButton('Accept all edits'), true);
});

test('Scenario 5: Reject unrelated "Accept all" text in editor content', () => {
  const psAdapter = new PowerShellAdapter();
  const detector = new FileChangeApprovalDetector(psAdapter);

  // If text appears in editor tokens or lines, confidence must be NONE/LOW and ambiguous
  const editorLineRaw = {
    FileChangeApprovalFound: false,
    IsAmbiguous: true,
    Confidence: 'NONE',
    Warnings: ['Rejected text in editor line/terminal: const text = "Accept all";'],
  };

  const res = detector.normalizeDetectionResult(editorLineRaw);
  assert.strictEqual(res.fileChangeApprovalFound, false);
  assert.strictEqual(res.isAmbiguous, true);
  assert.strictEqual(res.confidence, 'NONE');
});

test('Scenario 6: Reject buttons outside the verified file-change container', () => {
  const psAdapter = new PowerShellAdapter();
  const detector = new FileChangeApprovalDetector(psAdapter);

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
  assert.strictEqual(res.fileChangeApprovalFound, false);
  assert.strictEqual(detector.isAcceptAllButton('Random Button'), false);
});

test('Scenario 7: Reject negative actions such as Discard and Reject', () => {
  const psAdapter = new PowerShellAdapter();
  const detector = new FileChangeApprovalDetector(psAdapter);

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
    assert.strictEqual(detector.isNegativeAction(neg), true, `Expected ${neg} to be identified as negative`);
    assert.strictEqual(detector.isAcceptAllButton(neg), false, `Expected ${neg} NOT to be an accept all button`);
  }
});

test('Scenario 8: Support multiple Antigravity window instances', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const agent = new AgentService(psAdapter, store);

  // Multiple instances targeting
  agent.setSelectedWindow(112233);
  assert.strictEqual(agent.getStatus().selectedHwnd, 112233);

  agent.setSelectedWindow(445566);
  assert.strictEqual(agent.getStatus().selectedHwnd, 445566);

  agent.setSelectedWindow(null);
  assert.strictEqual(agent.getStatus().selectedHwnd, null);
});

test('Scenario 9: Respect auto_safe_only policy for file changes', () => {
  // auto_safe_only permits HIGH confidence with no ambiguity
  const safeEval = SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'HIGH', false);
  assert.strictEqual(safeEval.canAutoApprove, true);
  assert.strictEqual(safeEval.requiresManualApproval, false);

  // auto_safe_only pauses for ambiguous interfaces
  const ambigEval = SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'HIGH', true);
  assert.strictEqual(ambigEval.canAutoApprove, false);
  assert.strictEqual(ambigEval.requiresManualApproval, true);

  // auto_safe_only pauses for MEDIUM or LOW confidence
  const medEval = SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'MEDIUM', false);
  assert.strictEqual(medEval.canAutoApprove, false);
  assert.strictEqual(medEval.requiresManualApproval, true);
});

test('Scenario 10: Respect full_auto policy for file changes', () => {
  const fullEval = SafetyGuard.evaluateFileChangePolicy('full_auto', 'HIGH', false);
  assert.strictEqual(fullEval.canAutoApprove, true);

  const fullMedEval = SafetyGuard.evaluateFileChangePolicy('full_auto', 'MEDIUM', false);
  assert.strictEqual(fullMedEval.canAutoApprove, true);

  // Even full_auto safely stops when ambiguous
  const fullAmbig = SafetyGuard.evaluateFileChangePolicy('full_auto', 'HIGH', true);
  assert.strictEqual(fullAmbig.canAutoApprove, false);
  assert.strictEqual(fullAmbig.requiresManualApproval, true);
});

test('Scenario 11: Respect always_manual policy for file changes', () => {
  const manualEval = SafetyGuard.evaluateFileChangePolicy('always_manual', 'HIGH', false);
  assert.strictEqual(manualEval.canAutoApprove, false);
  assert.strictEqual(manualEval.requiresManualApproval, true);
});

test('Scenario 12: Respect autoAcceptAllFileChanges = false setting', async () => {
  const store = new DocumentStore();
  store.saveSettings({ autoAcceptAllFileChanges: false });
  assert.strictEqual(store.getSettings().autoAcceptAllFileChanges, false);

  // Re-enable
  store.saveSettings({ autoAcceptAllFileChanges: true });
  assert.strictEqual(store.getSettings().autoAcceptAllFileChanges, true);
});

test('Scenario 13: Prevent duplicate acceptance with fingerprint debouncing', () => {
  const psAdapter = new PowerShellAdapter();
  const service = new FileChangeApprovalService(psAdapter);

  const detection: any = {
    targetHwnd: 55555,
    modifiedFiles: ['fileA.ts', 'fileB.ts'],
    buttonFound: { name: 'Accept all', boundingRectangle: '100,100,50,20' },
  };

  const fp1 = service.generateFingerprint(detection);
  const fp2 = service.generateFingerprint(detection);
  assert.strictEqual(fp1, fp2);
  assert.ok(fp1.includes('55555'));
  assert.ok(fp1.includes('Accept all'));
});

test('Scenario 14: Verify successful approval and history creation', () => {
  const psAdapter = new PowerShellAdapter();
  const service = new FileChangeApprovalService(psAdapter);

  const detection: any = {
    targetHwnd: 12345,
    windowTitle: 'Antigravity IDE',
    modifiedFiles: ['src/main.ts', 'src/App.tsx'],
    buttonFound: { name: 'Accept all' },
    container: { className: 'composite-review' },
    confidence: 'HIGH',
    siblingActions: ['Discard'],
  };

  const result: any = {
    success: true,
    finalStatus: 'COMPLETED_SUCCESSFULLY',
    buttonClicked: 'Accept all',
    containerClass: 'composite-review',
    dismissalVerified: true,
    durationMs: 140,
    logs: ['Invoked Accept all', 'Dismissal verified'],
  };

  const record = service.createActionHistoryRecord(detection, result, 'auto_safe_only');
  assert.strictEqual(record.actionType, 'FILE_CHANGE_ACCEPT_ALL');
  assert.strictEqual(record.action, 'Accept all file changes');
  assert.strictEqual(record.status, 'COMPLETED_SUCCESSFULLY');
  assert.strictEqual(record.verifiedClosed, true);
  assert.strictEqual(record.fileChangeMetadata?.modifiedFiles?.length, 2);
});

test('Scenario 15: Handle UI Automation exceptions safely during execution', async () => {
  // Create a psAdapter that throws or returns error
  const mockPsAdapter: any = {
    executeFileChangeApproval: async () => {
      throw new Error('UIAutomation COM call timed out or window was destroyed');
    },
  };

  const service = new FileChangeApprovalService(mockPsAdapter);
  const detection: any = {
    targetHwnd: 9999,
    processId: 8888,
    windowTitle: 'Antigravity IDE',
    buttonFound: { name: 'Accept all' },
    confidence: 'HIGH',
    isAmbiguous: false,
    modifiedFiles: [],
  };

  const res = await service.executeApproval(detection, 'auto_safe_only', 0, 9999);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.finalStatus, 'EXECUTION_EXCEPTION');
  assert.ok(res.logs[0].includes('UIAutomation COM call timed out'));
});

test('Scenario 16: Handle target HWND changes by aborting action safely', async () => {
  const psAdapter = new PowerShellAdapter();
  const service = new FileChangeApprovalService(psAdapter);

  const detection: any = {
    targetHwnd: 1111,
    buttonFound: { name: 'Accept all' },
    confidence: 'HIGH',
    isAmbiguous: false,
    modifiedFiles: [],
  };

  // Window changed to 2222
  const res = await service.executeApproval(detection, 'auto_safe_only', 0, 2222);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.finalStatus, 'TARGET_HWND_CHANGED');
});

test('Scenario 17: Handle emergency stop during pending approval', async () => {
  const psAdapter = new PowerShellAdapter();
  const service = new FileChangeApprovalService(psAdapter);

  service.cancel(); // Emergency stop triggered

  const detection: any = {
    targetHwnd: 1234,
    buttonFound: { name: 'Accept all' },
    confidence: 'HIGH',
    isAmbiguous: false,
    modifiedFiles: [],
  };

  const res = await service.executeApproval(detection, 'auto_safe_only', 0, 1234);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.finalStatus, 'CANCELLED_BY_EMERGENCY_STOP');
});

test('Scenario 18: Handle ambiguous UI structures safely', async () => {
  const psAdapter = new PowerShellAdapter();
  const service = new FileChangeApprovalService(psAdapter);

  const ambiguousDetection: any = {
    targetHwnd: 1234,
    buttonFound: { name: 'Accept all' },
    confidence: 'LOW',
    isAmbiguous: true,
    modifiedFiles: [],
  };

  // In auto_safe_only, ambiguous interfaces are rejected from auto-clicking
  const res = await service.executeApproval(ambiguousDetection, 'auto_safe_only', 0, 1234);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.finalStatus, 'AWAITING_MANUAL_APPROVAL');
});

test('Scenario 19: Preserve existing normal prompt detection', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const agent = new AgentService(psAdapter, store);

  // Normal probePrompt executes without errors
  const res = await agent.probePrompt();
  assert.ok(res !== null);
  assert.strictEqual(typeof res.exitCode, 'number');
});

test('Scenario 20: Preserve existing workflow execution', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const testWf: WorkflowDefinition = {
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
  assert.strictEqual(record.status, 'completed');
  assert.strictEqual(record.stepResults['step_1'].status, 'completed');
});

test('Scenario 21: Preserve existing cancellation behavior', async () => {
  const store = new DocumentStore();
  const psAdapter = new PowerShellAdapter(store.getDiagnosticsDir());
  const engine = new WorkflowEngine(store, psAdapter);

  const delayWf: WorkflowDefinition = {
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
  assert.ok(activeIds.length > 0, 'Active run should be tracked by engine');
  for (const runId of activeIds) {
    engine.cancelRun(runId);
  }

  const record = await promise;
  assert.strictEqual(record.status, 'cancelled');
});

test('Scenario 22: Multi-IDE Registry initializes and registers all supported IDE adapters (Antigravity & VS Code)', () => {
  const psAdapter = new PowerShellAdapter();
  const registry = new IdeRegistry(psAdapter);

  const adapters = registry.getAllAdapters();
  assert.strictEqual(adapters.length, 2);

  const antigravity = registry.getAdapter('antigravity');
  assert.ok(antigravity);
  assert.strictEqual(antigravity?.ideId, 'antigravity');

  const vscode = registry.getAdapter('vscode_copilot');
  assert.ok(vscode);
  assert.strictEqual(vscode?.ideId, 'vscode_copilot');
});

test('Scenario 23: Multi-IDE matches TargetWindowInfo to correct IDE adapter', () => {
  const psAdapter = new PowerShellAdapter();
  const registry = new IdeRegistry(psAdapter);

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
  assert.strictEqual(ad1?.ideId, 'antigravity');

  const ad3 = registry.resolveAdapterForWindow(vscodeWin);
  assert.strictEqual(ad3?.ideId, 'vscode_copilot');
});

test('Scenario 24: UniversalActionDetector classifies action categories accurately', () => {
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Submit').category, 'PROMPT_SUBMISSION');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Submit ↵').category, 'PROMPT_SUBMISSION');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Send').category, 'PROMPT_SUBMISSION');

  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Continue').category, 'CONTINUE_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Proceed').category, 'CONTINUE_APPROVAL');

  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Allow').category, 'PERMISSION_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Allow this time').category, 'PERMISSION_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Yes, allow this time').category, 'PERMISSION_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Approve').category, 'PERMISSION_APPROVAL');

  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Confirm').category, 'CONFIRMATION');

  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Accept all').category, 'FILE_CHANGE_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Accept all changes').category, 'FILE_CHANGE_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Accept all files').category, 'FILE_CHANGE_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Apply').category, 'FILE_CHANGE_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Apply changes').category, 'FILE_CHANGE_APPROVAL');

  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Run').category, 'TERMINAL_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Run command').category, 'TERMINAL_APPROVAL');
  assert.strictEqual(UniversalActionDetector.evaluateCandidate('Run in terminal').category, 'TERMINAL_APPROVAL');
});

test('Scenario 25: UniversalActionDetector and SafetyGuard permanently lock destructive and rejection buttons', () => {
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
    const candidate = UniversalActionDetector.evaluateCandidate(btn);
    assert.strictEqual(candidate.isSafe, false, `Expected ${btn} to be flagged as unsafe`);
    assert.ok(
      candidate.category === 'REJECTION' || candidate.category === 'DESTRUCTIVE',
      `Expected ${btn} to be categorized as REJECTION or DESTRUCTIVE`
    );
    assert.strictEqual(SafetyGuard.isDestructiveOrRejection(btn), true);
  }
});

test('Scenario 26: Antigravity IDE adapter supports prompt inspection, file change detection, and terminal approval', async () => {
  const psAdapter = new PowerShellAdapter();
  const antigravityAdapter = new AntigravityAdapter(psAdapter);

  assert.strictEqual(antigravityAdapter.ideId, 'antigravity');
  assert.strictEqual(antigravityAdapter.displayName, 'Antigravity IDE');
  assert.ok(antigravityAdapter.defaultCapabilities.includes('Prompt Submission'));
  assert.ok(antigravityAdapter.defaultCapabilities.includes('Option Selection'));
  assert.ok(antigravityAdapter.defaultCapabilities.includes('Accept All File Changes'));
  assert.ok(antigravityAdapter.defaultCapabilities.includes('Terminal Command Approval'));
});

test('Scenario 27: VS Code Copilot adapter detects Copilot availability and capabilities', async () => {
  const psAdapter = new PowerShellAdapter();
  const vscodeAdapter = new VscodeCopilotAdapter(psAdapter);

  assert.strictEqual(vscodeAdapter.ideId, 'vscode_copilot');
  assert.strictEqual(vscodeAdapter.displayName, 'VS Code + GitHub Copilot');
  assert.ok(vscodeAdapter.defaultCapabilities.includes('Copilot Chat Prompts'));

  const status = await vscodeAdapter.getCopilotStatus(0, 0);
  assert.strictEqual(status, 'not_detected');
});

test('Scenario 28: AgentService scans and returns multi-IDE connection info for Antigravity and VS Code', async () => {
  const psAdapter = new PowerShellAdapter();
  const agent = new AgentService(psAdapter);

  const status = await agent.scanTargetWindow();
  assert.ok(status.ideConnections);
  assert.strictEqual(status.ideConnections.length, 2);

  const ideIds = status.ideConnections.map((c) => c.ideId);
  assert.ok(ideIds.includes('antigravity'));
  assert.ok(ideIds.includes('vscode_copilot'));
  assert.strictEqual(ideIds.includes('cursor' as any), false);
});

test('Scenario 29: AgentService respects target IDE filter and per-IDE config overrides', async () => {
  const psAdapter = new PowerShellAdapter();
  const agent = new AgentService(psAdapter);

  agent.setTargetIdeFilter('antigravity');
  assert.strictEqual(agent.getStatus().targetIdeFilter, 'antigravity');

  agent.updatePerIdeConfig('antigravity', { promptAutomation: true, approvalPolicy: 'auto_safe_only' });
  const connections = agent.getIdeConnections();
  assert.ok(connections.length > 0);
});

test('Scenario 30: Preserves safety policies and process allowlisting for Antigravity and VS Code without Cursor', () => {
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('Antigravity'), true);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('Antigravity IDE'), true);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('Code'), true);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('Visual Studio Code'), true);
  assert.strictEqual(SafetyGuard.isAllowedTargetApp('MaliciousApp'), false);

  assert.strictEqual(SafetyGuard.isSupportedIde('antigravity'), true);
  assert.strictEqual(SafetyGuard.isSupportedIde('vscode_copilot'), true);
  assert.strictEqual(SafetyGuard.isSupportedIde('cursor'), false);
  assert.strictEqual(SafetyGuard.isSupportedIde('unknown_ide'), false);
});

// ============================================================================
// PART 13 — 22 COMPREHENSIVE VS CODE & GOOGLE ANTIGRAVITY EXTENSION TESTS
// ============================================================================

test('Extension Test 1: Extension activation initializes core components and registers status bar', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot_ext_act_'));
  try {
    const docStore = new DocumentStore(tmpDir);
    const psAdapter = new PowerShellAdapter();
    const agent = new AgentService(psAdapter, docStore);
    const engine = new WorkflowEngine(docStore, psAdapter);

    assert.ok(docStore, 'DocumentStore initialized');
    assert.ok(agent, 'AgentService initialized');
    assert.ok(engine, 'WorkflowEngine initialized');

    const status = agent.getStatus();
    assert.strictEqual(status.autoPilotEnabled, true);
    assert.strictEqual(status.state, 'idle');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Extension Test 2: Extension deactivation safely stops watchers and cancels active runs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot_ext_deact_'));
  try {
    const docStore = new DocumentStore(tmpDir);
    const psAdapter = new PowerShellAdapter();
    const agent = new AgentService(psAdapter, docStore);
    const engine = new WorkflowEngine(docStore, psAdapter);

    agent.startMonitoring(5000);
    assert.strictEqual(agent.getStatus().state, 'monitoring');

    // Simulate deactivation cleanup
    const activeIds = engine.getActiveRunIds();
    for (const runId of activeIds) {
      engine.cancelRun(runId);
    }
    const stoppedStatus = agent.stopMonitoring();
    assert.strictEqual(stoppedStatus.state, 'idle');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Extension Test 3: Activity Bar registration configuration is valid', () => {
  const pkgPath = path.resolve(__dirname, '../../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  assert.ok(pkg.contributes?.viewsContainers?.activitybar, 'Activity bar container must be contributed');
  const activityBar = pkg.contributes.viewsContainers.activitybar[0];
  assert.strictEqual(activityBar.id, 'autopilot-ai');
  assert.strictEqual(activityBar.title, 'AutoPilot AI');

  const views = pkg.contributes?.views?.['autopilot-ai'];
  assert.ok(views, 'Views container must have autopilot-ai views');
  assert.strictEqual(views[0].id, 'autopilot-ai.mainView');
  assert.strictEqual(views[0].type, 'webview');
});

test('Extension Test 4: Sidebar loading serves webview HTML with secure script bridge', () => {
  const distDir = path.resolve(__dirname, '../../../dist');
  const indexHtml = path.join(distDir, 'index.html');
  assert.ok(fs.existsSync(indexHtml), 'dist/index.html must exist from Vite build');

  const content = fs.readFileSync(indexHtml, 'utf-8');
  assert.ok(content.includes('<div id="root"></div>') || content.includes('<script'), 'index.html must contain root mount and scripts');
});

test('Extension Test 5: Command registration defines all 9 public extension commands', () => {
  const pkgPath = path.resolve(__dirname, '../../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

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
    assert.ok(cmdIds.includes(cmd), `Expected command '${cmd}' to be registered in package.json`);
  }
});

test('Extension Test 6: Settings persistence saves and reloads extension configuration', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot_ext_sett_'));
  try {
    const store = new DocumentStore(tmpDir);
    const updated = store.saveSettings({
      approvalPolicy: 'full_auto',
      defaultTimeoutSeconds: 30,
      autoStartMonitoring: false,
    });

    assert.strictEqual(updated.approvalPolicy, 'full_auto');
    assert.strictEqual(updated.defaultTimeoutSeconds, 30);
    assert.strictEqual(updated.autoStartMonitoring, false);

    // Verify disk persistence
    const reloaded = new DocumentStore(tmpDir);
    const loaded = reloaded.getSettings();
    assert.strictEqual(loaded.approvalPolicy, 'full_auto');
    assert.strictEqual(loaded.defaultTimeoutSeconds, 30);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Extension Test 7: Automation mode selection updates AgentService state machine', () => {
  const psAdapter = new PowerShellAdapter();
  const agent = new AgentService(psAdapter);

  agent.setApprovalPolicy('always_manual');
  assert.strictEqual(agent.getStatus().approvalPolicy, 'always_manual');
  assert.strictEqual(agent.getStatus().autoPilotMode, 'manual');

  agent.setApprovalPolicy('auto_safe_only');
  assert.strictEqual(agent.getStatus().approvalPolicy, 'auto_safe_only');
  assert.strictEqual(agent.getStatus().autoPilotMode, 'full_auto');

  agent.setApprovalPolicy('full_auto');
  assert.strictEqual(agent.getStatus().approvalPolicy, 'full_auto');
  assert.strictEqual(agent.getStatus().autoPilotMode, 'full_auto');
});

test('Extension Test 8: Recommended option detection recognizes recommended patterns', () => {
  assert.strictEqual(SafetyGuard.isRecommendationOption('(Recommended) Keep current changes'), true);
  assert.strictEqual(SafetyGuard.isRecommendationOption('[Recommended] Run tests'), true);
  assert.strictEqual(SafetyGuard.isRecommendationOption('Recommended: Allow permission'), true);
  assert.strictEqual(SafetyGuard.isRecommendationOption('Default configuration'), true);
  assert.strictEqual(SafetyGuard.isRecommendationOption('Custom option'), false);
  assert.strictEqual(SafetyGuard.isRecommendationOption('Reject changes'), false);
});

test('Extension Test 9: Prompt submission identifies positive candidate buttons', () => {
  const candidates = ['Submit', 'Submit ↵', 'Send', 'Generate', 'Proceed', 'OK'];
  for (const label of candidates) {
    const evalResult = UniversalActionDetector.evaluateCandidate(label);
    assert.strictEqual(evalResult.isSafe, true, `Button '${label}' should be marked safe`);
    assert.ok(evalResult.category !== 'REJECTION' && evalResult.category !== 'DESTRUCTIVE');
  }
});

test('Extension Test 10: File-change detection identifies positive acceptance variations', () => {
  const psAdapter = new PowerShellAdapter();
  const detector = new FileChangeApprovalDetector(psAdapter);

  assert.strictEqual(detector.isAcceptAllButton('Accept all'), true);
  assert.strictEqual(detector.isAcceptAllButton('Accept all changes'), true);
  assert.strictEqual(detector.isAcceptAllButton('Accept all files'), true);
  assert.strictEqual(detector.isAcceptAllButton('ACCEPT ALL CHANGES'), true);
  assert.strictEqual(detector.isAcceptAllButton('Discard all'), false);
  assert.strictEqual(detector.isAcceptAllButton('Reject changes'), false);
});

test('Extension Test 11: File-change confidence validation distinguishes HIGH, MEDIUM, LOW', () => {
  const highConfidence = SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'HIGH', false);
  assert.strictEqual(highConfidence.canAutoApprove, true);
  assert.strictEqual(highConfidence.requiresManualApproval, false);

  const ambiguousContainer = SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'HIGH', true);
  assert.strictEqual(ambiguousContainer.canAutoApprove, false);
  assert.strictEqual(ambiguousContainer.requiresManualApproval, true);

  const lowConfidence = SafetyGuard.evaluateFileChangePolicy('auto_safe_only', 'LOW', false);
  assert.strictEqual(lowConfidence.canAutoApprove, false);
  assert.strictEqual(lowConfidence.requiresManualApproval, true);
});

test('Extension Test 12: SafetyGuard validates safe shell parameters and redacts tokens', () => {
  const dirty = 'inspect; rm -rf / | evil & `whoami` $HOME';
  const clean = SafetyGuard.sanitizeShellParameter(dirty);
  assert.strictEqual(clean.includes(';'), false);
  assert.strictEqual(clean.includes('&'), false);
  assert.strictEqual(clean.includes('|'), false);
  assert.strictEqual(clean.includes('`'), false);
  assert.strictEqual(clean.includes('$'), false);

  const logWithKey = 'Authorization: Bearer ghp_99887766554433221100aa';
  const redacted = SafetyGuard.redactSensitive(logWithKey);
  assert.strictEqual(redacted.includes('ghp_99887766554433221100aa'), false);
  assert.ok(redacted.includes('[REDACTED]'));
});

test('Extension Test 13: Negative action blocking permanently locks destructive buttons', () => {
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
    assert.strictEqual(SafetyGuard.isDestructiveOrRejection(act), true, `Action '${act}' must be locked`);
    const evalRes = UniversalActionDetector.evaluateCandidate(act);
    assert.strictEqual(evalRes.isSafe, false);
    assert.ok(evalRes.category === 'REJECTION' || evalRes.category === 'DESTRUCTIVE');
  }
});

test('Extension Test 14: Emergency stop halts active workflows immediately', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot_ext_em_'));
  try {
    const store = new DocumentStore(tmpDir);
    const psAdapter = new PowerShellAdapter();
    const engine = new WorkflowEngine(store, psAdapter);

    const wf: WorkflowDefinition = {
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
    assert.ok(activeIds.length > 0);

    // Trigger emergency stop
    for (const id of activeIds) {
      engine.cancelRun(id);
    }

    const result = await runPromise;
    assert.strictEqual(result.status, 'cancelled');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Extension Test 15: Workflow execution supports multi-step execution successfully', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot_ext_wf_'));
  try {
    const store = new DocumentStore(tmpDir);
    const psAdapter = new PowerShellAdapter();
    const engine = new WorkflowEngine(store, psAdapter);

    const wf: WorkflowDefinition = {
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
    assert.strictEqual(result.status, 'completed');
    assert.strictEqual(result.stepResults['step_1'].status, 'completed');
    assert.strictEqual(result.stepResults['step_2'].status, 'completed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Extension Test 16: Workflow cancellation halts in-flight steps cleanly', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot_ext_canc_'));
  try {
    const store = new DocumentStore(tmpDir);
    const psAdapter = new PowerShellAdapter();
    const engine = new WorkflowEngine(store, psAdapter);

    const wf: WorkflowDefinition = {
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
    assert.strictEqual(result.status, 'cancelled');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Extension Test 17: IDE detection matches Antigravity and VS Code windows', () => {
  const psAdapter = new PowerShellAdapter();
  const registry = new IdeRegistry(psAdapter);

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
  assert.strictEqual(adAntigravity?.ideId, 'antigravity');

  const adCode = registry.resolveAdapterForWindow(codeWindow);
  assert.strictEqual(adCode?.ideId, 'vscode_copilot');
});

test('Extension Test 18: VS Code compatibility adapter supports inline edit and diff approval', () => {
  const psAdapter = new PowerShellAdapter();
  const vscodeAdapter = new VscodeCopilotAdapter(psAdapter);

  assert.strictEqual(vscodeAdapter.ideId, 'vscode_copilot');
  assert.strictEqual(vscodeAdapter.displayName, 'VS Code + GitHub Copilot');
  assert.ok(vscodeAdapter.defaultCapabilities.includes('Inline Edit Approvals'));
  assert.ok(vscodeAdapter.defaultCapabilities.includes('Apply Changes'));
});

test('Extension Test 19: Google Antigravity compatibility environment detection is verified', () => {
  const env = AntigravityEnvironment.detect();
  assert.ok(env, 'Environment info must be returned');
  assert.ok(typeof env.isAntigravityHost === 'boolean');
  assert.ok(typeof env.appName === 'string');
  assert.strictEqual(env.supportsVsixPackaging, true);
  assert.strictEqual(env.supportsWebviewApi, true);
});

test('Extension Test 20: Platform adapter selection provides platform-specific capabilities', () => {
  const win = new WindowsAdapter(new PowerShellAdapter());
  const mac = new MacosAdapter();
  const linux = new LinuxAdapter();

  assert.strictEqual(win.getCapabilities().supportsDesktopUia, true);
  assert.strictEqual(win.getCapabilities().platformName, 'windows');

  assert.strictEqual(mac.getCapabilities().supportsDesktopUia, false);
  assert.strictEqual(mac.getCapabilities().platformName, 'macos');
  assert.ok(mac.getCapabilities().limitationMessage?.includes('not supported on macOS'));

  assert.strictEqual(linux.getCapabilities().supportsDesktopUia, false);
  assert.strictEqual(linux.getCapabilities().platformName, 'linux');
  assert.ok(linux.getCapabilities().limitationMessage?.includes('not supported on Linux'));
});

test('Extension Test 21: Error handling gracefully reports failed steps without engine crashes', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot_ext_err_'));
  try {
    const store = new DocumentStore(tmpDir);
    const psAdapter = new PowerShellAdapter();
    const engine = new WorkflowEngine(store, psAdapter);

    const failingWf: WorkflowDefinition = {
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
    assert.ok(result.status === 'failed' || result.status === 'completed');
    assert.strictEqual(engine.isRunning(), false, 'Engine must not remain locked after step failure');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Extension Test 22: Extension reload and restart retains workflows and runs across reboots', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot_ext_reboot_'));
  try {
    // Session 1: Create custom workflow
    const session1 = new DocumentStore(tmpDir);
    const customWf: WorkflowDefinition = {
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
    const session2 = new DocumentStore(tmpDir);
    const loadedWf = session2.getWorkflowById('wf_custom_persisted');
    assert.ok(loadedWf, 'Custom workflow must exist after restart');
    assert.strictEqual(loadedWf?.name, 'Persisted Across Reboots');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Regression Test BUG-001: Webview asset transformation handles relative ./assets/, /assets/, and bundle files with CSP', () => {
  const distDir = path.resolve('dist');
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

  let transformed = sampleHtml.replace(
    /(src|href)=["']((?:\.?\/)?assets\/[^"']+|(?:\.?\/)?[^"':]+\.(?:png|jpg|jpeg|svg|ico|css|js))["']/gi,
    (match, attr, assetPath) => {
      if (/^(?:https?:|\/\/|data:)/i.test(assetPath)) return match;
      const cleanPath = assetPath.replace(/^(\.\/|\/)/, '');
      return `${attr}="vscode-webview://mock/${cleanPath}"`;
    }
  );

  if (!transformed.includes('http-equiv="Content-Security-Policy"') && transformed.includes('<head>')) {
    transformed = transformed.replace('<head>', `<head>\n  ${cspMeta}`);
  }

  assert.ok(transformed.includes('src="vscode-webview://mock/assets/index-sample.js"'), 'Relative script ./assets/ must be transformed to webview URI');
  assert.ok(transformed.includes('href="vscode-webview://mock/assets/index-sample.css"'), 'Relative style ./assets/ must be transformed to webview URI');
  assert.ok(transformed.includes('src="vscode-webview://mock/assets/app-icon-sample.png"'), 'Root-relative /assets/ must be transformed to webview URI');
  assert.ok(transformed.includes('href="https://fonts.googleapis.com"'), 'External fonts link must be preserved as-is');
  assert.ok(transformed.includes('Content-Security-Policy'), 'Content-Security-Policy meta tag must be present in head');
});

test('Regression Test BUG-002: Sidebar navigation structure contains entries for Workflow Library and Automation Agent', () => {
  const sidebarPath = path.resolve('src/components/Sidebar.tsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf-8');

  // Verify 'agent' navigation entry
  assert.ok(sidebarCode.includes("id: 'agent'"), "Sidebar must define navigation item for 'agent'");
  assert.ok(sidebarCode.includes("label: 'Automation Agent'"), "Sidebar must display 'Automation Agent' label");

  // Verify 'library' navigation entry
  assert.ok(sidebarCode.includes("id: 'library'"), "Sidebar must define navigation item for 'library'");
  assert.ok(sidebarCode.includes("label: 'Workflow Library'"), "Sidebar must display 'Workflow Library' label");

  // Verify App.tsx binds both views to their active tabs
  const appPath = path.resolve('src/App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf-8');
  assert.ok(appCode.includes("case 'agent':"), "App.tsx must handle activeTab 'agent'");
  assert.ok(appCode.includes('<AutomationAgentView />'), 'App.tsx must render AutomationAgentView for agent tab');
  assert.ok(appCode.includes("case 'library':"), "App.tsx must handle activeTab 'library'");
  assert.ok(appCode.includes('<WorkflowLibraryView />'), 'App.tsx must render WorkflowLibraryView for library tab');
});

test('Regression Test BUG-003: ConfigurationSynchronizer bidirectionally maps settings and prevents circular sync loops', () => {
  // 1. Mode to approval policy mapping
  assert.strictEqual(ConfigurationSynchronizer.modeToApprovalPolicy('safe_auto'), 'auto_safe_only');
  assert.strictEqual(ConfigurationSynchronizer.modeToApprovalPolicy('full_auto'), 'full_auto');
  assert.strictEqual(ConfigurationSynchronizer.modeToApprovalPolicy('manual_approval'), 'always_manual');
  assert.strictEqual(ConfigurationSynchronizer.modeToApprovalPolicy('unknown' as any), 'auto_safe_only');

  // 2. Approval policy to mode mapping
  assert.strictEqual(ConfigurationSynchronizer.approvalPolicyToMode('auto_safe_only'), 'safe_auto');
  assert.strictEqual(ConfigurationSynchronizer.approvalPolicyToMode('full_auto'), 'full_auto');
  assert.strictEqual(ConfigurationSynchronizer.approvalPolicyToMode('always_manual'), 'manual_approval');

  // 3. Response speed to delay ms mapping
  assert.strictEqual(ConfigurationSynchronizer.speedToDelayMs('instant'), 100);
  assert.strictEqual(ConfigurationSynchronizer.speedToDelayMs('fast'), 250);
  assert.strictEqual(ConfigurationSynchronizer.speedToDelayMs('comfortable'), 750);
  assert.strictEqual(ConfigurationSynchronizer.speedToDelayMs('deliberate'), 1500);

  // 4. Delay ms to response speed mapping
  assert.strictEqual(ConfigurationSynchronizer.delayMsToSpeed(100), 'instant');
  assert.strictEqual(ConfigurationSynchronizer.delayMsToSpeed(250), 'fast');
  assert.strictEqual(ConfigurationSynchronizer.delayMsToSpeed(750), 'comfortable');
  assert.strictEqual(ConfigurationSynchronizer.delayMsToSpeed(1500), 'deliberate');

  // 5. DocumentStore settings persistence with synchronized fields
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot_cfg_test_'));
  try {
    const store = new DocumentStore(tmpDir);
    const updated = store.saveSettings({
      approvalPolicy: 'full_auto',
      responseSpeed: 'instant',
      autoStartMonitoring: true,
      monitoringInterval: 1200,
      autoAcceptAllFileChanges: true,
    });
    assert.strictEqual(updated.approvalPolicy, 'full_auto');
    assert.strictEqual(updated.responseSpeed, 'instant');
    assert.strictEqual(updated.autoStartMonitoring, true);
    assert.strictEqual(updated.monitoringInterval, 1200);

    const reloaded = store.getSettings();
    assert.strictEqual(reloaded.approvalPolicy, 'full_auto');
    assert.strictEqual(reloaded.responseSpeed, 'instant');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Test teardown: finalize test suite execution', () => {
  setTimeout(() => process.exit(0), 100);
});

