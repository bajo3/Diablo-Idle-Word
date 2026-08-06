/**
 * Authoritative active-instance state for the asynchronous server tick.
 *
 * This module is deliberately pure: it owns no socket, timer, database or renderer. The server
 * keeps the returned value in its instance registry and is the only caller allowed to advance it.
 * A client may submit a movement vector, never an absolute position or a new health value.
 */
import { z } from 'zod';

import { DifficultySchema } from './away.js';
import { InteractionActorStateSchema, InteractionPointSchema } from './interaction.js';
import { CharacterIdSchema, EntityIdSchema, ZoneIdSchema } from './ids.js';

export const ActiveInstanceSchemaVersion = 1 as const;
export const MAX_INSTANCE_PLAYERS = 4 as const;
export const MAX_INSTANCE_ENEMIES = 64 as const;

export const InstanceMovementConfigSchema = z.strictObject({
  worldWidth: z.number().finite().positive(),
  worldHeight: z.number().finite().positive(),
  worldMargin: z.number().finite().nonnegative(),
  playerSpeedPxPerSecond: z.number().finite().positive(),
  tickMs: z.number().int().positive(),
});
export type InstanceMovementConfig = z.infer<typeof InstanceMovementConfigSchema>;

/** Provisional local-forest bounds; the map catalog will own these values in a later milestone. */
export const DEFAULT_INSTANCE_MOVEMENT_CONFIG: InstanceMovementConfig = Object.freeze({
  worldWidth: 1280,
  worldHeight: 720,
  worldMargin: 24,
  playerSpeedPxPerSecond: 220,
  tickMs: 250,
});

export const InstancePlayerStateSchema = z.strictObject({
  characterId: CharacterIdSchema,
  position: InteractionPointSchema,
  actorState: InteractionActorStateSchema,
  health: z.number().int().nonnegative(),
  maxHealth: z.number().int().positive(),
});
export type InstancePlayerState = z.infer<typeof InstancePlayerStateSchema>;

export const InstanceEnemyStatusSchema = z.enum(['active', 'dead']);
export const InstanceEnemyAiStateSchema = z.enum([
  'idle',
  'patrol',
  'detect',
  'chase',
  'attack',
  'use_ability',
  'retreat',
  'stunned',
  'dead',
]);
export const InstanceEnemyStateSchema = z.strictObject({
  enemyId: EntityIdSchema,
  archetype: EntityIdSchema,
  position: InteractionPointSchema,
  status: InstanceEnemyStatusSchema,
  health: z.number().int().nonnegative(),
  maxHealth: z.number().int().positive(),
  /** Server-derived presentation state; omitted until the authoritative AI has ticked once. */
  aiState: InstanceEnemyAiStateSchema.optional(),
  /** Server timestamp used to keep the death animation before cleanup/respawn. */
  deadAtMs: z.number().int().nonnegative().optional(),
});
export type InstanceEnemyState = z.infer<typeof InstanceEnemyStateSchema>;

/**
 * Server-owned objective progress replicated with every active-instance snapshot.
 *
 * The finite altar/boss mission was retired by GOAL.md §0.1. The active Forest loop therefore
 * exposes one non-terminal level objective; reaching `target` is still playable and does not
 * turn the instance into a completed/defeated terminal state.
 */
export const InstanceObjectiveStateSchema = z.strictObject({
  objectiveId: EntityIdSchema,
  mode: z.literal('endless_forest'),
  status: z.enum(['active', 'complete']),
  progress: z.number().int().nonnegative(),
  target: z.number().int().positive(),
});
export type InstanceObjectiveState = z.infer<typeof InstanceObjectiveStateSchema>;

