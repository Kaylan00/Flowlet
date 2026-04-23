import { request } from 'undici';
import type { ExecutionContext } from '../engine.js';
import { resolveTemplateString } from '../../../lib/templating.js';

export async function runOpenAI(props: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
  const apiKey = String(props['apiKey'] ?? '');
  if (!apiKey) throw new Error('OpenAI API Key is required');

  const model = String(props['model'] ?? 'gpt-4o-mini');
  const prompt = resolveTemplateString(String(props['prompt'] ?? ''), ctx);
  const systemPrompt = String(props['systemPrompt'] ?? 'You are a helpful assistant.');
  const temperature = Math.min(2, Math.max(0, Number(props['temperature']) || 0.7));

  const response = await request('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const payload = (await response.body.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  if (payload.error) throw new Error(`OpenAI: ${payload.error.message ?? 'error'}`);
  return {
    reply: payload.choices?.[0]?.message?.content ?? '',
    model,
    tokens: payload.usage?.total_tokens ?? 0,
  };
}
