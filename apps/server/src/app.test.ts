import { afterEach, describe, expect, it } from 'vitest';
import { GAME_DATA_VERSION } from '@brecha/game-data';
import { ProtocolVersion } from '@brecha/shared';

import { buildServer } from './app.js';

const servers: ReturnType<typeof buildServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => server.close()));
});

describe('server bootstrap', () => {
  it('exposes a deterministic health endpoint', async () => {
    const server = buildServer();
    servers.push(server);

    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      gameDataVersion: GAME_DATA_VERSION,
      protocolVersion: ProtocolVersion,
      service: 'la-brecha-oscura-server',
      status: 'ok',
    });
  });

  it('publishes availability during maintenance without a database dependency', async () => {
    const server = buildServer({ status: 'maintenance' });
    servers.push(server);

    const status = await server.inject({ method: 'GET', url: '/api/status' });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      status: 'maintenance',
      protocolVersion: ProtocolVersion,
    });
  });

  it('accepts the loopback hostname alias for browser development origins', async () => {
    const server = buildServer({ allowedOrigins: ['http://localhost:5173'] });
    servers.push(server);

    const response = await server.inject({
      method: 'GET',
      url: '/api/status',
      headers: { origin: 'http://127.0.0.1:5173' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('accepts the alternate local frontend port used during development', async () => {
    const server = buildServer({
      allowedOrigins: ['http://localhost:5173'],
    });
    servers.push(server);

    const response = await server.inject({
      method: 'GET',
      url: '/api/status',
      headers: { origin: 'http://127.0.0.1:5176' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5176');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
