import { describe, expect, it } from 'vitest';

import { calculateAwayReward, rollAwayLootRarities } from './away-calculation.js';

const metrics = {
  validDurationSeconds: 300,
  normalEnemiesDefeated: 60,
  eliteEnemiesDefeated: 0,
  rewards: { experience: 600, gold: 300, materials: 60 },
  damageDealt: 10_000,
  damageTaken: 500,
  deathsOrDowns: 0,
  effectiveCombatSeconds: 280,
  droppedItemsByRarity: { common: 2, magic: 1, rare: 0, legendary: 1 },
  magicFind: 0,
};

describe('away calculation', () => {
  it('aggregates calibration rates and applies efficiency without frame simulation', () => {
    const result = calculateAwayReward({
      metrics,
      elapsedSeconds: 3_600,
      maxDurationSeconds: 28_800,
      efficiency: 0.8,
      calculationSeed: 'seed:one',
    });
    expect(result.computedSeconds).toBe(3_600);
    expect(result.rewards).toEqual({ experience: 5_760, gold: 2_880, materials: 576 });
    expect(result.estimatedEnemiesDefeated).toBe(576);
    expect(result.generatedItemsByRarity.legendary).toBe(0);
  });

  it('clamps to the cap, records discarded time and bounds death penalty', () => {
    const result = calculateAwayReward({
      metrics: { ...metrics, deathsOrDowns: 9 },
      elapsedSeconds: 40_000,
      maxDurationSeconds: 28_800,
      efficiency: 0.8,
      calculationSeed: 'seed:two',
    });
    expect(result.computedSeconds).toBe(28_800);
    expect(result.discardedSeconds).toBe(11_200);
    expect(result.survivalFactor).toBe(0.5);
    expect(result.reductions).toContain('cap:28800s');
  });

  it('is deterministic and never creates legendary away loot', () => {
    expect(rollAwayLootRarities('same', 40)).toEqual(rollAwayLootRarities('same', 40));
    expect(rollAwayLootRarities('same', 40).legendary).toBe(0);
  });

  it('returns zero rewards for a zero-time return', () => {
    const result = calculateAwayReward({
      metrics,
      elapsedSeconds: 0,
      maxDurationSeconds: 28_800,
      efficiency: 0.8,
      calculationSeed: 'seed:zero',
    });
    expect(result.rewards).toEqual({ experience: 0, gold: 0, materials: 0 });
    expect(result.discardedSeconds).toBe(0);
  });
});
