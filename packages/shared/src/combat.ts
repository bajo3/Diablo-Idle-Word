/** Pure local combat contracts. No renderer, transport, storage, clock or RNG implementation leaks here. */
export type GuardianAbilityKey = 'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin';
export type CombatVector = Readonly<{ x: number; y: number }>;
export type CombatTarget = Readonly<{
  id: string;
  position: CombatVector;
  armor: number;
  health: number;
}>;
export type RandomSource = Readonly<{
  nextInt(minimum: number, maximum: number): number;
  next(): number;
}>;
export type GuardianCombatTuning = Readonly<{
  formulaVersion: 'guardian-combat.1';
  level: number;
  strength: number;
  dexterity: number;
  vitality: number;
  weaponDamage: readonly [number, number];
  maxFury: number;
  criticalBaseChance: number;
  criticalPerDexterity: number;
  criticalCap: number;
  criticalMultiplier: number;
  armorDenominatorBase: number;
  armorDenominatorPerLevel: number;
  armorReductionCap: number;
  furyOnDamageTaken: number;
  furyDecayDelayMs: number;
  furyDecayPerSecond: number;
  battleThirst: Readonly<{ healFraction: number; capFraction: number; windowMs: number }>;
  abilities: Readonly<Record<GuardianAbilityKey, GuardianAbilityTuning>>;
  /**
   * Flat bonuses summed from equipped gear (see `ItemStatKey` in items.ts), layered on top of the
   * attribute-derived baseline. All optional/default 0 so every existing tuning literal — tests,
   * the catalog default, enemy tuning reused as attacker stats — stays valid without change.
   * `criticalChanceBonus` is a fraction (0.03, not 3) to match `criticalBaseChance`'s own units.
   */
  armorBonus?: number;
  physicalDamageBonus?: number;
  maxHealthBonus?: number;
  criticalChanceBonus?: number;
}>;
export type GuardianAbilityTuning = Readonly<{
  id: string;
  furyCost: number;
  cooldownMs: number;
  damageMultiplier: number;
  rangePx?: number;
  arcDegrees?: number;
  maxTargets?: number;
  impactMs?: number;
  recoveryMs?: number;
  radiusPx?: number;
  tickOffsetsMs?: readonly number[];
  durationMs?: number;
  movementMultiplier?: number;
  knockbackPx?: number;
  damageTakenMultiplier?: number;
  furyOnHit?: number;
}>;
export type GuardianCombatState = Readonly<{
  health: number;
  maxHealth: number;
  fury: number;
  armor: number;
  cooldownEndsAt: Readonly<Partial<Record<GuardianAbilityKey, number>>>;
  ironSkinStartsAt: number | undefined;
  ironSkinEndsAt: number | undefined;
  lastCombatAt: number;
  furyDecayCarryMs: number;
  battleThirstHeals: readonly Readonly<{ defeatId: string; at: number; amount: number }>[];
}>;
export type DamageResult = Readonly<{
  base: number;
  mitigation: number;
  critical: boolean;
  amount: number;
}>;
export type AbilityAttempt = Readonly<{
  executionId: string;
  ability: GuardianAbilityKey;
  at: number;
}>;
export type AbilityAcceptance = Readonly<{
  accepted: true;
  state: GuardianCombatState;
  ability: GuardianAbilityKey;
  executionId: string;
  at: number;
}>;
export type AbilityRejection = Readonly<{
  accepted: false;
  reason: 'cooldown' | 'fury' | 'downed';
}>;
export type AbilityAttemptResult = AbilityAcceptance | AbilityRejection;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function createGuardianCombatState(tuning: GuardianCombatTuning): GuardianCombatState {
  const maxHealth = 100 + tuning.vitality * 10 + (tuning.maxHealthBonus ?? 0);
  return {
    health: maxHealth,
    maxHealth,
    fury: 0,
    armor: 20 + Math.floor(tuning.strength * 0.5) + (tuning.armorBonus ?? 0),
    cooldownEndsAt: {},
    ironSkinStartsAt: undefined,
    ironSkinEndsAt: undefined,
    lastCombatAt: 0,
    furyDecayCarryMs: 0,
    battleThirstHeals: [],
  };
}

export function criticalChance(tuning: GuardianCombatTuning): number {
  return clamp(
    tuning.criticalBaseChance +
      tuning.dexterity * tuning.criticalPerDexterity +
      (tuning.criticalChanceBonus ?? 0),
    0,
    tuning.criticalCap,
  );
}

export function armorMitigation(
  armor: number,
  level: number,
  tuning: GuardianCombatTuning,
): number {
  const denominator = armor + tuning.armorDenominatorBase + tuning.armorDenominatorPerLevel * level;
  return denominator <= 0 ? 0 : clamp(armor / denominator, 0, tuning.armorReductionCap);
}

/**
 * Symmetric attacker-side stats: whoever deals damage (the Guardian today, any enemy from Paso 8
 * onward) is described the same way, so there is exactly one damage formula in the game.
 */
