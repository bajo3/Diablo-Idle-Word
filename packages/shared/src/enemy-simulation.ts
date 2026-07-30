import type { CombatVector } from './combat.js';
import {
  decideEnemyState,
  type EnemyAiRestState,
  type EnemyAiState,
  type EnemyAiTuning,
} from './enemy-ai.js';
import { arrive, combineSteering, seek, separation, type SeparationNeighbor } from './steering.js';

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

export type EnemySimInput = Readonly<{
  targetPosition: CombatVector;
  hasLineOfSight: boolean;
  neighbors: readonly SeparationNeighbor[];
  isDead: boolean;
  isStunned: boolean;
  abilityReady: boolean;
  restState: EnemyAiRestState;
  fromMs: number;
  toMs: number;
}>;

function distance(a: CombatVector, b: CombatVector): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Only `chase` and `retreat` move for the Paso 8 MVP; `attack`/`use_ability` hold ground to swing,
 * and `idle`/`patrol`/`detect`/`stunned`/`dead` are stationary here (patrol waypoints and knockback
 * are later concerns, not this function's). */
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
