import type { EngineLogger } from '../../lib/logger.js';
import type { FlowBlockInput, FlowConnectionInput } from '../flows/flows.schemas.js';
import { runBlock } from './blocks/index.js';

export type BlockCategory = 'trigger' | 'logic' | 'action' | 'output';

export interface ExecutionLog {
  blockId: string;
  blockLabel: string;
  blockCategory: BlockCategory;
  status: 'success' | 'failed' | 'skipped' | 'running';
  message: string;
  timestamp: string;
  duration: number;
  output?: unknown;
}

export interface ExecutionContext {
  data: Record<string, unknown>;
  variables: Record<string, unknown>;
  previousOutput: unknown;
  logs: ExecutionLog[];
  triggeredBy: 'manual' | 'webhook' | 'schedule' | 'retry';
  logger: EngineLogger;
}

export interface FlowDefinition {
  id: string;
  name: string;
  blocks: FlowBlockInput[];
  connections: FlowConnectionInput[];
}

export interface EngineResult {
  status: 'success' | 'failed';
  logs: ExecutionLog[];
  stepsCompleted: number;
  totalSteps: number;
  error?: string;
  finalData: Record<string, unknown>;
  variables: Record<string, unknown>;
}

export async function executeFlow(
  flow: FlowDefinition,
  opts: {
    triggeredBy: 'manual' | 'webhook' | 'schedule' | 'retry';
    triggerPayload?: unknown;
    logger: EngineLogger;
  },
): Promise<EngineResult> {
  const triggers = flow.blocks.filter((b) => b.category === 'trigger');
  if (triggers.length === 0) {
    return {
      status: 'failed',
      logs: [],
      stepsCompleted: 0,
      totalSteps: 0,
      error: 'Flow needs at least one Trigger block',
      finalData: {},
      variables: {},
    };
  }

  const initialData = resolveInitialData(triggers[0]!, opts.triggerPayload);
  const ctx: ExecutionContext = {
    data: { ...initialData },
    variables: {},
    previousOutput: initialData,
    logs: [],
    triggeredBy: opts.triggeredBy,
    logger: opts.logger,
  };

  const ordered = getExecutionOrder(flow);

  let status: 'success' | 'failed' = 'success';
  let stepsCompleted = 0;
  let lastError: string | undefined;

  for (let i = 0; i < ordered.length; i++) {
    const block = ordered[i]!;
    const start = Date.now();
    try {
      const output = await runBlock(block, ctx);
      ctx.previousOutput = output;
      if (output != null && typeof output === 'object' && !Array.isArray(output) && !('_clientAction' in output)) {
        ctx.data = { ...ctx.data, ...(output as Record<string, unknown>) };
      }
      ctx.logs.push({
        blockId: block.id,
        blockLabel: block.label,
        blockCategory: block.category,
        status: 'success',
        message: buildSuccessMessage(block.definitionId, output),
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
        output,
      });
      stepsCompleted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logs.push({
        blockId: block.id,
        blockLabel: block.label,
        blockCategory: block.category,
        status: 'failed',
        message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - start,
      });
      for (const rest of ordered.slice(i + 1)) {
        ctx.logs.push({
          blockId: rest.id,
          blockLabel: rest.label,
          blockCategory: rest.category,
          status: 'skipped',
          message: 'Skipped due to previous failure',
          timestamp: new Date().toISOString(),
          duration: 0,
        });
      }
      status = 'failed';
      lastError = message;
      break;
    }
  }

  return {
    status,
    logs: ctx.logs,
    stepsCompleted,
    totalSteps: ordered.length,
    error: lastError,
    finalData: ctx.data,
    variables: ctx.variables,
  };
}

function resolveInitialData(trigger: FlowBlockInput, override: unknown): Record<string, unknown> {
  if (override != null && typeof override === 'object') {
    return override as Record<string, unknown>;
  }
  const payload = trigger.properties.find((p) => p.key === 'payload')?.value;
  if (!payload) return {};
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof payload === 'object') return payload as Record<string, unknown>;
  return {};
}

function getExecutionOrder(flow: FlowDefinition): FlowBlockInput[] {
  const visited = new Set<string>();
  const ordered: FlowBlockInput[] = [];
  const triggers = flow.blocks.filter((b) => b.category === 'trigger');
  const queue = triggers.map((t) => t.id);

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const block = flow.blocks.find((b) => b.id === id);
    if (block) ordered.push(block);
    flow.connections.filter((c) => c.sourceId === id).forEach((c) => queue.push(c.targetId));
  }
  // Disconnected blocks
  flow.blocks.filter((b) => !visited.has(b.id)).forEach((b) => ordered.push(b));
  return ordered;
}

function buildSuccessMessage(definitionId: string, output: unknown): string {
  const o = output as Record<string, unknown> | undefined;
  switch (definitionId) {
    case 'manual-trigger':
      return 'Flow triggered manually';
    case 'webhook-trigger':
      return 'Webhook received';
    case 'schedule-trigger':
      return 'Schedule triggered';
    case 'if-else':
      return `Condition → ${o?.['conditionMet'] ? 'TRUE' : 'FALSE'}`;
    case 'filter':
      return `Filter: ${o?.['conditionMet'] ? 'passed' : 'blocked'}`;
    case 'delay':
      return `Waited ${o?.['delayed']}s`;
    case 'set-variable':
      return `Set $${o?.['variable']} = ${o?.['value']}`;
    case 'http-request':
      return 'HTTP response received';
    case 'slack-message':
      return 'Slack message sent';
    case 'discord-message':
      return 'Discord message sent';
    case 'telegram-message':
      return `Telegram message sent (ID: ${o?.['messageId'] ?? '-'})`;
    case 'webhook-send':
      return 'Webhook delivered';
    case 'openai-chat':
      return `GPT replied (${o?.['tokens'] ?? 0} tokens)`;
    case 'github-issue':
      return `Issue #${o?.['issueNumber']} created`;
    case 'transform-data':
      return 'Data transformed';
    case 'javascript-code':
      return 'JavaScript executed';
    case 'console-log':
      return 'Logged to server console';
    case 'browser-notification':
      return 'Browser notification queued';
    case 'alert-dialog':
      return 'Alert dialog queued';
    case 'save-to-storage':
      return `Saved to storage key "${o?.['key']}"`;
    default:
      return 'Executed';
  }
}
