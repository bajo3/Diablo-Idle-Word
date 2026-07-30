/**
 * Pure enemy AI state machine (Paso 8.2). No Phaser, no Math.random, no clock reads - the caller
 * supplies perception (already-computed distances/line-of-sight) and gets back the next state.
 * Steering (how to actually move toward/away) is Paso 8.3; this only decides *what* the enemy is
 * doing, the same separation combat.ts keeps between deciding damage and presenting it.
 */
export type EnemyAiState =
  | 'idle'
  | 'patrol'
  | 'detect'
  | 'chase'
  | 'attack'
  | 'use_ability'
  | 'retreat'
  | 'stunned'
  | 'dead';

/** The state a fully disengaged enemy rests in - data-driven per enemy (GOAL.md forbids
 * `if (id === ...)` here), not decided by this function. */
export type EnemyAiRestState = 'idle' | 'patrol';

export type EnemyAiTuning = Readonly<{
  detectRadiusPx: number;
  /** Must be > detectRadiusPx (enforced by game-data validation) so losing a target requires
   * clearing a wider ring than acquiring one did - prevents flicker at the detection boundary. */
  loseTargetRadiusPx: number;
  leashRadiusPx: number;
  attackRangePx: number;
}>;

export type EnemyAiPerception = Readonly<{
  distanceToTargetPx: number;
  hasLineOfSight: boolean;
  distanceFromSpawnPx: number;
}>;

export type EnemyAiInput = Readonly<{
  current: EnemyAiState;
  isDead: boolean;
  isStunned: boolean;
  abilityReady: boolean;
  restState: EnemyAiRestState;
  perception: EnemyAiPerception;
  tuning: EnemyAiTuning;
}>;

const ENGAGED_STATES: ReadonlySet<EnemyAiState> = new Set([
  'detect',
  'chase',
  'attack',
  'use_ability',
]);

/**
 * One tick of the enemy AI FSM. Priority: `dead` is terminal and absorbing; `stunned` overrides
 * everything else while active and, on recovery, re-evaluates from perception exactly as if the
 * enemy had been idle (no memory of what it was doing before the stun); leashing home overrides
 * chase/attack regardless of target proximity; only then does target acquisition/loss/range decide
 * the rest. Detection requires both radius and line of sight; sustaining a chase only needs
 * distance (with hysteresis) - an enemy doesn't forget you the instant you duck behind a pillar.
 */
export function decideEnemyState(input: EnemyAiInput): EnemyAiState {
  if (input.isDead || input.current === 'dead') return 'dead';
  if (input.isStunned) return 'stunned';
  const { perception, tuning } = input;

  if (input.current === 'retreat')
    return perception.distanceFromSpawnPx > tuning.detectRadiusPx ? 'retreat' : input.restState;
  if (perception.distanceFromSpawnPx > tuning.leashRadiusPx) return 'retreat';

  const withinAttackRange = perception.distanceToTargetPx <= tuning.attackRangePx;

  if (ENGAGED_STATES.has(input.current)) {
    if (perception.distanceToTargetPx > tuning.loseTargetRadiusPx) return input.restState;
    if (withinAttackRange) return input.abilityReady ? 'use_ability' : 'attack';
    return 'chase';
  }

  const withinDetectRadius =
    perception.distanceToTargetPx <= tuning.detectRadiusPx && perception.hasLineOfSight;
  return withinDetectRadius ? 'detect' : input.restState;
}
