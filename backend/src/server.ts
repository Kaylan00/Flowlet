import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { env } from './env.js';
import { HttpError } from './lib/errors.js';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { flowsRoutes } from './modules/flows/flows.routes.js';
import { executionsRoutes } from './modules/executions/executions.routes.js';
import { webhooksRoutes } from './modules/webhooks/webhooks.routes.js';
import { credentialsRoutes } from './modules/credentials/credentials.routes.js';
import { startScheduler } from './modules/scheduler/scheduler.js';
import { prisma } from './lib/prisma.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(sensible);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });
  await app.register(authPlugin);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'Validation failed', issues: err.flatten() });
    }
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    const maybeStatus = (err as { statusCode?: number }).statusCode;
    if (typeof maybeStatus === 'number') {
      return reply.code(maybeStatus).send({ error: (err as Error).message });
    }
    app.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  app.get('/api/health', async () => ({ status: 'ok', now: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(flowsRoutes, { prefix: '/api/flows' });
  await app.register(executionsRoutes, { prefix: '/api/executions' });
  await app.register(webhooksRoutes, { prefix: '/api/webhooks' });
  await app.register(credentialsRoutes, { prefix: '/api/credentials' });

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    startScheduler(app.log);
    app.log.info(`Flowlet backend ready at http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
