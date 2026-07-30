import { GAME_DATA } from '@brecha/game-data';
import {
  advanceGuardianCombat,
  applyBattleThirst,
  applySuccessfulHit,
  createGuardianCombatState,
  resolvePhysicalDamage,
  targetWithinArc,
  targetWithinRadius,
  tryActivateAbility,
  type CombatVector,
  type GuardianAbilityKey,
  type GuardianCombatState,
  type GuardianCombatTuning,
  type RandomSource,
} from '@brecha/shared';

export type CombatClock = Readonly<{ now(): number }>;
export type KnockbackConstrain = (from: CombatVector, proposed: CombatVector) => CombatVector;
export type CombatObstacle = Readonly<{ x: number; y: number; width: number; height: number }>;
export type CombatEvent =
  | Readonly<{ type: 'abilityAccepted'; executionId: string; ability: GuardianAbilityKey }>
  | Readonly<{
      type: 'abilityRejected';
      ability: GuardianAbilityKey;
      reason: 'cooldown' | 'fury' | 'busy';
    }>
  | Readonly<{
      type: 'damageApplied';
      executionId: string;
      targetId: string;
      amount: number;
      critical: boolean;
      tick: number;
      position: CombatVector;
    }>
  | Readonly<{ type: 'targetDefeated'; targetId: string; position: CombatVector }>
  | Readonly<{ type: 'knockback'; targetId: string; distance: number; position: CombatVector }>
  | Readonly<{ type: 'ironSkin'; active: boolean }>;
export type CombatHudSnapshot = Readonly<{
  health: number;
  maxHealth: number;
  fury: number;
  maxFury: number;
  cooldownRemainingMs: Readonly<Record<GuardianAbilityKey, number>>;
  ironSkinActive: boolean;
  movementMultiplier: number;
}>;
export type DummyTarget = Readonly<{
  id: string;
  position: CombatVector;
  armor: number;
  health: number;
  maxHealth: number;
}>;

const abilityKeys = ['slash', 'powerStrike', 'whirlwind', 'ironSkin'] as const;
const combatData = GAME_DATA.guardianCombat;
function tuningFor(abilityId: string): GuardianCombatTuning['abilities']['slash'] {
  const ability = combatData.abilities.find(({ id }) => id === abilityId);
  if (ability === undefined) throw new Error(`Missing Guardian combat ability: ${abilityId}`);
  return {
    id: ability.id,
    furyCost: ability.furyCost,
    cooldownMs: ability.cooldownMs,
    damageMultiplier: ability.damageMultiplier,
    ...(ability.rangePx === undefined ? {} : { rangePx: ability.rangePx }),
    ...(ability.arcDegrees === undefined ? {} : { arcDegrees: ability.arcDegrees }),
    ...(ability.maxTargets === undefined ? {} : { maxTargets: ability.maxTargets }),
    ...(ability.impactMs === undefined ? {} : { impactMs: ability.impactMs }),
    ...(ability.recoveryMs === undefined ? {} : { recoveryMs: ability.recoveryMs }),
    ...(ability.radiusPx === undefined ? {} : { radiusPx: ability.radiusPx }),
    ...(ability.tickOffsetsMs === undefined ? {} : { tickOffsetsMs: ability.tickOffsetsMs }),
    ...(ability.durationMs === undefined ? {} : { durationMs: ability.durationMs }),
    ...(ability.movementMultiplier === undefined
      ? {}
      : { movementMultiplier: ability.movementMultiplier }),
    ...(ability.knockbackPx === undefined ? {} : { knockbackPx: ability.knockbackPx }),
    ...(ability.damageTakenMultiplier === undefined
      ? {}
      : { damageTakenMultiplier: ability.damageTakenMultiplier }),
    ...(ability.furyOnHit === undefined ? {} : { furyOnHit: ability.furyOnHit }),
  };
}
export const guardianCombatTuning: GuardianCombatTuning = Object.freeze({
  formulaVersion: combatData.combatFormulaVersion,
  level: combatData.level,
  strength: combatData.attributes.strength,
  dexterity: combatData.attributes.dexterity,
  vitality: combatData.attributes.vitality,
  weaponDamage: combatData.weaponDamage,
  maxFury: combatData.maxFury,
  criticalBaseChance: combatData.criticalBaseChance,
  criticalPerDexterity: combatData.criticalPerDexterity,
  criticalCap: combatData.criticalCap,
  criticalMultiplier: combatData.criticalMultiplier,
  armorDenominatorBase: combatData.armorDenominatorBase,
  armorDenominatorPerLevel: combatData.armorDenominatorPerLevel,
  armorReductionCap: combatData.armorReductionCap,
  furyOnDamageTaken: combatData.furyOnDamageTaken,
  furyDecayDelayMs: combatData.furyDecayDelayMs,
  furyDecayPerSecond: combatData.furyDecayPerSecond,
  battleThirst: combatData.battleThirst,
  abilities: {
    slash: tuningFor('ability.guardian.slash'),
    powerStrike: tuningFor('ability.guardian.power_strike'),
    whirlwind: tuningFor('ability.guardian.whirlwind'),
    ironSkin: tuningFor('ability.guardian.iron_skin'),
  },
});

