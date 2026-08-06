import { describe, expect, it } from 'vitest';

import { enemyDifficultyMultipliers } from './multiplayer-scaling.js';

const config = {
  multiplayer: {
    healthPerAdditionalPlayer: 0.65,
    damagePerAdditionalPlayer: 0.15,
  },
  difficulty: {
    normal: { enemyHealthMultiplier: 1, enemyDamageMultiplier: 1 },
    veteran: { enemyHealthMultiplier: 1.25, enemyDamageMultiplier: 1.15 },
  },
} as const;

describe('enemyDifficultyMultipliers', () => {
  it('uses the configured baseline for a solo normal run', () => {
    expect(enemyDifficultyMultipliers({ players: 1, difficulty: 'normal', config })).toEqual({
      health: 1,
      damage: 1,
    });
  });

  it('scales health and damage by party size and veteran difficulty', () => {
    expect(enemyDifficultyMultipliers({ players: 4, difficulty: 'veteran', config })).toEqual({
      health: 3.2,
      damage: expect.closeTo(1.6),
    });
  });

  it('rejects an impossible server-side player count', () => {
    expect(() => enemyDifficultyMultipliers({ players: 5, difficulty: 'normal', config })).toThrow(
      /between 1 and 4/,
    );
  });
});
