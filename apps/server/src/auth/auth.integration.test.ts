import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { buildServer } from '../app.js';
import type { TestPostgres } from '../persistence/test-postgres.js';
import { createTestPostgres } from '../persistence/test-postgres.js';

const origin = 'http://localhost:5173';
let database: TestPostgres | undefined;
let server: ReturnType<typeof buildServer> | undefined;
let serverUrl = '';

function app(): ReturnType<typeof buildServer> {
  if (server === undefined) throw new Error('Server did not initialize.');
  return server;
}

function db(): TestPostgres {
  if (database === undefined) throw new Error('Database did not initialize.');
  return database;
}

function cookieFrom(response: {
  headers: Record<string, string | string[] | number | undefined>;
}): string {
  const raw = response.headers['set-cookie'];
  const cookie = Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw : undefined;
  const match = cookie?.match(/^brecha_session=([^;]+)/);
  if (match?.[1] === undefined) throw new Error('Missing session cookie.');
  return match[1];
}

async function register(email: string, displayName: string): Promise<string> {
  const response = await app().inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { origin, 'content-type': 'application/json' },
    payload: { email, password: 'secure-password', displayName },
  });
  expect(response.statusCode).toBe(200);
  return cookieFrom(response);
}

function authenticatedHeaders(cookie: string): Record<string, string> {
  return { cookie: `brecha_session=${cookie}`, origin, 'content-type': 'application/json' };
}

async function rejectedWebSocket(
  endpoint: string,
  headers: Record<string, string>,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(endpoint, { headers });
    socket.once('unexpected-response', (_request, response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    socket.once('open', () => {
      socket.close();
      reject(new Error('WebSocket unexpectedly upgraded.'));
    });
    socket.once('error', reject);
  });
}

beforeAll(async () => {
  database = await createTestPostgres();
  server = buildServer({ allowedOrigins: [origin], database: database.prisma });
  serverUrl = await server.listen({ host: '127.0.0.1', port: 0 });
});

afterAll(async () => {
  await server?.close();
  await database?.cleanup();
});

