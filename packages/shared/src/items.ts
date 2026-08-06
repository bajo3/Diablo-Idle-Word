import { z } from 'zod';

import { EquipmentSlotSchema, ItemRaritySchema, ItemTypeSchema } from './domain.js';
import { IdSchema, ItemDefinitionIdSchema, ItemInstanceIdSchema, SeedSchema } from './ids.js';
import { createSeededRandom, seedFromString, type RandomSource } from './random.js';

/** Stats that an item may contribute to the character build in the first vertical slice. */
export const ItemStatKeySchema = z.enum([
  'strength',
  'dexterity',
  'intelligence',
  'vitality',
  'armor',
  'physical_damage',
  'critical_chance',
  'attack_speed_minor',
  'max_health',
]);
export type ItemStatKey = z.infer<typeof ItemStatKeySchema>;

export const ItemStatRangeSchema = z.strictObject({
  stat: ItemStatKeySchema,
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});
export type ItemStatRange = z.infer<typeof ItemStatRangeSchema>;

export const ItemDefinitionSchema = z
  .strictObject({
    id: ItemDefinitionIdSchema,
    displayName: z.string().trim().min(1).max(96),
    type: ItemTypeSchema,
    slot: EquipmentSlotSchema.optional(),
    itemPowerRange: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    baseStats: z.array(ItemStatRangeSchema).max(8),
    tuningStatus: z.literal('PROVISIONAL'),
  })
  .superRefine((definition, context) => {
    if (definition.itemPowerRange[1] < definition.itemPowerRange[0])
      context.addIssue({ code: 'custom', message: 'itemPowerRange is descending' });
    if (definition.type === 'material' && definition.slot !== undefined)
      context.addIssue({ code: 'custom', message: 'materials cannot use an equipment slot' });
    if (definition.type !== 'material' && definition.slot === undefined)
      context.addIssue({ code: 'custom', message: 'equipment definitions require a slot' });
  });
export type ItemDefinition = z.infer<typeof ItemDefinitionSchema>;

export const AffixFamilySchema = z.enum(['offense', 'defense', 'utility', 'corruption']);
export const AffixDefinitionSchema = z.strictObject({
  id: IdSchema,
  displayName: z.string().trim().min(1).max(96),
  family: AffixFamilySchema,
  stat: ItemStatKeySchema,
  min: z.number().int().positive(),
  max: z.number().int().positive(),
  tuningStatus: z.literal('PROVISIONAL'),
});
export type AffixDefinition = z.infer<typeof AffixDefinitionSchema>;

export const GeneratedAffixSchema = z.strictObject({
  id: IdSchema,
  stat: ItemStatKeySchema,
  value: z.number().int().positive(),
});
export type GeneratedAffix = z.infer<typeof GeneratedAffixSchema>;

export const ItemInstanceSchema = z.strictObject({
  instanceId: ItemInstanceIdSchema,
  definitionId: ItemDefinitionIdSchema,
  itemLevel: z.number().int().positive(),
  rarity: ItemRaritySchema,
  itemPower: z.number().int().positive(),
  baseStats: z.array(GeneratedAffixSchema).max(8),
  affixes: z.array(GeneratedAffixSchema).max(4),
  generationSeed: SeedSchema,
  generatorVersion: z.string().trim().min(1).max(64),
  source: z.string().trim().min(1).max(64),
  quantity: z.number().int().positive(),
});
export type ItemInstance = z.infer<typeof ItemInstanceSchema>;

export const RarityWeightSchema = z.strictObject({
  rarity: ItemRaritySchema,
  weight: z.number().int().positive(),
});
export type RarityWeight = z.infer<typeof RarityWeightSchema>;

export const ItemGenerationConfigSchema = z.strictObject({
  generatorVersion: z.string().trim().min(1).max(64),
  rarityWeights: z.array(RarityWeightSchema).min(1),
  affixCountByRarity: z.strictObject({
    common: z.literal(0),
    magic: z.number().int().min(0).max(4),
    rare: z.number().int().min(0).max(4),
    legendary: z.number().int().min(0).max(4),
  }),
});
export type ItemGenerationConfig = z.infer<typeof ItemGenerationConfigSchema>;

export type GenerateItemInput = Readonly<{
  definition: ItemDefinition;
  affixes: readonly AffixDefinition[];
  config: ItemGenerationConfig;
  instanceId: string;
  seed: string;
  source: string;
  itemLevel: number;
  rarity?: z.infer<typeof ItemRaritySchema>;
  random?: RandomSource;
}>;

/** Generate one immutable item instance. All random choices are seedable and auditable. */
export function generateItemInstance(input: GenerateItemInput): ItemInstance {
  const definition = ItemDefinitionSchema.parse(input.definition);
  const affixes = input.affixes.map((affix) => AffixDefinitionSchema.parse(affix));
  const config = ItemGenerationConfigSchema.parse(input.config);
  const itemLevel = positiveInteger(input.itemLevel, 'itemLevel');
  const random = input.random ?? createSeededRandom(seedFromString(input.seed));
  const rarity = input.rarity ?? rollRarity(config.rarityWeights, random);
  const basePower = random.nextInt(definition.itemPowerRange[0], definition.itemPowerRange[1]);
  const rolledBaseStats = definition.baseStats.map((stat) => ({
    id: `base:${stat.stat}`,
    stat: stat.stat,
    value: random.nextInt(stat.min, stat.max),
  }));
  const rolledAffixes = rollAffixes(affixes, config.affixCountByRarity[rarity], random);
  const itemPower = Math.max(
    itemLevel,
    basePower + rolledAffixes.reduce((sum, item) => sum + item.value, 0),
  );
  return ItemInstanceSchema.parse({
    instanceId: ItemInstanceIdSchema.parse(input.instanceId),
    definitionId: definition.id,
    itemLevel,
    rarity,
    itemPower,
    baseStats: rolledBaseStats,
    affixes: rolledAffixes,
    generationSeed: SeedSchema.parse(input.seed),
    generatorVersion: config.generatorVersion,
    source: input.source,
    quantity: 1,
  });
}

export function rollRarity(
  weights: readonly RarityWeight[],
  random: RandomSource,
): z.infer<typeof ItemRaritySchema> {
  const parsed = weights.map((weight) => RarityWeightSchema.parse(weight));
  const total = parsed.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random.nextInt(1, total);
  for (const entry of parsed) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.rarity;
  }
  return parsed[parsed.length - 1]!.rarity;
}

function rollAffixes(
  definitions: readonly AffixDefinition[],
  count: number,
  random: RandomSource,
): GeneratedAffix[] {
  const result: GeneratedAffix[] = [];
  const families = new Set<string>();
  let available = definitions.slice();
  while (result.length < count && available.length > 0) {
    const index = random.nextInt(0, available.length - 1);
    const definition = available[index]!;
    available = available.filter(
      (candidate) => candidate.family !== definition.family && candidate.id !== definition.id,
    );
    if (families.has(definition.family)) continue;
    families.add(definition.family);
    result.push({
      id: definition.id,
      stat: definition.stat,
      value: random.nextInt(definition.min, definition.max),
    });
  }
  return result;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer.`);
  return value;
}
