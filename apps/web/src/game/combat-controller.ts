import { GAME_DATA } from '@brecha/game-data';
import {
  advanceGuardianCombat,
  applyBattleThirst,
  applyDamageTaken,
  applyResolvedDamageTaken,
  applySuccessfulHit,
  createGuardianCombatState,
  resolvePhysicalDamage,
  targetWithinArc,
  targetWithinRadius,
  tryActivateAbility,
  type CombatVector,
  type CharacterClassId,
  type EnemyAbilityTarget,
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
      reason: 'cooldown' | 'fury' | 'downed' | 'busy';
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
  | Readonly<{ type: 'ironSkin'; active: boolean }>
  | Readonly<{ type: 'selfDamaged'; amount: number; health: number; maxHealth: number }>;
export type CombatHudSnapshot = Readonly<{
  health: number;
  maxHealth: number;
  downed: boolean;
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
type CombatCatalog = typeof GAME_DATA.guardianCombat | typeof GAME_DATA.barbarianCombat;

function tuningFor(
  combatData: CombatCatalog,
  abilityId: string,
): GuardianCombatTuning['abilities']['slash'] {
  const ability = combatData.abilities.find(({ id }) => id === abilityId);
  if (ability === undefined) throw new Error(`Missing combat ability: ${abilityId}`);
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

function buildCombatTuning(
  combatData: CombatCatalog,
  abilityIds: Readonly<Record<(typeof abilityKeys)[number], string>>,
): GuardianCombatTuning {
  return Object.freeze({
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
      slash: tuningFor(combatData, abilityIds.slash),
      powerStrike: tuningFor(combatData, abilityIds.powerStrike),
      whirlwind: tuningFor(combatData, abilityIds.whirlwind),
      ironSkin: tuningFor(combatData, abilityIds.ironSkin),
    },
  });
}

const GUARDIAN_ABILITY_IDS = Object.freeze({
  slash: 'ability.guardian.slash',
  powerStrike: 'ability.guardian.power_strike',
  whirlwind: 'ability.guardian.whirlwind',
  ironSkin: 'ability.guardian.iron_skin',
});

/** The local preview uses the same pure combat rules as the server, with class data selected by ID. */
export const guardianCombatTuning: GuardianCombatTuning = buildCombatTuning(
  GAME_DATA.guardianCombat,
  GUARDIAN_ABILITY_IDS,
);

/**
 * Barbarian only has three active nodes in the first vertical slice. `powerStrike` is the internal
 * frontal-hit slot used by its Q ability; `whirlwind` aliases the basic cleave as a safe fallback
 * for legacy callers because the Barbarian kit has no area-over-time move yet.
 */
export const barbarianCombatTuning: GuardianCombatTuning = buildCombatTuning(
  GAME_DATA.barbarianCombat,
  Object.freeze({
    slash: 'ability.barbarian.cleave',
    powerStrike: 'ability.barbarian.berserker_oath',
    whirlwind: 'ability.barbarian.cleave',
    ironSkin: 'ability.barbarian.rallying_hide',
  }),
);

export function combatTuningForClass(characterClass: CharacterClassId): GuardianCombatTuning {
  return characterClass === 'BARBARIAN' ? barbarianCombatTuning : guardianCombatTuning;
}

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
  private tuning: GuardianCombatTuning = guardianCombatTuning;
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
    characterClass: CharacterClassId = 'GUARDIAN',
  ) {
    this.tuning = combatTuningForClass(characterClass);
    this.state = createGuardianCombatState(this.tuning);
    this.previousAt = clock.now();
  }

  /**
   * Rebinds combat to a specific character's server-authoritative level and attributes, replacing
   * the catalog's fixed reference Guardian. This is what makes levelling and spending attribute
   * points change how the character actually fights instead of only how the sheet reads.
   *
   * Health is carried across as a *fraction*, not an absolute: raising Vitality mid-run must not
   * heal, and lowering it must not instantly down a character who was at full health. A downed
   * character stays downed (0/anything is still 0), so this can never double as a revive.
   */
  public applyCharacterProfile(
    profile: Readonly<{
      level: number;
      strength: number;
      dexterity: number;
      vitality: number;
      /** Flat bonuses summed from equipped gear — see `GuardianCombatTuning`'s own fields. */
      armorBonus?: number;
      physicalDamageBonus?: number;
      maxHealthBonus?: number;
      criticalChanceBonus?: number;
    }>,
  ): void {
    const next: GuardianCombatTuning = {
      ...this.tuning,
      level: profile.level,
      strength: profile.strength,
      dexterity: profile.dexterity,
      vitality: profile.vitality,
      armorBonus: profile.armorBonus ?? 0,
      physicalDamageBonus: profile.physicalDamageBonus ?? 0,
      maxHealthBonus: profile.maxHealthBonus ?? 0,
      criticalChanceBonus: profile.criticalChanceBonus ?? 0,
    };
    if (
      next.level === this.tuning.level &&
      next.strength === this.tuning.strength &&
      next.dexterity === this.tuning.dexterity &&
      next.vitality === this.tuning.vitality &&
      next.armorBonus === this.tuning.armorBonus &&
      next.physicalDamageBonus === this.tuning.physicalDamageBonus &&
      next.maxHealthBonus === this.tuning.maxHealthBonus &&
      next.criticalChanceBonus === this.tuning.criticalChanceBonus
    )
      return;
    const healthFraction = this.state.maxHealth > 0 ? this.state.health / this.state.maxHealth : 0;
    const rebuilt = createGuardianCombatState(next);
    this.tuning = next;
    this.state = {
      ...this.state,
      armor: rebuilt.armor,
      maxHealth: rebuilt.maxHealth,
      health: Math.min(rebuilt.maxHealth, Math.round(rebuilt.maxHealth * healthFraction)),
    };
  }

  public addDummy(target: DummyTarget): void {
    this.targets.set(target.id, target);
  }
  public getTargets(): readonly DummyTarget[] {
    return [...this.targets.values()];
  }
  /**
   * Removes a defeated target from the authoritative combat map. Pending Guardian impacts are
   * resolved against the current map, so an entity removed during its death window cannot receive
   * a late hit. Repeated cleanup is intentionally idempotent for the Phaser adapter.
   */
  public removeDummy(id: string): boolean {
    return this.targets.delete(id);
  }
  /**
   * Replaces a dummy's position immutably (same object-replacement pattern the knockback resolution
   * uses internally), so the enemy AI adapter can drive chase/retreat without exposing the internal
   * Map. No-op for an unknown id. Used by the Paso 8.4 enemy-sim adapter to move enemies.
   */
  public repositionDummy(id: string, position: CombatVector): void {
    const target = this.targets.get(id);
    if (target === undefined) return;
    this.targets.set(id, { ...target, position });
  }
  /** Snapshot of the Guardian in the shared attacker/defender shape used by enemy abilities. */
  public guardianAbilityTarget(position: CombatVector): EnemyAbilityTarget {
    const now = this.clock.now();
    const ironSkinActive =
      this.state.ironSkinStartsAt !== undefined &&
      this.state.ironSkinStartsAt <= now &&
      this.state.ironSkinEndsAt !== undefined &&
      this.state.ironSkinEndsAt > now;
    const ironSkinMultiplier = this.tuning.abilities.ironSkin.damageTakenMultiplier;
    return {
      id: 'guardian',
      position,
      armor: this.state.armor,
      health: this.state.health,
      maxHealth: this.state.maxHealth,
      ...(ironSkinActive && ironSkinMultiplier !== undefined
        ? { incomingDamageMultiplier: ironSkinMultiplier }
        : {}),
    };
  }
  /**
   * Applies incoming damage to the Guardian himself, through the same pure `applyDamageTaken`
   * rule the unit tests already cover (armor, Iron Skin's damageTakenMultiplier, fury-on-hit).
   * A downed Guardian (health 0) is a no-op — death/derribado is Paso 9 scope, not Paso 7's.
   */
  public applyIncomingDamage(rawAmount: number, at: number = this.clock.now()): CombatEvent[] {
    const before = this.state;
    this.state = applyDamageTaken(this.tuning, this.state, rawAmount, at);
    if (this.state.health === before.health) return [];
    return [
      {
        type: 'selfDamaged',
        amount: before.health - this.state.health,
        health: this.state.health,
        maxHealth: this.state.maxHealth,
      },
    ];
  }
  /** Applies a final amount produced by `resolveAttack` exactly once. */
  public applyResolvedIncomingDamage(
    resolvedAmount: number,
    at: number = this.clock.now(),
  ): CombatEvent[] {
    const before = this.state;
    this.state = applyResolvedDamageTaken(this.tuning, this.state, resolvedAmount, at);
    if (this.state.health === before.health) return [];
    return [
      {
        type: 'selfDamaged',
        amount: before.health - this.state.health,
        health: this.state.health,
        maxHealth: this.state.maxHealth,
      },
    ];
  }
  /** Applies a data-driven ally heal while clamping to the target's declared maximum. */
  public healDummy(id: string, amount: number): boolean {
    const target = this.targets.get(id);
    if (target === undefined || target.health <= 0) return false;
    const nextHealth = Math.min(target.maxHealth, target.health + Math.max(0, Math.round(amount)));
    if (nextHealth === target.health) return false;
    this.targets.set(id, { ...target, health: nextHealth });
    return true;
  }
  /**
   * Restores Guardian health, clamped to his maximum. A downed Guardian is deliberately excluded:
   * standing back up is a revive, which is its own authority — a potion must never double as one.
   * Returns the health actually restored so the caller can decide whether a charge was spent.
   */
  public healGuardian(amount: number): number {
    if (this.state.health === 0) return 0;
    const restored = Math.min(
      this.state.maxHealth - this.state.health,
      Math.max(0, Math.round(amount)),
    );
    if (restored === 0) return 0;
    this.state = { ...this.state, health: this.state.health + restored };
    return restored;
  }
  public snapshot(): CombatHudSnapshot {
    const now = this.clock.now();
    return {
      health: this.state.health,
      maxHealth: this.state.maxHealth,
      downed: this.state.health === 0,
      fury: this.state.fury,
      maxFury: this.tuning.maxFury,
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
        this.whirlwindEndsAt > now ? (this.tuning.abilities.whirlwind.movementMultiplier ?? 1) : 1,
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
    const result = tryActivateAbility(this.tuning, this.state, {
      ability,
      executionId,
      at,
    });
    if (!result.accepted) return [{ type: 'abilityRejected', ability, reason: result.reason }];
    this.seenExecutions.add(executionId);
    this.state = result.state;
    const config = this.tuning.abilities[ability];
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
    this.state = advanceGuardianCombat(this.tuning, this.state, this.previousAt, now);
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
    const config = this.tuning.abilities[impact.ability];
    const origin =
      impact.ability === 'whirlwind' && actorPosition !== undefined ? actorPosition : impact.origin;
    const targets = [...this.targets.values()]
      .filter((target) => target.health > 0)
      .filter((target) =>
        config.radiusPx === undefined
          ? targetWithinArc(origin, impact.facing, target, config.rangePx!, config.arcDegrees!)
          : targetWithinRadius(origin, target, config.radiusPx),
      )
      .sort(
        (left, right) =>
          squaredDistance(origin, left.position) - squaredDistance(origin, right.position) ||
          (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
      )
      .slice(0, config.maxTargets ?? Number.POSITIVE_INFINITY);
    const events: CombatEvent[] = [];
    let hit = false;
    for (const target of targets) {
      const key = `${impact.executionId}:${target.id}:${impact.tick}`;
      if (this.resolvedImpactKeys.has(key)) continue;
      this.resolvedImpactKeys.add(key);
      const damage = resolvePhysicalDamage(
        this.tuning,
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
          this.tuning,
          this.state,
          `${impact.executionId}:${target.id}`,
          impact.at,
        );
        events.push({ type: 'targetDefeated', targetId: target.id, position: nextPosition });
      }
    }
    if (hit) this.state = applySuccessfulHit(this.tuning, this.state, impact.ability, impact.at);
    return events;
  }
}

function squaredDistance(from: CombatVector, to: CombatVector): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx * dx + dy * dy;
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
