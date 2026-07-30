import { z } from 'zod';

import { DifficultySchema } from './away.js';
import { ProtocolVersion } from './domain.js';
import { AbilityIdSchema, EntityIdSchema, MissionIdSchema, ZoneIdSchema } from './ids.js';

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
    payload: z.strictObject({ abilityId: AbilityIdSchema, targetId: EntityIdSchema.optional() }),
  }),
  EnvelopeSchema.extend({
    type: z.literal('INTERACT_INTENT'),
    payload: z.strictObject({ targetId: EntityIdSchema }),
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
    }),
  }),
]);

export type ClientEvent = z.infer<typeof ClientEventSchema>;
export type ServerEvent = z.infer<typeof ServerEventSchema>;