export const ActiveInstanceStateSchema = z
  .strictObject({
    schemaVersion: z.literal(ActiveInstanceSchemaVersion),
    instanceId: EntityIdSchema,
    zoneId: ZoneIdSchema,
    difficulty: DifficultySchema,
    startedAtMs: z.number().int().nonnegative(),
    nowMs: z.number().int().nonnegative(),
    tick: z.number().int().nonnegative(),
    revision: z.number().int().positive(),
    players: z.array(InstancePlayerStateSchema).min(1).max(MAX_INSTANCE_PLAYERS),
    enemies: z.array(InstanceEnemyStateSchema).max(MAX_INSTANCE_ENEMIES).default([]),
    objectives: z.array(InstanceObjectiveStateSchema).max(8).default([]),
  })
  .superRefine((state, context) => {
    const seen = new Set<string>();
    for (const [index, player] of state.players.entries()) {
      if (seen.has(player.characterId)) {
        context.addIssue({
          code: 'custom',
          message: 'An active instance cannot contain the same character twice.',
          path: ['players', index, 'characterId'],
        });
      }
      seen.add(player.characterId);
      if (player.health > player.maxHealth) {
        context.addIssue({
          code: 'custom',
          message: 'Player health cannot exceed maxHealth.',
          path: ['players', index, 'health'],
        });
      }
    }
    const seenEnemies = new Set<string>();
    for (const [index, enemy] of state.enemies.entries()) {
      if (seenEnemies.has(enemy.enemyId)) {
        context.addIssue({
          code: 'custom',
          message: 'An active instance cannot contain the same enemy twice.',
          path: ['enemies', index, 'enemyId'],
        });
      }
      seenEnemies.add(enemy.enemyId);
      if (enemy.health > enemy.maxHealth) {
        context.addIssue({
          code: 'custom',
          message: 'Enemy health cannot exceed maxHealth.',
          path: ['enemies', index, 'health'],
        });
      }
    }
    const seenObjectives = new Set<string>();
    for (const [index, objective] of state.objectives.entries()) {
      if (seenObjectives.has(objective.objectiveId)) {
        context.addIssue({
          code: 'custom',
          message: 'An active instance cannot contain the same objective twice.',
          path: ['objectives', index, 'objectiveId'],
        });
      }
      seenObjectives.add(objective.objectiveId);
      if (objective.progress > objective.target) {
        context.addIssue({
          code: 'custom',
          message: 'Objective progress cannot exceed its target.',
          path: ['objectives', index, 'progress'],
        });
      }
    }
    if (state.nowMs < state.startedAtMs) {
      context.addIssue({
        code: 'custom',
        message: 'Instance time cannot precede startedAtMs.',
        path: ['nowMs'],
      });
    }
  });
export type ActiveInstanceState = z.infer<typeof ActiveInstanceStateSchema>;

/** Public replication shape. It intentionally omits server-only start time and schema internals. */
export const InstanceSnapshotSchema = z.strictObject({
  instanceId: EntityIdSchema,
  zoneId: ZoneIdSchema,
  difficulty: DifficultySchema,
  serverTimeMs: z.number().int().nonnegative(),
  tick: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
  players: z.array(InstancePlayerStateSchema).min(1).max(MAX_INSTANCE_PLAYERS),
  enemies: z.array(InstanceEnemyStateSchema).max(MAX_INSTANCE_ENEMIES).default([]),
  objectives: z.array(InstanceObjectiveStateSchema).max(8).default([]),
});
export type InstanceSnapshot = z.infer<typeof InstanceSnapshotSchema>;

export function instanceSnapshot(state: ActiveInstanceState): InstanceSnapshot {
  return InstanceSnapshotSchema.parse({
    instanceId: state.instanceId,
    zoneId: state.zoneId,
    difficulty: state.difficulty,
    serverTimeMs: state.nowMs,
    tick: state.tick,
    revision: state.revision,
    players: state.players,
    enemies: state.enemies,
    objectives: state.objectives,
  });
}

export const MovementIntentSchema = z.strictObject({
  /** Direction/input vector. Values outside the unit square are normalized server-side. */
  x: z.number().finite(),
  y: z.number().finite(),
});
export type MovementIntent = z.infer<typeof MovementIntentSchema>;

export type MovementRejectReason = 'unknown_actor' | 'invalid_state' | 'invalid_vector';
export type MovementResult = Readonly<{
  state: ActiveInstanceState;
  accepted: boolean;
  reason?: MovementRejectReason;
}>;

export type CreateActiveInstanceInput = Readonly<{
  instanceId: string;
  zoneId: string;
  difficulty: z.infer<typeof DifficultySchema>;
  startedAtMs: number;
  characterId: string;
  spawnPosition: z.infer<typeof InteractionPointSchema>;
  maxHealth: number;
  objectives?: readonly InstanceObjectiveState[];
}>;

export type AddInstancePlayerInput = Readonly<{
  characterId: string;
  spawnPosition: z.infer<typeof InteractionPointSchema>;
  maxHealth: number;
  actorState?: z.infer<typeof InteractionActorStateSchema>;
  health?: number;
}>;

