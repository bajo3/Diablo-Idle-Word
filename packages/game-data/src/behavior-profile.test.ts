import { describe, expect, it } from 'vitest';

import { resolveEnemyMovementStyle } from './behavior-profile.js';
import { GAME_DATA } from './catalog.js';

describe('resolveEnemyMovementStyle', () => {
  it('kites for ranged or keep_distance tags, and closes in otherwise', () => {
    expect(resolveEnemyMovementStyle(['melee'])).toBe('close');
    expect(resolveEnemyMovementStyle(['ranged'])).toBe('keepDistance');
    expect(resolveEnemyMovementStyle(['melee', 'keep_distance'])).toBe('keepDistance');
    expect(resolveEnemyMovementStyle(['fast_pursuit', 'telegraphed_explosion'])).toBe('close');
  });

  it('resolves the five real catalog enemies to the expected style', () => {
    const expected: Record<string, 'close' | 'keepDistance'> = {
      corrupted_minion: 'close',
      possessed_archer: 'keepDistance',
      dark_shaman: 'keepDistance',
      root_brute: 'close',
      unstable_beast: 'close',
    };
    for (const enemy of GAME_DATA.enemies)
      expect(resolveEnemyMovementStyle(enemy.behaviors)).toBe(expected[enemy.id]);
  });
});
