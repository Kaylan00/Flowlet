import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, resetDatabase } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('auth routes', () => {
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

  it('registers a new user and returns a token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'ana@flowlet.test', password: 'super-secret-123', name: 'Ana' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user.email).toBe('ana@flowlet.test');
  });

  it('rejects a duplicate email on register', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'dup@flowlet.test', password: 'super-secret-123', name: 'Dup' },
    });

    const second = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'dup@flowlet.test', password: 'other-password', name: 'Dup 2' },
    });

    expect(second.statusCode).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'login@flowlet.test', password: 'super-secret-123', name: 'Login' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'login@flowlet.test', password: 'super-secret-123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().token).toEqual(expect.any(String));
  });

  it('rejects login with a wrong password', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'wrongpass@flowlet.test', password: 'super-secret-123', name: 'Wrong' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'wrongpass@flowlet.test', password: 'not-the-password' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns the authenticated user on /me and 401 without a token', async () => {
    const registered = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'me@flowlet.test', password: 'super-secret-123', name: 'Me' },
    });
    const { token } = registered.json();

    const authed = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(authed.statusCode).toBe(200);
    expect(authed.json().email).toBe('me@flowlet.test');

    const anonymous = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(anonymous.statusCode).toBe(401);
  });
});
