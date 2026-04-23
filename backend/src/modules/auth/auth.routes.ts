import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from './auth.schemas.js';
import { authService } from './auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const user = await authService.register(input);
    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.code(201).send({ token, user });
  });

  app.post('/login', async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const user = await authService.login(input);
    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.send({ token, user });
  });

  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    return authService.me(req.userId);
  });
}