describe('Paso 5 authentication and protected characters', () => {
  it('stores only a session hash, introspects concurrently without rotation and revokes logout idempotently', async () => {
    const token = await register('first@local.invalid', 'Ayla');
    const session = await db().prisma.session.findFirstOrThrow({
      where: { user: { email: 'first@local.invalid' } },
    });
    expect(session.tokenHash).toHaveLength(64);
    expect(session.tokenHash).not.toBe(token);
    expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());

    const sessionsBefore = await db().prisma.session.count({
      where: { user: { email: 'first@local.invalid' } },
    });
    const recovered = await Promise.all(
      [0, 1].map(async () =>
        app().inject({
          method: 'GET',
          url: '/api/auth/session',
          headers: { cookie: `brecha_session=${token}` },
        }),
      ),
    );
    expect(recovered.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(recovered.map((response) => response.headers['set-cookie'])).toEqual([
      undefined,
      undefined,
    ]);
    expect(
      await db().prisma.session.count({ where: { user: { email: 'first@local.invalid' } } }),
    ).toBe(sessionsBefore);
    expect(
      (
        await app().inject({
          method: 'GET',
          url: '/api/profile',
          headers: { cookie: `brecha_session=${token}` },
        })
      ).statusCode,
    ).toBe(200);

    const logout = await app().inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: authenticatedHeaders(token),
      payload: {},
    });
    expect(logout.statusCode).toBe(204);
    const repeatedLogout = await app().inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { ...authenticatedHeaders(token), cookie: `brecha_session=${token}` },
      payload: {},
    });
    expect(repeatedLogout.statusCode).toBe(204);
  });

  it('revokes a prior cookie only after successful login', async () => {
    const priorToken = await register('rotate@local.invalid', 'Rotación');
    const login = await app().inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: authenticatedHeaders(priorToken),
      payload: { email: 'rotate@local.invalid', password: 'secure-password' },
    });
    expect(login.statusCode).toBe(200);
    const replacementToken = cookieFrom(login);
    expect(replacementToken).not.toBe(priorToken);
    expect(
      (
        await app().inject({
          method: 'GET',
          url: '/api/profile',
          headers: { cookie: `brecha_session=${priorToken}` },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app().inject({
          method: 'GET',
          url: '/api/profile',
          headers: { cookie: `brecha_session=${replacementToken}` },
        })
      ).statusCode,
    ).toBe(200);
  });

  it('does not enumerate login failures and requires allowed JSON origins for mutations', async () => {
    const unknown = await app().inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin, 'content-type': 'application/json' },
      payload: { email: 'unknown@local.invalid', password: 'secure-password' },
    });
    const knownToken = await register('known@local.invalid', 'Nara');
    const wrongPassword = await app().inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin, 'content-type': 'application/json' },
      payload: { email: 'known@local.invalid', password: 'wrong-password' },
    });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrongPassword.json());
    expect(
      (
        await app().inject({
          method: 'PATCH',
          url: '/api/profile',
          headers: { cookie: `brecha_session=${knownToken}`, 'content-type': 'application/json' },
          payload: { displayName: 'No Origin' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app().inject({
          method: 'PATCH',
          url: '/api/profile',
          headers: { cookie: `brecha_session=${knownToken}`, origin, 'content-type': 'text/plain' },
          payload: 'nope',
        })
      ).statusCode,
    ).toBe(400);
  });

  it('keeps status observable and rejects protected mutations during maintenance', async () => {
    const maintenance = buildServer({
      allowedOrigins: [origin],
      database: db().prisma,
      status: 'maintenance',
    });
    try {
      const token = await register('maintenance@local.invalid', 'Mantenimiento');
      const status = await maintenance.inject({ method: 'GET', url: '/api/status' });
      const update = await maintenance.inject({
        method: 'PATCH',
        url: '/api/profile',
        headers: authenticatedHeaders(token),
        payload: { displayName: 'No cambia' },
      });

      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({ status: 'maintenance' });
      expect(update.statusCode).toBe(503);
      expect(update.json()).toEqual({ error: 'maintenance' });
    } finally {
      await maintenance.close();
    }
  });

  it('creates, selects and soft deletes only an owned available Guardian', async () => {
    const ownerToken = await register('owner@local.invalid', 'Owner');
    const otherToken = await register('other@local.invalid', 'Other');
    const created = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(ownerToken),
      payload: { name: '  Muralla  ' },
    });
    expect(created.statusCode).toBe(201);
    const characterId = created.json<{ character: { id: string; name: string } }>().character.id;
    expect(created.json<{ character: { name: string } }>().character.name).toBe('Muralla');
    expect(
      (
        await app().inject({
          method: 'POST',
          url: '/api/characters',
          headers: authenticatedHeaders(ownerToken),
          payload: { name: 'muralla' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app().inject({
          method: 'POST',
          url: '/api/characters',
          headers: authenticatedHeaders(ownerToken),
          payload: { name: '<inválido>' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app().inject({
          method: 'POST',
          url: `/api/characters/${characterId}/select`,
          headers: authenticatedHeaders(otherToken),
          payload: {},
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app().inject({
          method: 'DELETE',
          url: `/api/characters/${characterId}`,
          headers: authenticatedHeaders(otherToken),
          payload: {},
        })
      ).statusCode,
    ).toBe(404);

    const selected = await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/select`,
      headers: authenticatedHeaders(ownerToken),
      payload: {},
    });
    expect(selected.statusCode).toBe(200);
    expect(
      (
        await app().inject({
          method: 'GET',
          url: '/api/characters',
          headers: { cookie: `brecha_session=${ownerToken}` },
        })
      ).json(),
    ).toEqual({
      characters: [
        expect.objectContaining({ id: characterId, selected: true, availability: 'AVAILABLE' }),
      ],
    });
    expect(
      (
        await app().inject({
          method: 'DELETE',
          url: `/api/characters/${characterId}`,
          headers: authenticatedHeaders(ownerToken),
          payload: {},
        })
      ).statusCode,
    ).toBe(204);
    expect(
      await db().prisma.character.findUniqueOrThrow({
        where: { id: characterId },
        select: { deletedAt: true },
      }),
    ).toEqual({ deletedAt: expect.any(Date) });
    expect(await db().prisma.characterSelection.count()).toBe(0);
    expect(
      (
        await app().inject({
          method: 'POST',
          url: '/api/characters',
          headers: authenticatedHeaders(ownerToken),
          payload: { name: 'muralla' },
        })
      ).statusCode,
    ).toBe(201);
  });

  it('records a selected Guardian checkpoint idempotently without accepting client state', async () => {
    const token = await register('checkpoint@local.invalid', 'Checkpoint');
    const created = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(token),
      payload: { name: 'Punto' },
    });
    const characterId = created.json<{ character: { id: string } }>().character.id;
    await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/select`,
      headers: authenticatedHeaders(token),
      payload: {},
    });
    const intent = {
      operationId: '11111111-1111-4111-8111-111111111111',
      schemaVersion: 1,
      characterId,
      sceneId: 'local:test',
      checkpointId: 'test:gate',
    };
    const responses = await Promise.all(
      [0, 1].map(() =>
        app().inject({
          method: 'POST',
          url: `/api/characters/${characterId}/progress/checkpoints`,
          headers: authenticatedHeaders(token),
          payload: intent,
        }),
      ),
    );
    const first = responses[0]!;
    const replay = responses[1]!;
    expect([first.statusCode, replay.statusCode]).toEqual([201, 201]);
    expect(first.json()).toMatchObject({
      receipt: {
        operationId: intent.operationId,
        serverState: { coordinates: { x: 160, y: 160 } },
      },
    });
    expect(
      (
        await app().inject({
          method: 'POST',
          url: `/api/characters/${characterId}/progress/checkpoints`,
          headers: authenticatedHeaders(token),
          payload: { ...intent, checkpointId: 'test:other' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app().inject({
          method: 'POST',
          url: `/api/characters/${characterId}/progress/checkpoints`,
          headers: authenticatedHeaders(token),
          payload: {
            ...intent,
            operationId: '22222222-2222-4222-8222-222222222222',
            coordinates: { x: 1 },
          },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('accepts a websocket only with the same valid session and allowed origin', async () => {
    const token = await register('socket@local.invalid', 'Socket');
    const endpoint = serverUrl.replace('http://', 'ws://') + '/ws';
    const message = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(endpoint, {
        headers: { Origin: origin, Cookie: `brecha_session=${token}` },
      });
      socket.once('message', (data) => {
        socket.close();
        resolve(data.toString());
      });
      socket.once('error', reject);
    });
    expect(JSON.parse(message)).toMatchObject({ type: 'authenticated', protocolVersion: 1 });

    expect(await rejectedWebSocket(endpoint, { Origin: origin })).toBe(401);
    expect(
      await rejectedWebSocket(endpoint, {
        Origin: 'https://evil.invalid',
        Cookie: `brecha_session=${token}`,
      }),
    ).toBe(403);
    expect(
      await rejectedWebSocket(endpoint, {
        Origin: origin,
        Cookie: `brecha_session=${token}tampered`,
      }),
    ).toBe(401);

    const expiredToken = await register('expired@local.invalid', 'Expirada');
    const expiredSession = await db().prisma.session.findFirstOrThrow({
      where: { user: { email: 'expired@local.invalid' } },
    });
    await db().prisma.session.update({
      where: { id: expiredSession.id },
      data: { expiresAt: new Date(expiredSession.createdAt.getTime() + 1) },
    });
    expect(
      await rejectedWebSocket(endpoint, {
        Origin: origin,
        Cookie: `brecha_session=${expiredToken}`,
      }),
    ).toBe(401);

    const revokedToken = await register('revoked@local.invalid', 'Revocada');
    const revokedSession = await db().prisma.session.findFirstOrThrow({
      where: { user: { email: 'revoked@local.invalid' } },
    });
    await db().prisma.session.update({
      where: { id: revokedSession.id },
      data: { revokedAt: new Date() },
    });
    expect(
      await rejectedWebSocket(endpoint, {
        Origin: origin,
        Cookie: `brecha_session=${revokedToken}`,
      }),
    ).toBe(401);
  });
});
