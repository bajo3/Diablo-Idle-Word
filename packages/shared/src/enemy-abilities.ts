import type {
  AttackerStats,
  CombatTarget,
  CombatVector,
  DamageResult,
  DefenderStats,
  RandomSource,
} from './combat.js';
import { resolveAttack, targetWithinRadius } from './combat.js';
import type { EnemyAiState } from './enemy-ai.js';

/**
 * Enemy combat abilities (Paso 8, the specific-behaviors layer). The AI FSM (`decideEnemyState`)
 * decides *what state* the enemy is in (`attack`/`use_ability`); `stepEnemy` integrates movement
 * for that state. This module decides *what the enemy does when it acts* in those states: which
 * projectile it spawns, which telegraph it opens, which allies it heals, which targets it stuns.
 *
 * It is deliberately separate from `stepEnemy` so navigation never couples to damage resolution,
 * the same separation `combat.ts` keeps between deciding and presenting damage. Pure: no Phaser,
 * no transport, no clock reads except the explicit `atMs` argument every function takes - replaying
 * a fixed tick sequence always reproduces the same result (GOAL.md §32).
 *
 * Behaviour is derived from a data-driven `EnemyAbilityProfile` (Paso 8.4's "profiles, not
 * subclasses" rule), never from an enemy id - GOAL.md forbids `if (id === ...)` special-casing.
 */

export type EnemyAbilityKind =
  /** Melee swing: resolves instantly against targets inside an arc/range. */
  | 'melee_strike'
  /** Ranged: spawns a projectile that travels and hits on contact (`possessed_archer`). */
  | 'ranged_shot'
  /** Telegraphed area around the caster; resolves after `telegraphMs`, may stun (`root_brute`). */
  | 'area_attack'
  /** Support: heals the most-wounded valid ally inside a radius (`dark_shaman`). */
  | 'heal_allies'
  /** Telegraphed burst that must be announced before resolving (`unstable_beast`). */
  | 'telegraphed_explosion';

/** Tuning for the one-shot explosion of the `unstable_beast` (Paso 11.5: it announces before it hurts). */
export type ExplosionTuning = Readonly<{
  radiusPx: number;
  telegraphMs: number;
  damageMultiplier: number;
}>;
/** Tuning for the Bruto's area + stun (`root_brute`, Paso 11.4). */
export type AreaAttackTuning = Readonly<{
  radiusPx: number;
  stunMs: number;
}>;
/** Tuning for the Chamán's support (`dark_shaman`, Paso 11.3). */
export type HealAlliesTuning = Readonly<{
  /** Fraction of the ally's *missing* health restored on a single heal tick. */
  healMissingFraction: number;
  /** Allies at or above this health fraction are ignored (don't waste a heal on full HP). */
  ignoreAboveFraction: number;
}>;

/**
 * Data-driven description of how an enemy acts in `attack`/`use_ability`. Built once per enemy
 * from its declared `behaviors` tags by `resolveEnemyAbilityProfile` in `game-data` (the same
 * data→behaviour pattern as `resolveEnemyMovementStyle`), so there is no enemy id anywhere here.
 */
export type EnemyAbilityProfile = Readonly<
  | { kind: 'melee_strike' }
  | {
      kind: 'ranged_shot';
      projectileSpeedPxPerSec: number;
      projectileMaxRangePx: number;
      hitRadiusPx: number;
    }
  | { kind: 'area_attack'; tuning: AreaAttackTuning }
  | { kind: 'heal_allies'; tuning: HealAlliesTuning }
  | { kind: 'telegraphed_explosion'; tuning: ExplosionTuning }
>;

/** What an enemy's act produced this tick: spawned entities + resolved effects, all pure data. */
export type EnemyAbilityEffect =
  | Readonly<{ type: 'spawn_projectile'; projectile: EnemySpawnedProjectile }>
  | Readonly<{ type: 'open_telegraph'; telegraph: EnemySpawnedTelegraph }>
  | Readonly<{ type: 'damage'; targetId: string; result: DamageResult }>
  | Readonly<{ type: 'heal'; targetId: string; amount: number }>
  | Readonly<{ type: 'stun'; targetId: string; durationMs: number }>;

/** A projectile spawned by an enemy's `ranged_shot`, reusing `packages/shared/projectiles.ts` shape. */
export type EnemySpawnedProjectile = Readonly<{
  id: string;
  origin: CombatVector;
  direction: CombatVector;
  speedPxPerSec: number;
  spawnedAt: number;
  maxRangePx: number;
  hitRadiusPx: number;
  abilityMultiplier: number;
}>;
/** A telegraph opened by an enemy's `area_attack`/`telegraphed_explosion`. */
export type EnemySpawnedTelegraph = Readonly<{
  id: string;
  center: CombatVector;
  radiusPx: number;
  startedAt: number;
  telegraphMs: number;
  abilityMultiplier: number;
  stunMs?: number;
}>;

