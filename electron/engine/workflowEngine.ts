import {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowExecutionRecord,
  StepExecutionResult,
  ExecutionStatus,
} from './types';
import { StepRunners, StepContext } from './stepRunners';
import { PowerShellAdapter } from '../adapters/powershellAdapter';
import { DocumentStore } from '../storage/documentStore';
import { SafetyGuard } from '../security/safetyGuard';

export type WorkflowEventCallback = (event: {
  type: 'run_started' | 'step_started' | 'step_completed' | 'log' | 'approval_required' | 'run_completed';
  runId: string;
  data: any;
}) => void;

export class WorkflowEngine {
  private activeRuns: Map<string, { record: WorkflowExecutionRecord; cancelled: boolean }> = new Map();
  private pendingApprovals: Map<string, { resolve: (approved: boolean) => void; prompt: string }> = new Map();
  private isTargetLocked: boolean = false;

  constructor(
    private docStore: DocumentStore,
    private psAdapter: PowerShellAdapter,
    private eventEmitter?: WorkflowEventCallback
  ) {}

  public isRunning(): boolean {
    return this.isTargetLocked || this.activeRuns.size > 0;
  }

  public getActiveRun(runId: string): WorkflowExecutionRecord | undefined {
    return this.activeRuns.get(runId)?.record;
  }

  public getActiveRunIds(): string[] {
    return Array.from(this.activeRuns.keys());
  }

  public cancelRun(runId: string): boolean {
    const active = this.activeRuns.get(runId);
    if (!active) return false;
    active.cancelled = true;
    active.record.status = 'cancelled';
    active.record.endTime = new Date().toISOString();
    active.record.durationMs = Date.now() - new Date(active.record.startTime).getTime();
    this.addLog(active.record, 'Workflow execution cancelled by user.', 'warn');
    this.docStore.saveRun(active.record);
    this.emit('run_completed', runId, { status: 'cancelled' });
    this.isTargetLocked = false;
    return true;
  }

  public respondToApproval(stepId: string, approved: boolean): boolean {
    const pending = this.pendingApprovals.get(stepId);
    if (!pending) return false;
    pending.resolve(approved);
    this.pendingApprovals.delete(stepId);
    return true;
  }

