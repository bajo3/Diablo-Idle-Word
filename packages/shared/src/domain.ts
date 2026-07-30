import { z } from 'zod';

import {
  AbilityIdSchema,
  BuildFingerprintSchema,
  CharacterIdSchema,
  EntityIdSchema,
  ItemDefinitionIdSchema,
  ItemInstanceIdSchema,
  VersionSchema,
  ZoneIdSchema,
} from './ids.js';

export const ProtocolVersion = 1 as const;
export const DomainSchemaVersion = 1 as const;

export const CharacterAvailabilitySchema = z.enum([
  'AVAILABLE',
  'IN_ACTIVE_RUN',
  'AWAY_CALIBRATING',
  'AWAY_FARMING',
  'AWAY_REWARD_PENDING',
]);
export type CharacterAvailability = z.infer<typeof CharacterAvailabilitySchema>;

export const AttributeKeySchema = z.enum(['strength', 'dexterity', 'intelligence', 'vitality']);
export const AttributesSchema = z.strictObject({
  strength: z.number().int().nonnegative(),
  dexterity: z.number().int().nonnegative(),
  intelligence: z.number().int().nonnegative(),
  vitality: z.number().int().nonnegative(),
});
export type AttributeKey = z.infer<typeof AttributeKeySchema>;
export type Attributes = z.infer<typeof AttributesSchema>;

export const EquipmentSlotSchema = z.enum([
  'helmet',
  'chest',
  'gloves',
  'boots',
  'main_hand',
  'off_hand',
  'amulet',
  'ring_1',
  'ring_2',
]);
export const ItemTypeSchema = z.enum([
  'weapon_one_hand',
  'weapon_two_hand',
  'shield',
  'helmet',
  'chest',
  'gloves',
  'boots',
  'amulet',
  'ring',
  'material',
]);
export const ItemRaritySchema = z.enum(['common', 'magic', 'rare', 'legendary']);
export type EquipmentSlot = z.infer<typeof EquipmentSlotSchema>;
export type ItemType = z.infer<typeof ItemTypeSchema>;
export type ItemRarity = z.infer<typeof ItemRaritySchema>;

export const EquippedItemSnapshotSchema = z.strictObject({
  instanceId: ItemInstanceIdSchema,
  definitionId: ItemDefinitionIdSchema,
  slot: EquipmentSlotSchema,
  rarity: ItemRaritySchema,
  itemPower: z.number().int().nonnegative(),
});
export const BuildSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(DomainSchemaVersion),
  characterId: CharacterIdSchema,
  classId: z.literal('guardian'),
  level: z.number().int().min(1).max(10),
  attributes: AttributesSchema,
  equippedItems: z.array(EquippedItemSnapshotSchema).max(9),
  equippedAbilityIds: z.array(AbilityIdSchema).max(4),
  fingerprint: BuildFingerprintSchema,
  gameDataVersion: VersionSchema,
  balanceVersion: VersionSchema,
});
export type EquippedItemSnapshot = z.infer<typeof EquippedItemSnapshotSchema>;
export type BuildSnapshot = z.infer<typeof BuildSnapshotSchema>;

export const EntityStateSchema = z.strictObject({
  entityId: EntityIdSchema,
  availability: CharacterAvailabilitySchema,
  zoneId: ZoneIdSchema.optional(),
});
export type EntityState = z.infer<typeof EntityStateSchema>;
