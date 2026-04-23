import { request } from 'undici';
import type { ExecutionContext } from '../engine.js';
import { resolveTemplateString } from '../../../lib/templating.js';

export async function runSlack(props: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
  const url = String(props['webhookUrl'] ?? '');
  if (!url) throw new Error('Slack Webhook URL is required');
  if (!url.startsWith('https://hooks.slack.com/')) {
    throw new Error('Invalid Slack webhook URL');
  }

  const message = resolveTemplateString(String(props['message'] ?? ''), ctx);
  const body: Record<string, unknown> = { text: message };
  if (props['channel']) body['channel'] = props['channel'];
  if (props['username']) body['username'] = props['username'];

  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.body.text();
  if (response.statusCode >= 400) {
    throw new Error(`Slack error: ${response.statusCode} ${text.slice(0, 120)}`);
  }
  return { sent: true, platform: 'slack', message };
}