  public async executeWorkflow(
    workflow: WorkflowDefinition,
    triggeredBy: 'manual' | 'agent' | 'scheduler' = 'manual'
  ): Promise<WorkflowExecutionRecord> {
    if (this.isTargetLocked) {
      throw new Error(`Target desktop automation queue is locked by another running workflow.`);
    }

    // Safety validation
    const valResult = SafetyGuard.validateWorkflowSchema(workflow);
    if (!valResult.valid) {
      throw new Error(`Invalid workflow definition: ${valResult.errors.join('; ')}`);
    }

    this.isTargetLocked = true;
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: WorkflowExecutionRecord = {
      id: runId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'running',
      startTime: new Date().toISOString(),
      triggeredBy,
      stepResults: {},
      logs: [],
    };

    const state = { record, cancelled: false };
    this.activeRuns.set(runId, state);
    this.docStore.saveRun(record);
    this.addLog(record, `Starting workflow execution: '${workflow.name}' (${workflow.steps.length} steps)...`, 'info');
    this.emit('run_started', runId, record);

    const stepMap = new Map(workflow.steps.map(s => [s.id, s]));
    let currentStepIndex = 0;

    try {
      while (currentStepIndex < workflow.steps.length) {
        if (state.cancelled) {
          record.status = 'cancelled';
          break;
        }

        const step: WorkflowStep | undefined = workflow.steps[currentStepIndex];
        if (!step) break;

        if (!step.enabled) {
          this.addLog(record, `Skipping disabled step: '${step.name}'`, 'info');
          record.stepResults[step.id] = {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'skipped',
            startTime: new Date().toISOString(),
            retryCount: 0,
            logs: ['Step is disabled in workflow configuration'],
          };
          currentStepIndex++;
          continue;
        }

        record.currentStepId = step.id;
        this.emit('step_started', runId, { stepId: step.id, stepName: step.name });

        // Enforce approval policy: under 'always_manual', interactive mutations require user approval.
        // Under 'auto_safe_only', explicit recommended options proceed automatically, while ambiguous actions pause.
        const effectivePolicy = workflow.approvalPolicy || 'always_manual';
        const interactiveActions = ['select_radio', 'invoke_button'];
        let requiresApproval = false;
        let approvalPrompt = '';

        if (interactiveActions.includes(step.type)) {
          const target = step.config.targetSubstring || step.config.targetButtonText || '';
          if (!SafetyGuard.shouldAutoApprove(effectivePolicy, step.type, target)) {
            requiresApproval = true;
            approvalPrompt = `Approval required: Action '${step.name}' (${step.type} '${target}') is not auto-approved under ${effectivePolicy} policy.`;
          }
        }

        if (requiresApproval) {
          this.addLog(record, approvalPrompt, 'warn', step.id);
          const approved = await new Promise<boolean>((resolve) => {
            this.pendingApprovals.set(step.id, { resolve, prompt: approvalPrompt });
            this.emit('approval_required', record.id, { stepId: step.id, prompt: approvalPrompt });
          });
          if (!approved) {
            record.stepResults[step.id] = {
              stepId: step.id,
              stepName: step.name,
              type: step.type,
              status: 'failed',
              startTime: new Date().toISOString(),
              retryCount: 0,
              error: 'Execution denied by user approval policy.',
              logs: [`User rejected interactive step under ${effectivePolicy} policy.`],
            };
            record.status = 'failed';
            record.error = `Action '${step.name}' rejected by user.`;
            break;
          }
        }

        const stepResult = await this.executeStepWithRetries(step, record, state);
        record.stepResults[step.id] = stepResult;
        this.emit('step_completed', runId, stepResult);

        if (state.cancelled || record.status === 'cancelled') {
          record.status = 'cancelled';
          break;
        }

        if (stepResult.status === 'failed') {
          if (step.onFailureGoto && stepMap.has(step.onFailureGoto)) {
            const targetIdx = workflow.steps.findIndex(s => s.id === step.onFailureGoto);
            currentStepIndex = targetIdx !== -1 ? targetIdx : workflow.steps.length;
            this.addLog(record, `Step failed; branching via onFailureGoto to '${step.onFailureGoto}' (index ${currentStepIndex})`, 'warn');
          } else {
            record.status = 'failed';
            record.error = stepResult.error || `Step '${step.name}' failed.`;
            break;
          }
        } else {
          const gotoId = stepResult.output?.nextStepId || step.onSuccessGoto;
          if (gotoId && stepMap.has(gotoId)) {
            const targetIdx = workflow.steps.findIndex(s => s.id === gotoId);
            currentStepIndex = targetIdx !== -1 ? targetIdx : workflow.steps.length;
            this.addLog(record, `Branching to step '${gotoId}' (index ${currentStepIndex})`, 'info');
          } else {
            currentStepIndex++;
          }
        }
      }

      if (record.status === 'running') {
        record.status = 'completed';
        this.addLog(record, `Workflow '${workflow.name}' completed successfully.`, 'info');
      }
    } catch (err: any) {
      record.status = 'failed';
      record.error = err.message || 'Unexpected execution error';
      this.addLog(record, `Execution halted with exception: ${record.error}`, 'error');
    } finally {
      record.endTime = new Date().toISOString();
      record.durationMs = Date.now() - new Date(record.startTime).getTime();
      this.docStore.saveRun(record);
      this.activeRuns.delete(runId);
      this.isTargetLocked = false;
      this.emit('run_completed', runId, record);
    }

    return record;
  }

