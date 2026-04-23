import vm from 'node:vm';
import type { ExecutionContext } from '../engine.js';

const TIMEOUT_MS = 2_000;

function runUserCode(code: string, ctx: ExecutionContext, wrapAsReturn: boolean): unknown {
  const sandbox = {
    data: deepClone(ctx.data),
    variables: deepClone(ctx.variables),
    previousOutput: deepClone(ctx.previousOutput),
    console: { log: (...args: unknown[]) => ctx.logger.info({ userCode: args }, 'user-code') },
    __result: undefined as unknown,
  };
  const script = wrapAsReturn
    ? `__result = (function(data, variables, previousOutput) { ${code} \n})(data, variables, previousOutput);`
    : `__result = (function(data, variables, previousOutput) { ${code} \n})(data, variables, previousOutput);`;
  const context = vm.createContext(sandbox);
  try {
    vm.runInContext(script, context, { timeout: TIMEOUT_MS });
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
  return sandbox.__result;
}

function deepClone<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    return JSON.parse(JSON.stringify(v));
  }
}

export function runTransform(props: Record<string, unknown>, ctx: ExecutionContext): unknown {
  const code = String(props['expression'] ?? 'return data;');
  return runUserCode(code, ctx, true);
}

export function runJavaScript(props: Record<string, unknown>, ctx: ExecutionContext): unknown {
  const code = String(props['code'] ?? '');
  return runUserCode(code, ctx, true);
}
