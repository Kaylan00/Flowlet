import { Injectable, inject } from '@angular/core';
import { Flow, FlowBlock, Execution, ExecutionLog, BlockCategory } from '../models/flow.model';
import { MockDataService } from './mock-data.service';
import { ToastService } from './toast.service';

export interface ExecutionContext {
  data: any;
  variables: Record<string, any>;
  previousOutput: any;
  logs: ExecutionLog[];
}

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private data = inject(MockDataService);
  private toast = inject(ToastService);

  async executeFlow(
    flow: Flow,
    onBlockStart?: (blockId: string) => void,
    onBlockEnd?: (blockId: string) => void,
  ): Promise<Execution> {
    const startTime = Date.now();
    const ctx: ExecutionContext = { data: {}, variables: {}, previousOutput: {}, logs: [] };

    // Find trigger blocks
    const triggers = flow.blocks.filter(b => b.category === 'trigger');
    if (triggers.length === 0) {
      throw new Error('Flow needs at least one Trigger block');
    }

    // Parse trigger payload as initial data
    const triggerBlock = triggers[0];
    const payloadProp = triggerBlock.properties.find(p => p.key === 'payload');
    if (payloadProp?.value) {
      try { ctx.data = JSON.parse(payloadProp.value); } catch { ctx.data = {}; }
    }

    // BFS to order blocks from triggers
    const orderedBlocks = this.getExecutionOrder(flow);

    let allSuccess = true;
    let stepsCompleted = 0;
    let lastError = '';

    for (const block of orderedBlocks) {
      onBlockStart?.(block.id);
      const stepStart = Date.now();

      try {
        const output = await this.executeBlock(block, ctx);
        ctx.previousOutput = output;
        if (output !== undefined && output !== null) {
          ctx.data = typeof output === 'object' ? { ...ctx.data, ...output } : ctx.data;
        }

        ctx.logs.push({
          blockId: block.id,
          blockLabel: block.label,
          blockCategory: block.category,
          status: 'success',
          message: this.getSuccessMessage(block, output),
          timestamp: new Date().toISOString(),
          duration: Date.now() - stepStart,
          output,
        });
        stepsCompleted++;
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        ctx.logs.push({
          blockId: block.id,
          blockLabel: block.label,
          blockCategory: block.category,
          status: 'failed',
          message: errMsg,
          timestamp: new Date().toISOString(),
          duration: Date.now() - stepStart,
        });
        allSuccess = false;
        lastError = errMsg;

        // Mark remaining blocks as skipped
        const remaining = orderedBlocks.slice(orderedBlocks.indexOf(block) + 1);
        for (const rb of remaining) {
          ctx.logs.push({
            blockId: rb.id, blockLabel: rb.label, blockCategory: rb.category,
            status: 'skipped', message: 'Skipped due to previous failure',
            timestamp: new Date().toISOString(), duration: 0,
          });
        }
        break;
      } finally {
        onBlockEnd?.(block.id);
      }
    }

    const execution: Execution = {
      id: `ex-${Date.now()}`,
      flowId: flow.id,
      flowName: flow.name,
      status: allSuccess ? 'success' : 'failed',
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      stepsCompleted,
      totalSteps: orderedBlocks.length,
      error: allSuccess ? undefined : lastError,
      logs: ctx.logs,
    };

    this.data.addExecution(execution);
    return execution;
  }

  private getExecutionOrder(flow: Flow): FlowBlock[] {
    const visited = new Set<string>();
    const ordered: FlowBlock[] = [];
    const triggers = flow.blocks.filter(b => b.category === 'trigger');
    const queue = triggers.map(t => t.id);

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const block = flow.blocks.find(b => b.id === id);
      if (block) ordered.push(block);
      flow.connections.filter(c => c.sourceId === id).forEach(c => queue.push(c.targetId));
    }

    // Add disconnected blocks
    flow.blocks.filter(b => !visited.has(b.id)).forEach(b => ordered.push(b));
    return ordered;
  }

  private async executeBlock(block: FlowBlock, ctx: ExecutionContext): Promise<any> {
    const props = Object.fromEntries(block.properties.map(p => [p.key, p.value]));

    switch (block.definitionId) {
      // --- TRIGGERS ---
      case 'manual-trigger':
      case 'webhook-trigger':
      case 'schedule-trigger':
        return ctx.data; // triggers just pass through their payload

      // --- LOGIC ---
      case 'if-else':
      case 'filter':
        return this.executeCondition(props, ctx);

      case 'delay':
        return this.executeDelay(props);

      case 'set-variable':
        return this.executeSetVariable(props, ctx);

      // --- ACTIONS ---
      case 'http-request':
        return this.executeHttpRequest(props);

      case 'slack-message':
        return this.executeSlackMessage(props, ctx);

      case 'discord-message':
        return this.executeDiscordMessage(props, ctx);

      case 'telegram-message':
        return this.executeTelegramMessage(props, ctx);

      case 'webhook-send':
        return this.executeWebhookSend(props, ctx);

      case 'openai-chat':
        return this.executeOpenAIChat(props, ctx);

      case 'github-issue':
        return this.executeGitHubIssue(props, ctx);

      case 'transform-data':
        return this.executeTransform(props, ctx);

      case 'javascript-code':
        return this.executeJavaScript(props, ctx);

      // --- OUTPUT ---
      case 'console-log':
        return this.executeConsoleLog(props, ctx);

      case 'browser-notification':
        return this.executeBrowserNotification(props);

      case 'alert-dialog':
        return this.executeAlert(props, ctx);

      case 'save-to-storage':
        return this.executeSaveToStorage(props, ctx);

      default:
        return ctx.previousOutput;
    }
  }

  // --- Real implementations ---

  private executeCondition(props: Record<string, any>, ctx: ExecutionContext): any {
    const field = props['field'] || '';
    const operator = props['operator'] || 'equals';
    const compareValue = props['value'] || '';

    const actualValue = this.resolveFieldPath(field, ctx.data);

    let result = false;
    switch (operator) {
      case 'equals': result = String(actualValue) === String(compareValue); break;
      case 'not_equals': result = String(actualValue) !== String(compareValue); break;
      case 'contains': result = String(actualValue).includes(String(compareValue)); break;
      case 'greater_than': result = Number(actualValue) > Number(compareValue); break;
      case 'less_than': result = Number(actualValue) < Number(compareValue); break;
      case 'is_empty': result = !actualValue || actualValue === ''; break;
      case 'is_not_empty': result = !!actualValue && actualValue !== ''; break;
    }

    if (!result && props['field'] && !field.startsWith('__filter')) {
      // For filter blocks, throw to stop execution
      if (BLOCK_CATALOG_IDS.has('filter')) {
        // We check via definitionId in the caller
      }
    }

    return { conditionMet: result, field, operator, actualValue };
  }

  private async executeDelay(props: Record<string, any>): Promise<any> {
    const seconds = Math.min(Number(props['seconds']) || 1, 30); // cap at 30s
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return { delayed: seconds };
  }

  private executeSetVariable(props: Record<string, any>, ctx: ExecutionContext): any {
    const name = props['name'] || 'unnamed';
    let value = props['value'] || '';

    // Resolve template syntax {{data.field}}
    value = this.resolveTemplateString(value, ctx);
    ctx.variables[name] = value;
    return { variable: name, value };
  }

  private async executeHttpRequest(props: Record<string, any>): Promise<any> {
    const method = props['method'] || 'GET';
    const url = props['url'] || '';
    if (!url) throw new Error('URL is required');

    let headers: Record<string, string> = {};
    try { headers = JSON.parse(props['headers'] || '{}'); } catch {}

    const fetchOpts: RequestInit = { method, headers };
    if (['POST', 'PUT', 'PATCH'].includes(method) && props['body']) {
      fetchOpts.body = props['body'];
    }

    const response = await fetch(url, fetchOpts);
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let data: any;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return data;
  }

  private executeTransform(props: Record<string, any>, ctx: ExecutionContext): any {
    const expression = props['expression'] || 'return data';
    try {
      const fn = new Function('data', 'variables', 'previousOutput', expression);
      return fn(ctx.data, ctx.variables, ctx.previousOutput);
    } catch (err: any) {
      throw new Error(`Transform error: ${err.message}`);
    }
  }

  private executeJavaScript(props: Record<string, any>, ctx: ExecutionContext): any {
    const code = props['code'] || '';
    try {
      const fn = new Function('data', 'variables', 'previousOutput', code);
      return fn(ctx.data, ctx.variables, ctx.previousOutput);
    } catch (err: any) {
      throw new Error(`JavaScript error: ${err.message}`);
    }
  }

  private executeConsoleLog(props: Record<string, any>, ctx: ExecutionContext): any {
    const label = props['label'] || 'Flowlet';
    const logData = props['logData'] || 'full_context';

    let output: any;
    switch (logData) {
      case 'full_context': output = { data: ctx.data, variables: ctx.variables, previousOutput: ctx.previousOutput }; break;
      case 'previous_output': output = ctx.previousOutput; break;
      case 'variables_only': output = ctx.variables; break;
      default: output = ctx.data;
    }

    console.log(`%c[Flowlet] ${label}`, 'color: #8b5cf6; font-weight: bold;', output);
    return output;
  }

  private async executeBrowserNotification(props: Record<string, any>): Promise<any> {
    const title = props['title'] || 'Flowlet';
    const message = props['message'] || '';

    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        new Notification(title, { body: message, icon: '/favicon.ico' });
        return { notified: true, permission: 'granted' };
      }
      return { notified: false, permission: Notification.permission };
    }
    throw new Error('Browser notifications not supported');
  }

  private executeAlert(props: Record<string, any>, ctx: ExecutionContext): any {
    const message = props['message'] || '';
    const showData = props['showData'] !== false;

    let alertText = message;
    if (showData && ctx.previousOutput) {
      alertText += '\n\nData:\n' + JSON.stringify(ctx.previousOutput, null, 2);
    }
    alert(alertText);
    return { alerted: true };
  }

  private executeSaveToStorage(props: Record<string, any>, ctx: ExecutionContext): any {
    const key = props['storageKey'] || 'flowlet-output';
    const saveWhat = props['saveWhat'] || 'previous_output';

    let value: any;
    switch (saveWhat) {
      case 'full_context': value = { data: ctx.data, variables: ctx.variables }; break;
      case 'previous_output': value = ctx.previousOutput; break;
      case 'variables_only': value = ctx.variables; break;
      default: value = ctx.previousOutput;
    }

    localStorage.setItem(key, JSON.stringify(value));
    return { saved: true, key, size: JSON.stringify(value).length };
  }

  // --- AI & Dev integrations ---

  private async executeOpenAIChat(props: Record<string, any>, ctx: ExecutionContext): Promise<any> {
    const apiKey = props['apiKey'] || '';
    if (!apiKey) throw new Error('OpenAI API Key is required');

    const model = props['model'] || 'gpt-4o-mini';
    const prompt = this.resolveTemplateString(props['prompt'] || '', ctx);
    const systemPrompt = props['systemPrompt'] || 'You are a helpful assistant.';
    const temperature = Math.min(2, Math.max(0, Number(props['temperature']) || 0.7));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(`OpenAI: ${data.error.message}`);

    const reply = data.choices?.[0]?.message?.content || '';
    return { reply, model, tokens: data.usage?.total_tokens || 0 };
  }

  private async executeGitHubIssue(props: Record<string, any>, ctx: ExecutionContext): Promise<any> {
    const token = props['token'] || '';
    const repo = props['repo'] || '';
    if (!token || !repo) throw new Error('GitHub token and repository are required');

    const title = this.resolveTemplateString(props['title'] || '', ctx);
    const body = this.resolveTemplateString(props['body'] || '', ctx);
    const labels = (props['labels'] || '').split(',').map((l: string) => l.trim()).filter(Boolean);

    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(`GitHub: ${data.message || response.statusText}`);
    return { issueNumber: data.number, url: data.html_url, title: data.title };
  }

  // --- Integration blocks ---

  private async executeSlackMessage(props: Record<string, any>, ctx: ExecutionContext): Promise<any> {
    const url = props['webhookUrl'] || '';
    if (!url) throw new Error('Slack Webhook URL is required');

    const message = this.resolveTemplateString(props['message'] || '', ctx);
    const body: any = { text: message };
    if (props['channel']) body.channel = props['channel'];
    if (props['username']) body.username = props['username'];

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Slack error: ${response.status} ${response.statusText}`);
    return { sent: true, platform: 'slack', message };
  }

  private async executeDiscordMessage(props: Record<string, any>, ctx: ExecutionContext): Promise<any> {
    const url = props['webhookUrl'] || '';
    if (!url) throw new Error('Discord Webhook URL is required');

    const content = this.resolveTemplateString(props['content'] || '', ctx);
    const body: any = { content };
    if (props['username']) body.username = props['username'];
    if (props['avatarUrl']) body.avatar_url = props['avatarUrl'];

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Discord error: ${response.status} ${errorText || response.statusText}`);
    }
    return { sent: true, platform: 'discord', content };
  }

  private async executeTelegramMessage(props: Record<string, any>, ctx: ExecutionContext): Promise<any> {
    const token = props['botToken'] || '';
    const chatId = props['chatId'] || '';
    if (!token || !chatId) throw new Error('Bot Token and Chat ID are required');

    const message = this.resolveTemplateString(props['message'] || '', ctx);
    const parseMode = props['parseMode'] || 'HTML';

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: parseMode }),
    });

    const data = await response.json();
    if (!data.ok) throw new Error(`Telegram error: ${data.description || 'Unknown'}`);
    return { sent: true, platform: 'telegram', messageId: data.result?.message_id };
  }

  private async executeWebhookSend(props: Record<string, any>, ctx: ExecutionContext): Promise<any> {
    const url = props['url'] || '';
    if (!url) throw new Error('Webhook URL is required');

    let body: any;
    if (props['sendPreviousOutput'] !== false) {
      body = ctx.previousOutput;
    }
    if (props['customBody']) {
      try { body = JSON.parse(props['customBody']); } catch { body = props['customBody']; }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('json') ? await response.json() : await response.text();
    return { sent: true, response: result };
  }

  // --- Helpers ---

  private resolveFieldPath(path: string, obj: any): any {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  private resolveTemplateString(str: string, ctx: ExecutionContext): string {
    return str.replace(/\{\{(.+?)\}\}/g, (_match, expr) => {
      const trimmed = expr.trim();
      if (trimmed.startsWith('data.')) return String(this.resolveFieldPath(trimmed.slice(5), ctx.data) ?? '');
      if (trimmed.startsWith('variables.')) return String(ctx.variables[trimmed.slice(10)] ?? '');
      return String(this.resolveFieldPath(trimmed, ctx.data) ?? '');
    });
  }

  private getSuccessMessage(block: FlowBlock, output: any): string {
    switch (block.definitionId) {
      case 'manual-trigger': return 'Flow triggered manually';
      case 'webhook-trigger': return 'Webhook received';
      case 'schedule-trigger': return 'Schedule triggered';
      case 'if-else': return `Condition: ${output?.field} ${output?.operator} → ${output?.conditionMet ? 'TRUE' : 'FALSE'}`;
      case 'filter': return `Filter: ${output?.conditionMet ? 'passed' : 'blocked'}`;
      case 'delay': return `Waited ${output?.delayed}s`;
      case 'set-variable': return `Set $${output?.variable} = ${output?.value}`;
      case 'http-request': return `HTTP response received (${typeof output === 'object' ? JSON.stringify(output).length + ' bytes' : 'text'})`;
      case 'slack-message': return `Slack message sent`;
      case 'discord-message': return `Discord message sent`;
      case 'telegram-message': return `Telegram message sent (ID: ${output?.messageId || '-'})`;
      case 'webhook-send': return `Webhook delivered`;
      case 'openai-chat': return `GPT replied (${output?.tokens || 0} tokens)`;
      case 'github-issue': return `Issue #${output?.issueNumber} created`;
      case 'transform-data': return 'Data transformed';
      case 'javascript-code': return 'JavaScript executed';
      case 'console-log': return 'Logged to browser console';
      case 'browser-notification': return output?.notified ? 'Browser notification sent' : `Notification blocked (${output?.permission})`;
      case 'alert-dialog': return 'Alert dialog shown';
      case 'save-to-storage': return `Saved to localStorage key "${output?.key}" (${output?.size} bytes)`;
      default: return 'Executed';
    }
  }
}

// Used for condition check
const BLOCK_CATALOG_IDS = new Set(['filter']);
