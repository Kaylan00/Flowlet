import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { executionsService } from './executions.service.js';

const idParam = z.object({ id: z.string().min(1) });
const listQuery = z.object({
  flowId: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export async function executionsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (req) => {
    const query = listQuery.parse(req.query);
    return executionsService.list(req.userId, query);
  });

  app.get('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return executionsService.get(req.userId, id);
  });

  app.post('/:id/retry', async (req) => {
    const { id } = idParam.parse(req.params);
    return executionsService.retry(req.userId, id);
  });
}
