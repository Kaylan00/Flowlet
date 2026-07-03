import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, registerUser, resetDatabase } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

function flowPayload(status: 'active' | 'draft' | 'inactive') {
  return {
    name: 'Webhook flow',
    status,
    blocks: [
      {
        id: 't1',
        definitionId: 'webhook-trigger',
        category: 'trigger' as const,
        label: 'Webhook',
        icon: 'zap',
        color: '#000',
        position: { x: 0, y: 0 },
        properties: [],
      },
      {
        id: 'b1',
        definitionId: 'console-log',
        category: 'output' as const,
        label: 'Log',
        icon: 'terminal',
        color: '#000',
        position: { x: 200, y: 0 },
        properties: [],
      },
    ],
    connections: [{ id: 't1->b1', sourceId: 't1', targetId: 'b1' }],
  };
}

describe('webhooks routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function authHeader() {
    const { token } = await registerUser(app);
    return { authorization: `Bearer ${token}` };
  }

  it('triggers an active flow and records the execution', async () => {
    const headers = await authHeader();
    const created = await app.inject({ method: 'POST', url: '/api/flows', headers, payload: flowPayload('active') });
    const { webhookToken } = created.json();

    const response = await app.inject({
      method: 'POST',
      url: `/api/webhooks/${webhookToken}`,
      payload: { ping: 'pong' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('success');
    expect(body.executionId).toEqual(expect.any(String));
  });

  it('refuses to trigger a flow that is not active', async () => {
    const headers = await authHeader();
    const created = await app.inject({ method: 'POST', url: '/api/flows', headers, payload: flowPayload('draft') });
    const { webhookToken } = created.json();

    const response = await app.inject({ method: 'POST', url: `/api/webhooks/${webhookToken}` });
    expect(response.statusCode).toBe(423);
  });

  it('returns 404 for an unknown webhook token', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/webhooks/does-not-exist-token' });
    expect(response.statusCode).toBe(404);
  });

  it('does not leak sensitive headers into the execution payload', async () => {
    const headers = await authHeader();
    const created = await app.inject({ method: 'POST', url: '/api/flows', headers, payload: flowPayload('active') });
    const { id, webhookToken } = created.json();

    await app.inject({
      method: 'POST',
      url: `/api/webhooks/${webhookToken}`,
      headers: { authorization: 'Bearer super-secret-should-not-leak', cookie: 'session=abc' },
      payload: {},
    });

    const executions = await app.inject({ method: 'GET', url: `/api/executions?flowId=${id}`, headers });
    const [execution] = executions.json();
    const logsAsText = JSON.stringify(execution.logs);
    expect(logsAsText).not.toContain('super-secret-should-not-leak');
    expect(logsAsText).not.toContain('session=abc');
  });
});
