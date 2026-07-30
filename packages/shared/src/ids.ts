import { z } from 'zod';

/** Stable identifiers are data, never display names or filesystem paths. */
export const IdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._:-]*$/);
export type Id = z.infer<typeof IdSchema>;

export const EntityIdSchema = IdSchema;
export const CharacterIdSchema = IdSchema;
export const ItemDefinitionIdSchema = IdSchema;
export const ItemInstanceIdSchema = IdSchema;
export const AbilityIdSchema = IdSchema;
export const EnemyIdSchema = IdSchema;
export const ZoneIdSchema = IdSchema;
export const MissionIdSchema = IdSchema;
export const AssetIdSchema = IdSchema;
export const BuildFingerprintSchema = z.string().trim().min(1).max(256);
export const SeedSchema = z.string().trim().min(1).max(256);
export const VersionSchema = z.string().trim().min(1).max(64);

export type EntityId = z.infer<typeof EntityIdSchema>;
export type CharacterId = z.infer<typeof CharacterIdSchema>;
export type ItemDefinitionId = z.infer<typeof ItemDefinitionIdSchema>;
export type ItemInstanceId = z.infer<typeof ItemInstanceIdSchema>;
export type AbilityId = z.infer<typeof AbilityIdSchema>;
export type EnemyId = z.infer<typeof EnemyIdSchema>;
export type ZoneId = z.infer<typeof ZoneIdSchema>;
export type MissionId = z.infer<typeof MissionIdSchema>;
export type AssetId = z.infer<typeof AssetIdSchema>;
export type BuildFingerprint = z.infer<typeof BuildFingerprintSchema>;
export type Seed = z.infer<typeof SeedSchema>;
