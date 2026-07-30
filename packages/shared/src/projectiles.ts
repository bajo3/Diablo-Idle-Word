import type { CombatTarget, CombatVector } from './combat.js';
import { targetWithinRadius } from './combat.js';

/**
 * Pure projectile and telegraph primitives (Paso 8.5). Built once here so the boss (Paso 10) can
 * reuse them without duplicating code, per the plan's own scoping. No Phaser, no timers - every
 * function takes an explicit `atMs` and returns a value, the same style as `advanceGuardianCombat`
 * and `stepEnemy`, so replaying a fixed tick sequence always reproduces the same result.
 */
export type Projectile = Readonly<{
  id: string;
  origin: CombatVector;
  direction: CombatVector;
  speedPxPerSec: number;
  spawnedAt: number;
  maxRangePx: number;
}>;

function elapsedSeconds(spawnedAt: number, atMs: number): number {
  return Math.max(0, atMs - spawnedAt) / 1000;
}

/** How far the projectile has flown by `atMs`, clamped to its own max range - it doesn't keep
 * flying (and can't keep hitting things) past the point where it would have expired. */
function travelledPx(projectile: Projectile, atMs: number): number {
  return Math.min(
    projectile.speedPxPerSec * elapsedSeconds(projectile.spawnedAt, atMs),
    projectile.maxRangePx,
  );
}

export function projectilePositionAt(projectile: Projectile, atMs: number): CombatVector {
  const distance = travelledPx(projectile, atMs);
  return {
    x: projectile.origin.x + projectile.direction.x * distance,
    y: projectile.origin.y + projectile.direction.y * distance,
  };
}

export function hasProjectileExpired(projectile: Projectile, atMs: number): boolean {
  return travelledPx(projectile, atMs) >= projectile.maxRangePx;
}

/** Whether the projectile's current position is within `hitRadiusPx` of `target`, at `atMs`. Does
 * not consume the projectile or the target - the caller decides what happens on a hit (this stays
 * a pure geometry check, same separation `combat.ts` keeps between detection and resolution). */
export function projectileHitsTarget(
  projectile: Projectile,
  atMs: number,
  target: CombatTarget,
  hitRadiusPx: number,
): boolean {
  return targetWithinRadius(projectilePositionAt(projectile, atMs), target, hitRadiusPx);
}

/**
 * A telegraphed area effect: warns for `telegraphMs` before it resolves at a fixed point in time,
 * then (optionally) again every `repeatMs` after that - covers both a one-shot cast (e.g. an
 * archer's charged shot) and a recurring hazard (e.g. `hazard.corrupted_pulse`) with one type.
 */
export type Telegraph = Readonly<{
  id: string;
  center: CombatVector;
  radiusPx: number;
  startedAt: number;
  telegraphMs: number;
  repeatMs?: number;
}>;

/** Position within the current warning/dormant cycle: negative before `startedAt`, otherwise in
 * `[0, repeatMs)` for a repeating telegraph, or unbounded (just elapsed time) for a one-shot one. */
function phaseMs(telegraph: Telegraph, atMs: number): number {
  const elapsed = atMs - telegraph.startedAt;
  if (elapsed < 0 || telegraph.repeatMs === undefined) return elapsed;
  return elapsed % telegraph.repeatMs;
}

/** True while the warning is showing but the effect hasn't resolved yet. False again during the
 * dormant gap between one cycle's resolve and the next cycle's start. */
export function isTelegraphActive(telegraph: Telegraph, atMs: number): boolean {
  const phase = phaseMs(telegraph, atMs);
  return phase >= 0 && phase < telegraph.telegraphMs;
}

/** The next instant (at or after `atMs`) this telegraph resolves: the end of the current warning
 * window if one is active right now, otherwise the end of the next cycle's warning window. */
export function telegraphResolvesAt(telegraph: Telegraph, atMs: number): number {
  if (telegraph.repeatMs === undefined) return telegraph.startedAt + telegraph.telegraphMs;
  const phase = phaseMs(telegraph, atMs);
  if (phase < 0) return telegraph.startedAt + telegraph.telegraphMs;
  if (phase < telegraph.telegraphMs) return atMs - phase + telegraph.telegraphMs;
  const cyclesElapsed = Math.floor((atMs - telegraph.startedAt) / telegraph.repeatMs);
  return telegraph.startedAt + (cyclesElapsed + 1) * telegraph.repeatMs + telegraph.telegraphMs;
}

/** True exactly during the tick window `[resolveMs, resolveMs + toleranceMs)` a caller should
 * treat as "this cycle just resolved" - a single tick step, not every instant after resolution
 * (otherwise a repeating telegraph would appear to resolve continuously between cycles). */
export function telegraphResolvedThisTick(
  telegraph: Telegraph,
  fromMs: number,
  toMs: number,
): boolean {
  const resolvesAt = telegraphResolvesAt(telegraph, fromMs);
  return resolvesAt > fromMs && resolvesAt <= toMs;
}

export function telegraphHitsTarget(telegraph: Telegraph, target: CombatTarget): boolean {
  return targetWithinRadius(telegraph.center, target, telegraph.radiusPx);
}
