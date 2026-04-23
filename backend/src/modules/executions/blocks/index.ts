import type { ExecutionContext } from '../engine.js';
import type { FlowBlockInput } from '../../flows/flows.schemas.js';
import { runHttpRequest } from './http.js';
import { runSlack } from './slack.js';
import { runDiscord } from './discord.js';
import { runTelegram } from './telegram.js';
import { runOpenAI } from './openai.js';
import { runGitHubIssue } from './github.js';
import { runWebhookSend } from './webhook-send.js';
import { runCondition } from './condition.js';
import { runDelay } from './delay.js';
import { runSetVariable } from './set-variable.js';
import { runTransform, runJavaScript } from './code.js';
import { runConsoleLog } from './console-log.js';

export type BlockRunner = (block: FlowBlockInput, ctx: ExecutionContext) => Promise<unknown> | unknown;

export async function runBlock(block: FlowBlockInput, ctx: ExecutionContext): Promise<unknown> {
  const props = toPropsMap(block);
  switch (block.definitionId) {
    case 'manual-trigger':
    case 'webhook-trigger':
    case 'schedule-trigger':
      return ctx.data;

    case 'if-else':
      return runCondition(props, ctx, false);
    case 'filter':
      return runCondition(props, ctx, true);
    case 'delay':
      return runDelay(props);
    case 'set-variable':
      return runSetVariable(props, ctx);

    case 'http-request':
      return runHttpRequest(props, ctx);
    case 'slack-message':
      return runSlack(props, ctx);
    case 'discord-message':
      return runDiscord(props, ctx);
    case 'telegram-message':
      return runTelegram(props, ctx);
    case 'openai-chat':
      return runOpenAI(props, ctx);
    case 'github-issue':
      return runGitHubIssue(props, ctx);
    case 'webhook-send':
      return runWebhookSend(props, ctx);
    case 'transform-data':
      return runTransform(props, ctx);
    case 'javascript-code':
      return runJavaScript(props, ctx);

    case 'console-log':
      return runConsoleLog(props, ctx);
    case 'browser-notification':
      return {
        _clientAction: 'notification',
        title: String(props['title'] ?? 'Flowlet'),
        message: String(props['message'] ?? ''),
      };
    case 'alert-dialog':
      return {
        _clientAction: 'alert',
        message: String(props['message'] ?? ''),
        showData: props['showData'] !== false,
        data: ctx.previousOutput,
      };
    case 'save-to-storage':
      return {
        _clientAction: 'save-to-storage',
        key: String(props['storageKey'] ?? 'flowlet-output'),
        value: selectStoragePayload(props['saveWhat'] as string, ctx),
      };

    default:
      return ctx.previousOutput;
  }
}

function toPropsMap(block: FlowBlockInput): Record<string, unknown> {
  return Object.fromEntries(block.properties.map((p) => [p.key, p.value]));
}

function selectStoragePayload(kind: string | undefined, ctx: ExecutionContext): unknown {
  switch (kind) {
    case 'full_context':
      return { data: ctx.data, variables: ctx.variables };
    case 'variables_only':
      return ctx.variables;
    case 'previous_output':
    default:
      return ctx.previousOutput;
  }
}
