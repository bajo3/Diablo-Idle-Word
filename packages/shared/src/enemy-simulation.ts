import type { CombatVector } from './combat.js';
import {
  decideEnemyState,
  type EnemyAiRestState,
  type EnemyAiState,
  type EnemyAiTuning,
} from './enemy-ai.js';
import {
  arrive,
  combineSteering,
  flee,
  seek,
  separation,
  type SeparationNeighbor,
} from './steering.js';

/**
 * The fixed-step "SimulationWorld" piece deferred from Paso 8.0d: now that both the AI FSM (8.2)
 * and steering (8.3) exist, this composes them into one deterministic per-tick enemy update -
 * perception -> `decideEnemyState` -> a steering velocity for that state -> position integrated
 * over an explicit [fromMs, toMs) window (mirrors `advanceGuardianCombat`'s pattern: no hidden
 * delta accumulator, so replaying the same fixed tick sequence always reproduces the same result).
 * Still no Phaser here - the scene-side adapter (spawning sprites, driving `toMs` from the game
 * clock) is Paso 8.4's concern, once real enemy sprites exist to drive.
 */
export type EnemySimTuning = Readonly<{
  ai: EnemyAiTuning;
  moveSpeedPxPerSec: number;
  separationRadiusPx: number;
}>;

export type EnemySimState = Readonly<{
  aiState: EnemyAiState;
  position: CombatVector;
  spawnPosition: CombatVector;
}>;

/**
 * Data-driven movement differentiation (Paso 8.4): derived by the caller from the enemy's
 * declared `behaviors` tags (e.g. `behaviors.includes('keep_distance')`), never from its id -
 * GOAL.md forbids `if (id === ...)` special-casing. `close` (the melee default) holds ground
 * once engaged, for as long as it's in range. `keepDistance` only applies to enemies explicitly
 * tagged `keep_distance`; it holds ground normally but backs away once the target closes to under
 * half its `attackRangePx`.
 *
 * There's no equivalent difference during `chase`: `decideEnemyState` only stays in `chase` while
 * `distanceToTargetPx > attackRangePx`, so a chaser can never actually be inside its own attack
 * range - `attack`/`use_ability` is the only state where "too close" is a reachable condition.
 */
export type EnemyMovementStyle = 'close' | 'keepDistance';

export type EnemySimInput = Readonly<{
  targetPosition: CombatVector;
  hasLineOfSight: boolean;
  neighbors: readonly SeparationNeighbor[];
  isDead: boolean;
  isStunned: boolean;
  abilityReady: boolean;
  restState: EnemyAiRestState;
  movementStyle: EnemyMovementStyle;
  fromMs: number;
  toMs: number;
}>;

function distance(a: CombatVector, b: CombatVector): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

const ENGAGED_MELEE_STATES: ReadonlySet<EnemyAiState> = new Set(['attack', 'use_ability']);

/** Only `chase` and `retreat` move for the Paso 8 MVP; `idle`/`patrol`/`detect`/`stunned`/`dead`
 * are stationary here (patrol waypoints and knockback are later concerns, not this function's).
 * `attack`/`use_ability` normally hold ground too, except a `keepDistance` mover backing off once
 * the target is too close (see `EnemyMovementStyle`). */
function velocityFor(
  aiState: EnemyAiState,
  state: EnemySimState,
  input: EnemySimInput,
  tuning: EnemySimTuning,
): CombatVector {
  const avoidNeighbors = separation(
    state.position,
    input.neighbors,
    tuning.separationRadiusPx,
    tuning.moveSpeedPxPerSec,
  );
  if (aiState === 'chase')
    return combineSteering(
      [seek(state.position, input.targetPosition, tuning.moveSpeedPxPerSec), avoidNeighbors],
      tuning.moveSpeedPxPerSec,
    );
  if (aiState === 'retreat')
    return combineSteering(
      [
        arrive(
          state.position,
          state.spawnPosition,
          tuning.moveSpeedPxPerSec,
          tuning.ai.detectRadiusPx,
        ),
        avoidNeighbors,
      ],
      tuning.moveSpeedPxPerSec,
    );
  if (
    ENGAGED_MELEE_STATES.has(aiState) &&
    input.movementStyle === 'keepDistance' &&
    distance(state.position, input.targetPosition) < tuning.ai.attackRangePx / 2
  )
    return combineSteering(
      [flee(state.position, input.targetPosition, tuning.moveSpeedPxPerSec), avoidNeighbors],
      tuning.moveSpeedPxPerSec,
    );
  return { x: 0, y: 0 };
}

export function stepEnemy(
  state: EnemySimState,
  input: EnemySimInput,
  tuning: EnemySimTuning,
): EnemySimState {
  const nextAiState = decideEnemyState({
    current: state.aiState,
    isDead: input.isDead,
    isStunned: input.isStunned,
    abilityReady: input.abilityReady,
    restState: input.restState,
    perception: {
      distanceToTargetPx: distance(state.position, input.targetPosition),
      hasLineOfSight: input.hasLineOfSight,
      distanceFromSpawnPx: distance(state.position, state.spawnPosition),
    },
    tuning: tuning.ai,
  });
  const velocity = velocityFor(nextAiState, state, input, tuning);
  const elapsedSeconds = Math.max(0, input.toMs - input.fromMs) / 1000;
  return {
    ...state,
    aiState: nextAiState,
    position: {
      x: state.position.x + velocity.x * elapsedSeconds,
      y: state.position.y + velocity.y * elapsedSeconds,
    },
  };
}
