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

  it('gives every archetype a distinct generated silhouette or a safe tint fallback', () => {
    expect(ENEMY_VISUALS.root_brute.character?.id).toBe('root_brute');
    expect(ENEMY_VISUALS.possessed_archer.character?.id).toBe('ranger');
    expect(ENEMY_VISUALS.corrupted_minion.character?.id).toBe('assassin');
    expect(ENEMY_VISUALS.dark_shaman.character?.id).toBe('necromancer');
    expect(ENEMY_VISUALS.unstable_beast.character?.id).toBe('druid');
    const characterIds = Object.values(ENEMY_VISUALS).map((visual) => visual.character?.id);
    expect(new Set(characterIds).size).toBe(characterIds.length);
  });
});
