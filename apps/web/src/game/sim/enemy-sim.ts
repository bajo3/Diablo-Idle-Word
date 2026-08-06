/**
 * Phaser-side adapter for the pure enemy simulation in `@brecha/shared` (Paso 8.4 / step-08
 * "trabajo pendiente #3": the `apps/web/src/game/sim/` layer that was always planned but never
 * created, so until now the enemies in `TestScene` were static dummies that never moved).
 *
 * This module is pure: it holds no Phaser sprites and reads no clock. `runtime.ts` supplies the
 * `fromMs`/`toMs` window from its pause-aware `combatNow()` (never `Date.now()`), and applies the
 * resulting position to the sprite itself. The FSM + steering come from `stepEnemy`, unchanged.
 *
 * Scope of this adapter: chase/retreat/kiting movement plus a data-driven ability profile. The
 * Phaser runtime owns presentation and applies the pure effects; this module only carries the
 * profile, attacker stats and combat-clock cooldown, so no enemy id needs special casing.
 */
import {
  GAME_DATA,
  resolveEnemyAbilityProfile,
  resolveEnemyMovementStyle,
} from '@brecha/game-data';
import {
  stepEnemy,
  type AttackerStats,
  type CombatVector,
  type EnemyAiState,
  type EnemyAbilityProfile,
  type EnemySimInput,
  type EnemySimState,
  type EnemySimTuning,
  type SeparationNeighbor,
} from '@brecha/shared';

import type { EnemyVisualId } from '../enemy-visuals';

/** Damage an enemy deals per successful hit, before its catalog `damageMultiplier`.
 *  Conservative flat base so the new "enemies can hurt you" behaviour can't one-shot the Guardian;
 *  the per-enemy `attack.damageMultiplier` in `GAME_DATA.enemyTuning` then differentiates them
 *  (minion 0.8x, archer 0.9x, brute 1.4x). Lives here, not in shared, because it is a local-scene
 *  placeholder until the server-authoritative combat of Paso 14 replaces this client scene. */
export const ENEMY_BASE_HIT_DAMAGE = 8;

/** Radius within which enemies push apart so they don't stack on the same pixel. */
const SEPARATION_RADIUS_PX = 40;

/** Per-enemy runtime record: the pure sim state (position + AI state) plus the cooldown that
 *  `stepEnemy` doesn't track (the FSM only decides *what* the enemy does; *when* it lands a hit
 *  is the adapter's concern, so one enemy can't machine-gun the player). */
export interface EnemyRecord {
  readonly id: string;
  readonly visual: EnemyVisualId;
  readonly tuning: EnemySimTuning;
  /** Flat damage this enemy deals on a successful attack hit. Precomputed once at spawn. */
  readonly hitDamage: number;
  /** Whether this enemy has an explicit keep-distance behavior or presses in. */
  readonly movementStyle: EnemySimInput['movementStyle'];
  /** Behaviour-derived ability profile resolved from catalog tags. */
  readonly abilityProfile: EnemyAbilityProfile;
  /** Symmetric attacker stats consumed by the shared enemy ability resolver. */
  readonly attacker: AttackerStats;
  /** Catalog multiplier applied to the profile's damage act. */
  readonly abilityMultiplier: number;
  sim: EnemySimState;
  /** Combat-clock ms before which the enemy cannot land another attack hit. */
  nextAttackAt: number;
  /** Combat-clock ms before which the enemy cannot start another profile ability. */
  nextAbilityAt: number;
}

function tuningForEnemy(visual: EnemyVisualId): EnemySimTuning {
  const entry = GAME_DATA.enemyTuning.find((e) => e.enemyId === visual);
  if (entry === undefined) {
    throw new Error(`enemy-sim: no catalog tuning for "${visual}"`);
  }
  return {
    ai: {
      detectRadiusPx: entry.detectRadiusPx,
      loseTargetRadiusPx: entry.loseTargetRadiusPx,
      leashRadiusPx: entry.leashRadiusPx,
      attackRangePx: entry.attack.rangePx,
    },
    moveSpeedPxPerSec: entry.moveSpeedPxPerSec,
    separationRadiusPx: SEPARATION_RADIUS_PX,
  };
}

