import { describe, expect, it } from 'vitest';

import { resolveEnemyAbilityProfile, resolveEnemyMovementStyle } from './behavior-profile.js';
import { GAME_DATA } from './catalog.js';

const abilityTuning = GAME_DATA.enemyAbilityTuning;

describe('resolveEnemyMovementStyle', () => {
  it('kites only for an explicit keep_distance tag, and closes in otherwise', () => {
    expect(resolveEnemyMovementStyle(['melee'])).toBe('close');
    expect(resolveEnemyMovementStyle(['ranged'])).toBe('close');
    expect(resolveEnemyMovementStyle(['melee', 'keep_distance'])).toBe('keepDistance');
    expect(resolveEnemyMovementStyle(['fast_pursuit', 'telegraphed_explosion'])).toBe('close');
  });

  it('resolves every real catalog enemy to the expected style', () => {
    const expected: Record<string, 'close' | 'keepDistance'> = {
      corrupted_minion: 'close',
      possessed_archer: 'close',
      dark_shaman: 'close',
      root_brute: 'close',
      unstable_beast: 'close',
      skeleton_recruit: 'close',
      skeleton_warrior: 'close',
      bone_soldier: 'close',
      bone_warlord: 'close',
      skeleton_king: 'close',
    };
    for (const enemy of GAME_DATA.enemies)
      expect(resolveEnemyMovementStyle(enemy.behaviors)).toBe(expected[enemy.id]);
  });
});

describe('resolveEnemyAbilityProfile', () => {
  it('resolves every real catalog enemy to the expected ability kind from their tags', () => {
    const expected: Record<string, string> = {
      corrupted_minion: 'melee_strike',
      possessed_archer: 'ranged_shot',
      dark_shaman: 'heal_allies',
      root_brute: 'area_attack',
      unstable_beast: 'telegraphed_explosion',
      skeleton_recruit: 'melee_strike',
      skeleton_warrior: 'melee_strike',
      bone_soldier: 'melee_strike',
      // Bone Warlord's `buff_allies` tag shares the heal_allies profile shape (see
      // resolveEnemyAbilityProfile's docstring) rather than needing its own ability kind.
      bone_warlord: 'heal_allies',
      skeleton_king: 'area_attack',
    };
    for (const enemy of GAME_DATA.enemies)
      expect(resolveEnemyAbilityProfile(enemy.behaviors, abilityTuning).kind).toBe(
        expected[enemy.id],
      );
  });

  it('priority: heal_allies wins over ranged when both are present (the shaman heals, not bites)', () => {
    expect(
      resolveEnemyAbilityProfile(['ranged', 'heal_allies', 'buff_allies'], abilityTuning).kind,
    ).toBe('heal_allies');
  });

  it('priority: area_attack wins over melee when both are present (the brute uses its area)', () => {
    expect(resolveEnemyAbilityProfile(['melee', 'area_attack', 'stun'], abilityTuning).kind).toBe(
      'area_attack',
    );
  });

  it('falls back to ranged_shot for a plain ranged enemy and melee_strike for a plain melee one', () => {
    expect(resolveEnemyAbilityProfile(['ranged', 'keep_distance'], abilityTuning).kind).toBe(
      'ranged_shot',
    );
    expect(resolveEnemyAbilityProfile(['melee'], abilityTuning).kind).toBe('melee_strike');
  });

  it('carries the catalog numerical tuning into the resolved profile (no magic numbers here)', () => {
    const shaman = resolveEnemyAbilityProfile(
      ['ranged', 'heal_allies', 'buff_allies'],
      abilityTuning,
    );
    expect(shaman.kind).toBe('heal_allies');
    if (shaman.kind === 'heal_allies')
      expect(shaman.tuning.healMissingFraction).toBe(abilityTuning.healAllies.healMissingFraction);

    const beast = resolveEnemyAbilityProfile(
      ['fast_pursuit', 'telegraphed_explosion'],
      abilityTuning,
    );
    expect(beast.kind).toBe('telegraphed_explosion');
    if (beast.kind === 'telegraphed_explosion')
      expect(beast.tuning.telegraphMs).toBe(abilityTuning.explosion.telegraphMs);
  });
});
