import { request } from 'undici';
import type { ExecutionContext } from '../engine.js';
import { resolveTemplateString } from '../../../lib/templating.js';

export async function runWebhookSend(props: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
  const url = String(props['url'] ?? '');
  if (!url) throw new Error('Webhook URL is required');
  if (!/^https?:\/\//.test(url)) throw new Error('Webhook URL must be http(s)');

  let body: unknown = undefined;
  if (props['sendPreviousOutput'] !== false) {
    body = ctx.previousOutput;
  }
  const custom = props['customBody'];
  if (custom) {
    const raw = typeof custom === 'string' ? resolveTemplateString(custom, ctx) : JSON.stringify(custom);
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }

  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const text = await response.body.text();
  if (response.statusCode >= 400) {
    throw new Error(`Webhook error: ${response.statusCode} ${text.slice(0, 160)}`);
  }
  const contentType = String(response.headers['content-type'] ?? '');
  let parsed: unknown = text;
  if (contentType.includes('json')) {
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep text */
    }
  }
  return { sent: true, response: parsed };
}