export type EnemyAbilityContext = Readonly<{
  /** The enemy's own position (facing is implied by the target when a projectile is spawned). */
  position: CombatVector;
  /** The enemy's attacker-side stats, resolved into the symmetric shape `resolveAttack` uses. */
  attacker: AttackerStats;
  /** Multiplier applied to the attack for this act (mirrors `abilityMultiplier` in Guardian combat). */
  abilityMultiplier: number;
  /** Telegraph window for area/explosion acts, in ms. */
  telegraphMs: number;
  atMs: number;
  random: RandomSource;
  /** Stable, caller-supplied id source so spawned entities get reproducible ids under a seed. */
  nextId: () => string;
}>;

/** A potential target or ally: anything the ability can act on (player or fellow enemy). Carries
 *  `maxHealth` so heal/buff abilities can reason about health *fraction*, not absolute HP. */
export type EnemyAbilityTarget = CombatTarget &
  Readonly<{
    maxHealth: number;
    /** Defender-side multiplier (for example the Guardian's active Iron Skin). */
    incomingDamageMultiplier?: number;
  }>;

function normalize(vector: CombatVector): CombatVector {
  const length = Math.hypot(vector.x, vector.y);
  return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length };
}

/**
 * Resolves one act of an enemy in `attack`/`use_ability`. Returns the effects produced (spawns and
 * resolved damage/heal/stun) without mutating anything outside - the caller (the Phaser adapter,
 * later) owns applying them to the world. Melee/ranged act immediately; area/explosion open a
 * telegraph whose *damage* is resolved later by `resolveEnemyTelegraph` on its resolution tick, so
 * the burst is always announced before it hurts (GOAL.md: "the explosion must be announced visually").
 */
export function resolveEnemyAction(
  profile: EnemyAbilityProfile,
  targets: readonly EnemyAbilityTarget[],
  context: EnemyAbilityContext,
): readonly EnemyAbilityEffect[] {
  switch (profile.kind) {
    case 'melee_strike':
      return resolveMeleeStrike(targets, context);
    case 'ranged_shot':
      return resolveRangedShot(profile, targets, context);
    case 'area_attack':
      return resolveAreaAttack(profile, context);
    case 'heal_allies':
      return resolveHealAllies(profile, targets);
    case 'telegraphed_explosion':
      return resolveTelegraphedExplosion(profile, context);
  }
}

function resolveMeleeStrike(
  targets: readonly EnemyAbilityTarget[],
  context: EnemyAbilityContext,
): readonly EnemyAbilityEffect[] {
  const effects: EnemyAbilityEffect[] = [];
  for (const target of targets) {
    const result = resolveAttack(
      context.attacker,
      defenderFor(target),
      context.abilityMultiplier,
      context.random,
    );
    effects.push({ type: 'damage', targetId: target.id, result });
  }
  return effects;
}

function resolveRangedShot(
  profile: Extract<EnemyAbilityProfile, { kind: 'ranged_shot' }>,
  targets: readonly EnemyAbilityTarget[],
  context: EnemyAbilityContext,
): readonly EnemyAbilityEffect[] {
  const primary = targets[0];
  if (primary === undefined) return [];
  const direction = normalize({
    x: primary.position.x - context.position.x,
    y: primary.position.y - context.position.y,
  });
  const projectile: EnemySpawnedProjectile = {
    id: context.nextId(),
    origin: context.position,
    direction,
    speedPxPerSec: profile.projectileSpeedPxPerSec,
    spawnedAt: context.atMs,
    maxRangePx: profile.projectileMaxRangePx,
    hitRadiusPx: profile.hitRadiusPx,
    abilityMultiplier: context.abilityMultiplier,
  };
  return [{ type: 'spawn_projectile', projectile }];
}

function resolveAreaAttack(
  profile: Extract<EnemyAbilityProfile, { kind: 'area_attack' }>,
  context: EnemyAbilityContext,
): readonly EnemyAbilityEffect[] {
  const telegraph: EnemySpawnedTelegraph = {
    id: context.nextId(),
    center: context.position,
    radiusPx: profile.tuning.radiusPx,
    startedAt: context.atMs,
    telegraphMs: context.telegraphMs,
    abilityMultiplier: context.abilityMultiplier,
    stunMs: profile.tuning.stunMs,
  };
  return [{ type: 'open_telegraph', telegraph }];
}

