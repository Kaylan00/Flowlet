import type { ExecutionContext } from '../engine.js';
import { resolveFieldPath } from '../../../lib/templating.js';

export function runCondition(
  props: Record<string, unknown>,
  ctx: ExecutionContext,
  throwIfFalse: boolean,
): unknown {
  const field = String(props['field'] ?? '');
  const operator = String(props['operator'] ?? 'equals');
  const compare = props['value'];
  const actual = resolveFieldPath(field, ctx.data);

  let result = false;
  switch (operator) {
    case 'equals':
      result = String(actual) === String(compare);
      break;
    case 'not_equals':
      result = String(actual) !== String(compare);
      break;
    case 'contains':
      result = String(actual ?? '').includes(String(compare));
      break;
    case 'greater_than':
      result = Number(actual) > Number(compare);
      break;
    case 'less_than':
      result = Number(actual) < Number(compare);
      break;
    case 'is_empty':
      result = actual == null || actual === '';
      break;
    case 'is_not_empty':
      result = actual != null && actual !== '';
      break;
  }

  if (throwIfFalse && !result) {
    throw new Error(`Filter blocked: ${field} ${operator} ${String(compare)}`);
  }
  return { conditionMet: result, field, operator, actualValue: actual };
}
