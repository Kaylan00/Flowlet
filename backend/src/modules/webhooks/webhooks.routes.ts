import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { executionsService } from '../executions/executions.service.js';

const tokenParam = z.object({ token: z.string().min(10) });

export async function webhooksRoutes(app: FastifyInstance) {
  const handler = async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = tokenParam.parse(req.params);

    const flow = await prisma.flow.findUnique({ where: { webhookToken: token } });
    if (!flow) throw notFound('Webhook not found');

    if (flow.status !== 'active') {
      return reply.code(423).send({ error: 'Flow is not active' });
    }

    const payload = buildPayloadFromRequest(req);

    const execution = await executionsService.runFlow({
      flow: { id: flow.id, name: flow.name, blocks: flow.blocks, connections: flow.connections },
      userId: flow.userId,
      triggeredBy: 'webhook',
      triggerPayload: payload,
      logger: app.log,
    });

    return reply.send({
      executionId: execution.id,
      status: execution.status,
      duration: execution.duration,
    });
  };

  app.get('/:token', handler);
  app.post('/:token', handler);
  app.put('/:token', handler);
}

function buildPayloadFromRequest(req: FastifyRequest): Record<string, unknown> {
  return {
    method: req.method,
    query: (req.query as Record<string, unknown>) ?? {},
    body: req.body ?? {},
    headers: sanitizeHeaders(req.headers as Record<string, unknown>),
    receivedAt: new Date().toISOString(),
  };
}

function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (['authorization', 'cookie', 'set-cookie'].includes(lower)) continue;
    safe[lower] = value;
  }
  return safe;
}
