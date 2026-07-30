import type { EnemyMovementStyle } from '@brecha/shared';

import type { EnemyBehavior } from './schemas.js';

/**
 * Derives an enemy's simulation movement style (Paso 8.4) from its declared `behaviors` tags -
 * never from its id, per GOAL.md's ban on `if (id === ...)` special-casing. Any enemy tagged
 * `ranged` or `keep_distance` kites (see `EnemyMovementStyle` in `@brecha/shared`); everything
 * else presses in like a melee attacker.
 */
export function resolveEnemyMovementStyle(behaviors: readonly EnemyBehavior[]): EnemyMovementStyle {
  return behaviors.includes('ranged') || behaviors.includes('keep_distance')
    ? 'keepDistance'
    : 'close';
}