export function createActiveInstance(
  input: CreateActiveInstanceInput,
  config: InstanceMovementConfig = DEFAULT_INSTANCE_MOVEMENT_CONFIG,
): ActiveInstanceState {
  const movement = InstanceMovementConfigSchema.parse(config);
  if (!Number.isInteger(input.startedAtMs) || input.startedAtMs < 0)
    throw new Error('An active instance requires a non-negative integer start time.');
  const position = clampPosition(InteractionPointSchema.parse(input.spawnPosition), movement);
  const maxHealth = positiveInteger(input.maxHealth, 'maxHealth');
  return ActiveInstanceStateSchema.parse({
    schemaVersion: ActiveInstanceSchemaVersion,
    instanceId: EntityIdSchema.parse(input.instanceId),
    zoneId: ZoneIdSchema.parse(input.zoneId),
    difficulty: DifficultySchema.parse(input.difficulty),
    startedAtMs: input.startedAtMs,
    nowMs: input.startedAtMs,
    tick: 0,
    revision: 1,
    players: [
      {
        characterId: CharacterIdSchema.parse(input.characterId),
        position,
        actorState: 'active',
        health: maxHealth,
        maxHealth,
      },
    ],
    enemies: [],
    objectives: input.objectives ?? [],
  });
}

/** Adds a server-authorized party member without changing the instance identity or clock. */
export function addInstancePlayer(
  state: ActiveInstanceState,
  input: AddInstancePlayerInput,
  config: InstanceMovementConfig = DEFAULT_INSTANCE_MOVEMENT_CONFIG,
): ActiveInstanceState {
  const current = ActiveInstanceStateSchema.parse(state);
  const movement = InstanceMovementConfigSchema.parse(config);
  if (current.players.length >= MAX_INSTANCE_PLAYERS)
    throw new Error('An active instance cannot contain more than four players.');
  const characterId = CharacterIdSchema.parse(input.characterId);
  if (current.players.some((player) => player.characterId === characterId))
    throw new Error('The character is already in this active instance.');
  const maxHealth = positiveInteger(input.maxHealth, 'maxHealth');
  const health = input.health ?? maxHealth;
  if (!Number.isInteger(health) || health < 0 || health > maxHealth)
    throw new Error('Instance player health is outside its allowed range.');
  const player: InstancePlayerState = {
    characterId,
    position: clampPosition(InteractionPointSchema.parse(input.spawnPosition), movement),
    actorState: input.actorState ?? 'active',
    health,
    maxHealth,
  };
  return ActiveInstanceStateSchema.parse({
    ...current,
    players: [...current.players, player],
    revision: current.revision + 1,
  });
}

/** Removes a party member; an empty active instance is represented by `undefined` at the registry. */
export function removeInstancePlayer(
  state: ActiveInstanceState,
  characterId: string,
): ActiveInstanceState | undefined {
  const current = ActiveInstanceStateSchema.parse(state);
  const index = current.players.findIndex((player) => player.characterId === characterId);
  if (index < 0) return current;
  if (current.players.length === 1) return undefined;
  return ActiveInstanceStateSchema.parse({
    ...current,
    players: current.players.filter((_, playerIndex) => playerIndex !== index),
    revision: current.revision + 1,
  });
}

/** Replaces the server-owned encounter list; clients never provide enemy health or positions. */
export function replaceInstanceEnemies(
  state: ActiveInstanceState,
  enemies: readonly InstanceEnemyState[],
): ActiveInstanceState {
  const current = ActiveInstanceStateSchema.parse(state);
  return ActiveInstanceStateSchema.parse({
    ...current,
    enemies: enemies.map((enemy) => InstanceEnemyStateSchema.parse(enemy)),
    revision: current.revision + 1,
  });
}

/** Replaces the server-owned objective list; clients never provide objective progress. */
export function replaceInstanceObjectives(
  state: ActiveInstanceState,
  objectives: readonly InstanceObjectiveState[],
): ActiveInstanceState {
  const current = ActiveInstanceStateSchema.parse(state);
  return ActiveInstanceStateSchema.parse({
    ...current,
    objectives: objectives.map((objective) => InstanceObjectiveStateSchema.parse(objective)),
    revision: current.revision + 1,
  });
}

