import { request } from 'undici';
import type { ExecutionContext } from '../engine.js';
import { resolveTemplateString } from '../../../lib/templating.js';

export async function runDiscord(props: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
  const url = String(props['webhookUrl'] ?? '');
  if (!url) throw new Error('Discord Webhook URL is required');
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(url)) {
    throw new Error('Invalid Discord webhook URL');
  }
  const content = resolveTemplateString(String(props['content'] ?? ''), ctx);
  const body: Record<string, unknown> = { content };
  if (props['username']) body['username'] = props['username'];
  if (props['avatarUrl']) body['avatar_url'] = props['avatarUrl'];

  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.body.text();
  if (response.statusCode >= 400) {
    throw new Error(`Discord error: ${response.statusCode} ${text.slice(0, 160)}`);
  }
  return { sent: true, platform: 'discord', content };
}
