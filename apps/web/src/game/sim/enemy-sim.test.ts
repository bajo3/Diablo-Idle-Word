import { describe, expect, it } from 'vitest';

import { createEnemy, scheduleNextAbility, wantsToUseAbility } from './enemy-sim';

describe('enemy runtime records', () => {
  it('resolves every catalog behaviour into a concrete profile without id branching', () => {
    expect(createEnemy('minion', 'corrupted_minion', { x: 0, y: 0 }).abilityProfile.kind).toBe(
      'melee_strike',
    );
    expect(createEnemy('archer', 'possessed_archer', { x: 0, y: 0 }).abilityProfile.kind).toBe(
      'ranged_shot',
    );
    expect(createEnemy('shaman', 'dark_shaman', { x: 0, y: 0 }).abilityProfile.kind).toBe(
      'heal_allies',
    );
    expect(createEnemy('brute', 'root_brute', { x: 0, y: 0 }).abilityProfile.kind).toBe(
      'area_attack',
    );
    expect(createEnemy('beast', 'unstable_beast', { x: 0, y: 0 }).abilityProfile.kind).toBe(
      'telegraphed_explosion',
    );
  });

  it('keeps profile cooldowns on the combat clock', () => {
    const enemy = createEnemy('archer', 'possessed_archer', { x: 0, y: 0 });
    enemy.sim = { ...enemy.sim, aiState: 'use_ability' };
    expect(wantsToUseAbility(enemy, 0)).toBe(true);
    scheduleNextAbility(enemy, 0);
    expect(wantsToUseAbility(enemy, 1)).toBe(false);
    expect(wantsToUseAbility(enemy, 1800)).toBe(true);
  });
});