/** Advances only server time/tick. Calling with an older time is rejected, never rewound. */
export function advanceActiveInstance(
  state: ActiveInstanceState,
  nowMs: number,
  config: InstanceMovementConfig = DEFAULT_INSTANCE_MOVEMENT_CONFIG,
): ActiveInstanceState {
  const current = ActiveInstanceStateSchema.parse(state);
  const movement = InstanceMovementConfigSchema.parse(config);
  if (!Number.isInteger(nowMs) || nowMs < current.nowMs)
    throw new Error('An active instance cannot move its clock backwards.');
  if (nowMs === current.nowMs) return current;
  const tick = Math.floor((nowMs - current.startedAtMs) / movement.tickMs);
  if (tick < current.tick) throw new Error('An active instance cannot move its tick backwards.');
  return ActiveInstanceStateSchema.parse({
    ...current,
    nowMs,
    tick,
    revision: current.revision + (tick === current.tick ? 0 : 1),
  });
}

/**
 * Applies a movement intention for the elapsed server window. The client vector is normalized and
 * clamped to map bounds, so even an untrusted huge vector cannot teleport the actor.
 */
export function applyMovementIntent(
  state: ActiveInstanceState,
  characterId: string,
  intent: MovementIntent,
  nowMs: number,
  config: InstanceMovementConfig = DEFAULT_INSTANCE_MOVEMENT_CONFIG,
): MovementResult {
  const current = advanceActiveInstance(state, nowMs, config);
  const movement = InstanceMovementConfigSchema.parse(config);
  const actorId = CharacterIdSchema.safeParse(characterId);
  const parsedIntent = MovementIntentSchema.safeParse(intent);
  const playerIndex = current.players.findIndex((player) => player.characterId === characterId);
  if (!actorId.success || playerIndex < 0)
    return { state: current, accepted: false, reason: 'unknown_actor' };
  if (!parsedIntent.success) return { state: current, accepted: false, reason: 'invalid_vector' };
  const player = current.players[playerIndex]!;
  if (player.actorState !== 'active')
    return { state: current, accepted: false, reason: 'invalid_state' };

  const { x, y } = parsedIntent.data;
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude))
    return { state: current, accepted: false, reason: 'invalid_vector' };
  const normalizedX = magnitude > 1 ? x / magnitude : x;
  const normalizedY = magnitude > 1 ? y / magnitude : y;
  const elapsedMs = Math.max(0, nowMs - state.nowMs);
  const distance = (movement.playerSpeedPxPerSecond * elapsedMs) / 1000;
  const nextPosition = clampPosition(
    {
      x: player.position.x + normalizedX * distance,
      y: player.position.y + normalizedY * distance,
    },
    movement,
  );
  const players = current.players.map((candidate, index) =>
    index === playerIndex ? { ...candidate, position: nextPosition } : candidate,
  );
  return {
    state: ActiveInstanceStateSchema.parse({
      ...current,
      players,
      revision: current.revision + (samePoint(player.position, nextPosition) ? 0 : 1),
    }),
    accepted: true,
  };
}

export function instancePlayer(
  state: ActiveInstanceState,
  characterId: string,
): InstancePlayerState | undefined {
  return state.players.find((player) => player.characterId === characterId);
}

export function updateInstancePlayer(
  state: ActiveInstanceState,
  characterId: string,
  update: Partial<Pick<InstancePlayerState, 'actorState' | 'health'>>,
): ActiveInstanceState {
  const index = state.players.findIndex((player) => player.characterId === characterId);
  if (index < 0) throw new Error('The requested instance player does not exist.');
  const player = state.players[index]!;
  const health = update.health ?? player.health;
  if (!Number.isInteger(health) || health < 0 || health > player.maxHealth)
    throw new Error('Instance player health is outside its allowed range.');
  const players = state.players.map((candidate, candidateIndex) =>
    candidateIndex === index
      ? { ...candidate, actorState: update.actorState ?? candidate.actorState, health }
      : candidate,
  );
  return ActiveInstanceStateSchema.parse({ ...state, players, revision: state.revision + 1 });
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${field} must be a positive integer.`);
  return value;
}

function clampPosition(
  point: z.infer<typeof InteractionPointSchema>,
  config: InstanceMovementConfig,
): z.infer<typeof InteractionPointSchema> {
  const minX = Math.min(config.worldMargin, config.worldWidth / 2);
  const minY = Math.min(config.worldMargin, config.worldHeight / 2);
  const maxX = Math.max(minX, config.worldWidth - config.worldMargin);
  const maxY = Math.max(minY, config.worldHeight - config.worldMargin);
  return {
    x: Math.min(maxX, Math.max(minX, point.x)),
    y: Math.min(maxY, Math.max(minY, point.y)),
  };
}

function samePoint(
  left: z.infer<typeof InteractionPointSchema>,
  right: z.infer<typeof InteractionPointSchema>,
): boolean {
  return left.x === right.x && left.y === right.y;
}
