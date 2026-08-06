import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { buildServer } from '../app.js';
import type { TestPostgres } from '../persistence/test-postgres.js';
import { createTestPostgres } from '../persistence/test-postgres.js';

const origin = 'http://localhost:5173';
let database: TestPostgres | undefined;
let server: ReturnType<typeof buildServer> | undefined;
let serverUrl = '';
let rewardCharacterId: string | undefined;

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

async function websocketMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  const queues = websocketMessageQueues;
  let queue = queues.get(socket);
  if (queue === undefined) {
    queue = { messages: [], waiters: [] };
    queues.set(socket, queue);
    socket.on('message', (data) => {
      try {
        const value: unknown = JSON.parse(data.toString());
        if (typeof value !== 'object' || value === null)
          throw new Error('Websocket message was not an object.');
        const message = value as Record<string, unknown>;
        const waiter = queue!.waiters.shift();
        if (waiter === undefined) queue!.messages.push(message);
        else waiter.resolve(message);
      } catch (error) {
        const waiter = queue!.waiters.shift();
        if (waiter !== undefined)
          waiter.reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    socket.on('error', (error) => {
      while (queue!.waiters.length > 0) queue!.waiters.shift()!.reject(error);
    });
  }
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for websocket message.')),
      2000,
    );
    const message = queue!.messages.shift();
    if (message !== undefined) {
      clearTimeout(timeout);
      resolve(message);
      return;
    }
    queue!.waiters.push({
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
  });
}

const websocketMessageQueues = new WeakMap<
  WebSocket,
  {
    messages: Record<string, unknown>[];
    waiters: Array<{
      resolve: (value: Record<string, unknown>) => void;
      reject: (error: Error) => void;
    }>;
  }
>();

beforeAll(async () => {
  database = await createTestPostgres();
  server = buildServer({
    allowedOrigins: [origin],
    database: database.prisma,
    initialForestEnemies: (instanceId, defaults) =>
      instanceId.includes(rewardCharacterId ?? '\0')
        ? defaults.map((enemy, index) =>
            index === 0 ? { ...enemy, health: 1, maxHealth: 1 } : enemy,
          )
        : defaults,
  });
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

  it('creates, selects and soft deletes only an owned available class', async () => {
    const ownerToken = await register('owner@local.invalid', 'Owner');
    const otherToken = await register('other@local.invalid', 'Other');
    const created = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(ownerToken),
      payload: { name: '  Muralla  ', class: 'BARBARIAN' },
    });
    expect(created.statusCode).toBe(201);
    const createdCharacter = created.json<{
      character: { id: string; name: string; class: string };
    }>().character;
    const characterId = createdCharacter.id;
    expect(createdCharacter.name).toBe('Muralla');
    expect(createdCharacter.class).toBe('BARBARIAN');
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
    expect(first.json()).toMatchObject({
      receipt: {
        serverState: {
          saveVersion: 2,
          progression: { level: 1, experience: '0', attributePoints: 0 },
          forestProgress: { formatVersion: 1, stateSchemaVersion: 1 },
        },
      },
    });
    expect(
      await db().prisma.character.findUniqueOrThrow({
        where: { id: characterId },
        select: { revision: true },
      }),
    ).toEqual({ revision: 2 });
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

  it('applies checkpoint experienceGained once, capped, and reflects it in the receipt', async () => {
    const token = await register('checkpoint-xp@local.invalid', 'Checkpoint Xp');
    const created = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(token),
      payload: { name: 'Cronista' },
    });
    const characterId = created.json<{ character: { id: string } }>().character.id;
    await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/select`,
      headers: authenticatedHeaders(token),
      payload: {},
    });
    const intent = {
      operationId: '33333333-3333-4333-8333-333333333333',
      schemaVersion: 1,
      characterId,
      sceneId: 'local:test',
      checkpointId: 'test:gate',
      // Comfortably above the 5,000 cap: the receipt must reflect the clamped amount, not this one.
      experienceGained: '999999',
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
    expect([responses[0]!.statusCode, responses[1]!.statusCode]).toEqual([201, 201]);
    // Both responses describe the same, once-applied grant — a retried request must not double it.
    for (const response of responses)
      expect(response.json()).toMatchObject({
        receipt: { serverState: { progression: { experience: '5000' } } },
      });
    expect(
      await db().prisma.characterProgress.findUniqueOrThrow({
        where: { characterId },
        select: { experience: true },
      }),
    ).toEqual({ experience: 5000n });
  });

  it('hydrates the versioned forest progress snapshot only for its owner', async () => {
    const token = await register('forest-route@local.invalid', 'Forest Route');
    const created = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(token),
      payload: { name: 'Bosque' },
    });
    const characterId = created.json<{ character: { id: string } }>().character.id;
    const response = await app().inject({
      method: 'GET',
      url: `/api/characters/${characterId}/forest-progress`,
      headers: { cookie: `brecha_session=${token}`, origin },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      progress: {
        formatVersion: 1,
        stateSchemaVersion: 1,
        characterId,
        revision: 1,
        payload: { level: 1, xpInLevel: 0, bestLevel: 1, countedDefeats: [] },
      },
    });
    const otherToken = await register('forest-other@local.invalid', 'Forest Other');
    const forbidden = await app().inject({
      method: 'GET',
      url: `/api/characters/${characterId}/forest-progress`,
      headers: { cookie: `brecha_session=${otherToken}`, origin },
    });
    expect(forbidden.statusCode).toBe(404);
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

  it('routes interaction intents through server authority with replay and sequence protection', async () => {
    const token = await register('socket-interaction@local.invalid', 'Socket Interaction');
    const created = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(token),
      payload: { name: 'Interacción' },
    });
    const characterId = created.json<{ character: { id: string } }>().character.id;
    expect(
      (
        await app().inject({
          method: 'POST',
          url: `/api/characters/${characterId}/select`,
          headers: authenticatedHeaders(token),
          payload: {},
        })
      ).statusCode,
    ).toBe(200);

    const endpoint = serverUrl.replace('http://', 'ws://') + '/ws';
    const socket = new WebSocket(endpoint, {
      headers: { Origin: origin, Cookie: `brecha_session=${token}` },
    });
    const opened = new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    const authenticated = websocketMessage(socket);
    await opened;
    expect(await authenticated).toMatchObject({ type: 'authenticated', protocolVersion: 1 });

    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'ws-move-1',
        sequence: 1,
        type: 'MOVE_INTENT',
        payload: { x: 1, y: 0 },
      }),
    );
    await expect(websocketMessage(socket)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'ws-move-1',
    });
    await expect(websocketMessage(socket)).resolves.toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'ws-move-1',
      payload: { instanceId: `instance:corrupted_forest:${characterId}`, tick: 0 },
    });

    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'ws-interaction-1',
        sequence: 2,
        type: 'INTERACT_INTENT',
        payload: { targetId: 'chest:forest:01' },
      }),
    );
    await expect(websocketMessage(socket)).resolves.toMatchObject({
      type: 'INTERACTION_RESULT',
      requestId: 'ws-interaction-1',
      payload: { replayed: false, receipt: { accepted: true, kind: 'chest' }, stateRevision: 2 },
    });
    await expect(websocketMessage(socket)).resolves.toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'ws-interaction-1',
    });

    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'ws-interaction-1',
        sequence: 3,
        type: 'INTERACT_INTENT',
        payload: { targetId: 'chest:forest:01' },
      }),
    );
    await expect(websocketMessage(socket)).resolves.toMatchObject({
      type: 'INTERACTION_RESULT',
      payload: { replayed: true, receipt: { accepted: true }, stateRevision: 2 },
    });
    await expect(websocketMessage(socket)).resolves.toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'ws-interaction-1',
    });

    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'ws-interaction-invalid',
        sequence: 4,
        type: 'INTERACT_INTENT',
        payload: { targetId: 'chest:forest:01', actorPosition: { x: 220, y: 160 } },
      }),
    );
    await expect(websocketMessage(socket)).resolves.toMatchObject({
      type: 'COMMAND_REJECTED',
      payload: { code: 'INVALID_PAYLOAD' },
    });

    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'ws-interaction-stale',
        sequence: 3,
        type: 'INTERACT_INTENT',
        payload: { targetId: 'chest:forest:01' },
      }),
    );
    await expect(websocketMessage(socket)).resolves.toMatchObject({
      type: 'COMMAND_REJECTED',
      payload: { code: 'STALE_SEQUENCE' },
    });
    socket.close();
  });

  it('grants an individual enemy reward once through the authoritative WebSocket flow', async () => {
    const token = await register('enemy-reward-ws@local.invalid', 'Enemy Reward WS');
    const created = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(token),
      payload: { name: 'Enemy Reward Guardian' },
    });
    const characterId = created.json<{ character: { id: string } }>().character.id;
    rewardCharacterId = characterId;
    expect(
      (
        await app().inject({
          method: 'POST',
          url: `/api/characters/${characterId}/select`,
          headers: authenticatedHeaders(token),
          payload: {},
        })
      ).statusCode,
    ).toBe(200);

    const endpoint = serverUrl.replace('http://', 'ws://') + '/ws';
    const socket = new WebSocket(endpoint, {
      headers: { Origin: origin, Cookie: `brecha_session=${token}` },
    });
    const authenticated = websocketMessage(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    await expect(authenticated).resolves.toMatchObject({ type: 'authenticated' });

    socket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'reward-init',
        sequence: 1,
        type: 'MOVE_INTENT',
        payload: { x: 0, y: 0 },
      }),
    );
    await expect(websocketMessage(socket)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'reward-init',
    });
    const initialSnapshot = await websocketMessage(socket);
    expect(initialSnapshot).toMatchObject({ type: 'INSTANCE_SNAPSHOT', requestId: 'reward-init' });
    let targetId = (initialSnapshot.payload as { enemies: Array<{ enemyId: string }> }).enemies[0]!
      .enemyId;
    let reward: Record<string, unknown> | undefined;
    for (let attempt = 0; attempt < 8 && reward === undefined; attempt += 1) {
      const requestId = `reward-attack-${attempt}`;
      const abilityId = attempt === 3 ? 'ability.guardian.power_strike' : 'ability.guardian.slash';
      socket.send(
        JSON.stringify({
          protocolVersion: 1,
          requestId,
          sequence: attempt + 2,
          type: 'COMBAT_INTENT',
          payload: {
            abilityId,
            ...(targetId === undefined ? {} : { targetId }),
            facing: { x: 1, y: 0 },
          },
        }),
      );
      let accepted = false;
      while (!accepted) {
        const message = await websocketMessage(socket);
        accepted = message.type === 'COMMAND_ACCEPTED' && message.requestId === requestId;
      }
      let resolved = false;
      let snapshot = false;
      let defeated = false;
      while (!resolved || !snapshot || (defeated && reward === undefined)) {
        const message = await websocketMessage(socket);
        if (message.type === 'COMBAT_RESULT' && message.requestId === requestId) {
          const payload = message.payload as {
            pending?: boolean;
            defeated?: boolean;
            hits?: Array<{ targetId: string }>;
          };
          if (payload.hits?.[0]?.targetId !== undefined) targetId = payload.hits[0].targetId;
          defeated ||= payload.defeated === true;
          resolved = payload.pending === false;
        }
        if (message.type === 'INSTANCE_SNAPSHOT' && message.requestId === requestId)
          snapshot = true;
        if (message.type === 'REWARD_GRANTED') reward = message;
      }
      if (reward === undefined) await new Promise((resolve) => setTimeout(resolve, 550));
    }
    expect(reward).toMatchObject({
      type: 'REWARD_GRANTED',
      payload: {
        source: 'enemy_defeat',
        characterId,
        experienceDelta: expect.stringMatching(/^\d+$/),
        goldDelta: expect.stringMatching(/^\d+$/),
        visibility: 'private',
      },
    });
    const results = await app().inject({
      method: 'GET',
      url: `/api/characters/${characterId}/rewards/recent`,
      headers: authenticatedHeaders(token),
    });
    expect(results.statusCode).toBe(200);
    expect(
      results.json<{ results: Array<{ characterId: string; visibility: string }> }>().results[0],
    ).toMatchObject({
      characterId,
      visibility: 'private',
    });
    expect(
      await db().prisma.rewardLog.count({
        where: { characterId, source: 'enemy_defeat' },
      }),
    ).toBe(1);
    socket.close();
  });

  it('synchronizes a two-player party, starts one shared instance and broadcasts movement snapshots', async () => {
    const firstToken = await register('party-one@local.invalid', 'Party One');
    const secondToken = await register('party-two@local.invalid', 'Party Two');
    const firstCreated = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(firstToken),
      payload: { name: 'Party One Guardian' },
    });
    const secondCreated = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(secondToken),
      payload: { name: 'Party Two Guardian' },
    });
    const firstCharacterId = firstCreated.json<{ character: { id: string } }>().character.id;
    const secondCharacterId = secondCreated.json<{ character: { id: string } }>().character.id;
    expect(
      (
        await app().inject({
          method: 'POST',
          url: `/api/characters/${firstCharacterId}/select`,
          headers: authenticatedHeaders(firstToken),
          payload: {},
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app().inject({
          method: 'POST',
          url: `/api/characters/${secondCharacterId}/select`,
          headers: authenticatedHeaders(secondToken),
          payload: {},
        })
      ).statusCode,
    ).toBe(200);

    const endpoint = serverUrl.replace('http://', 'ws://') + '/ws';
    const firstSocket = new WebSocket(endpoint, {
      headers: { Origin: origin, Cookie: `brecha_session=${firstToken}` },
    });
    const secondSocket = new WebSocket(endpoint, {
      headers: { Origin: origin, Cookie: `brecha_session=${secondToken}` },
    });
    const firstAuthenticated = websocketMessage(firstSocket);
    const secondAuthenticated = websocketMessage(secondSocket);
    await Promise.all(
      [firstSocket, secondSocket].map(
        (socket) =>
          new Promise<void>((resolve, reject) => {
            socket.once('open', resolve);
            socket.once('error', reject);
          }),
      ),
    );
    await expect(firstAuthenticated).resolves.toMatchObject({ type: 'authenticated' });
    await expect(secondAuthenticated).resolves.toMatchObject({ type: 'authenticated' });

    firstSocket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'party-create',
        sequence: 1,
        type: 'PARTY_CREATE_INTENT',
        payload: {},
      }),
    );
    await expect(websocketMessage(firstSocket)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'party-create',
    });
    const createdParty = await websocketMessage(firstSocket);
    expect(createdParty).toMatchObject({
      type: 'PARTY_SNAPSHOT',
      payload: { status: 'LOBBY', members: [{ characterId: firstCharacterId, ready: true }] },
    });
    const joinCode = (createdParty.payload as { joinCode: string }).joinCode;

    secondSocket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'party-join',
        sequence: 1,
        type: 'PARTY_JOIN_INTENT',
        payload: { joinCode },
      }),
    );
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'party-join',
    });
    await expect(websocketMessage(firstSocket)).resolves.toMatchObject({
      type: 'PARTY_SNAPSHOT',
      payload: { members: [{ characterId: firstCharacterId }, { characterId: secondCharacterId }] },
    });
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'PARTY_SNAPSHOT',
      payload: { members: [{ characterId: firstCharacterId }, { characterId: secondCharacterId }] },
    });

    secondSocket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'party-ready',
        sequence: 2,
        type: 'PARTY_READY_INTENT',
        payload: { ready: true },
      }),
    );
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'party-ready',
    });
    await expect(websocketMessage(firstSocket)).resolves.toMatchObject({
      type: 'PARTY_SNAPSHOT',
      payload: { members: [{ ready: true }, { ready: true }] },
    });
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({ type: 'PARTY_SNAPSHOT' });

    firstSocket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'party-start',
        sequence: 2,
        type: 'PARTY_START_INTENT',
        payload: { zoneId: 'corrupted_forest', difficulty: 'normal' },
      }),
    );
    await expect(websocketMessage(firstSocket)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'party-start',
    });
    await expect(websocketMessage(firstSocket)).resolves.toMatchObject({
      type: 'PARTY_SNAPSHOT',
      payload: {
        status: 'ACTIVE',
        members: [{ characterId: firstCharacterId }, { characterId: secondCharacterId }],
      },
    });
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'PARTY_SNAPSHOT',
      payload: { status: 'ACTIVE' },
    });
    const firstInstanceSnapshot = await websocketMessage(firstSocket);
    expect(firstInstanceSnapshot).toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      payload: {
        players: [{ characterId: firstCharacterId }, { characterId: secondCharacterId }],
        objectives: [
          {
            objectiveId: 'objective.forest.level',
            mode: 'endless_forest',
            status: 'active',
            progress: 1,
            target: 20,
          },
        ],
      },
    });
    expect((firstInstanceSnapshot.payload as { enemies: unknown[] }).enemies).toHaveLength(3);
    const enemyId = (firstInstanceSnapshot.payload as { enemies: Array<{ enemyId: string }> })
      .enemies[0]!.enemyId;
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      payload: { players: [{ characterId: firstCharacterId }, { characterId: secondCharacterId }] },
    });

    secondSocket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'party-move',
        sequence: 3,
        type: 'MOVE_INTENT',
        payload: { x: 1, y: 0 },
      }),
    );
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'party-move',
    });
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'party-move',
    });
    await expect(websocketMessage(firstSocket)).resolves.toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'party-move',
      payload: { players: [{ characterId: firstCharacterId }, { characterId: secondCharacterId }] },
    });
    secondSocket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'party-combat',
        sequence: 4,
        type: 'COMBAT_INTENT',
        payload: { abilityId: 'ability.guardian.slash', targetId: enemyId },
      }),
    );
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'party-combat',
    });
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'COMBAT_RESULT',
      requestId: 'party-combat',
      payload: { replayed: false, pending: true, hits: [] },
    });
    const secondCombatSnapshot = await websocketMessage(secondSocket);
    const firstCombatSnapshot = await websocketMessage(firstSocket);
    expect(secondCombatSnapshot).toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'party-combat',
    });
    expect(firstCombatSnapshot).toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'party-combat',
    });
    for (const snapshot of [secondCombatSnapshot, firstCombatSnapshot]) {
      const enemies = (snapshot.payload as { enemies: Array<{ enemyId: string }> }).enemies;
      expect(enemies.find((enemy) => enemy.enemyId === enemyId)).toBeDefined();
    }
    await expect(websocketMessage(secondSocket)).resolves.toMatchObject({
      type: 'COMBAT_RESULT',
      requestId: 'party-combat',
      payload: {
        targetId: enemyId,
        replayed: false,
        pending: false,
        hits: [{ targetId: enemyId }],
      },
    });
    await expect(websocketMessage(firstSocket)).resolves.toMatchObject({
      type: 'COMBAT_RESULT',
      requestId: 'party-combat',
      payload: {
        targetId: enemyId,
        replayed: false,
        pending: false,
        hits: [{ targetId: enemyId }],
      },
    });
    const secondResolvedCombatSnapshot = await websocketMessage(secondSocket);
    const firstResolvedCombatSnapshot = await websocketMessage(firstSocket);
    expect(secondResolvedCombatSnapshot).toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'party-combat',
    });
    expect(firstResolvedCombatSnapshot).toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'party-combat',
    });
    firstSocket.close();
    const reconnected = new WebSocket(endpoint, {
      headers: { Origin: origin, Cookie: `brecha_session=${firstToken}` },
    });
    const reconnectedAuthenticated = websocketMessage(reconnected);
    await new Promise<void>((resolve, reject) => {
      reconnected.once('open', resolve);
      reconnected.once('error', reject);
    });
    await expect(reconnectedAuthenticated).resolves.toMatchObject({ type: 'authenticated' });
    await expect(websocketMessage(reconnected)).resolves.toMatchObject({
      type: 'PARTY_SNAPSHOT',
      requestId: 'session',
      payload: { status: 'ACTIVE' },
    });
    await expect(websocketMessage(reconnected)).resolves.toMatchObject({
      type: 'INSTANCE_SNAPSHOT',
      requestId: 'session',
      payload: { players: [{ characterId: firstCharacterId }, { characterId: secondCharacterId }] },
    });
    reconnected.close();
    secondSocket.close();
  });

  it('keeps a lobby when the leader disconnects and restores it on reconnect', async () => {
    const token = await register('party-lobby-reconnect@local.invalid', 'Lobby Reconnect');
    const created = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: authenticatedHeaders(token),
      payload: { name: 'Lobby Guardian' },
    });
    const characterId = created.json<{ character: { id: string } }>().character.id;
    expect(
      (
        await app().inject({
          method: 'POST',
          url: `/api/characters/${characterId}/select`,
          headers: authenticatedHeaders(token),
          payload: {},
        })
      ).statusCode,
    ).toBe(200);

    const endpoint = serverUrl.replace('http://', 'ws://') + '/ws';
    const firstSocket = new WebSocket(endpoint, {
      headers: { Origin: origin, Cookie: `brecha_session=${token}` },
    });
    const firstAuthenticated = websocketMessage(firstSocket);
    await new Promise<void>((resolve, reject) => {
      firstSocket.once('open', resolve);
      firstSocket.once('error', reject);
    });
    await expect(firstAuthenticated).resolves.toMatchObject({ type: 'authenticated' });
    firstSocket.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'lobby-create',
        sequence: 1,
        type: 'PARTY_CREATE_INTENT',
        payload: {},
      }),
    );
    await expect(websocketMessage(firstSocket)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'lobby-create',
    });
    const createdParty = await websocketMessage(firstSocket);
    expect(createdParty).toMatchObject({
      type: 'PARTY_SNAPSHOT',
      payload: { status: 'LOBBY', leaderCharacterId: characterId },
    });
    const joinCode = (createdParty.payload as { joinCode: string }).joinCode;
    const firstClosed = new Promise<void>((resolve) => firstSocket.once('close', () => resolve()));
    firstSocket.close();
    await firstClosed;

    const reconnected = new WebSocket(endpoint, {
      headers: { Origin: origin, Cookie: `brecha_session=${token}` },
    });
    const reconnectedAuthenticated = websocketMessage(reconnected);
    await new Promise<void>((resolve, reject) => {
      reconnected.once('open', resolve);
      reconnected.once('error', reject);
    });
    await expect(reconnectedAuthenticated).resolves.toMatchObject({ type: 'authenticated' });
    await expect(websocketMessage(reconnected)).resolves.toMatchObject({
      type: 'PARTY_SNAPSHOT',
      requestId: 'session',
      payload: {
        status: 'LOBBY',
        joinCode,
        leaderCharacterId: characterId,
        members: [{ characterId, ready: true, leader: true }],
      },
    });

    reconnected.send(
      JSON.stringify({
        protocolVersion: 1,
        requestId: 'lobby-leave',
        sequence: 1,
        type: 'PARTY_LEAVE_INTENT',
        payload: {},
      }),
    );
    await expect(websocketMessage(reconnected)).resolves.toMatchObject({
      type: 'COMMAND_ACCEPTED',
      requestId: 'lobby-leave',
    });
    reconnected.close();
  });
});