function resolveHealAllies(
  profile: Extract<EnemyAbilityProfile, { kind: 'heal_allies' }>,
  targets: readonly EnemyAbilityTarget[],
): readonly EnemyAbilityEffect[] {
  const ally = chooseHealTarget(profile, targets);
  if (ally === undefined) return [];
  const missing = Math.max(0, ally.maxHealth - ally.health);
  const amount = Math.round(missing * profile.tuning.healMissingFraction);
  if (amount <= 0) return [];
  return [{ type: 'heal', targetId: ally.id, amount }];
}

function resolveTelegraphedExplosion(
  profile: Extract<EnemyAbilityProfile, { kind: 'telegraphed_explosion' }>,
  context: EnemyAbilityContext,
): readonly EnemyAbilityEffect[] {
  const telegraph: EnemySpawnedTelegraph = {
    id: context.nextId(),
    center: context.position,
    radiusPx: profile.tuning.radiusPx,
    startedAt: context.atMs,
    telegraphMs: profile.tuning.telegraphMs,
    abilityMultiplier: profile.tuning.damageMultiplier,
  };
  return [{ type: 'open_telegraph', telegraph }];
}

/**
 * Picks the ally the Chamán heals: the one with the lowest health *fraction* (most wounded
 * proportionally), breaking ties by id so the choice is deterministic under a seed - never by
 * array order, which would make the result depend on how the caller happened to list allies
 * (GOAL.md §8.4 explicitly flags non-deterministic ally selection as a risk to mitigate).
 * Allies already at/above `ignoreAboveFraction` are skipped so the heal is never wasted on full HP.
 * Exported so it can be tested directly without going through `resolveEnemyAction`.
 */
export function chooseHealTarget(
  profile: Extract<EnemyAbilityProfile, { kind: 'heal_allies' }>,
  allies: readonly EnemyAbilityTarget[],
): EnemyAbilityTarget | undefined {
  const { ignoreAboveFraction } = profile.tuning;
  let best: EnemyAbilityTarget | undefined;
  for (const ally of allies) {
    if (ally.maxHealth <= 0) continue;
    const fraction = ally.health / ally.maxHealth;
    // Skip allies that aren't wounded enough to be worth healing.
    if (fraction >= ignoreAboveFraction) continue;
    // Otherwise keep the most-wounded ally, breaking ties by id for determinism.
    const isMoreWounded = best === undefined || fraction < best.health / best.maxHealth;
    const isTieWinner =
      best !== undefined && fraction === best.health / best.maxHealth && ally.id < best.id;
    if (isMoreWounded || isTieWinner) best = ally;
  }
  return best;
}

/**
 * Resolves a previously-opened enemy telegraph on its resolution tick. Damage applies to every
 * target inside the radius via the symmetric `resolveAttack`; a stun telegraph also applies its
 * stun to those targets. The caller gates this on the telegraph's resolution timing (use
 * `telegraphResolvedThisTick` from `projectiles.ts`, the same gate hazards use), so damage only
 * ever lands once per telegraph at the announced instant - never during the warning window.
 */
export function resolveEnemyTelegraph(
  telegraph: EnemySpawnedTelegraph,
  targets: readonly EnemyAbilityTarget[],
  attacker: AttackerStats,
  random: RandomSource,
): readonly EnemyAbilityEffect[] {
  const effects: EnemyAbilityEffect[] = [];
  for (const target of targets) {
    if (!targetWithinRadius(telegraph.center, target, telegraph.radiusPx)) continue;
    const result = resolveAttack(
      attacker,
      defenderFor(target),
      telegraph.abilityMultiplier,
      random,
    );
    effects.push({ type: 'damage', targetId: target.id, result });
    if (telegraph.stunMs !== undefined && telegraph.stunMs > 0)
      effects.push({ type: 'stun', targetId: target.id, durationMs: telegraph.stunMs });
  }
  return effects;
}

function defenderFor(target: EnemyAbilityTarget): DefenderStats {
  return {
    armor: target.armor,
    armorDenominatorBase: 0,
    armorDenominatorPerLevel: 0,
    armorReductionCap: 0.75,
    ...(target.incomingDamageMultiplier === undefined
      ? {}
      : { incomingDamageMultiplier: target.incomingDamageMultiplier }),
  };
}

/** Whether an enemy in the given AI state should act this tick (only `attack`/`use_ability` act). */
export function enemyCanAct(aiState: EnemyAiState): boolean {
  return aiState === 'attack' || aiState === 'use_ability';
}
