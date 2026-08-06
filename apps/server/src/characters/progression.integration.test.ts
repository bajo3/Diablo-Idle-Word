import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../app.js';
import type { TestPostgres } from '../persistence/test-postgres.js';
import { createTestPostgres } from '../persistence/test-postgres.js';

const origin = 'http://localhost:5173';
let database: TestPostgres | undefined;
let server: ReturnType<typeof buildServer> | undefined;

beforeAll(async () => {
  database = await createTestPostgres();
  server = buildServer({ allowedOrigins: [origin], database: database.prisma });
});
afterAll(async () => {
  await server?.close();
  await database?.cleanup();
});

describe('Paso 12 character progression', () => {
  it('rejects overspending and persists authoritative attributes and skill bar', async () => {
    if (server === undefined || database === undefined) throw new Error('test server unavailable');
    const registered = await server.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { origin, 'content-type': 'application/json' },
      payload: {
        email: `progression-${Date.now()}@local.invalid`,
        password: 'secure-password',
        displayName: 'Progression test',
      },
    });
    expect(registered.statusCode).toBe(200);
    const cookie = String(registered.headers['set-cookie']).match(/brecha_session=([^;]+)/)?.[1];
    if (cookie === undefined) throw new Error('missing session cookie');
    const headers = {
      cookie: `brecha_session=${cookie}`,
      origin,
      'content-type': 'application/json',
    };
    const created = await server.inject({
      method: 'POST',
      url: '/api/characters',
      headers,
      payload: { name: 'Progression Guardian' },
    });
    expect(created.statusCode).toBe(201);
    const characterId = (created.json() as { character: { id: string } }).character.id;
    await database.prisma.characterProgress.update({
      where: { characterId },
      data: { level: 2, experience: 100n, attributePoints: 3 },
    });

    const allocated = await server.inject({
      method: 'POST',
      url: `/api/characters/${characterId}/progression/attributes`,
      headers,
      payload: { operationId: 'progression:allocate:one', attribute: 'strength', amount: 2 },
    });
    expect(allocated.statusCode).toBe(200);
    expect(
      (
        allocated.json() as {
          receipt: { snapshot: { attributes: { strength: number }; attributePoints: number } };
        }
      ).receipt.snapshot,
    ).toMatchObject({ attributes: { strength: 12 }, attributePoints: 1 });

    const overspend = await server.inject({
      method: 'POST',
      url: `/api/characters/${characterId}/progression/attributes`,
      headers,
      payload: { operationId: 'progression:allocate:two', attribute: 'vitality', amount: 2 },
    });
    expect(overspend.statusCode).toBe(409);

    const learned = await server.inject({
      method: 'POST',
      url: `/api/characters/${characterId}/progression/skills/learn`,
      headers,
      payload: {
        operationId: 'progression:learn:power',
        abilityId: 'ability.guardian.power_strike',
      },
    });
    expect(learned.statusCode).toBe(200);
    const equipped = await server.inject({
      method: 'POST',
      url: `/api/characters/${characterId}/progression/skills/bar`,
      headers,
      payload: {
        operationId: 'progression:bar:power',
        abilityId: 'ability.guardian.power_strike',
        barSlot: 1,
      },
    });
    expect(equipped.statusCode).toBe(200);
    const replay = await server.inject({
      method: 'POST',
      url: `/api/characters/${characterId}/progression/attributes`,
      headers,
      payload: { operationId: 'progression:allocate:one', attribute: 'strength', amount: 2 },
    });
    expect(replay.statusCode).toBe(200);
    expect((replay.json() as { receipt: { replayed: boolean } }).receipt.replayed).toBe(true);
    const snapshot = await server.inject({
      method: 'GET',
      url: `/api/characters/${characterId}/progression`,
      headers,
    });
    expect(snapshot.statusCode).toBe(200);
    expect(snapshot.json()).toMatchObject({
      progression: {
        attributes: { strength: 12 },
        skills: expect.arrayContaining([
          expect.objectContaining({
            abilityId: 'ability.guardian.power_strike',
            equipped: true,
            barSlot: 1,
          }),
        ]),
      },
    });
  });
});
