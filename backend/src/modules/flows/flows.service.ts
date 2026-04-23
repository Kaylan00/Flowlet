import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import type { CreateFlowInput, UpdateFlowInput } from './flows.schemas.js';

function generateWebhookToken(): string {
  return randomBytes(24).toString('hex');
}

function serialize<T extends { blocks: Prisma.JsonValue; connections: Prisma.JsonValue }>(flow: T) {
  return {
    ...flow,
    blocks: (flow.blocks ?? []) as unknown,
    connections: (flow.connections ?? []) as unknown,
  };
}

export const flowsService = {
  async list(userId: string) {
    const flows = await prisma.flow.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return flows.map(serialize);
  },

  async get(userId: string, id: string) {
    const flow = await prisma.flow.findFirst({ where: { id, userId } });
    if (!flow) throw notFound('Flow not found');
    return serialize(flow);
  },

  async create(userId: string, input: CreateFlowInput) {
    const hasWebhookTrigger = input.blocks.some((b) => b.definitionId === 'webhook-trigger');
    const flow = await prisma.flow.create({
      data: {
        userId,
        name: input.name,
        description: input.description ?? '',
        blocks: input.blocks as unknown as Prisma.InputJsonValue,
        connections: input.connections as unknown as Prisma.InputJsonValue,
        status: input.status,
        webhookToken: hasWebhookTrigger ? generateWebhookToken() : null,
      },
    });
    return serialize(flow);
  },

  async update(userId: string, id: string, input: UpdateFlowInput) {
    const existing = await prisma.flow.findFirst({ where: { id, userId } });
    if (!existing) throw notFound('Flow not found');

    const nextBlocks = input.blocks ?? (existing.blocks as unknown as CreateFlowInput['blocks']);
    const needsWebhookToken = nextBlocks.some((b) => b.definitionId === 'webhook-trigger');

    const flow = await prisma.flow.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.blocks !== undefined ? { blocks: input.blocks as unknown as Prisma.InputJsonValue } : {}),
        ...(input.connections !== undefined
          ? { connections: input.connections as unknown as Prisma.InputJsonValue }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        webhookToken: needsWebhookToken ? existing.webhookToken ?? generateWebhookToken() : null,
      },
    });
    return serialize(flow);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.flow.findFirst({ where: { id, userId } });
    if (!existing) throw notFound('Flow not found');
    await prisma.flow.delete({ where: { id } });
  },

  async toggle(userId: string, id: string) {
    const existing = await prisma.flow.findFirst({ where: { id, userId } });
    if (!existing) throw notFound('Flow not found');
    const next = existing.status === 'active' ? 'inactive' : 'active';
    const flow = await prisma.flow.update({ where: { id }, data: { status: next } });
    return serialize(flow);
  },

  async duplicate(userId: string, id: string) {
    const existing = await prisma.flow.findFirst({ where: { id, userId } });
    if (!existing) throw notFound('Flow not found');
    const hasWebhookTrigger = (existing.blocks as unknown as CreateFlowInput['blocks']).some(
      (b) => b.definitionId === 'webhook-trigger',
    );
    const flow = await prisma.flow.create({
      data: {
        userId,
        name: `${existing.name} (copy)`,
        description: existing.description,
        blocks: existing.blocks as Prisma.InputJsonValue,
        connections: existing.connections as Prisma.InputJsonValue,
        status: 'draft',
        webhookToken: hasWebhookTrigger ? generateWebhookToken() : null,
      },
    });
    return serialize(flow);
  },
};
