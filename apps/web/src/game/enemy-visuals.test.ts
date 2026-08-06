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

  it('gives generated art to the Bruto and Arquero, with safe tint fallbacks for the rest', () => {
    expect(ENEMY_VISUALS.root_brute.character?.id).toBe('root_brute');
    expect(ENEMY_VISUALS.possessed_archer.character?.id).toBe('ranger');
    const withoutOwnArt: Array<[string, boolean]> = Object.entries(ENEMY_VISUALS)
      .filter(([id]) => id !== 'root_brute' && id !== 'possessed_archer')
      .map(([id, visual]) => [id, visual.character === undefined]);
    expect(withoutOwnArt).toEqual([
      ['corrupted_minion', true],
      ['dark_shaman', true],
      ['unstable_beast', true],
    ]);
  });
});