export type AttackerStats = Readonly<{
  weaponDamage: readonly [number, number];
  power: number;
  level: number;
  criticalChance: number;
  criticalMultiplier: number;
}>;
/** Symmetric defender-side stats: whoever takes damage, including the Guardian himself. */
export type DefenderStats = Readonly<{
  armor: number;
  armorDenominatorBase: number;
  armorDenominatorPerLevel: number;
  armorReductionCap: number;
  /** e.g. Iron Skin's damageTakenMultiplier while active. Omitted or 1 means no reduction. */
  incomingDamageMultiplier?: number;
}>;

export function resolveArmorMitigation(defender: DefenderStats, attackerLevel: number): number {
  const denominator =
    defender.armor +
    defender.armorDenominatorBase +
    defender.armorDenominatorPerLevel * attackerLevel;
  return denominator <= 0 ? 0 : clamp(defender.armor / denominator, 0, defender.armorReductionCap);
}

/**
 * The one damage formula in the game: weapon roll + power, mitigated by the defender's armor,
 * critical multiplier, then the defender's own incoming-damage multiplier (Iron Skin and future
 * enemy resistances alike), single rounding at the end. Both `resolvePhysicalDamage` (Guardian
 * abilities) and enemy attacks (Paso 8) resolve through this same path.
 */
export function resolveAttack(
  attacker: AttackerStats,
  defender: DefenderStats,
  abilityMultiplier: number,
  random: RandomSource,
): DamageResult {
  const rolledWeaponDamage = random.nextInt(attacker.weaponDamage[0], attacker.weaponDamage[1]);
  const base = rolledWeaponDamage + attacker.power;
  const mitigation = resolveArmorMitigation(defender, attacker.level);
  const critical = random.next() < attacker.criticalChance;
  const amount = Math.max(
    0,
    Math.round(
      base *
        abilityMultiplier *
        (1 - mitigation) *
        (critical ? attacker.criticalMultiplier : 1) *
        (defender.incomingDamageMultiplier ?? 1),
    ),
  );
  return { base, mitigation, critical, amount };
}

export function resolvePhysicalDamage(
  tuning: GuardianCombatTuning,
  targetArmor: number,
  abilityMultiplier: number,
  random: RandomSource,
): DamageResult {
  const damageBonus = tuning.physicalDamageBonus ?? 0;
  return resolveAttack(
    {
      weaponDamage: [tuning.weaponDamage[0] + damageBonus, tuning.weaponDamage[1] + damageBonus],
      power: tuning.strength,
      level: tuning.level,
      criticalChance: criticalChance(tuning),
      criticalMultiplier: tuning.criticalMultiplier,
    },
    {
      armor: targetArmor,
      armorDenominatorBase: tuning.armorDenominatorBase,
      armorDenominatorPerLevel: tuning.armorDenominatorPerLevel,
      armorReductionCap: tuning.armorReductionCap,
    },
    abilityMultiplier,
    random,
  );
}

export function tryActivateAbility(
  tuning: GuardianCombatTuning,
  state: GuardianCombatState,
  attempt: AbilityAttempt,
): AbilityAttemptResult {
  const ability = tuning.abilities[attempt.ability];
  if (state.health === 0) return { accepted: false, reason: 'downed' };
  if ((state.cooldownEndsAt[attempt.ability] ?? 0) > attempt.at)
    return { accepted: false, reason: 'cooldown' };
  if (state.fury < ability.furyCost) return { accepted: false, reason: 'fury' };
  return {
    accepted: true,
    ability: attempt.ability,
    executionId: attempt.executionId,
    at: attempt.at,
    state: {
      ...state,
      fury: state.fury - ability.furyCost,
      cooldownEndsAt: {
        ...state.cooldownEndsAt,
        [attempt.ability]: attempt.at + ability.cooldownMs,
      },
      ...(attempt.ability === 'ironSkin'
        ? {
            ironSkinStartsAt: attempt.at + (ability.impactMs ?? 0),
            ironSkinEndsAt: attempt.at + (ability.impactMs ?? 0) + (ability.durationMs ?? 0),
          }
        : {}),
      lastCombatAt: attempt.at,
    },
  };
}

export function applyDamageTaken(
  tuning: GuardianCombatTuning,
  state: GuardianCombatState,
  incomingDamage: number,
  at: number,
): GuardianCombatState {
  if (state.health === 0) return state;
  const ironSkinMultiplier =
    state.ironSkinStartsAt !== undefined &&
    state.ironSkinStartsAt <= at &&
    state.ironSkinEndsAt !== undefined &&
    state.ironSkinEndsAt > at
      ? (tuning.abilities.ironSkin.damageTakenMultiplier ?? 1)
      : 1;
  const amount = Math.max(
    0,
    Math.round(
      incomingDamage *
        (1 - armorMitigation(state.armor, tuning.level, tuning)) *
        ironSkinMultiplier,
    ),
  );
  return {
    ...state,
    health: clamp(state.health - amount, 0, state.maxHealth),
    fury: amount > 0 ? clamp(state.fury + tuning.furyOnDamageTaken, 0, tuning.maxFury) : state.fury,
    lastCombatAt: amount > 0 ? at : state.lastCombatAt,
    furyDecayCarryMs: amount > 0 ? 0 : state.furyDecayCarryMs,
  };
}

