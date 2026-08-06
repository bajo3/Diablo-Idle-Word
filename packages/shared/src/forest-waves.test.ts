import { describe, expect, it } from 'vitest';

import { createForestWave } from './forest-waves.js';
import type { ForestProgressionCurve } from './endless-forest.js';

function curve(maximumLevel = 5): ForestProgressionCurve {
  return {
    minimumLevel: 1,
    maximumLevel,
    levels: Array.from({ length: maximumLevel }, (_, index) => ({
      level: index + 1,
      enemyHealthMultiplier: 1 + index * 0.25,
      enemyDamageMultiplier: 1 + index * 0.1,
      waveSize: 3 + index,
      xpToAdvance: 100,
    })),
  };
}

describe('forest wave generation', () => {
  it('scales wave size from the selected level and emits unique stable spawn keys', () => {
    const wave = createForestWave(curve(), 4, 2, 4201, ['minion', 'archer', 'shaman']);
    expect(wave.tuning.level).toBe(4);
    expect(wave.spawns).toHaveLength(6);
    expect(new Set(wave.spawns.map(({ spawnKey }) => spawnKey)).size).toBe(6);
    expect(wave.spawns.map(({ slot }) => slot)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(wave.spawns.slice(0, 3).map(({ archetype }) => archetype)).size).toBe(3);
  });

  it('replays the same seed and inputs exactly, including composition order', () => {
    const first = createForestWave(curve(), 3, 7, 991, ['minion', 'archer', 'shaman', 'beast']);
    const replay = createForestWave(curve(), 3, 7, 991, ['minion', 'archer', 'shaman', 'beast']);
    expect(replay).toEqual(first);
  });

  it('rejects invalid levels, indices, seeds and compositions', () => {
    expect(() => createForestWave(curve(), 0, 0, 1, ['minion'])).toThrow();
    expect(() => createForestWave(curve(), 1, -1, 1, ['minion'])).toThrow();
    expect(() =>
      createForestWave(curve(), 1, 0, Number.MAX_SAFE_INTEGER + 1, ['minion']),
    ).toThrow();
    expect(() => createForestWave(curve(), 1, 0, 1, [])).toThrow();
    expect(() => createForestWave(curve(), 1, 0, 1, [''])).toThrow();
  });
});
