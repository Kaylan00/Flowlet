import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { noopLogger, type EngineLogger } from '../../lib/logger.js';
import { executeFlow, type FlowDefinition } from './engine.js';
import type { FlowBlockInput, FlowConnectionInput } from '../flows/flows.schemas.js';

export const runFlowSchema = z.object({
  payload: z.unknown().optional(),
});

interface RunFlowArgs {
  flow: {
    id: string;
    name: string;
    blocks: unknown;
    connections: unknown;
  };
  userId: string;
  triggeredBy: 'manual' | 'webhook' | 'schedule' | 'retry';
  triggerPayload?: unknown;
  logger?: EngineLogger;
}

export const executionsService = {
  async runFlow({ flow, userId, triggeredBy, triggerPayload, logger }: RunFlowArgs) {
    const startedAt = new Date();
    const execution = await prisma.execution.create({
      data: {
        flowId: flow.id,
        userId,
        flowName: flow.name,
        status: 'running',
        startedAt,
        triggeredBy,
      },
    });

    const flowDef: FlowDefinition = {
      id: flow.id,
      name: flow.name,
      blocks: flow.blocks as FlowBlockInput[],
      connections: flow.connections as FlowConnectionInput[],
    };

    const result = await executeFlow(flowDef, {
      triggeredBy,
      triggerPayload,
      logger: logger ?? noopLogger,
    });

    const completedAt = new Date();
    const updated = await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: result.status,
        completedAt,
        duration: completedAt.getTime() - startedAt.getTime(),
        stepsCompleted: result.stepsCompleted,
        totalSteps: result.totalSteps,
        error: result.error ?? null,
        logs: result.logs as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.flow.update({
      where: { id: flow.id },
      data: { executionCount: { increment: 1 } },
    });

    return serialize(updated);
  },

  async list(userId: string, params: { flowId?: string; limit?: number; offset?: number }) {
    const limit = Math.min(params.limit ?? 50, 200);
    const offset = Math.max(params.offset ?? 0, 0);
    const rows = await prisma.execution.findMany({
      where: { userId, ...(params.flowId ? { flowId: params.flowId } : {}) },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map(serialize);
  },

  async get(userId: string, id: string) {
    const row = await prisma.execution.findFirst({ where: { id, userId } });
    if (!row) throw notFound('Execution not found');
    return serialize(row);
  },

  async retry(userId: string, id: string) {
    const execution = await this.get(userId, id);
    const flow = await prisma.flow.findFirst({ where: { id: execution.flowId, userId } });
    if (!flow) throw notFound('Flow not found');
    return this.runFlow({
      flow: {
        id: flow.id,
        name: flow.name,
        blocks: flow.blocks,
        connections: flow.connections,
      },
      userId,
      triggeredBy: 'retry',
    });
  },
};

function serialize<T extends { logs: Prisma.JsonValue }>(row: T) {
  return {
    ...row,
    logs: (row.logs ?? []) as unknown,
  };
}
