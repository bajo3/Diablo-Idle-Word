import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../app.js';
import { createTestPostgres, type TestPostgres } from './test-postgres.js';

const origin = 'http://localhost:5173';
let database: TestPostgres | undefined;
let server: ReturnType<typeof buildServer> | undefined;
let cookie = '';
let characterId = '';

function app(): ReturnType<typeof buildServer> {
  if (server === undefined) throw new Error('Server did not initialize.');
  return server;
}

beforeAll(async () => {
  database = await createTestPostgres();
  server = buildServer({ database: database.prisma, allowedOrigins: [origin] });
  const registered = await app().inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { origin, 'content-type': 'application/json' },
    payload: {
      email: 'town-routes@local.invalid',
      password: 'secure-password',
      displayName: 'Pueblo',
    },
  });
  expect(registered.statusCode).toBe(200);
  const rawCookie = registered.headers['set-cookie'];
  cookie =
    (Array.isArray(rawCookie) ? rawCookie[0] : rawCookie)
      ?.split(';')[0]
      ?.replace('brecha_session=', '') ?? '';
  const created = await app().inject({
    method: 'POST',
    url: '/api/characters',
    headers: { cookie: `brecha_session=${cookie}`, origin, 'content-type': 'application/json' },
    payload: { name: 'Muro' },
  });
  expect(created.statusCode).toBe(201);
  characterId = (created.json() as { character: { id: string } }).character.id;
  await database.prisma.character.update({ where: { id: characterId }, data: { gold: 200n } });
});

afterAll(async () => {
  await server?.close();
  await database?.cleanup();
});

describe('town HTTP contract', () => {
  it('exposes town snapshot, tutorial, merchant purchase and chest movement', async () => {
    const headers = {
      cookie: `brecha_session=${cookie}`,
      origin,
      'content-type': 'application/json',
    };
    const town = await app().inject({
      method: 'GET',
      url: `/api/characters/${characterId}/town`,
      headers,
    });
    expect(town.statusCode).toBe(200);
    expect(town.json()).toMatchObject({
      town: { characterId, portal: { active: true }, merchant: { items: expect.any(Array) } },
    });
    const tutorial = await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/town/tutorial`,
      headers,
      payload: {
        operationId: 'route:tutorial:start',
        tutorialId: 'town-intro.v1',
        action: 'start',
      },
    });
    expect(tutorial.statusCode).toBe(200);
    const buy = await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/merchant/buy`,
      headers,
      payload: { operationId: 'route:buy:one', stockId: 'merchant.iron-sword' },
    });
    expect(buy.statusCode).toBe(200);
    const itemId = (
      buy.json() as { receipt: { snapshot: { items: Array<{ instanceId: string }> } } }
    ).receipt.snapshot.items[0]!.instanceId;
    const deposit = await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/chest/deposit`,
      headers,
      payload: { operationId: 'route:deposit:one', itemId },
    });
    expect(deposit.statusCode).toBe(200);
    expect(deposit.json()).toMatchObject({
      receipt: { chest: { items: [{ instanceId: itemId }] }, inventory: { items: [] } },
    });
    const replay = await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/chest/deposit`,
      headers,
      payload: { operationId: 'route:deposit:one', itemId },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({ receipt: { replayed: true } });
  });
});