type PendingImpact = Readonly<{
  executionId: string;
  ability: GuardianAbilityKey;
  at: number;
  tick: number;
  origin: CombatVector;
  facing: CombatVector;
}>;

/** Local application adapter: it owns test dummies and invokes the reusable pure rules. */
export class LocalCombatController {
  private state: GuardianCombatState = createGuardianCombatState(guardianCombatTuning);
  private previousAt: number;
  private readonly targets = new Map<string, DummyTarget>();
  private readonly pending: PendingImpact[] = [];
  private readonly resolvedImpactKeys = new Set<string>();
  private readonly seenExecutions = new Set<string>();
  private ironSkinWasActive = false;
  private whirlwindEndsAt = 0;
  private actionEndsAt = 0;
  private readonly executionEndsAt = new Map<string, number>();

  public constructor(
    private readonly clock: CombatClock,
    private readonly random: RandomSource,
    private readonly constrainKnockback: KnockbackConstrain = (_from, proposed) => proposed,
  ) {
    this.previousAt = clock.now();
  }

  public addDummy(target: DummyTarget): void {
    this.targets.set(target.id, target);
  }
  public getTargets(): readonly DummyTarget[] {
    return [...this.targets.values()];
  }
  public snapshot(): CombatHudSnapshot {
    const now = this.clock.now();
    return {
      health: this.state.health,
      maxHealth: this.state.maxHealth,
      fury: this.state.fury,
      maxFury: guardianCombatTuning.maxFury,
      cooldownRemainingMs: Object.fromEntries(
        abilityKeys.map((ability) => [
          ability,
          Math.max(0, (this.state.cooldownEndsAt[ability] ?? 0) - now),
        ]),
      ) as CombatHudSnapshot['cooldownRemainingMs'],
      ironSkinActive:
        this.state.ironSkinStartsAt !== undefined &&
        this.state.ironSkinStartsAt <= now &&
        this.state.ironSkinEndsAt !== undefined &&
        this.state.ironSkinEndsAt > now,
      movementMultiplier:
        this.whirlwindEndsAt > now
          ? (guardianCombatTuning.abilities.whirlwind.movementMultiplier ?? 1)
          : 1,
    };
  }
  public activate(
    ability: GuardianAbilityKey,
    executionId: string,
    origin: CombatVector,
    facing: CombatVector,
  ): readonly CombatEvent[] {
    const at = this.clock.now();
    if (this.seenExecutions.has(executionId)) return [];
    if (at < this.actionEndsAt) return [{ type: 'abilityRejected', ability, reason: 'busy' }];
    const result = tryActivateAbility(guardianCombatTuning, this.state, {
      ability,
      executionId,
      at,
    });
    if (!result.accepted) return [{ type: 'abilityRejected', ability, reason: result.reason }];
    this.seenExecutions.add(executionId);
    this.state = result.state;
    const config = guardianCombatTuning.abilities[ability];
    const actionDuration = config.recoveryMs ?? config.durationMs ?? config.impactMs ?? 0;
    this.actionEndsAt = at + actionDuration;
    this.executionEndsAt.set(executionId, this.actionEndsAt);
    if (ability === 'whirlwind') this.whirlwindEndsAt = at + (config.durationMs ?? 0);
    const ticks = config.tickOffsetsMs ?? [config.impactMs ?? 0];
    this.pending.push(
      ...ticks.map((offset, tick) => ({
        executionId,
        ability,
        at: at + offset,
        tick,
        origin,
        facing,
      })),
    );
    return [{ type: 'abilityAccepted', ability, executionId }];
  }
  public update(actorPosition?: CombatVector): readonly CombatEvent[] {
    const now = this.clock.now();
    this.state = advanceGuardianCombat(guardianCombatTuning, this.state, this.previousAt, now);
    this.previousAt = now;
    const events: CombatEvent[] = [];
    const due = this.pending
      .filter((impact) => impact.at <= now)
      .sort((left, right) => left.at - right.at || left.tick - right.tick);
    this.pending.splice(
      0,
      this.pending.length,
      ...this.pending.filter((impact) => impact.at > now),
    );
    for (const impact of due)
      if (impact.ability !== 'ironSkin') events.push(...this.resolveImpact(impact, actorPosition));
    const skinActive = this.snapshot().ironSkinActive;
    if (!this.ironSkinWasActive && skinActive) events.push({ type: 'ironSkin', active: true });
    if (this.ironSkinWasActive && !skinActive) events.push({ type: 'ironSkin', active: false });
    this.ironSkinWasActive = skinActive;
    for (const [executionId, endsAt] of this.executionEndsAt)
      if (endsAt <= now && !this.pending.some((impact) => impact.executionId === executionId)) {
        this.executionEndsAt.delete(executionId);
        this.seenExecutions.delete(executionId);
        for (const key of this.resolvedImpactKeys)
          if (key.startsWith(`${executionId}:`)) this.resolvedImpactKeys.delete(key);
      }
    return events;
  }
  private resolveImpact(impact: PendingImpact, actorPosition?: CombatVector): CombatEvent[] {
    const config = guardianCombatTuning.abilities[impact.ability];
    const origin =
      impact.ability === 'whirlwind' && actorPosition !== undefined ? actorPosition : impact.origin;
    const targets = [...this.targets.values()]
      .filter((target) => target.health > 0)
      .filter((target) =>
        config.radiusPx === undefined
          ? targetWithinArc(origin, impact.facing, target, config.rangePx!, config.arcDegrees!)
          : targetWithinRadius(origin, target, config.radiusPx),
      )
      .slice(0, config.maxTargets ?? Number.POSITIVE_INFINITY);
    const events: CombatEvent[] = [];
    let hit = false;
    for (const target of targets) {
      const key = `${impact.executionId}:${target.id}:${impact.tick}`;
      if (this.resolvedImpactKeys.has(key)) continue;
      this.resolvedImpactKeys.add(key);
      const damage = resolvePhysicalDamage(
        guardianCombatTuning,
        target.armor,
        config.damageMultiplier,
        this.random,
      );
      const nextPosition =
        config.knockbackPx === undefined
          ? target.position
          : this.constrainKnockback(
              target.position,
              knockbackDestination(origin, target.position, config.knockbackPx),
            );
      const next = {
        ...target,
        position: nextPosition,
        health: Math.max(0, target.health - damage.amount),
      };
      this.targets.set(target.id, next);
      hit = true;
      events.push({
        type: 'damageApplied',
        executionId: impact.executionId,
        targetId: target.id,
        amount: damage.amount,
        critical: damage.critical,
        tick: impact.tick,
        position: nextPosition,
      });
      if (config.knockbackPx !== undefined)
        events.push({
          type: 'knockback',
          targetId: target.id,
          distance: config.knockbackPx,
          position: nextPosition,
        });
      if (next.health === 0) {
        this.state = applyBattleThirst(
          guardianCombatTuning,
          this.state,
          `${impact.executionId}:${target.id}`,
          impact.at,
        );
        events.push({ type: 'targetDefeated', targetId: target.id, position: nextPosition });
      }
    }
    if (hit)
      this.state = applySuccessfulHit(guardianCombatTuning, this.state, impact.ability, impact.at);
    return events;
  }
}

