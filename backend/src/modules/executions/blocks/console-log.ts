import type { ExecutionContext } from '../engine.js';

export function runConsoleLog(props: Record<string, unknown>, ctx: ExecutionContext): unknown {
  const label = String(props['label'] ?? 'Flowlet');
  const logData = String(props['logData'] ?? 'full_context');
  let output: unknown;
  switch (logData) {
    case 'previous_output':
      output = ctx.previousOutput;
      break;
    case 'variables_only':
      output = ctx.variables;
      break;
    case 'full_context':
    default:
      output = { data: ctx.data, variables: ctx.variables, previousOutput: ctx.previousOutput };
  }
  ctx.logger.info({ consoleLog: { label, output } }, '[Flowlet console]');
  return output;
}
