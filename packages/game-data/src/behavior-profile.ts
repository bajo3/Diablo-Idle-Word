import type { EnemyAbilityProfile, EnemyMovementStyle } from '@brecha/shared';

import type { EnemyBehavior } from './schemas.js';

/**
 * Derives an enemy's simulation movement style (Paso 8.4) from its declared `behaviors` tags -
 * never from its id, per GOAL.md's ban on `if (id === ...)` special-casing. Any enemy tagged
 * only an explicit `keep_distance` tag kites (see `EnemyMovementStyle` in `@brecha/shared`);
 * `ranged` selects an attack profile but does not make the enemy retreat by itself. Everything
 * else presses in like a melee attacker.
 */
export function resolveEnemyMovementStyle(behaviors: readonly EnemyBehavior[]): EnemyMovementStyle {
  return behaviors.includes('keep_distance') ? 'keepDistance' : 'close';
}

/**
 * Derives an enemy's combat ability profile (Paso 8, specific-behaviours layer) from its declared
 * `behaviors` tags - the same data→behaviour pattern as `resolveEnemyMovementStyle`, and likewise
 * never from an id. When an enemy declares more than one special tag, priority is explicit and
 * data-driven so the result is unambiguous: a support that can also bite (`dark_shaman`) heals
 * rather than melees; a melee bruiser with an area tag (`root_brute`) uses the area attack.
 *
 * Numerical tuning lives in `GAME_DATA.enemyTuning` (radii, damage multipliers, telegraph windows)
 * and `GAME_DATA.balance` (per-behaviour constants), passed in by the caller - this function only
 * *selects* the shape, it carries no magic numbers of its own.
 */
export function resolveEnemyAbilityProfile(
  behaviors: readonly EnemyBehavior[],
  tuning: EnemyAbilityTuningSource,
): EnemyAbilityProfile {
  if (behaviors.includes('heal_allies') || behaviors.includes('buff_allies'))
    return { kind: 'heal_allies', tuning: tuning.healAllies };
  if (behaviors.includes('area_attack')) return { kind: 'area_attack', tuning: tuning.areaAttack };
  if (behaviors.includes('telegraphed_explosion'))
    return { kind: 'telegraphed_explosion', tuning: tuning.explosion };
  if (behaviors.includes('ranged'))
    return {
      kind: 'ranged_shot',
      projectileSpeedPxPerSec: tuning.ranged.projectileSpeedPxPerSec,
      projectileMaxRangePx: tuning.ranged.projectileMaxRangePx,
      hitRadiusPx: tuning.ranged.hitRadiusPx,
    };
  return { kind: 'melee_strike' };
}

/** Numerical inputs `resolveEnemyAbilityProfile` needs, sourced from the catalog by the caller.
 *  Kept as one object so the resolver stays free of magic numbers and easy to test in isolation. */
export type EnemyAbilityTuningSource = Readonly<{
  healAllies: Readonly<{ healMissingFraction: number; ignoreAboveFraction: number }>;
  areaAttack: Readonly<{ radiusPx: number; stunMs: number }>;
  explosion: Readonly<{ radiusPx: number; telegraphMs: number; damageMultiplier: number }>;
  ranged: Readonly<{
    projectileSpeedPxPerSec: number;
    projectileMaxRangePx: number;
    hitRadiusPx: number;
  }>;
}>;
