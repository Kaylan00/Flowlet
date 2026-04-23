import { request } from 'undici';
import type { ExecutionContext } from '../engine.js';
import { resolveTemplateString } from '../../../lib/templating.js';

export async function runTelegram(props: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
  const token = String(props['botToken'] ?? '');
  const chatId = String(props['chatId'] ?? '');
  if (!token || !chatId) throw new Error('Bot Token and Chat ID are required');

  const text = resolveTemplateString(String(props['message'] ?? ''), ctx);
  const parseMode = String(props['parseMode'] ?? 'HTML');

  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
  const response = await request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
  const payload = (await response.body.json()) as { ok: boolean; description?: string; result?: { message_id?: number } };
  if (!payload.ok) throw new Error(`Telegram error: ${payload.description ?? 'unknown'}`);
  return { sent: true, platform: 'telegram', messageId: payload.result?.message_id };
}
