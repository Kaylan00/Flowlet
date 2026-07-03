import { buildServer } from '../src/server.js';
import { prisma } from '../src/lib/prisma.js';

export async function createTestApp() {
  const app = await buildServer();
  await app.ready();
  return app;
}

export async function resetDatabase() {
  await prisma.execution.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.flow.deleteMany();
  await prisma.user.deleteMany();
}

interface RegisteredUser {
  token: string;
  user: { id: string; email: string; name: string };
}

export async function registerUser(
  app: Awaited<ReturnType<typeof createTestApp>>,
  overrides: Partial<{ email: string; password: string; name: string }> = {},
): Promise<RegisteredUser> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@flowlet.test`,
      password: overrides.password ?? 'super-secret-123',
      name: overrides.name ?? 'Test User',
    },
  });
  if (response.statusCode !== 201) {
    throw new Error(`Failed to register test user: ${response.body}`);
  }
  return response.json();
}
