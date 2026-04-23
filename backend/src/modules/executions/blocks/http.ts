import { request } from 'undici';
import type { ExecutionContext } from '../engine.js';
import { resolveTemplateString } from '../../../lib/templating.js';

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // cloud metadata endpoint
];

function assertSafeUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.includes(hostname)) {
    throw new Error('Requests to internal hosts are blocked');
  }
  // Block private IP ranges (basic)
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
    throw new Error('Requests to private networks are blocked');
  }
}

export async function runHttpRequest(props: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
  const rawUrl = String(props['url'] ?? '');
  if (!rawUrl) throw new Error('URL is required');
  const url = resolveTemplateString(rawUrl, ctx);
  assertSafeUrl(url);

  const method = String(props['method'] ?? 'GET').toUpperCase();
  let headers: Record<string, string> = {};
  try {
    const h = props['headers'];
    if (typeof h === 'string' && h.trim()) headers = JSON.parse(h);
    else if (typeof h === 'object' && h !== null) headers = h as Record<string, string>;
  } catch {
    headers = {};
  }

  let body: string | undefined;
  if (['POST', 'PUT', 'PATCH'].includes(method) && props['body']) {
    const raw = typeof props['body'] === 'string' ? props['body'] : JSON.stringify(props['body']);
    body = resolveTemplateString(raw, ctx);
  }

  const response = await request(url, {
    method: method as 'GET',
    headers,
    body,
    headersTimeout: 15_000,
    bodyTimeout: 15_000,
  });

  const contentType = String(response.headers['content-type'] ?? '');
  const text = await response.body.text();

  if (response.statusCode >= 400) {
    throw new Error(`HTTP ${response.statusCode}: ${text.slice(0, 200)}`);
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}
