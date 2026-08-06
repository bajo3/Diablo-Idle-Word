import { resolveCharacterState, type LocalCharacterState } from '../domain';
import type { EnemyAbilityProfile, EnemyAiState } from '@brecha/shared';

/** Presentation-only state held by the Phaser adapter until a hit reaction expires or cleanup. */
export type EnemyVisualLatch = Readonly<{
  state: 'stunned' | 'knocked_back' | 'dead';
  untilMs: number | undefined;
}>;

export type EnemyAbilityVisualMode = 'cast' | 'channel';

/** Maps the pure AI intent to the shared 11-state visual contract. */
export function enemyAiVisualState(
  aiState: EnemyAiState,
  abilityMode: EnemyAbilityVisualMode = 'cast',
): LocalCharacterState {
  if (aiState === 'patrol' || aiState === 'chase' || aiState === 'retreat') return 'moving';
  if (aiState === 'detect') return 'interacting';
  if (aiState === 'attack') return 'attacking';
  if (aiState === 'use_ability') return abilityMode === 'channel' ? 'channeling' : 'casting';
  if (aiState === 'stunned') return 'stunned';
  if (aiState === 'dead') return 'dead';
  return 'idle';
}

/** Telegraphs/channeling are the long warning states; instant profile acts use casting. */
export function enemyAbilityVisualMode(
  profile: Readonly<{ kind: EnemyAbilityProfile['kind'] }>,
): EnemyAbilityVisualMode {
  return profile.kind === 'area_attack' || profile.kind === 'telegraphed_explosion'
    ? 'channel'
    : 'cast';
}

/** Requests a temporary reaction or terminal death state without mutating combat state. */
export function latchEnemyVisualState(
  current: EnemyVisualLatch | undefined,
  requested: EnemyVisualLatch,
): EnemyVisualLatch {
  if (current?.state === 'dead') return current;
  if (requested.state === 'dead') return requested;
  if (current?.untilMs !== undefined) {
    const untilMs = Math.max(current.untilMs, requested.untilMs ?? current.untilMs);
    return { state: requested.state, untilMs };
  }
  return requested;
}

/** Returns the latched visual while active, otherwise the current AI-derived visual state. */
export function activeEnemyVisualState(
  base: LocalCharacterState,
  latch: EnemyVisualLatch | undefined,
  now: number,
): LocalCharacterState {
  if (latch === undefined) return base;
  if (latch.state === 'dead') return resolveCharacterState(base, 'dead');
  if (latch.untilMs !== undefined && now < latch.untilMs)
    return resolveCharacterState(base, latch.state);
  return base;
}
