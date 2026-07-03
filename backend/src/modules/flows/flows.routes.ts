import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createFlowSchema, listFlowsQuerySchema, updateFlowSchema } from './flows.schemas.js';
import { flowsService } from './flows.service.js';
import { runFlowSchema, executionsService } from '../executions/executions.service.js';

const idParam = z.object({ id: z.string().min(1) });

export async function flowsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (req) => {
    const query = listFlowsQuerySchema.parse(req.query);
    return flowsService.list(req.userId, query);
  });

  app.post('/', async (req, reply) => {
    const input = createFlowSchema.parse(req.body);
    const flow = await flowsService.create(req.userId, input);
    return reply.code(201).send(flow);
  });

  app.get('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return flowsService.get(req.userId, id);
  });

  const updateHandler = async (req: FastifyRequest) => {
    const { id } = idParam.parse(req.params);
    const input = updateFlowSchema.parse(req.body);
    return flowsService.update(req.userId, id, input);
  };

  app.put('/:id', updateHandler);
  app.patch('/:id', updateHandler);

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await flowsService.remove(req.userId, id);
    return reply.code(204).send();
  });

  app.post('/:id/toggle', async (req) => {
    const { id } = idParam.parse(req.params);
    return flowsService.toggle(req.userId, id);
  });

  app.post('/:id/duplicate', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const flow = await flowsService.duplicate(req.userId, id);
    return reply.code(201).send(flow);
  });

  app.post('/:id/run', async (req) => {
    const { id } = idParam.parse(req.params);
    const input = runFlowSchema.parse(req.body ?? {});
    const flow = await flowsService.get(req.userId, id);
    return executionsService.runFlow({
      flow,
      userId: req.userId,
      triggeredBy: 'manual',
      triggerPayload: input.payload,
    });
  });
}
