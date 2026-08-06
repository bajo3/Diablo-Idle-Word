import { z } from 'zod';

import { AttributeKeySchema, AttributesSchema, DomainSchemaVersion } from './domain.js';

export const CharacterProgressionFormulaVersion = 'character-progression.1' as const;

export const CharacterProgressionConfigSchema = z.strictObject({
  formulaVersion: z.string().trim().min(1).max(64),
  minimumLevel: z.literal(1),
  maximumLevel: z.literal(10),
  xpToReachLevel: z.array(z.number().int().nonnegative()).length(10),
  attributePointsPerLevel: z.number().int().positive().max(10),
  resetCostPerLevel: z.number().int().positive().max(100_000),
});
export type CharacterProgressionConfig = z.infer<typeof CharacterProgressionConfigSchema>;

export const CharacterDerivedStatsSchema = z.strictObject({
  maxHealth: z.number().int().positive(),
  physicalDamageMin: z.number().int().nonnegative(),
  physicalDamageMax: z.number().int().nonnegative(),
  armor: z.number().int().nonnegative(),
  criticalChancePercent: z.number().nonnegative(),
  attackSpeedPercent: z.number().nonnegative(),
});
export type CharacterDerivedStats = z.infer<typeof CharacterDerivedStatsSchema>;

export const CharacterProgressionStateSchema = z.strictObject({
  schemaVersion: z.literal(DomainSchemaVersion),
  attributes: AttributesSchema,
  derivedStats: CharacterDerivedStatsSchema,
  equippedAbilityIds: z.array(z.string().trim().min(1).max(128)).max(4),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CharacterProgressionState = z.infer<typeof CharacterProgressionStateSchema>;

export type ExperienceResult = Readonly<{
  experience: bigint;
  level: number;
  levelsGained: number;
  attributePoints: number;
}>;

export function levelForExperience(experience: bigint, config: CharacterProgressionConfig): number {
  if (experience < 0n) throw new RangeError('experience cannot be negative');
  let level = config.minimumLevel;
  for (let index = config.xpToReachLevel.length - 1; index >= 0; index -= 1) {
    const threshold = BigInt(config.xpToReachLevel[index] ?? 0);
    if (experience >= threshold) {
      level = index + config.minimumLevel;
      break;
    }
  }
  return Math.min(level, config.maximumLevel);
}

export function xpIntoLevel(
  experience: bigint,
  level: number,
  config: CharacterProgressionConfig,
): { current: bigint; toNext: bigint } {
  const safeLevel = Math.max(config.minimumLevel, Math.min(config.maximumLevel, level));
  const start = BigInt(config.xpToReachLevel[safeLevel - 1] ?? 0);
  const next = config.xpToReachLevel[safeLevel] ?? start;
  return {
    current: experience - start < 0n ? 0n : experience - start,
    toNext: BigInt(next) - start,
  };
}

export function applyExperience(
  current: Readonly<{ experience: bigint; level: number; attributePoints: number }>,
  delta: bigint,
  config: CharacterProgressionConfig,
): ExperienceResult {
  if (delta < 0n) throw new RangeError('experience delta cannot be negative');
  const experience = current.experience + delta;
  // Persisted characters created before the curve was introduced may have a level ahead of
  // their raw XP. Never silently downgrade them when the first new reward is applied.
  const level = Math.max(current.level, levelForExperience(experience, config));
  const levelsGained = Math.max(0, level - current.level);
  return {
    experience,
    level,
    levelsGained,
    attributePoints: current.attributePoints + levelsGained * config.attributePointsPerLevel,
  };
}

export function totalAttributePoints(level: number, config: CharacterProgressionConfig): number {
  return (
    Math.max(0, Math.min(config.maximumLevel, level) - config.minimumLevel) *
    config.attributePointsPerLevel
  );
}

export function deriveCharacterStats(
  attributes: z.infer<typeof AttributesSchema>,
): CharacterDerivedStats {
  const physicalDamageMin = 8 + attributes.strength * 2;
  const physicalDamageMax = physicalDamageMin + 8 + Math.floor(attributes.dexterity / 2);
  return {
    maxHealth: 100 + attributes.vitality * 12,
    physicalDamageMin,
    physicalDamageMax,
    armor: attributes.vitality * 2 + attributes.strength,
    criticalChancePercent: Math.min(50, 5 + attributes.dexterity * 0.5),
    attackSpeedPercent: Math.min(100, attributes.dexterity * 0.35),
  };
}

export function assertAttributeKey(
  value: string,
): asserts value is z.infer<typeof AttributeKeySchema> {
  AttributeKeySchema.parse(value);
}
