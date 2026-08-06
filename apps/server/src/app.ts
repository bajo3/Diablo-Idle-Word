import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { GAME_DATA, GAME_DATA_VERSION } from '@brecha/game-data';
import {
  ClientEventSchema,
  ProtocolVersion,
  createForestWave,
  enemyDifficultyMultipliers,
  instanceSnapshot,
  type ClientEvent,
  type InstanceEnemyState,
} from '@brecha/shared';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
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
import {
  InteractionAuthorityService,
  InteractionOperationConflictError,
  InteractionPersistenceError,
  InteractionZoneUnavailableError,
} from './characters/interaction-service.js';
import { InteractionEffectService } from './characters/interaction-effects.js';
import {
  AllocateAttributesInputSchema,
  InsufficientAttributePointsError,
  InsufficientGoldError,
  LearnSkillInputSchema,
  ProgressionOperationConflictError,
  ProgressionService,
  ResetAttributesInputSchema,
  SetSkillBarInputSchema,
  SkillLockedError,
  SkillNotFoundError,
} from './characters/progression-service.js';
import type { DatabaseClient } from './persistence/database.js';
import { ForestProgressRepository } from './persistence/forest-progress-repository.js';
import { EnemyRewardService, type EnemyRewardReceipt } from './persistence/enemy-reward-service.js';
import {
  ActivateAwayInputSchema,
  AwayCalibrationIncompleteError,
  AwayNotFoundError,
  AwayOperationConflictError,
  AwayService,
  AwayStateConflictError,
  ClaimAwayInputSchema,
  CompleteAwayCalibrationInputSchema,
  ReturnAwayInputSchema,
  StartAwayCalibrationInputSchema,
} from './persistence/away-service.js';
import {
  EquipItemInputSchema,
  FavoriteItemInputSchema,
  InventoryFullError,
  InventoryItemNotFoundError,
  InventoryOperationConflictError,
  InventoryService,
  InvalidEquipmentError,
  ProtectedInventoryItemError,
  BuyItemInputSchema,
  ChestDepositInputSchema,
  ChestFullError,
  ChestItemNotFoundError,
  ChestWithdrawInputSchema,
  SellItemInputSchema,
  UnequipItemInputSchema,
} from './persistence/inventory-service.js';
import {
  TownOperationConflictError,
  TownService,
  TownTutorialConflictError,
  UpdateTownTutorialInputSchema,
  MerchantStockNotFoundError,
} from './persistence/town-service.js';
import {
  ActiveInstanceConflictError,
  ActiveInstanceRegistry,
  type CompletedInstanceInteraction,
} from './gameplay/instance-registry.js';
import { REVIVE_INTERACTION_ID, selectReviveTarget } from './gameplay/revive-authority.js';
import { PartyError, PartyRegistry } from './gameplay/party-registry.js';
import {
  CombatAuthority,
  CombatCommandError,
  CombatOperationConflictError,
  COMBAT_TICK_INTERVAL_MS,
  type CombatResult,
} from './gameplay/combat-authority.js';
import { EnemyAuthority } from './gameplay/enemy-authority.js';
import { TrafficMetrics } from './gameplay/traffic-metrics.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}

type BuildServerOptions = {
  allowedOrigins?: readonly string[];
  database?: DatabaseClient;
  /** Test seam for deterministic initial enemy fixtures; production uses the catalog wave. */
  initialForestEnemies?: (
    instanceId: string,
    defaults: readonly InstanceEnemyState[],
  ) => readonly InstanceEnemyState[];
  logger?: boolean;
  now?: () => Date;
  partyLobbyTtlMs?: number;
  status?: 'available' | 'maintenance';
  /** Absolute path to the built frontend; when set this server also serves it (single origin). */
  webDistPath?: string;
};

function expandLoopbackOrigins(origins: readonly string[]): Set<string> {
  const expanded = new Set(origins);
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)) continue;
      const alias = new URL(url);
      alias.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
      expanded.add(alias.origin);
    } catch {
      // Invalid configuration remains rejected by the exact-origin check below.
    }
  }
  return expanded;
}

type GameplaySocket = Readonly<{
  readyState: number;
  send: (data: string) => void;
  on: (event: 'close', listener: () => void) => unknown;
}>;
type PartyClientEvent = Extract<ClientEvent, { type: `PARTY_${string}` }>;
type GameplayClientEvent = Extract<
  ClientEvent,
  { type: 'MOVE_INTENT' | 'INTERACT_INTENT' | 'COMBAT_INTENT' }
>;

