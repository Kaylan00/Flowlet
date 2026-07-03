import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createCredentialSchema, updateCredentialSchema } from './credentials.schemas.js';
import { credentialsService } from './credentials.service.js';

const idParam = z.object({ id: z.string().min(1) });

export async function credentialsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/', async (req) => {
    return credentialsService.list(req.userId);
  });

  app.post('/', async (req, reply) => {
    const input = createCredentialSchema.parse(req.body);
    const cred = await credentialsService.create(req.userId, input);
    return reply.code(201).send(cred);
  });

  app.get('/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return credentialsService.get(req.userId, id);
  });

  const updateHandler = async (req: FastifyRequest) => {
    const { id } = idParam.parse(req.params);
    const input = updateCredentialSchema.parse(req.body);
    return credentialsService.update(req.userId, id, input);
  };

  app.put('/:id', updateHandler);
  app.patch('/:id', updateHandler);

  app.delete('/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await credentialsService.remove(req.userId, id);
    return reply.code(204).send();
  });
}
