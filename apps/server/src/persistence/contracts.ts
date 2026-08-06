import { CharacterClassIdSchema, IdSchema, type CharacterClassId } from '@brecha/shared';
import { z } from 'zod';

export const CharacterSaveFormatVersion = 1 as const;
export const InventorySchemaVersion = 1 as const;
export const AwaySnapshotSchemaVersion = 1 as const;

const BaseAttributesSchema = z.strictObject({
  strength: z.number().int().nonnegative(),
  dexterity: z.number().int().nonnegative(),
  intelligence: z.number().int().nonnegative(),
  vitality: z.number().int().nonnegative(),
});
const InventoryItemInputSchema = z.strictObject({
  id: IdSchema,
  definitionId: IdSchema,
  rarity: z.string().trim().min(1).max(32),
  itemPower: z.number().int().nonnegative(),
  favorite: z.boolean(),
  affixes: z.array(z.unknown()),
  generationData: z.record(z.string(), z.unknown()),
  quantity: z.number().int().positive(),
});

export const CreateCharacterInputSchema = z.strictObject({
  user: z.strictObject({ id: IdSchema, email: z.string().trim().email().max(320) }),
  character: z.strictObject({
    id: IdSchema,
    name: z.string().trim().min(1).max(64),
    class: CharacterClassIdSchema.default('GUARDIAN'),
    attributes: BaseAttributesSchema,
    materials: z.bigint().nonnegative(),
    inventory: z.strictObject({
      id: IdSchema,
      capacity: z.number().int().positive(),
      schemaVersion: z.literal(InventorySchemaVersion),
      items: z.array(InventoryItemInputSchema),
    }),
    equipment: z.array(
      z.strictObject({ id: IdSchema, inventoryItemId: IdSchema, slot: z.string() }),
    ),
    progress: z.strictObject({
      id: IdSchema,
      level: z.number().int().min(1).max(10),
      experience: z.bigint().nonnegative(),
      attributePoints: z.number().int().nonnegative(),
      schemaVersion: z.literal(1),
    }),
    skills: z
      .array(
        z
          .strictObject({
            id: IdSchema,
            abilityId: IdSchema,
            level: z.number().int().positive(),
            unlocked: z.boolean(),
            equipped: z.boolean(),
            barSlot: z.number().int().min(0).max(3).nullable(),
          })
          .refine((skill) => skill.equipped === (skill.barSlot !== null), {
            message: 'equipped must match barSlot presence',
          })
          .refine((skill) => !skill.equipped || skill.unlocked, {
            message: 'only unlocked skills can be equipped',
          }),
      )
      .max(4),
  }),
});
export type CreateCharacterInput = z.infer<typeof CreateCharacterInputSchema>;

export type CharacterAggregate = {
  id: string;
  userId: string;
  name: string;
  class: CharacterClassId;
  availability: string;
  gold: bigint;
  materials: bigint;
  attributes: z.infer<typeof BaseAttributesSchema>;
  lastSeenAt: Date;
  saveVersion: number;
  revision: number;
  inventory: {
    id: string;
    capacity: number;
    schemaVersion: number;
    revision: number;
    items: Array<z.infer<typeof InventoryItemInputSchema> & { revision: number }>;
  };
  equipment: Array<{ id: string; slot: string; inventoryItemId: string; revision: number }>;
  skills: Array<{
    id: string;
    abilityId: string;
    level: number;
    unlocked: boolean;
    equipped: boolean;
    barSlot: number | null;
    revision: number;
  }>;
  progress: {
    id: string;
    level: number;
    experience: bigint;
    attributePoints: number;
    schemaVersion: number;
    revision: number;
  };
};

export const EconomyOperationInputSchema = z.strictObject({
  actorUserId: IdSchema,
  characterId: IdSchema,
  operationId: IdSchema,
  source: z.string().trim().min(1).max(64),
  sourceId: IdSchema,
  goldDelta: z.bigint(),
  materialsDelta: z.bigint(),
  experienceDelta: z.bigint(),
  versions: z.strictObject({
    balance: z.string().trim().min(1).max(64),
    data: z.string().trim().min(1).max(64),
    formula: z.string().trim().min(1).max(64),
    schema: z.literal(1),
  }),
});
export type EconomyOperationInput = z.infer<typeof EconomyOperationInputSchema>;

/** Durable receipt: replaying an operation returns this exact stored value. */
export type EconomyReceipt = {
  operationId: string;
  requestHash: string;
  source: string;
  sourceId: string;
  goldDelta: bigint;
  materialsDelta: bigint;
  experienceDelta: bigint;
  goldBalanceAfter: bigint;
  materialsBalanceAfter: bigint;
  experienceBalanceAfter: bigint;
  balanceVersion: string;
  dataVersion: string;
  formulaVersion: string;
  schemaVersion: number;
  revision: number;
};

export const CharacterSaveV1Schema = z.strictObject({
  formatVersion: z.literal(CharacterSaveFormatVersion),
  userId: IdSchema,
  characterId: IdSchema,
  revision: z.number().int().positive(),
  savedAtServerMs: z.number().int().nonnegative(),
  inventorySchemaVersion: z.literal(InventorySchemaVersion),
  awaySnapshotSchemaVersion: z.literal(AwaySnapshotSchemaVersion),
  payload: z.strictObject({
    gold: z.bigint().nonnegative(),
    materials: z.bigint().nonnegative(),
    level: z.number().int().min(1).max(10),
    experience: z.bigint().nonnegative(),
  }),
});
export type CharacterSaveV1 = z.infer<typeof CharacterSaveV1Schema>;

export class UnknownSaveVersionError extends Error {
  public constructor(version: unknown) {
    super(`Unsupported character save format version: ${String(version)}`);
    this.name = 'UnknownSaveVersionError';
  }
}

/** Version 1 is the minimum supported format. Later versions must add a sequential migrator. */
export function migrateCharacterSave(value: unknown): CharacterSaveV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UnknownSaveVersionError(undefined);
  }
  const version = (value as { formatVersion?: unknown }).formatVersion;
  if (version !== CharacterSaveFormatVersion) throw new UnknownSaveVersionError(version);
  return CharacterSaveV1Schema.parse(value);
}
