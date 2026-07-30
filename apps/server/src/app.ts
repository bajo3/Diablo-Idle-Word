import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { GAME_DATA_VERSION } from '@brecha/game-data';
import { ProtocolVersion } from '@brecha/shared';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { AuthService, type AuthSession } from './auth/auth-service.js';
import {
  type AuthenticatedPrincipal,
  CreateGuardianInputSchema,
  ForbiddenOriginError,
  InvalidCredentialsError,
  LoginInputSchema,
  RegisterInputSchema,
  RegistrationConflictError,
  UnauthenticatedError,
  UpdateProfileInputSchema,
} from './auth/contracts.js';
import { FixedWindowRateLimiter } from './auth/rate-limiter.js';
import {
  CharacterNameConflictError,
  CharacterNotAvailableError,
  CharacterNotFoundError,
  CharacterService,
} from './characters/character-service.js';
import {
  CheckpointConflictError,
  CheckpointIntentSchema,
  CheckpointService,
} from './characters/checkpoint-service.js';
import type { DatabaseClient } from './persistence/database.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}

type BuildServerOptions = {
  allowedOrigins?: readonly string[];
  database?: DatabaseClient;
  logger?: boolean;
  now?: () => Date;
  status?: 'available' | 'maintenance';
};

const cookieName = 'brecha_session';

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const allowedOrigins = new Set(
    options.allowedOrigins ?? (process.env.APP_ORIGIN ?? 'http://localhost:5173').split(','),
  );
  const secureCookie = process.env.NODE_ENV === 'production';
  const auth =
    options.database === undefined ? undefined : new AuthService(options.database, options.now);
  const characters =
    options.database === undefined ? undefined : new CharacterService(options.database);
  const checkpoints =
    options.database === undefined ? undefined : new CheckpointService(options.database);
  const credentialLimit = new FixedWindowRateLimiter();
  const status = options.status ?? serverStatusFromEnvironment();

  void app.register(cookie);
  void app.register(cors, {
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type'],
    origin(origin, done) {
      done(null, origin !== undefined && allowedOrigins.has(origin));
    },
  });
  void app.register(websocket, { options: { maxPayload: 1024 } });

  function setSessionCookie(reply: FastifyReply, session: AuthSession): void {
    reply.setCookie(cookieName, session.token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      path: '/',
      expires: session.expiresAt,
    });
  }

  async function assertAllowedOrigin(request: FastifyRequest): Promise<void> {
    const origin = request.headers.origin;
    if (origin === undefined || !allowedOrigins.has(origin)) throw new ForbiddenOriginError();
  }

  async function assertJson(request: FastifyRequest): Promise<void> {
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      throw new ZodError([]);
    }
  }

  async function requirePrincipal(request: FastifyRequest): Promise<void> {
    if (auth === undefined) throw new Error('Authentication requires a configured database.');
    request.principal = await auth.authenticate(request.cookies[cookieName]);
  }

  async function requireAvailable(): Promise<void> {
    if (status === 'maintenance') {
      const error = new Error('The server is in maintenance.');
      error.name = 'MaintenanceError';
      throw error;
    }
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      void reply.code(400).send({ error: 'invalid_request', details: error.issues });
      return;
    }
    if (error instanceof InvalidCredentialsError || error instanceof UnauthenticatedError) {
      void reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    if (error instanceof ForbiddenOriginError) {
      void reply.code(403).send({ error: 'forbidden_origin' });
      return;
    }
    if (
      error instanceof RegistrationConflictError ||
      error instanceof CharacterNameConflictError ||
      error instanceof CheckpointConflictError
    ) {
      void reply.code(409).send({ error: 'conflict' });
      return;
    }
    if (error instanceof CharacterNotFoundError) {
      void reply.code(404).send({ error: 'not_found' });
      return;
    }
    if (error instanceof CharacterNotAvailableError) {
      void reply.code(409).send({ error: 'character_unavailable' });
      return;
    }
    if (error instanceof Error && error.name === 'RateLimitError') {
      void reply.code(429).send({ error: 'rate_limited' });
      return;
    }
    if (error instanceof Error && error.name === 'MaintenanceError') {
      void reply.code(503).send({ error: 'maintenance' });
      return;
    }
    app.log.error(error);
    void reply.code(500).send({ error: 'internal_error' });
  });

  app.get('/health', async () => ({
    gameDataVersion: GAME_DATA_VERSION,
    protocolVersion: ProtocolVersion,
    service: 'la-brecha-oscura-server',
    status: 'ok',
  }));

  app.get('/api/status', async () => ({
    gameDataVersion: GAME_DATA_VERSION,
    message:
      status === 'maintenance'
        ? 'Mantenimiento en curso. Probá nuevamente más tarde.'
        : 'Disponible.',
    protocolVersion: ProtocolVersion,
    status,
  }));

  app.post(
    '/api/auth/register',
    { preValidation: [assertAllowedOrigin, assertJson] },
    async (request, reply) => {
      if (auth === undefined) throw new Error('Authentication requires a configured database.');
      const input = RegisterInputSchema.parse(request.body);
      consumeCredentials(credentialLimit, request.ip, input.email);
      const session = await auth.register(input, request.cookies[cookieName]);
      setSessionCookie(reply, session);
      return { profile: await auth.getProfile(session.principal.userId) };
    },
  );

  app.post(
    '/api/auth/login',
    { preValidation: [assertAllowedOrigin, assertJson] },
    async (request, reply) => {
      if (auth === undefined) throw new Error('Authentication requires a configured database.');
      const input = LoginInputSchema.parse(request.body);
      consumeCredentials(credentialLimit, request.ip, input.email);
      const session = await auth.login(input, request.cookies[cookieName]);
      setSessionCookie(reply, session);
      return { profile: await auth.getProfile(session.principal.userId) };
    },
  );

  app.post(
    '/api/auth/logout',
    { preValidation: [assertAllowedOrigin, assertJson] },
    async (request, reply) => {
      await auth?.logout(request.cookies[cookieName]);
      reply.clearCookie(cookieName, { path: '/' });
      return reply.code(204).send();
    },
  );

  app.get('/api/auth/session', { preValidation: requirePrincipal }, async (request) => {
    if (auth === undefined || request.principal === undefined) throw new UnauthenticatedError();
    return { profile: await auth.getProfile(request.principal.userId) };
  });

  app.get('/api/profile', { preValidation: requirePrincipal }, async (request) => {
    if (auth === undefined || request.principal === undefined) throw new UnauthenticatedError();
    return { profile: await auth.getProfile(request.principal.userId) };
  });

  app.patch(
    '/api/profile',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (auth === undefined || request.principal === undefined) throw new UnauthenticatedError();
      return {
        profile: await auth.updateProfile(
          request.principal.userId,
          UpdateProfileInputSchema.parse(request.body),
        ),
      };
    },
  );

  app.get(
    '/api/characters',
    { preValidation: [requirePrincipal, requireAvailable] },
    async (request) => {
      if (characters === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      return { characters: await characters.list(request.principal.userId) };
    },
  );

  app.post(
    '/api/characters',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request, reply) => {
      if (characters === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const character = await characters.createGuardian(
        request.principal.userId,
        CreateGuardianInputSchema.parse(request.body),
      );
      return reply.code(201).send({ character });
    },
  );

  app.post(
    '/api/characters/:characterId/select',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (characters === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      return { character: await characters.select(request.principal.userId, params.characterId) };
    },
  );

  app.delete(
    '/api/characters/:characterId',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request, reply) => {
      if (characters === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      await characters.delete(request.principal.userId, params.characterId);
      return reply.code(204).send();
    },
  );

  app.post(
    '/api/characters/:characterId/progress/checkpoints',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request, reply) => {
      if (checkpoints === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const intent = CheckpointIntentSchema.parse(request.body);
      if (intent.characterId !== params.characterId) throw new ZodError([]);
      const receipt = await checkpoints.record(request.principal.userId, intent);
      return reply.code(201).send({
        receipt: {
          checkpointId: receipt.checkpointId,
          operationId: receipt.operationId,
          sceneId: receipt.sceneId,
          schemaVersion: receipt.schemaVersion,
          serverState: receipt.serverState,
        },
      });
    },
  );

  // The plugin must finish registration before this websocket route is declared.
  app.after(() => {
    app.get(
      '/ws',
      {
        websocket: true,
        preValidation: [assertAllowedOrigin, requirePrincipal],
      },
      (socket, request) => {
        const principal = request.principal;
        if (principal === undefined) {
          socket.close(1008, 'unauthenticated');
          return;
        }
        socket.send(
          JSON.stringify({
            type: 'authenticated',
            userId: principal.userId,
            protocolVersion: ProtocolVersion,
          }),
        );
        socket.on('message', () =>
          socket.close(1003, 'gameplay messages are unavailable in step 4'),
        );
      },
    );
  });

  return app;
}

function consumeCredentials(limiter: FixedWindowRateLimiter, ip: string, email: string): void {
  if (!limiter.consume(`${ip}:${email}`)) {
    const error = new Error('Too many credential attempts.');
    error.name = 'RateLimitError';
    throw error;
  }
}

function characterParams(request: FastifyRequest): { characterId: string } {
  const value = request.params as { characterId?: unknown };
  if (
    typeof value.characterId !== 'string' ||
    value.characterId.length === 0 ||
    value.characterId.length > 128
  ) {
    throw new ZodError([]);
  }
  return { characterId: value.characterId };
}

function serverStatusFromEnvironment(
  value = process.env.SERVER_STATUS,
): 'available' | 'maintenance' {
  if (value === undefined || value === 'available') return 'available';
  if (value === 'maintenance') return 'maintenance';
  throw new Error('SERVER_STATUS must be "available" or "maintenance".');
}