function knockbackDestination(
  origin: CombatVector,
  target: CombatVector,
  distance: number,
): CombatVector {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: target.x + (dx / length) * distance, y: target.y + (dy / length) * distance };
}

/** Returns the last safe point before a swept target enters an obstacle. */
export function constrainKnockbackSweep(
  from: CombatVector,
  proposed: CombatVector,
  obstacles: readonly CombatObstacle[],
  bounds: Readonly<{ minimumX: number; minimumY: number; maximumX: number; maximumY: number }>,
): CombatVector {
  const clamped = {
    x: Math.min(bounds.maximumX, Math.max(bounds.minimumX, proposed.x)),
    y: Math.min(bounds.maximumY, Math.max(bounds.minimumY, proposed.y)),
  };
  let firstHit = 1;
  for (const obstacle of obstacles) {
    const hit = segmentRectEntry(from, clamped, obstacle);
    if (hit !== undefined) firstHit = Math.min(firstHit, hit);
  }
  if (firstHit === 1) return clamped;
  const safe = Math.max(0, firstHit - 0.001);
  return { x: from.x + (clamped.x - from.x) * safe, y: from.y + (clamped.y - from.y) * safe };
}
function segmentRectEntry(
  from: CombatVector,
  to: CombatVector,
  rect: CombatObstacle,
): number | undefined {
  let minimum = 0;
  let maximum = 1;
  for (const [start, delta, low, high] of [
    [from.x, to.x - from.x, rect.x - rect.width / 2, rect.x + rect.width / 2],
    [from.y, to.y - from.y, rect.y - rect.height / 2, rect.y + rect.height / 2],
  ] as const) {
    if (delta === 0) {
      if (start < low || start > high) return undefined;
      continue;
    }
    const first = (low - start) / delta;
    const second = (high - start) / delta;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return undefined;
  }
  return minimum;
}
