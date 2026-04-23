import type { ExecutionContext } from '../engine.js';
import { resolveTemplateString } from '../../../lib/templating.js';

export function runSetVariable(props: Record<string, unknown>, ctx: ExecutionContext): unknown {
  const name = String(props['name'] ?? 'unnamed');
  const raw = props['value'];
  const resolved = typeof raw === 'string' ? resolveTemplateString(raw, ctx) : raw;
  ctx.variables[name] = resolved;
  return { variable: name, value: resolved };
}
