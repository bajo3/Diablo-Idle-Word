import { randomUUID } from 'node:crypto';

import WebSocket from '../apps/server/node_modules/ws/index.js';

const apiUrl = (process.env.STAGING_API_URL ?? 'http://127.0.0.1:3002').replace(/\/$/u, '');
const origin = process.env.STAGING_WEB_ORIGIN ?? 'http://127.0.0.1:8080';
const websocketUrl = apiUrl.replace(/^https:/u, 'wss:').replace(/^http:/u, 'ws:') + '/ws';
const timeoutMs = Number(process.env.STAGING_SMOKE_TIMEOUT_MS ?? 7_000);
const password = `StagingSmoke-${randomUUID()}!`;

function assertResponse(response, expectedStatus, label) {
  if (response.status !== expectedStatus) {
    throw new Error(`${label} returned HTTP ${response.status}: ${response.body}`);
  }
}

function sessionCookie(headers) {
  const values =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie')];
  const raw = values.find((value) => typeof value === 'string' && value.length > 0);
  const token = raw?.match(/^brecha_session=([^;]+)/u)?.[1];
  if (token === undefined) throw new Error('Registration did not return a session cookie.');
  return `brecha_session=${token}`;
}

async function request(path, { method = 'GET', cookie, body } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Keep non-JSON errors readable without logging credentials.
  }
  return { response, body: parsed };
}

async function register(displayName) {
  const email = `staging-smoke-${randomUUID()}@example.invalid`;
  const { response, body } = await request('/api/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
  });
  assertResponse(response, 200, 'register');
  const cookie = sessionCookie(response.headers);
  const created = await request('/api/characters', {
    method: 'POST',
    cookie,
    body: { name: `${displayName} Guardian` },
  });
  assertResponse(created.response, 201, 'create character');
  const characterId = created.body?.character?.id;
  if (typeof characterId !== 'string') throw new Error('Character creation returned no id.');
  const selected = await request(`/api/characters/${encodeURIComponent(characterId)}/select`, {
    method: 'POST',
    cookie,
    body: {},
  });
  assertResponse(selected.response, 200, 'select character');
  return { cookie, characterId, profileId: body?.profile?.id };
}

function openSocket(cookie) {
  const socket = new WebSocket(websocketUrl, {
    headers: { Origin: origin, Cookie: cookie },
  });
  const queue = [];
  const waiters = [];
  const push = (message) => {
    const waiter = waiters.shift();
    if (waiter === undefined) queue.push(message);
    else waiter.resolve(message);
  };
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (typeof message !== 'object' || message === null) throw new Error('not object');
      push(message);
    } catch {
      const waiter = waiters.shift();
      waiter?.reject(new Error('Invalid JSON received from staging WebSocket.'));
    }
  });
  socket.on('error', (error) => {
    while (waiters.length > 0) waiters.shift().reject(error);
  });
  const next = () =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for WebSocket event.')),
        timeoutMs,
      );
      const message = queue.shift();
      if (message !== undefined) {
        clearTimeout(timer);
        resolve(message);
      } else {
        waiters.push({
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
      }
    });
  const nextMatching = async (predicate, label) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const message = await next();
      if (predicate(message)) return message;
    }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  return { socket, nextMatching };
}

function send(socket, requestId, sequence, type, payload) {
  socket.send(JSON.stringify({ protocolVersion: 1, requestId, sequence, type, payload }));
}

async function main() {
  const first = await register('Staging One');
  const second = await register('Staging Two');
  const firstSocket = openSocket(first.cookie);
  const secondSocket = openSocket(second.cookie);
  try {
    await Promise.all([
      firstSocket.nextMatching((event) => event.type === 'authenticated', 'first authentication'),
      secondSocket.nextMatching((event) => event.type === 'authenticated', 'second authentication'),
    ]);

    send(firstSocket.socket, 'party-create', 1, 'PARTY_CREATE_INTENT', {});
    await firstSocket.nextMatching(
      (event) => event.type === 'COMMAND_ACCEPTED' && event.requestId === 'party-create',
      'party create acknowledgement',
    );
    const created = await firstSocket.nextMatching(
      (event) => event.type === 'PARTY_SNAPSHOT' && event.payload?.status === 'LOBBY',
      'party lobby snapshot',
    );
    const joinCode = created.payload?.joinCode;
    if (typeof joinCode !== 'string')
      throw new Error('Party snapshot did not include a join code.');

    send(secondSocket.socket, 'party-join', 1, 'PARTY_JOIN_INTENT', { joinCode });
    await secondSocket.nextMatching(
      (event) => event.type === 'COMMAND_ACCEPTED' && event.requestId === 'party-join',
      'party join acknowledgement',
    );
    const [firstJoined] = await Promise.all([
      firstSocket.nextMatching(
        (event) => event.type === 'PARTY_SNAPSHOT' && event.payload?.members?.length === 2,
        'first two-member snapshot',
      ),
      secondSocket.nextMatching(
        (event) => event.type === 'PARTY_SNAPSHOT' && event.payload?.members?.length === 2,
        'second two-member snapshot',
      ),
    ]);

    send(secondSocket.socket, 'party-ready', 2, 'PARTY_READY_INTENT', { ready: true });
    await secondSocket.nextMatching(
      (event) => event.type === 'COMMAND_ACCEPTED' && event.requestId === 'party-ready',
      'party ready acknowledgement',
    );
    await Promise.all([
      firstSocket.nextMatching(
        (event) =>
          event.type === 'PARTY_SNAPSHOT' &&
          event.payload?.members?.every((member) => member.ready),
        'first ready snapshot',
      ),
      secondSocket.nextMatching(
        (event) =>
          event.type === 'PARTY_SNAPSHOT' &&
          event.payload?.members?.every((member) => member.ready),
        'second ready snapshot',
      ),
    ]);

    send(firstSocket.socket, 'party-start', 2, 'PARTY_START_INTENT', {
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
    });
    await firstSocket.nextMatching(
      (event) => event.type === 'COMMAND_ACCEPTED' && event.requestId === 'party-start',
      'party start acknowledgement',
    );
    const [firstInstance, secondInstance] = await Promise.all([
      firstSocket.nextMatching(
        (event) => event.type === 'INSTANCE_SNAPSHOT' && event.payload?.players?.length === 2,
        'first shared instance snapshot',
      ),
      secondSocket.nextMatching(
        (event) => event.type === 'INSTANCE_SNAPSHOT' && event.payload?.players?.length === 2,
        'second shared instance snapshot',
      ),
    ]);

    send(secondSocket.socket, 'party-move', 3, 'MOVE_INTENT', { x: 1, y: 0 });
    await secondSocket.nextMatching(
      (event) => event.type === 'COMMAND_ACCEPTED' && event.requestId === 'party-move',
      'movement acknowledgement',
    );
    await Promise.all([
      firstSocket.nextMatching(
        (event) => event.type === 'INSTANCE_SNAPSHOT' && event.requestId === 'party-move',
        'first movement broadcast',
      ),
      secondSocket.nextMatching(
        (event) => event.type === 'INSTANCE_SNAPSHOT' && event.requestId === 'party-move',
        'second movement snapshot',
      ),
    ]);

    console.info(
      JSON.stringify({
        api: apiUrl,
        origin,
        webSocket: 'authenticated',
        partyMembers: firstJoined.payload.members.length,
        instancePlayers: firstInstance.payload.players.length,
        secondInstancePlayers: secondInstance.payload.players.length,
      }),
    );
  } finally {
    firstSocket.socket.close();
    secondSocket.socket.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