const cookieName = 'brecha_session';
const alternateLocalDevelopmentOrigin = 'http://localhost:5176';
const ENDLESS_FOREST_OBJECTIVES = Object.freeze([
  {
    objectiveId: 'objective.forest.level',
    mode: 'endless_forest' as const,
    status: 'active' as const,
    progress: GAME_DATA.endlessForest.minimumLevel,
    target: GAME_DATA.endlessForest.maximumLevel,
  },
]);
export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const configuredOrigins =
    options.allowedOrigins ?? (process.env.APP_ORIGIN ?? 'http://localhost:5173').split(',');
  const allowedOrigins = expandLoopbackOrigins(
    process.env.NODE_ENV === 'production'
      ? configuredOrigins
      : [...configuredOrigins, alternateLocalDevelopmentOrigin],
  );
  const secureCookie = process.env.NODE_ENV === 'production';
  const auth =
    options.database === undefined ? undefined : new AuthService(options.database, options.now);
  const characters =
    options.database === undefined ? undefined : new CharacterService(options.database);
  const checkpoints =
    options.database === undefined ? undefined : new CheckpointService(options.database);
  const forestProgress =
    options.database === undefined ? undefined : new ForestProgressRepository(options.database);
  const enemyRewards =
    options.database === undefined ? undefined : new EnemyRewardService(options.database);
  const away =
    options.database === undefined ? undefined : new AwayService(options.database, options.now);
  const inventory =
    options.database === undefined ? undefined : new InventoryService(options.database);
  const town =
    options.database === undefined
      ? undefined
      : new TownService(options.database, options.now ?? (() => new Date()));
  const progression =
    options.database === undefined ? undefined : new ProgressionService(options.database);
  const interactionAuthority =
    options.database === undefined ? undefined : new InteractionAuthorityService(options.database);
  const interactionEffects =
    options.database === undefined ? undefined : new InteractionEffectService(options.database);
  const credentialLimit = new FixedWindowRateLimiter();
  const gameplayLimit = new FixedWindowRateLimiter(120, 60 * 1000, () => serverNowMs(options.now));
  const activeInstances = new ActiveInstanceRegistry();
  const parties = new PartyRegistry(
    options.partyLobbyTtlMs === undefined ? {} : { lobbyTtlMs: options.partyLobbyTtlMs },
  );
  const combatAuthority = new CombatAuthority();
  const enemyAuthority = new EnemyAuthority();
  const trafficMetrics = new TrafficMetrics();
  const partySockets = new Map<string, Set<GameplaySocket>>();
  const status = options.status ?? serverStatusFromEnvironment();

  const cleanupParties = (): void => {
    parties.cleanupExpired(serverNowMs(options.now), new Set(partySockets.keys()));
  };
  const partyCleanupTimer = setInterval(cleanupParties, 60_000);
  partyCleanupTimer.unref?.();
  app.addHook('onClose', async () => {
    clearInterval(partyCleanupTimer);
  });

  const sendToUser = (userId: string, message: string): void => {
    for (const client of partySockets.get(userId) ?? []) {
      if (client.readyState === 1) {
        sendTracked(client, message);
      }
    }
  };
  const sendTracked = (client: { send: (data: string) => void }, message: string): void => {
    trafficMetrics.recordOutbound(message, messageType(message));
    client.send(message);
  };
  const sendPartySnapshot = (partyId: string, requestId: string): void => {
    const snapshot = parties.snapshot(partyId);
    const message = JSON.stringify({
      protocolVersion: ProtocolVersion,
      type: 'PARTY_SNAPSHOT',
      requestId,
      payload: snapshot,
    });
    for (const member of parties.members(partyId)) sendToUser(member.userId, message);
  };
  const sendInstanceSnapshot = (partyId: string, requestId: string): void => {
    const members = parties.members(partyId);
    const state =
      members[0] === undefined ? undefined : activeInstances.stateFor(members[0].characterId);
    if (state === undefined) return;
    const message = JSON.stringify({
      protocolVersion: ProtocolVersion,
      type: 'INSTANCE_SNAPSHOT',
      requestId,
      payload: instanceSnapshot(state),
    });
    for (const member of members) sendToUser(member.userId, message);
  };
  const sendCombatResults = (characterId: string, results: readonly CombatResult[]): void => {
    if (results.length === 0) return;
    const party = parties.snapshotForCharacter(characterId);
    const members = party?.status === 'ACTIVE' ? parties.members(party.partyId) : undefined;
    const recipients = members ?? [
      {
        userId: activeInstances.ownerFor(characterId) ?? '',
      },
    ];
    for (const result of results) {
      const message = JSON.stringify({
        protocolVersion: ProtocolVersion,
        type: 'COMBAT_RESULT',
        requestId: result.operationId,
        payload: result,
      });
      for (const recipient of recipients) sendToUser(recipient.userId, message);
    }
  };
  const sendInstanceSnapshotForCharacter = (characterId: string, requestId: string): void => {
    const state = activeInstances.stateFor(characterId);
    const owner = activeInstances.ownerFor(characterId);
    if (state === undefined || owner === undefined) return;
    const party = parties.snapshotForCharacter(characterId);
    if (party?.status === 'ACTIVE') {
      sendInstanceSnapshot(party.partyId, requestId);
      return;
    }
    sendToUser(
      owner,
      JSON.stringify({
        protocolVersion: ProtocolVersion,
        type: 'INSTANCE_SNAPSHOT',
        requestId,
        payload: instanceSnapshot(state),
      }),
    );
  };
  const flushCompletedInteractions = async (
    completed: readonly CompletedInstanceInteraction[],
  ): Promise<void> => {
    if (interactionEffects === undefined) return;
    for (const interaction of completed) {
      const recipientsParty = parties.snapshotForCharacter(interaction.characterId);
      const effectCharacterId = interaction.effectCharacterId ?? interaction.characterId;
      if (interaction.interruptedByDamage === true) {
        const interruptedMessage = JSON.stringify({
          protocolVersion: ProtocolVersion,
          type: 'INTERACTION_INTERRUPTED',
          requestId: interaction.operationId,
          payload: {
            operationId: interaction.operationId,
            characterId: interaction.characterId,
            reason: 'damage',
            stateRevision: activeInstances.stateFor(interaction.characterId)?.revision ?? 1,
          },
        });
        if (recipientsParty?.status === 'ACTIVE') {
          for (const member of parties.members(recipientsParty.partyId))
            sendToUser(member.userId, interruptedMessage);
        } else {
          const owner = activeInstances.ownerFor(interaction.characterId);
          if (owner !== undefined) sendToUser(owner, interruptedMessage);
        }
        continue;
      }
      const owner =
        activeInstances.ownerFor(effectCharacterId) ??
        activeInstances.ownerFor(interaction.characterId);
      if (owner === undefined) continue;
      const effect = await interactionEffects.applyOnce({
        userId: owner,
        characterId: effectCharacterId,
        operationId: interaction.operationId,
        resultId: interaction.resultId,
      });
      if (effect.effectType === 'revive') {
        const player = activeInstances.playerFor(effectCharacterId);
        if (player !== undefined && player.actorState === 'downed')
          activeInstances.updatePlayer(effectCharacterId, {
            actorState: 'active',
            health: player.maxHealth,
          });
      }
      const message = JSON.stringify({
        protocolVersion: ProtocolVersion,
        type: 'INTERACTION_EFFECT',
        requestId: interaction.operationId,
        payload: effect,
      });
      if (recipientsParty?.status === 'ACTIVE') {
        for (const member of parties.members(recipientsParty.partyId))
          sendToUser(member.userId, message);
        sendInstanceSnapshot(recipientsParty.partyId, interaction.operationId);
      } else {
        sendToUser(owner, message);
        sendInstanceSnapshotForCharacter(interaction.characterId, interaction.operationId);
      }
    }
  };
  const grantDefeatRewards = async (
    characterId: string,
    results: readonly CombatResult[],
  ): Promise<readonly EnemyRewardReceipt[]> => {
    if (enemyRewards === undefined || results.length === 0) return [];
    const instance = activeInstances.stateFor(characterId);
    if (instance === undefined) return [];
    const defeatedEnemyIds = [
      ...new Set(
        results.flatMap((result) =>
          result.hits.filter((hit) => hit.defeated).map((hit) => hit.targetId),
        ),
      ),
    ].sort();
    if (defeatedEnemyIds.length === 0) return [];
    const party = parties.snapshotForCharacter(characterId);
    const recipients =
      party?.status === 'ACTIVE'
        ? parties.members(party.partyId)
        : [
            {
              userId: activeInstances.ownerFor(characterId) ?? '',
              characterId,
            },
          ];
    const receipts: EnemyRewardReceipt[] = [];
    for (const enemyId of defeatedEnemyIds) {
      const enemy = instance.enemies.find((candidate) => candidate.enemyId === enemyId);
      const tuning =
        enemy === undefined
          ? undefined
          : GAME_DATA.enemyTuning.find((candidate) => candidate.enemyId === enemy.archetype);
      if (enemy === undefined || tuning === undefined) continue;
      for (const recipient of recipients) {
        if (recipient.userId.length === 0) continue;
        const operationId = rewardOperationId(instance.instanceId, enemyId, recipient.characterId);
        const receipt = await enemyRewards.applyOnce({
          actorUserId: recipient.userId,
          characterId: recipient.characterId,
          operationId,
          instanceId: instance.instanceId,
          enemyId,
          archetype: enemy.archetype,
          experience: tuning.xpReward,
          gold: tuning.goldReward,
          materials: tuning.materialsReward,
          difficulty: instance.difficulty,
          partySize: Math.min(4, Math.max(1, instance.players.length)),
          atMs: instance.nowMs,
        });
        receipts.push(receipt);
        sendToUser(
          recipient.userId,
          JSON.stringify({
            protocolVersion: ProtocolVersion,
            type: 'REWARD_GRANTED',
            requestId: operationId,
            payload: {
              operationId: receipt.operationId,
              characterId: receipt.characterId,
              source: 'enemy_defeat',
              sourceId: `enemy:${receipt.requestHash}`,
              archetype: receipt.archetype,
              experienceDelta: receipt.experienceDelta.toString(),
              goldDelta: receipt.goldDelta.toString(),
              materialsDelta: receipt.materialsDelta.toString(),
              forestLevel: receipt.forestLevel,
              forestXpInLevel: receipt.forestXpInLevel,
              forestBestLevel: receipt.forestBestLevel,
              leveledUp: receipt.leveledUp,
              items: receipt.drop === undefined ? [] : [receipt.drop],
              dropStatus: receipt.dropStatus,
              visibility: 'private',
              replayed: receipt.replayed,
            },
          }),
        );
      }
    }
    return receipts;
  };
  const combatTickTimer = setInterval(() => {
    void (async () => {
      const nowMs = serverNowMs(options.now);
      const processedEnemyInstances = new Set<string>();
      const completedInteractions: CompletedInstanceInteraction[] = [];
      for (const characterId of activeInstances.activeCharacterIds()) {
        const advanced = activeInstances.advanceWithEvents(characterId, nowMs);
        if (advanced === undefined) continue;
        completedInteractions.push(...advanced.completedInteractions);
        const results = combatAuthority.advance(characterId, nowMs, activeInstances);
        if (results.length > 0) {
          sendCombatResults(characterId, results);
          sendInstanceSnapshotForCharacter(characterId, results.at(-1)!.operationId);
          await grantDefeatRewards(characterId, results);
        }
        const instanceId = activeInstances.instanceFor(characterId);
        if (instanceId === undefined || processedEnemyInstances.has(instanceId)) continue;
        processedEnemyInstances.add(instanceId);
        const enemyEvents = enemyAuthority.advance(
          characterId,
          nowMs,
          activeInstances,
          combatAuthority,
        );
        if (
          enemyEvents.some(
            (event) =>
              event.type === 'damage' ||
              event.type === 'heal' ||
              event.type === 'cleanup' ||
              event.type === 'spawn',
          )
        )
          sendInstanceSnapshotForCharacter(characterId, `enemy-tick:${characterId}:${nowMs}`);
      }
      const finalizedInteractions = completedInteractions.map((interaction) => {
        const actor = activeInstances.playerFor(interaction.characterId);
        const interruptedByDamage =
          interaction.interruptOnDamage === true &&
          interaction.actorHealthAtStart !== undefined &&
          actor !== undefined &&
          actor.health < interaction.actorHealthAtStart;
        if (!interruptedByDamage) return interaction;
        activeInstances.markInteractionInterrupted(
          interaction.characterId,
          interaction.operationId,
        );
        return { ...interaction, interruptedByDamage: true };
      });
      await flushCompletedInteractions(finalizedInteractions);
    })().catch((error: unknown) => app.log.error(error));
  }, COMBAT_TICK_INTERVAL_MS);
  combatTickTimer.unref?.();
  app.addHook('onClose', async () => {
    clearInterval(combatTickTimer);
  });
  const ensureForestEnemies = (characterId: string): void => {
    const current = activeInstances.stateFor(characterId);
    if (current === undefined || current.enemies.length > 0) return;
    const defaults = createInitialForestEnemies(current);
    activeInstances.replaceEnemies(
      characterId,
      options.initialForestEnemies?.(current.instanceId, defaults) ?? defaults,
    );
  };

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

  app.setErrorHandler((error, request, reply) => {
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
      error instanceof CheckpointConflictError ||
      error instanceof InteractionOperationConflictError ||
      error instanceof ProgressionOperationConflictError ||
      error instanceof InventoryOperationConflictError ||
      error instanceof InvalidEquipmentError ||
      error instanceof ProtectedInventoryItemError ||
      error instanceof InsufficientAttributePointsError ||
      error instanceof InsufficientGoldError ||
      error instanceof SkillLockedError ||
      error instanceof SkillNotFoundError ||
      error instanceof AwayOperationConflictError ||
      error instanceof AwayStateConflictError ||
      error instanceof TownOperationConflictError ||
      error instanceof TownTutorialConflictError
    ) {
      void reply.code(409).send({ error: 'conflict' });
      return;
    }
    if (error instanceof CharacterNotFoundError) {
      void reply.code(404).send({ error: 'not_found' });
      return;
    }
    if (error instanceof InventoryItemNotFoundError) {
      void reply.code(404).send({ error: 'inventory_item_not_found' });
      return;
    }
    if (error instanceof ChestItemNotFoundError || error instanceof MerchantStockNotFoundError) {
      void reply.code(404).send({ error: 'not_found' });
      return;
    }
    if (error instanceof AwayNotFoundError) {
      void reply.code(404).send({ error: 'away_not_found' });
      return;
    }
    if (error instanceof AwayCalibrationIncompleteError) {
      void reply.code(409).send({
        error: 'calibration_incomplete',
        remainingSeconds: error.remainingSeconds,
      });
      return;
    }
    if (error instanceof InventoryFullError) {
      void reply.code(409).send({ error: 'inventory_full' });
      return;
    }
    if (error instanceof ChestFullError) {
      void reply.code(409).send({ error: 'chest_full' });
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
    app.log.error(
      {
        err: error,
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      'Unhandled request error',
    );
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

  app.get('/api/metrics/network', { preValidation: requirePrincipal }, async () => ({
    metrics: trafficMetrics.snapshot(60_000),
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

  app.get(
    '/api/characters/:characterId/town',
    { preValidation: [requirePrincipal] },
    async (request) => {
      if (town === undefined || request.principal === undefined) throw new UnauthenticatedError();
      const params = characterParams(request);
      return { town: await town.getOwned(request.principal.userId, params.characterId) };
    },
  );

  app.post(
    '/api/characters/:characterId/town/tutorial',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (town === undefined || request.principal === undefined) throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = UpdateTownTutorialInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await town.updateTutorial(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/merchant/buy',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (inventory === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = BuyItemInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await inventory.buy(input) };
    },
  );

  app.get(
    '/api/characters/:characterId/chest',
    { preValidation: [requirePrincipal] },
    async (request) => {
      if (inventory === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      return await inventory.getChest(request.principal.userId, params.characterId);
    },
  );

  app.post(
    '/api/characters/:characterId/chest/deposit',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (inventory === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = ChestDepositInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await inventory.depositToChest(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/chest/withdraw',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (inventory === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = ChestWithdrawInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await inventory.withdrawFromChest(input) };
    },
  );

  app.get(
    '/api/characters/:characterId/forest-progress',
    { preValidation: [requirePrincipal, requireAvailable] },
    async (request) => {
      if (forestProgress === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const progress = await forestProgress.getOwned(request.principal.userId, params.characterId);
      return { progress };
    },
  );

  app.get(
    '/api/characters/:characterId/rewards/recent',
    { preValidation: [requirePrincipal, requireAvailable] },
    async (request) => {
      if (enemyRewards === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      return {
        results: await enemyRewards.recentOwned(request.principal.userId, params.characterId),
      };
    },
  );

  app.get(
    '/api/characters/:characterId/away',
    { preValidation: [requirePrincipal, requireAvailable] },
    async (request) => {
      if (away === undefined || request.principal === undefined) throw new UnauthenticatedError();
      const params = characterParams(request);
      return { away: await away.status(request.principal.userId, params.characterId) };
    },
  );

  app.post(
    '/api/characters/:characterId/away/calibration',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (away === undefined || request.principal === undefined) throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = StartAwayCalibrationInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { away: await away.startCalibration(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/away/calibration/:calibrationId/complete',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (away === undefined || request.principal === undefined) throw new UnauthenticatedError();
      const params = request.params as { characterId?: string; calibrationId?: string };
      if (typeof params.characterId !== 'string' || typeof params.calibrationId !== 'string')
        throw new ZodError([]);
      const input = CompleteAwayCalibrationInputSchema.parse({
        actorUserId: request.principal.userId,
        characterId: params.characterId,
        calibrationId: params.calibrationId,
      });
      return { away: await away.completeCalibration(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/away/activate',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (away === undefined || request.principal === undefined) throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = ActivateAwayInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { away: await away.activate(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/away/return',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (away === undefined || request.principal === undefined) throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = ReturnAwayInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { away: await away.returnFromAway(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/away/claim',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (away === undefined || request.principal === undefined) throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = ClaimAwayInputSchema.parse({
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await away.claim(input) };
    },
  );

  app.get(
    '/api/characters/:characterId/inventory',
    { preValidation: [requirePrincipal, requireAvailable] },
    async (request) => {
      if (inventory === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      return { inventory: await inventory.getOwned(request.principal.userId, params.characterId) };
    },
  );

  app.get(
    '/api/characters/:characterId/progression',
    { preValidation: [requirePrincipal, requireAvailable] },
    async (request) => {
      if (progression === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      return {
        progression: await progression.getOwned(request.principal.userId, params.characterId),
      };
    },
  );

  app.post(
    '/api/characters/:characterId/progression/attributes',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (progression === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = AllocateAttributesInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await progression.allocateAttributes(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/progression/skills/learn',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (progression === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = LearnSkillInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await progression.learnSkill(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/progression/skills/bar',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (progression === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = SetSkillBarInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await progression.setSkillBar(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/progression/reset-attributes',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (progression === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = ResetAttributesInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await progression.resetAttributes(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/inventory/equip',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (inventory === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = EquipItemInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await inventory.equip(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/inventory/unequip',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (inventory === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = UnequipItemInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await inventory.unequip(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/inventory/favorite',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (inventory === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = FavoriteItemInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await inventory.favorite(input) };
    },
  );

  app.post(
    '/api/characters/:characterId/inventory/sell',
    { preValidation: [assertAllowedOrigin, assertJson, requirePrincipal, requireAvailable] },
    async (request) => {
      if (inventory === undefined || request.principal === undefined)
        throw new UnauthenticatedError();
      const params = characterParams(request);
      const input = SellItemInputSchema.parse({
        ...requestBodyObject(request.body),
        actorUserId: request.principal.userId,
        characterId: params.characterId,
      });
      return { receipt: await inventory.sell(input) };
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
        cleanupParties();
        const principal = request.principal;
        if (principal === undefined) {
          socket.close(1008, 'unauthenticated');
          return;
        }
        const gameplaySocket = socket as unknown as GameplaySocket;
        const sockets = partySockets.get(principal.userId) ?? new Set<GameplaySocket>();
        sockets.add(gameplaySocket);
        partySockets.set(principal.userId, sockets);
        socket.on('close', () => {
          const current = partySockets.get(principal.userId);
          if (current === undefined) return;
          current.delete(gameplaySocket);
          if (current.size === 0) partySockets.delete(principal.userId);
        });
        sendTracked(
          socket,
          JSON.stringify({
            type: 'authenticated',
            userId: principal.userId,
            protocolVersion: ProtocolVersion,
          }),
        );
        void (async () => {
          const selection = await options.database?.characterSelection.findUnique({
            where: { userId: principal.userId },
            select: { characterId: true },
          });
          const party =
            selection === undefined || selection === null
              ? undefined
              : parties.snapshotForCharacter(selection.characterId);
          if (party !== undefined) {
            sendPartySnapshot(party.partyId, 'session');
            if (party.status === 'ACTIVE') sendInstanceSnapshot(party.partyId, 'session');
          }
        })();
        let lastSequence = -1;
        socket.on('message', (raw) => {
          cleanupParties();
          trafficMetrics.recordInbound(raw.toString());
          const requestId = readRequestId(raw.toString());
          const reject = (
            code: 'INVALID_PAYLOAD' | 'NOT_ALLOWED' | 'STALE_SEQUENCE',
            message: string,
          ) => {
            sendTracked(
              socket,
              JSON.stringify({
                protocolVersion: ProtocolVersion,
                type: 'COMMAND_REJECTED',
                requestId,
                payload: { code, message },
              }),
            );
          };

          if (!gameplayLimit.consume(principal.userId)) {
            reject('NOT_ALLOWED', 'Too many gameplay commands.');
            return;
          }

          let event: ReturnType<typeof ClientEventSchema.parse>;
          try {
            event = ClientEventSchema.parse(JSON.parse(raw.toString()));
          } catch {
            reject('INVALID_PAYLOAD', 'The command payload is invalid.');
            return;
          }
          if (event.sequence <= lastSequence) {
            reject('STALE_SEQUENCE', 'The command sequence is stale.');
            return;
          }
          lastSequence = event.sequence;
          const isPartyEvent = event.type.startsWith('PARTY_');
          if (!isPartyEvent && interactionAuthority === undefined) {
            reject('NOT_ALLOWED', 'Gameplay authority is unavailable.');
            return;
          }
          const partyEvent = isPartyEvent ? (event as PartyClientEvent) : undefined;
          const isGameplayEvent =
            event.type === 'MOVE_INTENT' ||
            event.type === 'INTERACT_INTENT' ||
            event.type === 'COMBAT_INTENT';
          const gameplayEvent = isGameplayEvent ? (event as GameplayClientEvent) : undefined;
          if (!isPartyEvent && gameplayEvent === undefined) {
            reject('NOT_ALLOWED', 'This gameplay command is not available yet.');
            return;
          }

          void (async () => {
            try {
              const selection = await options.database?.characterSelection.findUnique({
                where: { userId: principal.userId },
                select: { characterId: true, character: { select: { availability: true } } },
              });
              if (selection === undefined || selection === null) {
                reject('NOT_ALLOWED', 'Select an available character first.');
                return;
              }
              if (selection.character.availability !== 'AVAILABLE') {
                reject('NOT_ALLOWED', 'The selected character is not available.');
                return;
              }
              if (partyEvent !== undefined) {
                const nowMs = serverNowMs(options.now);
                let partySnapshot;
                if (partyEvent.type === 'PARTY_CREATE_INTENT') {
                  partySnapshot = parties.create(principal.userId, selection.characterId, nowMs);
                } else if (partyEvent.type === 'PARTY_JOIN_INTENT') {
                  partySnapshot = parties.join(
                    principal.userId,
                    selection.characterId,
                    partyEvent.payload.joinCode,
                    nowMs,
                  );
                } else if (partyEvent.type === 'PARTY_READY_INTENT') {
                  partySnapshot = parties.setReady(
                    principal.userId,
                    selection.characterId,
                    partyEvent.payload.ready,
                    nowMs,
                  );
                } else if (partyEvent.type === 'PARTY_LEAVE_INTENT') {
                  const partyId = parties.partyIdForCharacter(selection.characterId);
                  if (partyId === undefined)
                    throw new PartyError('NOT_MEMBER', 'The character is not in a party.');
                  const remaining = parties.leave(principal.userId, selection.characterId);
                  activeInstances.leave(selection.characterId);
                  enemyAuthority.clearCharacter(selection.characterId);
                  sendTracked(
                    socket,
                    JSON.stringify({
                      protocolVersion: ProtocolVersion,
                      type: 'COMMAND_ACCEPTED',
                      requestId: partyEvent.requestId,
                      payload: { serverTimeMs: nowMs },
                    }),
                  );
                  if (remaining === undefined) {
                    return;
                  }
                  sendPartySnapshot(partyId, partyEvent.requestId);
                  if (remaining.status === 'ACTIVE')
                    sendInstanceSnapshot(partyId, partyEvent.requestId);
                  return;
                } else {
                  const partyId = parties.partyIdForCharacter(selection.characterId);
                  if (partyId === undefined)
                    throw new PartyError('NOT_MEMBER', 'The character is not in a party.');
                  const started = parties.start({
                    userId: principal.userId,
                    characterId: selection.characterId,
                    zoneId: partyEvent.payload.zoneId,
                    difficulty: partyEvent.payload.difficulty,
                    nowMs,
                  });
                  try {
                    const members = parties.members(partyId);
                    if (
                      members.some(
                        (member) => activeInstances.instanceFor(member.characterId) !== undefined,
                      )
                    )
                      throw new ActiveInstanceConflictError(
                        'A party member already belongs to an active instance.',
                      );
                    const leader = members.find(
                      (member) => member.characterId === started.leaderCharacterId,
                    );
                    if (leader === undefined) throw new Error('The party leader is unavailable.');
                    activeInstances.ensure({
                      userId: leader.userId,
                      characterId: leader.characterId,
                      zoneId: started.zoneId!,
                      difficulty: started.difficulty!,
                      nowMs,
                      objectives: ENDLESS_FOREST_OBJECTIVES,
                    });
                    for (const member of members) {
                      if (member.characterId === leader.characterId) continue;
                      activeInstances.join({
                        userId: member.userId,
                        characterId: member.characterId,
                        hostCharacterId: leader.characterId,
                        zoneId: started.zoneId!,
                        difficulty: started.difficulty!,
                        nowMs,
                      });
                    }
                    ensureForestEnemies(leader.characterId);
                  } catch (error: unknown) {
                    parties.abortStart(partyId, nowMs);
                    throw error;
                  }
                  partySnapshot = started;
                  sendTracked(
                    socket,
                    JSON.stringify({
                      protocolVersion: ProtocolVersion,
                      type: 'COMMAND_ACCEPTED',
                      requestId: partyEvent.requestId,
                      payload: { serverTimeMs: nowMs },
                    }),
                  );
                  sendPartySnapshot(partyId, partyEvent.requestId);
                  sendInstanceSnapshot(partyId, partyEvent.requestId);
                  return;
                }
                sendTracked(
                  socket,
                  JSON.stringify({
                    protocolVersion: ProtocolVersion,
                    type: 'COMMAND_ACCEPTED',
                    requestId: partyEvent.requestId,
                    payload: { serverTimeMs: nowMs },
                  }),
                );
                sendPartySnapshot(partySnapshot.partyId, partyEvent.requestId);
                return;
              }
              if (gameplayEvent === undefined || interactionAuthority === undefined) return;
              const gameplayAuthority = interactionAuthority;
              const nowMs = serverNowMs(options.now);
              const party = parties.snapshotForCharacter(selection.characterId);
              if (party?.status === 'LOBBY') {
                reject('NOT_ALLOWED', 'Start the party before entering the expedition.');
                return;
              }
              const tick = activeInstances.ensureWithEvents({
                userId: principal.userId,
                characterId: selection.characterId,
                zoneId: party?.zoneId ?? 'corrupted_forest',
                difficulty: party?.difficulty ?? 'normal',
                nowMs,
                objectives: ENDLESS_FOREST_OBJECTIVES,
              });
              ensureForestEnemies(selection.characterId);
              await flushCompletedInteractions(tick.completedInteractions);
              sendCombatResults(
                selection.characterId,
                combatAuthority.advance(selection.characterId, nowMs, activeInstances),
              );
              if (gameplayEvent.type === 'COMBAT_INTENT') {
                await progression?.assertAbilityUsable(
                  principal.userId,
                  selection.characterId,
                  gameplayEvent.payload.abilityId,
                );
                const result = combatAuthority.apply(
                  {
                    userId: principal.userId,
                    characterId: selection.characterId,
                    operationId: gameplayEvent.requestId,
                    abilityId: gameplayEvent.payload.abilityId,
                    ...(gameplayEvent.payload.targetId === undefined
                      ? {}
                      : { targetId: gameplayEvent.payload.targetId }),
                    ...(gameplayEvent.payload.facing === undefined
                      ? {}
                      : { facing: gameplayEvent.payload.facing }),
                    nowMs,
                  },
                  activeInstances,
                );
                sendTracked(
                  socket,
                  JSON.stringify({
                    protocolVersion: ProtocolVersion,
                    type: 'COMMAND_ACCEPTED',
                    requestId: gameplayEvent.requestId,
                    payload: { serverTimeMs: nowMs },
                  }),
                );
                sendTracked(
                  socket,
                  JSON.stringify({
                    protocolVersion: ProtocolVersion,
                    type: 'COMBAT_RESULT',
                    requestId: gameplayEvent.requestId,
                    payload: result,
                  }),
                );
                await grantDefeatRewards(selection.characterId, [result]);
                if (party?.status === 'ACTIVE')
                  sendInstanceSnapshot(party.partyId, gameplayEvent.requestId);
                else
                  sendTracked(
                    socket,
                    JSON.stringify({
                      protocolVersion: ProtocolVersion,
                      type: 'INSTANCE_SNAPSHOT',
                      requestId: gameplayEvent.requestId,
                      payload: instanceSnapshot(activeInstances.stateFor(selection.characterId)!),
                    }),
                  );
                return;
              }
              if (gameplayEvent.type === 'MOVE_INTENT') {
                const movement = activeInstances.move(
                  selection.characterId,
                  gameplayEvent.payload,
                  nowMs,
                );
                if (movement === undefined || !movement.accepted) {
                  reject('NOT_ALLOWED', 'The movement intent is not allowed in the current state.');
                  return;
                }
                sendTracked(
                  socket,
                  JSON.stringify({
                    protocolVersion: ProtocolVersion,
                    type: 'COMMAND_ACCEPTED',
                    requestId: gameplayEvent.requestId,
                    payload: { serverTimeMs: movement.state.nowMs },
                  }),
                );
                if (party?.status === 'ACTIVE')
                  sendInstanceSnapshot(party.partyId, gameplayEvent.requestId);
                else
                  sendTracked(
                    socket,
                    JSON.stringify({
                      protocolVersion: ProtocolVersion,
                      type: 'INSTANCE_SNAPSHOT',
                      requestId: gameplayEvent.requestId,
                      payload: instanceSnapshot(movement.state),
                    }),
                  );
                return;
              }
              const player = activeInstances.playerFor(selection.characterId);
              if (player === undefined) {
                reject('NOT_ALLOWED', 'The active gameplay actor is unavailable.');
                return;
              }
              let effectCharacterId: string | undefined;
              if (gameplayEvent.payload.targetId === REVIVE_INTERACTION_ID) {
                effectCharacterId = await gameplayAuthority.effectCharacterForOperation(
                  principal.userId,
                  selection.characterId,
                  gameplayEvent.requestId,
                );
                if (effectCharacterId === undefined)
                  effectCharacterId = selectReviveTarget(
                    activeInstances.stateFor(selection.characterId)!,
                    selection.characterId,
                  );
                if (effectCharacterId === undefined) {
                  reject('NOT_ALLOWED', 'No hay un compañero derribado para reanimar.');
                  return;
                }
              }
              const result = await gameplayAuthority.apply(
                principal.userId,
                selection.characterId,
                {
                  schemaVersion: 1,
                  operationId: gameplayEvent.requestId,
                  zoneId: party?.zoneId ?? 'corrupted_forest',
                  targetId: gameplayEvent.payload.targetId,
                },
                {
                  actorPosition: player.position,
                  actorState: player.actorState,
                  interruptedByDamage: false,
                  nowMs,
                  ...(effectCharacterId === undefined ? {} : { effectCharacterId }),
                },
              );
              if (
                result.receipt.accepted &&
                result.receipt.resultId !== undefined &&
                result.receipt.completesAtMs !== undefined
              ) {
                const completed = {
                  operationId: result.receipt.operationId,
                  characterId: selection.characterId,
                  targetId: result.receipt.targetId,
                  resultId: result.receipt.resultId,
                  completesAtMs: result.receipt.completesAtMs,
                  ...(result.receipt.effectCharacterId === undefined
                    ? {}
                    : { effectCharacterId: result.receipt.effectCharacterId }),
                  ...(result.receipt.startedAtMs === undefined
                    ? {}
                    : { startedAtMs: result.receipt.startedAtMs }),
                  ...(result.receipt.kind === undefined
                    ? {}
                    : { interruptOnDamage: result.receipt.kind === 'revive' }),
                  actorHealthAtStart: player.health,
                  ...(activeInstances.interactionWasInterrupted(
                    selection.characterId,
                    result.receipt.operationId,
                  )
                    ? { interruptedByDamage: true }
                    : {}),
                } satisfies CompletedInstanceInteraction;
                if (result.replayed && completed.completesAtMs <= nowMs)
                  await flushCompletedInteractions([completed]);
                else activeInstances.scheduleInteraction(selection.characterId, completed);
              }
              sendTracked(
                socket,
                JSON.stringify({
                  protocolVersion: ProtocolVersion,
                  type: 'INTERACTION_RESULT',
                  requestId: gameplayEvent.requestId,
                  payload: result,
                }),
              );
              if (party?.status === 'ACTIVE')
                sendInstanceSnapshot(party.partyId, gameplayEvent.requestId);
              else
                sendTracked(
                  socket,
                  JSON.stringify({
                    protocolVersion: ProtocolVersion,
                    type: 'INSTANCE_SNAPSHOT',
                    requestId: gameplayEvent.requestId,
                    payload: instanceSnapshot(activeInstances.stateFor(selection.characterId)!),
                  }),
                );
            } catch (error: unknown) {
              if (error instanceof CombatCommandError) {
                reject('NOT_ALLOWED', error.message);
              } else if (error instanceof CombatOperationConflictError) {
                reject('NOT_ALLOWED', error.message);
              } else if (error instanceof PartyError) {
                reject('NOT_ALLOWED', error.message);
              } else if (error instanceof ActiveInstanceConflictError) {
                reject('NOT_ALLOWED', 'The selected character is already in another instance.');
              } else if (error instanceof InteractionOperationConflictError) {
                reject('NOT_ALLOWED', 'The operation id conflicts with a prior command.');
              } else if (error instanceof InteractionZoneUnavailableError) {
                reject('NOT_ALLOWED', 'This interaction zone is unavailable.');
              } else if (error instanceof CharacterNotFoundError) {
                reject('NOT_ALLOWED', 'Select an available character first.');
              } else if (error instanceof CharacterNotAvailableError) {
                reject('NOT_ALLOWED', 'The selected character is unavailable.');
              } else if (error instanceof SkillLockedError) {
                reject('NOT_ALLOWED', 'The selected skill is not unlocked for this character.');
              } else if (error instanceof InteractionPersistenceError) {
                reject('NOT_ALLOWED', 'The interaction could not be persisted.');
              } else {
                app.log.error(
                  { err: error, requestId, userId: principal.userId },
                  'Gameplay command failed',
                );
                reject('NOT_ALLOWED', 'The interaction could not be completed.');
              }
            }
          })();
        });
      },
    );
  });

  // Single-origin deployment: when WEB_DIST_PATH points at the built frontend, this server also
  // serves it, so the browser talks to one origin for pages, /api and /ws alike. That keeps the
  // session cookie first-party — a split web/API deployment would need SameSite=None, which
  // browsers phasing out third-party cookies increasingly refuse, silently breaking login.
  // Opt-in via env so every existing test and the local two-process dev setup are untouched.
  const webDistPath = options.webDistPath ?? process.env.WEB_DIST_PATH;
  if (webDistPath !== undefined && webDistPath.length > 0) {
    // Default wildcard routing: it resolves files per request, so a rebuilt bundle with new hashed
    // filenames is served without restarting. Registering per-file instead snapshots the directory
    // at boot, and every later asset falls through to the SPA fallback as text/html — which the
    // browser refuses as a module script.
    void app.register(fastifyStatic, { root: webDistPath });
    // SPA fallback: unknown GETs return index.html so client-side routes survive a hard refresh,
    // while /api and /ws keep returning a real 404 instead of an HTML page a fetch cannot parse.
    app.setNotFoundHandler((request, reply) => {
      if (
        request.method !== 'GET' ||
        request.url.startsWith('/api') ||
        request.url.startsWith('/ws')
      )
        return reply.code(404).send({ error: { code: 'not_found' } });
      return reply.sendFile('index.html');
    });
  }

  return app;
}

function serverNowMs(now: () => Date = () => new Date()): number {
  return now().getTime();
}

function messageType(message: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(message);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const type = (parsed as { type?: unknown }).type;
    return typeof type === 'string' ? type : undefined;
  } catch {
    return undefined;
  }
}

function createInitialForestEnemies(
  instance: Readonly<{
    instanceId: string;
    difficulty: 'normal' | 'veteran';
    players: readonly unknown[];
  }>,
): readonly InstanceEnemyState[] {
  const scaling = enemyDifficultyMultipliers({
    players: instance.players.length,
    difficulty: instance.difficulty,
    config: GAME_DATA.balance,
  });
  const composition = GAME_DATA.enemyTuning.map((enemy) => enemy.enemyId);
  const wave = createForestWave(
    GAME_DATA.endlessForest,
    1,
    0,
    stableSeed(instance.instanceId),
    composition,
  );
  const positions = [
    { x: 220, y: 180 },
    { x: 340, y: 240 },
    { x: 280, y: 300 },
    { x: 400, y: 180 },
  ];
  return wave.spawns.map((spawn, index) => {
    const tuning = GAME_DATA.enemyTuning.find((enemy) => enemy.enemyId === spawn.archetype);
    if (tuning === undefined) throw new Error(`Missing tuning for ${spawn.archetype}.`);
    const maxHealth = Math.max(
      1,
      Math.round(tuning.maxHealth * wave.tuning.enemyHealthMultiplier * scaling.health),
    );
    return {
      enemyId: `enemy:${instance.instanceId}:${spawn.spawnKey}`,
      archetype: spawn.archetype,
      position: positions[index % positions.length]!,
      status: 'active',
      health: maxHealth,
      maxHealth,
    } satisfies InstanceEnemyState;
  });
}

function stableSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function rewardOperationId(instanceId: string, enemyId: string, characterId: string): string {
  const digest = createHash('sha256')
    .update(`${instanceId}\0${enemyId}\0${characterId}`)
    .digest('hex');
  return `reward:${digest}`;
}

function readRequestId(raw: string): string {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === 'object' && value !== null && 'requestId' in value) {
      const requestId = Reflect.get(value, 'requestId');
      if (typeof requestId === 'string' && requestId.trim().length > 0 && requestId.length <= 128) {
        return requestId;
      }
    }
  } catch {
    // The full parser reports malformed payloads below.
  }
  return 'unknown';
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

function requestBodyObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ZodError([]);
  return value as Record<string, unknown>;
}

function serverStatusFromEnvironment(
  value = process.env.SERVER_STATUS,
): 'available' | 'maintenance' {
  if (value === undefined || value === 'available') return 'available';
  if (value === 'maintenance') return 'maintenance';
  throw new Error('SERVER_STATUS must be "available" or "maintenance".');
}
