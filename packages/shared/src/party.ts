import { z } from 'zod';

import { DifficultySchema } from './away.js';
import { CharacterIdSchema, EntityIdSchema, ZoneIdSchema } from './ids.js';

export const PartySchemaVersion = 1 as const;
export const PARTY_MAX_MEMBERS = 4 as const;

export const PartyStatusSchema = z.enum(['LOBBY', 'ACTIVE']);
export type PartyStatus = z.infer<typeof PartyStatusSchema>;

export const PartyMemberSnapshotSchema = z.strictObject({
  characterId: CharacterIdSchema,
  ready: z.boolean(),
  leader: z.boolean(),
});
export type PartyMemberSnapshot = z.infer<typeof PartyMemberSnapshotSchema>;

export const PartySnapshotSchema = z.strictObject({
  schemaVersion: z.literal(PartySchemaVersion),
  partyId: EntityIdSchema,
  joinCode: z.string().regex(/^[A-Z0-9]{6}$/),
  status: PartyStatusSchema,
  leaderCharacterId: CharacterIdSchema,
  zoneId: ZoneIdSchema.optional(),
  difficulty: DifficultySchema.optional(),
  revision: z.number().int().positive(),
  members: z.array(PartyMemberSnapshotSchema).min(1).max(PARTY_MAX_MEMBERS),
});
export type PartySnapshot = z.infer<typeof PartySnapshotSchema>;

export const PartyJoinCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/);
