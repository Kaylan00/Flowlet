export function resolveFieldPath(path: string, obj: unknown): unknown {
  if (!path || obj == null) return undefined;
  return path
    .split('.')
    .reduce<unknown>((acc, key) => (acc != null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

export interface TemplateContext {
  data: unknown;
  variables: Record<string, unknown>;
  previousOutput: unknown;
}

export function resolveTemplateString(str: string, ctx: TemplateContext): string {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/\{\{(.+?)\}\}/g, (_match, expr: string) => {
    const trimmed = expr.trim();
    if (trimmed === 'data') return stringify(ctx.data);
    if (trimmed === 'previousOutput') return stringify(ctx.previousOutput);
    if (trimmed.startsWith('data.')) return stringify(resolveFieldPath(trimmed.slice(5), ctx.data));
    if (trimmed.startsWith('variables.')) return stringify(ctx.variables[trimmed.slice(10)]);
    if (trimmed.startsWith('previousOutput.')) return stringify(resolveFieldPath(trimmed.slice(15), ctx.previousOutput));
    return stringify(resolveFieldPath(trimmed, ctx.data));
  });
}

function stringify(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}
