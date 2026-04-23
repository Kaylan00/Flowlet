import { request } from 'undici';
import type { ExecutionContext } from '../engine.js';
import { resolveTemplateString } from '../../../lib/templating.js';

export async function runGitHubIssue(props: Record<string, unknown>, ctx: ExecutionContext): Promise<unknown> {
  const token = String(props['token'] ?? '');
  const repo = String(props['repo'] ?? '');
  if (!token || !repo) throw new Error('GitHub token and repository are required');
  if (!/^[^\s/]+\/[^\s/]+$/.test(repo)) throw new Error('Repository must be in "owner/repo" format');

  const title = resolveTemplateString(String(props['title'] ?? ''), ctx);
  const body = resolveTemplateString(String(props['body'] ?? ''), ctx);
  const labels = String(props['labels'] ?? '')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);

  const response = await request(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github.v3+json',
      'content-type': 'application/json',
      'user-agent': 'Flowlet',
    },
    body: JSON.stringify({ title, body, labels }),
  });
  const payload = (await response.body.json()) as { number?: number; html_url?: string; title?: string; message?: string };
  if (response.statusCode >= 400) {
    throw new Error(`GitHub: ${payload.message ?? response.statusCode}`);
  }
  return { issueNumber: payload.number, url: payload.html_url, title: payload.title };
}