/**
 * Applies damage whose mitigation has already been resolved by the shared attacker/defender
 * formula. Enemy projectiles and telegraphs use `resolveAttack` before reaching the local scene
 * adapter; routing that final amount through `applyDamageTaken` again would reduce it twice.
 */
export function applyResolvedDamageTaken(
  tuning: GuardianCombatTuning,
  state: GuardianCombatState,
  resolvedDamage: number,
  at: number,
): GuardianCombatState {
  if (state.health === 0) return state;
  const amount = Math.max(0, Math.min(state.health, Math.round(resolvedDamage)));
  return {
    ...state,
    health: state.health - amount,
    fury: amount > 0 ? clamp(state.fury + tuning.furyOnDamageTaken, 0, tuning.maxFury) : state.fury,
    lastCombatAt: amount > 0 ? at : state.lastCombatAt,
    furyDecayCarryMs: amount > 0 ? 0 : state.furyDecayCarryMs,
  };
}

export function applySuccessfulHit(
  tuning: GuardianCombatTuning,
  state: GuardianCombatState,
  ability: GuardianAbilityKey,
  at: number,
): GuardianCombatState {
  const fury = tuning.abilities[ability].furyOnHit ?? 0;
  return {
    ...state,
    fury: clamp(state.fury + fury, 0, tuning.maxFury),
    lastCombatAt: at,
    furyDecayCarryMs: 0,
  };
}

export function advanceGuardianCombat(
  tuning: GuardianCombatTuning,
  state: GuardianCombatState,
  from: number,
  to: number,
): GuardianCombatState {
  const expired = {
    ...state,
    ironSkinStartsAt:
      state.ironSkinEndsAt !== undefined && state.ironSkinEndsAt <= to
        ? undefined
        : state.ironSkinStartsAt,
    ironSkinEndsAt:
      state.ironSkinEndsAt !== undefined && state.ironSkinEndsAt <= to
        ? undefined
        : state.ironSkinEndsAt,
    battleThirstHeals: state.battleThirstHeals.filter(
      (entry) => entry.at > to - tuning.battleThirst.windowMs,
    ),
  };
  if (to <= from || to <= state.lastCombatAt + tuning.furyDecayDelayMs) return expired;
  const decayStart = Math.max(from, state.lastCombatAt + tuning.furyDecayDelayMs);
  const elapsedMs = expired.furyDecayCarryMs + to - decayStart;
  const wholeSeconds = Math.floor(elapsedMs / 1000);
  if (wholeSeconds === 0) return { ...expired, furyDecayCarryMs: elapsedMs };
  return {
    ...expired,
    fury: clamp(expired.fury - wholeSeconds * tuning.furyDecayPerSecond, 0, tuning.maxFury),
    furyDecayCarryMs: elapsedMs % 1000,
  };
}

export function applyBattleThirst(
  tuning: GuardianCombatTuning,
  state: GuardianCombatState,
  defeatId: string,
  at: number,
): GuardianCombatState {
  if (state.battleThirstHeals.some((entry) => entry.defeatId === defeatId)) return state;
  const recent = state.battleThirstHeals.filter(
    (entry) => entry.at > at - tuning.battleThirst.windowMs,
  );
  const cap = Math.round(state.maxHealth * tuning.battleThirst.capFraction);
  const alreadyHealed = recent.reduce((total, entry) => total + entry.amount, 0);
  const amount = clamp(
    Math.round(state.maxHealth * tuning.battleThirst.healFraction),
    0,
    Math.max(0, cap - alreadyHealed),
  );
  return {
    ...state,
    health: clamp(state.health + amount, 0, state.maxHealth),
    battleThirstHeals: [...recent, { defeatId, at, amount }],
  };
}

export function targetWithinArc(
  origin: CombatVector,
  facing: CombatVector,
  target: Pick<CombatTarget, 'position'>,
  rangePx: number,
  arcDegrees: number,
): boolean {
  const dx = target.position.x - origin.x;
  const dy = target.position.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance > rangePx) return false;
  const dot = (dx / distance) * facing.x + (dy / distance) * facing.y;
  return dot >= Math.cos((arcDegrees * Math.PI) / 360);
}

export function targetWithinRadius(
  origin: CombatVector,
  target: Pick<CombatTarget, 'position'>,
  radiusPx: number,
): boolean {
  return Math.hypot(target.position.x - origin.x, target.position.y - origin.y) <= radiusPx;
}