  private async executeStepWithRetries(
    step: any,
    record: WorkflowExecutionRecord,
    state: { cancelled: boolean }
  ): Promise<StepExecutionResult> {
    const handler = StepRunners[step.type];
    if (!handler) {
      return {
        stepId: step.id,
        stepName: step.name,
        type: step.type,
        status: 'failed',
        startTime: new Date().toISOString(),
        retryCount: 0,
        error: `No handler registered for step type '${step.type}'`,
        logs: [`Unsupported action: ${step.type}`],
      };
    }

    let attempts = 0;
    const maxAttempts = (step.retryLimit || 0) + 1;
    const stepLogs: string[] = [];

    const ctx: StepContext = {
      workflowId: record.workflowId,
      runId: record.id,
      stepResults: record.stepResults,
      onLog: (msg, level = 'info') => {
        const line = `[${step.name}] ${msg}`;
        stepLogs.push(line);
        this.addLog(record, line, level, step.id);
      },
      requestUserApproval: (stepId, prompt) => {
        return new Promise((resolve) => {
          this.pendingApprovals.set(stepId, { resolve, prompt });
          this.emit('approval_required', record.id, { stepId, prompt });
        });
      },
      isCancelled: () => state.cancelled,
    };

    while (attempts < maxAttempts) {
      attempts++;
      const startTime = new Date().toISOString();
      const startMs = Date.now();

      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      try {
        const timeoutPromise = new Promise<{ error: string }>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`Step timed out after ${step.timeoutSeconds}s`)), step.timeoutSeconds * 1000);
        });

        const res = await Promise.race([handler(step, ctx, this.psAdapter), timeoutPromise]) as any;
        if (timeoutHandle) clearTimeout(timeoutHandle);

        if (state.cancelled) {
          return {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'cancelled',
            startTime,
            endTime: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            retryCount: attempts - 1,
            logs: [...stepLogs, 'Execution cancelled by user.'],
          };
        }

        if (res.error) {
          if (attempts < maxAttempts) {
            ctx.onLog(`Attempt ${attempts} failed: ${res.error}. Retrying...`, 'warn');
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          return {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'failed',
            startTime,
            endTime: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            retryCount: attempts - 1,
            error: res.error,
            logs: stepLogs,
          };
        }

        return {
          stepId: step.id,
          stepName: step.name,
          type: step.type,
          status: 'completed',
          startTime,
          endTime: new Date().toISOString(),
          durationMs: Date.now() - startMs,
          retryCount: attempts - 1,
          output: res.output,
          logs: stepLogs,
        };
      } catch (err: any) {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (state.cancelled) {
          return {
            stepId: step.id,
            stepName: step.name,
            type: step.type,
            status: 'cancelled',
            startTime,
            endTime: new Date().toISOString(),
            durationMs: Date.now() - startMs,
            retryCount: attempts - 1,
            logs: [...stepLogs, 'Execution cancelled by user.'],
          };
        }
        if (attempts < maxAttempts) {
          ctx.onLog(`Attempt ${attempts} threw error: ${err.message}. Retrying...`, 'warn');
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return {
          stepId: step.id,
          stepName: step.name,
          type: step.type,
          status: 'failed',
          startTime,
          endTime: new Date().toISOString(),
          durationMs: Date.now() - startMs,
          retryCount: attempts - 1,
          error: err.message,
          logs: stepLogs,
        };
      }
    }

    return {
      stepId: step.id,
      stepName: step.name,
      type: step.type,
      status: 'failed',
      startTime: new Date().toISOString(),
      retryCount: attempts,
      error: 'Max retries exceeded',
      logs: stepLogs,
    };
  }

  private addLog(
    record: WorkflowExecutionRecord,
    message: string,
    level: 'info' | 'warn' | 'error' | 'debug' = 'info',
    stepId?: string
  ): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: SafetyGuard.redactSensitive(message),
      stepId,
    };
    record.logs.push(entry);
    this.emit('log', record.id, entry);
  }

  private emit(type: any, runId: string, data: any): void {
    if (this.eventEmitter) {
      this.eventEmitter({ type, runId, data });
    }
  }
}
