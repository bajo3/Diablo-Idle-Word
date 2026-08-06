import { z } from 'zod';

import { DifficultySchema } from './away.js';
import { ProtocolVersion } from './domain.js';
import { AbilityIdSchema, EntityIdSchema, MissionIdSchema, ZoneIdSchema } from './ids.js';
import { InteractionPointSchema, InteractionReceiptSchema } from './interaction.js';
import { InstanceObjectiveStateSchema, InstanceSnapshotSchema } from './instance.js';
import { PartyJoinCodeSchema, PartySnapshotSchema } from './party.js';
import { ItemInstanceSchema } from './items.js';

const EnvelopeSchema = z.strictObject({
  protocolVersion: z.literal(ProtocolVersion),
  requestId: z.string().trim().min(1).max(128),
  sequence: z.number().int().nonnegative(),
});

export const ClientEventSchema = z.discriminatedUnion('type', [
  EnvelopeSchema.extend({
    type: z.literal('MOVE_INTENT'),
    payload: z.strictObject({ x: z.number().finite(), y: z.number().finite() }),
  }),
  EnvelopeSchema.extend({
    type: z.literal('COMBAT_INTENT'),
    payload: z.strictObject({
      abilityId: AbilityIdSchema,
      targetId: EntityIdSchema.optional(),
      /** Facing is an intent; the server normalizes it and never trusts client position. */
      facing: InteractionPointSchema.optional(),
    }),
  }),
  EnvelopeSchema.extend({
    type: z.literal('INTERACT_INTENT'),
    payload: z.strictObject({ targetId: EntityIdSchema }),
  }),
  EnvelopeSchema.extend({
    type: z.literal('PARTY_CREATE_INTENT'),
    payload: z.strictObject({}),
  }),
  EnvelopeSchema.extend({
    type: z.literal('PARTY_JOIN_INTENT'),
    payload: z.strictObject({ joinCode: PartyJoinCodeSchema }),
  }),
  EnvelopeSchema.extend({
    type: z.literal('PARTY_READY_INTENT'),
    payload: z.strictObject({ ready: z.boolean() }),
  }),
  EnvelopeSchema.extend({
    type: z.literal('PARTY_START_INTENT'),
    payload: z.strictObject({ zoneId: ZoneIdSchema, difficulty: DifficultySchema }),
  }),
  EnvelopeSchema.extend({
    type: z.literal('PARTY_LEAVE_INTENT'),
    payload: z.strictObject({}),
  }),
  EnvelopeSchema.extend({
    type: z.literal('START_CALIBRATION_INTENT'),
    payload: z.strictObject({ zoneId: ZoneIdSchema, difficulty: DifficultySchema }),
  }),
]);

export const ServerEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('COMMAND_ACCEPTED'),
    requestId: z.string().trim().min(1).max(128),
    payload: z.strictObject({ serverTimeMs: z.number().int().nonnegative() }),
  }),
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('COMMAND_REJECTED'),
    requestId: z.string().trim().min(1).max(128),
    payload: z.strictObject({
      code: z.enum(['INVALID_PAYLOAD', 'NOT_ALLOWED', 'STALE_SEQUENCE']),
      message: z.string().trim().min(1).max(160),
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('MISSION_STATE'),
    requestId: z.string().trim().min(1).max(128),
    payload: z.strictObject({
      missionId: MissionIdSchema,
      revision: z.number().int().nonnegative(),
      /** Server-owned progress; finite altar/boss objectives are retired by the endless Forest loop. */
      objectives: z.array(InstanceObjectiveStateSchema).max(8).default([]),
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('INTERACTION_RESULT'),
    requestId: z.string().trim().min(1).max(128),
    payload: z.strictObject({
      receipt: InteractionReceiptSchema,
      replayed: z.boolean(),
      stateRevision: z.number().int().positive(),
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('INSTANCE_SNAPSHOT'),
    requestId: z.string().trim().min(1).max(128),
    payload: InstanceSnapshotSchema,
  }),
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('INTERACTION_EFFECT'),
    requestId: z.string().trim().min(1).max(128),
    payload: z.strictObject({
      operationId: z.string().trim().min(1).max(128),
      characterId: z.string().trim().min(1).max(128),
      resultId: z.string().trim().min(1).max(128),
      effectType: z.enum(['revive', 'dialogue', 'loot_authorization']),
      status: z.enum(['APPLIED', 'PENDING_DOMAIN']),
      replayed: z.boolean(),
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('INTERACTION_INTERRUPTED'),
    requestId: z.string().trim().min(1).max(128),
    payload: z.strictObject({
      operationId: z.string().trim().min(1).max(128),
      characterId: EntityIdSchema,
      reason: z.literal('damage'),
      stateRevision: z.number().int().positive(),
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('REWARD_GRANTED'),
    requestId: z.string().trim().min(1).max(128),
    payload: z.strictObject({
      operationId: z.string().trim().min(1).max(128),
      characterId: EntityIdSchema,
      source: z.literal('enemy_defeat'),
      sourceId: EntityIdSchema,
      archetype: EntityIdSchema,
      experienceDelta: z.string().regex(/^\d+$/),
      goldDelta: z.string().regex(/^\d+$/),
      materialsDelta: z.string().regex(/^\d+$/),
      forestLevel: z.number().int().positive(),
      forestXpInLevel: z.number().int().nonnegative(),
      forestBestLevel: z.number().int().positive(),
      leveledUp: z.boolean(),
      items: z.array(ItemInstanceSchema).max(4).default([]),
      dropStatus: z.enum(['granted', 'no_drop', 'inventory_full']).default('no_drop'),
      visibility: z.literal('private').default('private'),
      replayed: z.boolean(),
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('PARTY_SNAPSHOT'),
    requestId: z.string().trim().min(1).max(128),
    payload: PartySnapshotSchema,
  }),
  z.strictObject({
    protocolVersion: z.literal(ProtocolVersion),
    type: z.literal('COMBAT_RESULT'),
    requestId: z.string().trim().min(1).max(128),
    payload: z.strictObject({
      operationId: z.string().trim().min(1).max(128),
      characterId: EntityIdSchema,
      abilityId: AbilityIdSchema,
      executionId: z.string().trim().min(1).max(128),
      replayed: z.boolean(),
      damage: z.number().int().nonnegative(),
      critical: z.boolean(),
      targetId: EntityIdSchema.optional(),
      targetHealth: z.number().int().nonnegative().optional(),
      defeated: z.boolean(),
      cooldownEndsAt: z.number().int().nonnegative(),
      revision: z.number().int().positive(),
      pending: z.boolean().default(false),
      impactAtMs: z.number().int().nonnegative().optional(),
      hits: z
        .array(
          z.strictObject({
            targetId: EntityIdSchema,
            damage: z.number().int().nonnegative(),
            critical: z.boolean(),
            targetHealth: z.number().int().nonnegative(),
            defeated: z.boolean(),
            position: InteractionPointSchema,
          }),
        )
        .default([]),
      ironSkinStartsAt: z.number().int().nonnegative().optional(),
      ironSkinEndsAt: z.number().int().nonnegative().optional(),
      movementMultiplier: z.number().positive().max(1).optional(),
    }),
  }),
]);

export type ClientEvent = z.infer<typeof ClientEventSchema>;
export type ServerEvent = z.infer<typeof ServerEventSchema>;
