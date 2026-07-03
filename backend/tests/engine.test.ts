import { describe, expect, it } from 'vitest';
import { executeFlow, type FlowDefinition } from '../src/modules/executions/engine.js';
import { noopLogger } from '../src/lib/logger.js';
import type { FlowBlockInput } from '../src/modules/flows/flows.schemas.js';

function block(partial: Partial<FlowBlockInput> & Pick<FlowBlockInput, 'id' | 'definitionId' | 'category'>): FlowBlockInput {
  return {
    label: partial.definitionId,
    icon: 'zap',
    color: '#000000',
    position: { x: 0, y: 0 },
    properties: [],
    ...partial,
  };
}

function connect(sourceId: string, targetId: string) {
  return { id: `${sourceId}->${targetId}`, sourceId, targetId };
}

const run = (flow: FlowDefinition, triggerPayload?: unknown) =>
  executeFlow(flow, { triggeredBy: 'manual', triggerPayload, logger: noopLogger });

describe('executeFlow', () => {
  it('fails fast when the flow has no trigger block', async () => {
    const result = await run({ id: 'f1', name: 'No trigger', blocks: [], connections: [] });
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/Trigger/);
    expect(result.totalSteps).toBe(0);
  });

  it('runs trigger payload through a set-variable block', async () => {
    const trigger = block({ id: 't1', definitionId: 'manual-trigger', category: 'trigger' });
    const setVar = block({
      id: 'b1',
      definitionId: 'set-variable',
      category: 'logic',
      properties: [
        { key: 'name', label: 'Name', type: 'text', value: 'greeting' },
        { key: 'value', label: 'Value', type: 'text', value: 'hello {{name}}' },
      ],
    });

    const flow: FlowDefinition = {
      id: 'f2',
      name: 'Set variable',
      blocks: [trigger, setVar],
      connections: [connect('t1', 'b1')],
    };

    const result = await run(flow, { name: 'world' });

    expect(result.status).toBe('success');
    expect(result.stepsCompleted).toBe(2);
    expect(result.variables['greeting']).toBe('hello world');
  });

  it('stops the branch on a blocked filter without failing the execution', async () => {
    const trigger = block({ id: 't1', definitionId: 'manual-trigger', category: 'trigger' });
    const filterBlock = block({
      id: 'b1',
      definitionId: 'filter',
      category: 'logic',
      properties: [
        { key: 'field', label: 'Field', type: 'text', value: 'status' },
        { key: 'operator', label: 'Operator', type: 'select', value: 'equals' },
        { key: 'value', label: 'Value', type: 'text', value: 'approved' },
      ],
    });
    const afterFilter = block({ id: 'b2', definitionId: 'console-log', category: 'output' });

    const flow: FlowDefinition = {
      id: 'f3',
      name: 'Filter stop',
      blocks: [trigger, filterBlock, afterFilter],
      connections: [connect('t1', 'b1'), connect('b1', 'b2')],
    };

    const result = await run(flow, { status: 'pending' });

    expect(result.status).toBe('success');
    expect(result.stepsCompleted).toBe(2);
    expect(result.logs.find((l) => l.blockId === 'b1')?.status).toBe('skipped');
    expect(result.logs.find((l) => l.blockId === 'b2')?.status).toBe('skipped');
  });

  it('continues past a passing filter', async () => {
    const trigger = block({ id: 't1', definitionId: 'manual-trigger', category: 'trigger' });
    const filterBlock = block({
      id: 'b1',
      definitionId: 'filter',
      category: 'logic',
      properties: [
        { key: 'field', label: 'Field', type: 'text', value: 'status' },
        { key: 'operator', label: 'Operator', type: 'select', value: 'equals' },
        { key: 'value', label: 'Value', type: 'text', value: 'approved' },
      ],
    });
    const afterFilter = block({ id: 'b2', definitionId: 'console-log', category: 'output' });

    const flow: FlowDefinition = {
      id: 'f4',
      name: 'Filter pass',
      blocks: [trigger, filterBlock, afterFilter],
      connections: [connect('t1', 'b1'), connect('b1', 'b2')],
    };

    const result = await run(flow, { status: 'approved' });

    expect(result.status).toBe('success');
    expect(result.stepsCompleted).toBe(3);
    expect(result.logs.every((l) => l.status === 'success')).toBe(true);
  });

  it('marks a genuinely broken block as failed and skips the rest', async () => {
    const trigger = block({ id: 't1', definitionId: 'manual-trigger', category: 'trigger' });
    const brokenCode = block({
      id: 'b1',
      definitionId: 'javascript-code',
      category: 'logic',
      properties: [{ key: 'code', label: 'Code', type: 'textarea', value: 'throw new Error("boom");' }],
    });
    const afterBroken = block({ id: 'b2', definitionId: 'console-log', category: 'output' });

    const flow: FlowDefinition = {
      id: 'f5',
      name: 'Broken code',
      blocks: [trigger, brokenCode, afterBroken],
      connections: [connect('t1', 'b1'), connect('b1', 'b2')],
    };

    const result = await run(flow);

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/boom/);
    expect(result.logs.find((l) => l.blockId === 'b2')?.status).toBe('skipped');
  });
});
