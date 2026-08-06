import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../app.js';
import { createTestPostgres, type TestPostgres } from './test-postgres.js';

const origin = 'http://localhost:5173';
let database: TestPostgres | undefined;
let server: ReturnType<typeof buildServer> | undefined;
let nowMs = Date.now();

function db(): TestPostgres {
  if (database === undefined) throw new Error('Test database did not initialize.');
  return database;
}
function app(): ReturnType<typeof buildServer> {
  if (server === undefined) throw new Error('Server did not initialize.');
  return server;
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
function headers(cookie: string): Record<string, string> {
  return { cookie: `brecha_session=${cookie}`, origin, 'content-type': 'application/json' };
}

beforeAll(async () => {
  database = await createTestPostgres();
  server = buildServer({
    allowedOrigins: [origin],
    database: db().prisma,
    now: () => new Date(nowMs),
  });
});
afterAll(async () => {
  await server?.close();
  await database?.cleanup();
});

describe('Paso 16 modo ausente', () => {
  it('calibrates, survives a server-time window and claims concurrently once', async () => {
    const registered = await app().inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { origin, 'content-type': 'application/json' },
      payload: { email: 'away@local.invalid', password: 'secure-password', displayName: 'Away' },
    });
    expect(registered.statusCode).toBe(200);
    const cookie = cookieFrom(registered);
    const created = await app().inject({
      method: 'POST',
      url: '/api/characters',
      headers: headers(cookie),
      payload: { name: 'Calibrador' },
    });
    expect(created.statusCode).toBe(201);
    const characterId = (created.json() as { character: { id: string } }).character.id;
    expect(
      (
        await app().inject({
          method: 'POST',
          url: `/api/characters/${characterId}/select`,
          headers: headers(cookie),
          payload: {},
        })
      ).statusCode,
    ).toBe(200);

    const started = await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/away/calibration`,
      headers: headers(cookie),
      payload: {
        operationId: 'away:start:integration',
        zoneId: 'corrupted_forest',
        difficulty: 'normal',
      },
    });
    expect(started.statusCode).toBe(200);
    const calibrationId = (started.json() as { away: { calibration: { id: string } } }).away
      .calibration.id;
    await db().prisma.rewardLog.create({
      data: {
        id: 'reward:away:calibration',
        characterId,
        operationId: 'away:calibration:reward',
        requestHash: 'a'.repeat(64),
        kind: 'ECONOMY',
        goldDelta: 5n,
        materialsDelta: 1n,
        experienceDelta: 10n,
        goldBalanceAfter: 0n,
        materialsBalanceAfter: 0n,
        experienceBalanceAfter: 0n,
        source: 'enemy_defeat',
        sourceId: 'enemy:calibration',
        balanceVersion: 'test',
        dataVersion: 'test',
        formulaVersion: 'test',
        schemaVersion: 1,
        payload: { archetype: 'corrupted_minion' },
      },
    });
    const wallNow = Date.now();
    await db().prisma.awayCalibration.update({
      where: { id: calibrationId },
      data: { startedAt: new Date(wallNow - 300_000) },
    });
    nowMs = wallNow + 300_000;
    const completed = await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/away/calibration/${calibrationId}/complete`,
      headers: headers(cookie),
      payload: {},
    });
    expect(completed.statusCode).toBe(200);
    expect(
      (completed.json() as { away: { calibration: { state: string } } }).away.calibration.state,
    ).toBe('VALID');

    const activated = await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/away/activate`,
      headers: headers(cookie),
      payload: { calibrationId, operationId: 'away:activate:integration' },
    });
    expect(activated.statusCode).toBe(200);

    // The away session is durable and uses server time, so a fresh Fastify instance can resume it
    // after the browser/process that started it has gone away.
    await server?.close();
    server = buildServer({
      allowedOrigins: [origin],
      database: db().prisma,
      now: () => new Date(nowMs),
    });
    nowMs += 3_600_000;
    const returned = await app().inject({
      method: 'POST',
      url: `/api/characters/${characterId}/away/return`,
      headers: headers(cookie),
      payload: { operationId: 'away:return:integration' },
    });
    expect(returned.statusCode).toBe(200);
    const report = (
      returned.json() as { away: { result: { report: { rewards: { gold: number } } } } }
    ).away.result.report;
    expect(report.rewards.gold).toBeGreaterThan(0);

    const claims = await Promise.all(
      [0, 1].map(() =>
        app().inject({
          method: 'POST',
          url: `/api/characters/${characterId}/away/claim`,
          headers: headers(cookie),
          payload: {},
        }),
      ),
    );
    expect(claims.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(await db().prisma.rewardLog.count({ where: { characterId, source: 'away_mode' } })).toBe(
      1,
    );
    expect(
      (await db().prisma.character.findUniqueOrThrow({ where: { id: characterId } })).availability,
    ).toBe('AVAILABLE');
    expect(
      claims.some(
        (response) => (response.json() as { receipt: { replayed: boolean } }).receipt.replayed,
      ),
    ).toBe(true);
  });
});
