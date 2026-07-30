import { describe, expect, it } from 'vitest';

import { ENEMY_VISUALS } from './enemy-visuals';

describe('enemy visuals', () => {
  it('gives all five catalog enemies a distinct tint', () => {
    const ids = Object.keys(ENEMY_VISUALS);
    expect(ids).toEqual([
      'corrupted_minion',
      'possessed_archer',
      'dark_shaman',
      'root_brute',
      'unstable_beast',
    ]);
    const tints = Object.values(ENEMY_VISUALS).map(({ tint }) => tint);
    expect(new Set(tints).size).toBe(tints.length);
    for (const tint of tints) {
      expect(tint).toBeGreaterThanOrEqual(0);
      expect(tint).toBeLessThanOrEqual(0xffffff);
    }
  });
});