/** Build a fresh enemy at its spawn point. Call once per spawned enemy from `runtime.ts`. */
export function createEnemy(id: string, visual: EnemyVisualId, spawn: CombatVector): EnemyRecord {
  const catalog = GAME_DATA.enemies.find((e) => e.id === visual);
  if (catalog === undefined) throw new Error(`enemy-sim: no catalog entry for "${visual}"`);
  const tuning = tuningForEnemy(visual);
  const attackEntry = GAME_DATA.enemyTuning.find((e) => e.enemyId === visual)!.attack;
  const abilityProfile = resolveEnemyAbilityProfile(
    catalog.behaviors,
    GAME_DATA.enemyAbilityTuning,
  );
  return {
    id,
    visual,
    tuning,
    hitDamage: Math.max(1, Math.round(ENEMY_BASE_HIT_DAMAGE * attackEntry.damageMultiplier)),
    movementStyle: resolveEnemyMovementStyle(catalog.behaviors),
    abilityProfile,
    attacker: {
      weaponDamage: [ENEMY_BASE_HIT_DAMAGE, ENEMY_BASE_HIT_DAMAGE],
      power: 0,
      level: 1,
      criticalChance: 0,
      criticalMultiplier: 1,
    },
    abilityMultiplier: attackEntry.damageMultiplier,
    sim: { aiState: 'idle', position: { ...spawn }, spawnPosition: { ...spawn } },
    nextAttackAt: 0,
    nextAbilityAt: 0,
  };
}

/** Advance one enemy's AI + position over the `[fromMs, toMs)` window against the current world.
 *  Returns the new sim state (the record is mutated in place for convenience). Movement only —
 *  whether the enemy should *land a hit* this tick is decided by `wantsToAttack`. */
export function advanceEnemy(
  enemy: EnemyRecord,
  target: CombatVector,
  neighbors: readonly SeparationNeighbor[],
  window: { fromMs: number; toMs: number },
  isDead: boolean,
  abilityReady = false,
): EnemySimState {
  // hasLineOfSight=true keeps the MVP simple: the test world has no occluding pillars between
  // spawn lanes and the player. If we add LOS occlusion later, the caller computes it.
  const input: EnemySimInput = {
    targetPosition: target,
    hasLineOfSight: true,
    neighbors,
    isDead,
    isStunned: false,
    abilityReady,
    restState: 'idle',
    movementStyle: enemy.movementStyle,
    fromMs: window.fromMs,
    toMs: window.toMs,
  };
  enemy.sim = stepEnemy(enemy.sim, input, enemy.tuning);
  return enemy.sim;
}

/** Did the FSM leave this enemy in a state where it should try to land an attack hit, and is its
 *  per-enemy cooldown ready? The caller applies the damage via `LocalCombatController` and then
 *  sets `enemy.nextAttackAt`, so the same swing can't hit twice. */
export function wantsToAttack(enemy: EnemyRecord, now: number): boolean {
  if (enemy.sim.aiState !== 'attack') return false;
  if (now < enemy.nextAttackAt) return false;
  return true;
}

/** Did the FSM choose a profile ability and is its independent cooldown ready? */
export function wantsToUseAbility(enemy: EnemyRecord, now: number): boolean {
  return enemy.sim.aiState === 'use_ability' && now >= enemy.nextAbilityAt;
}

/** Schedule the next profile act from the same catalog cooldown as the basic attack. */
export function scheduleNextAbility(enemy: EnemyRecord, now: number): void {
  const entry = GAME_DATA.enemyTuning.find((candidate) => candidate.enemyId === enemy.visual)!;
  enemy.nextAbilityAt = now + entry.attack.cooldownMs;
}

/** Schedule this enemy's next hit after it just landed one, from its catalog `attack.cooldownMs`. */
export function scheduleNextAttack(enemy: EnemyRecord, now: number): void {
  const entry = GAME_DATA.enemyTuning.find((e) => e.enemyId === enemy.visual)!;
  enemy.nextAttackAt = now + entry.attack.cooldownMs;
}

/** Human-facing label for the AI state, for debug HUDs / dev overlays. */
export function describeEnemyAiState(state: EnemyAiState): string {
  return state;
}
