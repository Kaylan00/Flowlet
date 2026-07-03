import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, registerUser, resetDatabase } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

const sampleFlow = {
  name: 'Ping on webhook',
  description: 'Logs the payload received via webhook',
  status: 'active' as const,
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

describe('flows routes', () => {
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

  it('creates a flow and assigns a webhook token when it has a webhook trigger', async () => {
    const headers = await authHeader();
    const response = await app.inject({ method: 'POST', url: '/api/flows', headers, payload: sampleFlow });

    expect(response.statusCode).toBe(201);
    const flow = response.json();
    expect(flow.name).toBe(sampleFlow.name);
    expect(flow.webhookToken).toEqual(expect.any(String));
  });

  it('lists only the requesting user flows, supports status filter and pagination', async () => {
    const headers = await authHeader();
    await app.inject({ method: 'POST', url: '/api/flows', headers, payload: sampleFlow });
    await app.inject({
      method: 'POST',
      url: '/api/flows',
      headers,
      payload: { ...sampleFlow, name: 'Draft flow', status: 'draft', blocks: [], connections: [] },
    });

    const all = await app.inject({ method: 'GET', url: '/api/flows', headers });
    expect(all.json()).toHaveLength(2);

    const onlyActive = await app.inject({ method: 'GET', url: '/api/flows?status=active', headers });
    expect(onlyActive.json()).toHaveLength(1);
    expect(onlyActive.json()[0].status).toBe('active');

    const limited = await app.inject({ method: 'GET', url: '/api/flows?limit=1', headers });
    expect(limited.json()).toHaveLength(1);
  });

  it('updates a flow via PUT and PATCH', async () => {
    const headers = await authHeader();
    const created = await app.inject({ method: 'POST', url: '/api/flows', headers, payload: sampleFlow });
    const { id } = created.json();

    const viaPut = await app.inject({ method: 'PUT', url: `/api/flows/${id}`, headers, payload: { name: 'Renamed via PUT' } });
    expect(viaPut.statusCode).toBe(200);
    expect(viaPut.json().name).toBe('Renamed via PUT');

    const viaPatch = await app.inject({ method: 'PATCH', url: `/api/flows/${id}`, headers, payload: { name: 'Renamed via PATCH' } });
    expect(viaPatch.statusCode).toBe(200);
    expect(viaPatch.json().name).toBe('Renamed via PATCH');
  });

  it('runs a flow manually and records an execution', async () => {
    const headers = await authHeader();
    const created = await app.inject({ method: 'POST', url: '/api/flows', headers, payload: sampleFlow });
    const { id } = created.json();

    const run = await app.inject({ method: 'POST', url: `/api/flows/${id}/run`, headers, payload: { payload: { hello: 'world' } } });
    expect(run.statusCode).toBe(200);
    expect(run.json().status).toBe('success');

    const executions = await app.inject({ method: 'GET', url: '/api/executions', headers });
    expect(executions.json()).toHaveLength(1);
  });

  it('blocks users from reading, editing or deleting flows they do not own', async () => {
    const ownerHeaders = await authHeader();
    const created = await app.inject({ method: 'POST', url: '/api/flows', headers: ownerHeaders, payload: sampleFlow });
    const { id } = created.json();

    const intruderHeaders = await authHeader();

    const getAttempt = await app.inject({ method: 'GET', url: `/api/flows/${id}`, headers: intruderHeaders });
    expect(getAttempt.statusCode).toBe(404);

    const patchAttempt = await app.inject({
      method: 'PATCH',
      url: `/api/flows/${id}`,
      headers: intruderHeaders,
      payload: { name: 'Hijacked' },
    });
    expect(patchAttempt.statusCode).toBe(404);

    const deleteAttempt = await app.inject({ method: 'DELETE', url: `/api/flows/${id}`, headers: intruderHeaders });
    expect(deleteAttempt.statusCode).toBe(404);

    const stillThere = await app.inject({ method: 'GET', url: `/api/flows/${id}`, headers: ownerHeaders });
    expect(stillThere.statusCode).toBe(200);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/flows' });
    expect(response.statusCode).toBe(401);
  });
});
