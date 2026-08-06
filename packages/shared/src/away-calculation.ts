import { z } from 'zod';

import { createSeededRandom, seedFromString } from './random.js';
import {
  AwayMetricsSchema,
  RarityCountsSchema,
  ResourceTotalsSchema,
  type AwayMetrics,
  type RarityCounts,
} from './away.js';

export const AwayCalculationInputSchema = z.strictObject({
  metrics: AwayMetricsSchema,
  elapsedSeconds: z.number().int().nonnegative(),
  maxDurationSeconds: z.number().int().positive(),
  efficiency: z.number().min(0).max(1),
  calculationSeed: z.string().trim().min(1).max(256),
});

export type AwayCalculationInput = z.infer<typeof AwayCalculationInputSchema>;

export type AwayCalculation = Readonly<{
  elapsedSeconds: number;
  computedSeconds: number;
  discardedSeconds: number;
  efficiency: number;
  survivalFactor: number;
  estimatedEnemiesDefeated: number;
  rewards: z.infer<typeof ResourceTotalsSchema>;
  generatedItemsByRarity: RarityCounts;
  lootCount: number;
  reductions: readonly string[];
}>;

/**
 * Calculates a whole away window without simulating combat frames. Rates are measured during the
 * calibration and then multiplied by capped server time, efficiency and a bounded death penalty.
 */
export function calculateAwayReward(input: AwayCalculationInput): AwayCalculation {
  const value = AwayCalculationInputSchema.parse(input) as AwayCalculationInput & {
    metrics: AwayMetrics;
  };
  const calibrationSeconds = Math.max(1, value.metrics.validDurationSeconds);
  const computedSeconds = Math.min(value.elapsedSeconds, value.maxDurationSeconds);
  const discardedSeconds = value.elapsedSeconds - computedSeconds;
  const survivalFactor = Math.max(0.5, 1 - Math.min(5, value.metrics.deathsOrDowns) * 0.1);
  const multiplier = (computedSeconds * value.efficiency * survivalFactor) / calibrationSeconds;
  const rewards = {
    experience: Math.floor(value.metrics.rewards.experience * multiplier),
    gold: Math.floor(value.metrics.rewards.gold * multiplier),
    materials: Math.floor(value.metrics.rewards.materials * multiplier),
  };
  const estimatedEnemiesDefeated = Math.floor(
    (value.metrics.normalEnemiesDefeated + value.metrics.eliteEnemiesDefeated) * multiplier,
  );
  const rawLootCount = Math.floor(
    (value.metrics.normalEnemiesDefeated + value.metrics.eliteEnemiesDefeated) * 0.35 * multiplier,
  );
  const lootCount = Math.min(40, Math.max(0, rawLootCount));
  const generatedItemsByRarity = rollAwayLootRarities(value.calculationSeed, lootCount);
  const reductions: string[] = [];
  if (value.efficiency < 1) reductions.push(`efficiency:${value.efficiency}`);
  if (survivalFactor < 1) reductions.push(`survival:${survivalFactor}`);
  if (discardedSeconds > 0) reductions.push(`cap:${value.maxDurationSeconds}s`);
  return {
    elapsedSeconds: value.elapsedSeconds,
    computedSeconds,
    discardedSeconds,
    efficiency: value.efficiency,
    survivalFactor,
    estimatedEnemiesDefeated,
    rewards: ResourceTotalsSchema.parse(rewards),
    generatedItemsByRarity: RarityCountsSchema.parse(generatedItemsByRarity),
    lootCount,
    reductions,
  };
}

/** Away mode never rolls boss-exclusive legendary items. */
export function rollAwayLootRarities(seed: string, count: number): RarityCounts {
  return aggregateAwayLootRarities(awayLootRaritySequence(seed, count));
}

export function awayLootRaritySequence(
  seed: string,
  count: number,
): Array<'common' | 'magic' | 'rare'> {
  const total = Math.max(0, Math.min(40, Math.floor(count)));
  const random = createSeededRandom(seedFromString(`${seed}:away-loot`));
  const result: Array<'common' | 'magic' | 'rare'> = [];
  for (let index = 0; index < total; index += 1) {
    const roll = random.next();
    if (roll < 0.8) result.push('common');
    else if (roll < 0.95) result.push('magic');
    else result.push('rare');
  }
  return result;
}

function aggregateAwayLootRarities(
  sequence: readonly ('common' | 'magic' | 'rare')[],
): RarityCounts {
  const result: RarityCounts = { common: 0, magic: 0, rare: 0, legendary: 0 };
  for (const rarity of sequence) result[rarity] += 1;
  return result;
}

export function awayRatePerHour(value: number, validDurationSeconds: number): number {
  if (!Number.isFinite(value) || value <= 0 || validDurationSeconds <= 0) return 0;
  return Math.floor((value * 3600) / validDurationSeconds);
}
