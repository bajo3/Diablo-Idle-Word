import { GAME_DATA } from '@brecha/game-data';
import {
  DEFAULT_INSTANCE_MOVEMENT_CONFIG,
  advanceGuardianCombat,
  applyBattleThirst,
  applySuccessfulHit,
  createGuardianCombatState,
  createSeededRandom,
  resolvePhysicalDamage,
  targetWithinArc,
  targetWithinRadius,
  tryActivateAbility,
  applyResolvedDamageTaken,
  type GuardianAbilityKey,
  type GuardianCombatState,
  type GuardianCombatTuning,
  type CharacterClassId,
  type EnemyAbilityTarget,
  type InstanceEnemyState,
} from '@brecha/shared';

import type { ActiveInstanceRegistry } from './instance-registry.js';

type CombatData = typeof GAME_DATA.guardianCombat | typeof GAME_DATA.barbarianCombat;
type CombatProfile = Readonly<{
  abilityKeys: Readonly<Record<string, GuardianAbilityKey>>;
  tuning: GuardianCombatTuning;
}>;

function buildProfile(
  combatData: CombatData,
  abilityKeys: Readonly<Record<string, GuardianAbilityKey>>,
): CombatProfile {
  const tuningFor = (abilityId: string): GuardianCombatTuning['abilities']['slash'] => {
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
  };
  const keyFor = (key: GuardianAbilityKey): string => {
    const abilityId = Object.entries(abilityKeys).find(([, value]) => value === key)?.[0];
    if (abilityId === undefined) throw new Error(`Missing mapped ability for ${key}`);
    return abilityId;
  };
  return {
    abilityKeys,
    tuning: Object.freeze({
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
        slash: tuningFor(keyFor('slash')),
        powerStrike: tuningFor(keyFor('powerStrike')),
        whirlwind: tuningFor(keyFor('whirlwind')),
        ironSkin: tuningFor(keyFor('ironSkin')),
      },
    }),
  };
}

const guardianProfile = buildProfile(GAME_DATA.guardianCombat, {
  'ability.guardian.slash': 'slash',
  'ability.guardian.power_strike': 'powerStrike',
  'ability.guardian.whirlwind': 'whirlwind',
  'ability.guardian.iron_skin': 'ironSkin',
});
const barbarianProfile = buildProfile(GAME_DATA.barbarianCombat, {
  'ability.barbarian.cleave': 'slash',
  'ability.barbarian.berserker_oath': 'powerStrike',
  'ability.barbarian.blood_rush': 'whirlwind',
  'ability.barbarian.rallying_hide': 'ironSkin',
});

function profileForClass(classId: CharacterClassId | undefined): CombatProfile {
  return classId === 'BARBARIAN' ? barbarianProfile : guardianProfile;
}

/** Server combat sampling interval; impacts still resolve against their exact configured timestamp. */
export const COMBAT_TICK_INTERVAL_MS = 50 as const;

export type CombatCommandInput = Readonly<{
  userId: string;
  characterId: string;
  operationId: string;
  abilityId: string;
  classId?: CharacterClassId;
  targetId?: string;
  facing?: Readonly<{ x: number; y: number }>;
  nowMs: number;
}>;

export type CombatHit = Readonly<{
  targetId: string;
  damage: number;
  critical: boolean;
  targetHealth: number;
  defeated: boolean;
  position: Readonly<{ x: number; y: number }>;
}>;

export type CombatResult = Readonly<{
  operationId: string;
  characterId: string;
  abilityId: string;
  executionId: string;
  replayed: boolean;
  damage: number;
  critical: boolean;
  targetId?: string;
  targetHealth?: number;
  defeated: boolean;
  cooldownEndsAt: number;
  revision: number;
  hits: readonly CombatHit[];
  pending: boolean;
  impactAtMs?: number;
  ironSkinStartsAt?: number;
  ironSkinEndsAt?: number;
  movementMultiplier?: number;
}>;

export type EnemyDamageResolution = Readonly<{
  characterId: string;
  damage: number;
  health: number;
  downed: boolean;
}>;

export class CombatCommandError extends Error {
  public constructor(
    public readonly code:
      | 'INVALID_ABILITY'
      | 'INVALID_STATE'
      | 'COOLDOWN'
      | 'FURY'
      | 'DOWNED'
      | 'TARGET_REQUIRED'
      | 'TARGET_NOT_ALLOWED'
      | 'TARGET_NOT_FOUND'
      | 'OUT_OF_RANGE',
    message: string,
  ) {
    super(message);
    this.name = 'CombatCommandError';
  }
}

export class CombatOperationConflictError extends Error {
  public constructor() {
    super('The combat operation id conflicts with a previous command.');
    this.name = 'CombatOperationConflictError';
  }
}

type StoredResult = Readonly<{
  userId: string;
  characterId: string;
  classId: CharacterClassId | undefined;
  abilityId: string;
  targetId: string | undefined;
  result: CombatResult;
}>;

type PendingCombatImpact = Readonly<{
  operationId: string;
  characterId: string;
  ability: GuardianAbilityKey;
  targetIds: readonly string[];
  origin: Readonly<{ x: number; y: number }>;
  atMs: number;
  tick: number;
}>;

type CombatAccess = Pick<
  ActiveInstanceRegistry,
  'playerFor' | 'stateFor' | 'replaceEnemies' | 'ownerFor' | 'updatePlayer'
>;
type CombatHealthAccess = Pick<ActiveInstanceRegistry, 'playerFor' | 'stateFor' | 'updatePlayer'>;

/** Server-side, process-local combat adapter. The pure damage formula remains in shared. */
export class CombatAuthority {
  private readonly states = new Map<string, GuardianCombatState>();
  private readonly profiles = new Map<string, CombatProfile>();
  private readonly results = new Map<string, StoredResult>();
  private readonly pending = new Map<string, PendingCombatImpact[]>();

  /** Returns the server-derived defender shape used by enemy attacks. */
  public targetForEnemy(
    characterId: string,
    atMs: number,
    instances: CombatHealthAccess,
  ): EnemyAbilityTarget | undefined {
    const player = instances.playerFor(characterId);
    if (player === undefined) return undefined;
    const profile = this.profiles.get(characterId) ?? guardianProfile;
    const tuning = profile.tuning;
    let state = this.states.get(characterId) ?? {
      ...createGuardianCombatState(tuning),
      health: player.health,
    };
    if (atMs < state.lastCombatAt)
      throw new CombatCommandError('INVALID_STATE', 'The combat clock cannot move backwards.');
    state = advanceGuardianCombat(tuning, state, state.lastCombatAt, atMs);
    this.states.set(characterId, state);
    const ironSkinActive =
      state.ironSkinStartsAt !== undefined &&
      state.ironSkinEndsAt !== undefined &&
      state.ironSkinStartsAt <= atMs &&
      state.ironSkinEndsAt > atMs;
    return {
      id: characterId,
      position: player.position,
      armor: state.armor,
      health: state.health,
      maxHealth: state.maxHealth,
      ...(ironSkinActive
        ? { incomingDamageMultiplier: tuning.abilities.ironSkin.damageTakenMultiplier ?? 1 }
        : {}),
    };
  }

  /** Applies already-mitigated enemy damage exactly once to the Guardian state and instance. */
  public applyResolvedEnemyDamage(
    characterId: string,
    damage: number,
    atMs: number,
    instances: CombatHealthAccess,
  ): EnemyDamageResolution | undefined {
    const player = instances.playerFor(characterId);
    if (player === undefined) return undefined;
    const profile = this.profiles.get(characterId) ?? guardianProfile;
    const tuning = profile.tuning;
    let state = this.states.get(characterId) ?? {
      ...createGuardianCombatState(tuning),
      health: player.health,
    };
    if (atMs < state.lastCombatAt)
      throw new CombatCommandError('INVALID_STATE', 'The combat clock cannot move backwards.');
    state = advanceGuardianCombat(tuning, state, state.lastCombatAt, atMs);
    state = applyResolvedDamageTaken(tuning, state, damage, atMs);
    this.states.set(characterId, state);
    syncPlayerHealth(instances, characterId, state.health);
    return {
      characterId,
      damage: Math.max(0, Math.round(damage)),
      health: state.health,
      downed: state.health === 0,
    };
  }

  /** Resolves due impacts using the server clock and returns result updates to replicate. */
  public advance(
    characterId: string,
    nowMs: number,
    instances: CombatAccess,
  ): readonly CombatResult[] {
    const queued = this.pending.get(characterId) ?? [];
    if (queued.length === 0) return [];
    const state = this.states.get(characterId);
    if (state === undefined) return [];
    const profile = this.profiles.get(characterId) ?? guardianProfile;
    const tuning = profile.tuning;
    if (!Number.isInteger(nowMs) || nowMs < state.lastCombatAt)
      throw new CombatCommandError('INVALID_STATE', 'The combat clock cannot move backwards.');
    let nextState = advanceGuardianCombat(tuning, state, state.lastCombatAt, nowMs);
    const due = queued
      .filter((impact) => impact.atMs <= nowMs)
      .sort((left, right) => left.atMs - right.atMs || left.tick - right.tick);
    if (due.length === 0) {
      this.states.set(characterId, nextState);
      return [];
    }
    const dueKeys = new Set(due.map((impact) => `${impact.operationId}:${impact.tick}`));
    const remaining = queued.filter(
      (impact) => !dueKeys.has(`${impact.operationId}:${impact.tick}`),
    );
    this.pending.set(characterId, remaining);
    const updates: CombatResult[] = [];
    for (const impact of due) {
      const stored = this.results.get(impact.operationId);
      if (stored === undefined) continue;
      const resolved = this.resolvePendingImpact(impact, nextState, instances);
      nextState = resolved.state;
      const current = instances.stateFor(characterId);
      if (current === undefined)
        throw new CombatCommandError('INVALID_STATE', 'The combat instance disappeared.');
      const operationPending = remaining.some(
        (candidate) => candidate.operationId === impact.operationId,
      );
      const { impactAtMs, ...storedWithoutImpact } = stored.result;
      void impactAtMs;
      const hits = [...stored.result.hits, ...resolved.hits];
      const firstHit = hits[0];
      const targetId = stored.result.targetId ?? firstHit?.targetId;
      const targetHealth = stored.result.targetHealth ?? firstHit?.targetHealth;
      const updated: CombatResult = {
        ...storedWithoutImpact,
        replayed: false,
        damage: stored.result.damage + resolved.hits.reduce((sum, hit) => sum + hit.damage, 0),
        critical: stored.result.critical || resolved.hits.some((hit) => hit.critical),
        defeated: stored.result.defeated || resolved.hits.some((hit) => hit.defeated),
        ...(targetId === undefined ? {} : { targetId }),
        ...(targetHealth === undefined ? {} : { targetHealth }),
        hits,
        pending: operationPending,
        ...(operationPending
          ? {
              impactAtMs: Math.min(
                ...remaining
                  .filter((candidate) => candidate.operationId === impact.operationId)
                  .map((candidate) => candidate.atMs),
              ),
            }
          : {}),
        revision: current.revision,
      };
      this.results.set(impact.operationId, { ...stored, result: updated });
      updates.push(updated);
    }
    this.states.set(characterId, nextState);
    return updates;
  }

  public apply(input: CombatCommandInput, instances: CombatAccess): CombatResult {
    const existing = this.results.get(input.operationId);
    if (existing !== undefined) {
      if (
        existing.userId !== input.userId ||
        existing.characterId !== input.characterId ||
        existing.classId !== input.classId ||
        existing.abilityId !== input.abilityId ||
        existing.targetId !== input.targetId
      )
        throw new CombatOperationConflictError();
      return { ...existing.result, replayed: true };
    }
    if (instances.ownerFor(input.characterId) !== input.userId)
      throw new CombatCommandError('INVALID_STATE', 'The character is not owned by this session.');
    const player = instances.playerFor(input.characterId);
    if (player === undefined || instances.stateFor(input.characterId) === undefined)
      throw new CombatCommandError('INVALID_STATE', 'The active combat actor is unavailable.');
    const profile = profileForClass(input.classId);
    this.profiles.set(input.characterId, profile);
    const ability = profile.abilityKeys[input.abilityId];
    if (ability === undefined)
      throw new CombatCommandError('INVALID_ABILITY', 'The requested ability is not available.');
    const tuning = profile.tuning;
    let state = this.states.get(input.characterId) ?? createGuardianCombatState(tuning);
    if (input.nowMs < state.lastCombatAt)
      throw new CombatCommandError('INVALID_STATE', 'The combat clock cannot move backwards.');
    state = advanceGuardianCombat(tuning, state, state.lastCombatAt, input.nowMs);
    if (player.health === 0 || player.actorState === 'downed') state = { ...state, health: 0 };
    const activation = tryActivateAbility(tuning, state, {
      executionId: input.operationId,
      ability,
      at: input.nowMs,
    });
    if (!activation.accepted) {
      const code =
        activation.reason === 'cooldown'
          ? 'COOLDOWN'
          : activation.reason === 'fury'
            ? 'FURY'
            : 'DOWNED';
      throw new CombatCommandError(code, `The ability was rejected: ${activation.reason}.`);
    }
    state = activation.state;
    const config = tuning.abilities[ability];
    const instance = instances.stateFor(input.characterId)!;
    if (ability === 'ironSkin' && input.targetId !== undefined)
      throw new CombatCommandError(
        'TARGET_NOT_ALLOWED',
        'Iron Skin is a self-targeted ability and does not accept an enemy.',
      );
    const facing = normalizeFacing(input.facing);
    const targets = selectTargets(
      ability,
      instance.enemies,
      input,
      player.position,
      facing,
      config,
    );
    const impactOffsets = impactOffsetsFor(ability, config);
    const immediateTargets = impactOffsets.includes(0) ? targets : [];
    const hits: CombatHit[] = [];
    let nextEnemies = instance.enemies;
    let damage = 0;
    let critical = false;
    let defeated = false;
    for (const enemy of immediateTargets) {
      const enemyTuning = GAME_DATA.enemyTuning.find(
        (candidate) => candidate.enemyId === enemy.archetype,
      );
      if (enemyTuning === undefined)
        throw new CombatCommandError('TARGET_NOT_FOUND', 'The target has no authoritative tuning.');
      const hit = resolvePhysicalDamage(
        tuning,
        enemyTuning.armor,
        config.damageMultiplier,
        createSeededRandom(seedFor(`${input.operationId}:${enemy.enemyId}`)),
      );
      const health = Math.max(0, enemy.health - hit.amount);
      const isDefeated = health === 0;
      const position =
        config.knockbackPx === undefined
          ? enemy.position
          : clampPosition(
              knockbackDestination(player.position, enemy.position, config.knockbackPx),
            );
      nextEnemies = nextEnemies.map((candidate) =>
        candidate.enemyId === enemy.enemyId
          ? {
              ...candidate,
              position,
              health,
              status: isDefeated ? ('dead' as const) : candidate.status,
              ...(isDefeated && candidate.deadAtMs === undefined ? { deadAtMs: input.nowMs } : {}),
            }
          : candidate,
      );
      hits.push({
        targetId: enemy.enemyId,
        damage: hit.amount,
        critical: hit.critical,
        targetHealth: health,
        defeated: isDefeated,
        position,
      });
      damage += hit.amount;
      critical ||= hit.critical;
      defeated ||= isDefeated;
    }
    if (hits.length > 0) {
      instances.replaceEnemies(input.characterId, nextEnemies);
      state = applySuccessfulHit(tuning, state, ability, input.nowMs);
      for (const hit of hits)
        if (hit.defeated) state = applyBattleThirst(tuning, state, hit.targetId, input.nowMs);
    }
    this.states.set(input.characterId, state);
    syncPlayerHealth(instances, input.characterId, state.health);
    const current = instances.stateFor(input.characterId);
    if (current === undefined)
      throw new CombatCommandError('INVALID_STATE', 'The combat instance disappeared.');
    const futureImpacts = impactOffsets
      .map((offset, tick) => ({ offset, tick }))
      .filter(({ offset }) => offset > 0)
      .map(({ offset, tick }) => ({
        operationId: input.operationId,
        characterId: input.characterId,
        ability,
        targetIds: targets.map((target) => target.enemyId),
        origin: player.position,
        atMs: input.nowMs + offset,
        tick,
      }));
    const result: CombatResult = {
      operationId: input.operationId,
      characterId: input.characterId,
      abilityId: input.abilityId,
      executionId: input.operationId,
      replayed: false,
      damage,
      critical,
      ...(hits[0] === undefined ? {} : { targetId: hits[0].targetId }),
      ...(hits[0] === undefined ? {} : { targetHealth: hits[0].targetHealth }),
      defeated,
      cooldownEndsAt: state.cooldownEndsAt[ability] ?? input.nowMs,
      revision: current.revision,
      hits,
      pending: futureImpacts.length > 0,
      ...(futureImpacts.length > 0
        ? {
            impactAtMs: Math.min(...futureImpacts.map((impact) => impact.atMs)),
          }
        : {}),
      ...(state.ironSkinStartsAt === undefined ? {} : { ironSkinStartsAt: state.ironSkinStartsAt }),
      ...(state.ironSkinEndsAt === undefined ? {} : { ironSkinEndsAt: state.ironSkinEndsAt }),
      ...(ability === 'whirlwind' && config.movementMultiplier !== undefined
        ? { movementMultiplier: config.movementMultiplier }
        : {}),
    };
    this.results.set(input.operationId, {
      userId: input.userId,
      characterId: input.characterId,
      classId: input.classId,
      abilityId: input.abilityId,
      targetId: input.targetId,
      result,
    });
    if (futureImpacts.length > 0)
      this.pending.set(input.characterId, [
        ...(this.pending.get(input.characterId) ?? []),
        ...futureImpacts,
      ]);
    return result;
  }

  private resolvePendingImpact(
    impact: PendingCombatImpact,
    state: GuardianCombatState,
    instances: CombatAccess,
  ): { state: GuardianCombatState; hits: readonly CombatHit[] } {
    const instance = instances.stateFor(impact.characterId);
    if (instance === undefined)
      throw new CombatCommandError('INVALID_STATE', 'The combat instance disappeared.');
    const profile = this.profiles.get(impact.characterId) ?? guardianProfile;
    const tuning = profile.tuning;
    const config = tuning.abilities[impact.ability];
    const hits: CombatHit[] = [];
    let nextEnemies = instance.enemies;
    for (const targetId of impact.targetIds) {
      const enemy = nextEnemies.find(
        (candidate) => candidate.enemyId === targetId && candidate.status === 'active',
      );
      if (enemy === undefined) continue;
      const enemyTuning = GAME_DATA.enemyTuning.find(
        (candidate) => candidate.enemyId === enemy.archetype,
      );
      if (enemyTuning === undefined) continue;
      const hit = resolvePhysicalDamage(
        tuning,
        enemyTuning.armor,
        config.damageMultiplier,
        createSeededRandom(seedFor(`${impact.operationId}:${enemy.enemyId}:${impact.tick}`)),
      );
      const health = Math.max(0, enemy.health - hit.amount);
      const defeated = health === 0;
      const position =
        config.knockbackPx === undefined
          ? enemy.position
          : clampPosition(knockbackDestination(impact.origin, enemy.position, config.knockbackPx));
      nextEnemies = nextEnemies.map((candidate) =>
        candidate.enemyId === enemy.enemyId
          ? {
              ...candidate,
              position,
              health,
              status: defeated ? ('dead' as const) : candidate.status,
              ...(defeated && candidate.deadAtMs === undefined ? { deadAtMs: impact.atMs } : {}),
            }
          : candidate,
      );
      hits.push({
        targetId: enemy.enemyId,
        damage: hit.amount,
        critical: hit.critical,
        targetHealth: health,
        defeated,
        position,
      });
    }
    if (hits.length === 0) return { state, hits };
    instances.replaceEnemies(impact.characterId, nextEnemies);
    let nextState = applySuccessfulHit(tuning, state, impact.ability, impact.atMs);
    for (const hit of hits)
      if (hit.defeated) nextState = applyBattleThirst(tuning, nextState, hit.targetId, impact.atMs);
    syncPlayerHealth(instances, impact.characterId, nextState.health);
    return { state: nextState, hits };
  }
}

function impactOffsetsFor(
  ability: GuardianAbilityKey,
  config: GuardianCombatTuning['abilities']['slash'],
): readonly number[] {
  if (ability === 'ironSkin') return [];
  return ability === 'whirlwind' ? (config.tickOffsetsMs ?? [0]) : [config.impactMs ?? 0];
}

function selectTargets(
  ability: GuardianAbilityKey,
  enemies: readonly InstanceEnemyState[],
  input: CombatCommandInput,
  origin: Readonly<{ x: number; y: number }>,
  facing: Readonly<{ x: number; y: number }>,
  config: GuardianCombatTuning['abilities']['slash'],
): readonly InstanceEnemyState[] {
  if (ability === 'ironSkin') return [];
  const active = enemies.filter((enemy) => enemy.status === 'active' && enemy.health > 0);
  const requested =
    input.targetId === undefined
      ? undefined
      : active.find((enemy) => enemy.enemyId === input.targetId);
  if (input.targetId !== undefined && requested === undefined)
    throw new CombatCommandError('TARGET_NOT_FOUND', 'The target is not an active enemy.');
  if (ability !== 'whirlwind' && requested === undefined)
    throw new CombatCommandError('TARGET_REQUIRED', 'This ability requires a target.');
  if (requested !== undefined && !isInAbilityArea(requested, ability, origin, facing, config))
    throw new CombatCommandError('OUT_OF_RANGE', 'The target is outside the ability range.');
  const candidates = active
    .filter((enemy) => isInAbilityArea(enemy, ability, origin, facing, config))
    .sort(
      (left, right) =>
        squaredDistance(origin, left.position) - squaredDistance(origin, right.position) ||
        left.enemyId.localeCompare(right.enemyId),
    )
    .slice(0, config.maxTargets ?? Number.POSITIVE_INFINITY);
  if (requested !== undefined && !candidates.some((enemy) => enemy.enemyId === requested.enemyId))
    throw new CombatCommandError('OUT_OF_RANGE', 'The target is outside the ability area.');
  return candidates;
}

function isInAbilityArea(
  target: InstanceEnemyState,
  ability: GuardianAbilityKey,
  origin: Readonly<{ x: number; y: number }>,
  facing: Readonly<{ x: number; y: number }>,
  config: GuardianCombatTuning['abilities']['slash'],
): boolean {
  if (ability === 'whirlwind')
    return config.radiusPx !== undefined && targetWithinRadius(origin, target, config.radiusPx);
  return (
    config.rangePx !== undefined &&
    config.arcDegrees !== undefined &&
    targetWithinArc(origin, facing, target, config.rangePx, config.arcDegrees)
  );
}

function normalizeFacing(facing: Readonly<{ x: number; y: number }> | undefined): {
  x: number;
  y: number;
} {
  const x = facing?.x ?? 1;
  const y = facing?.y ?? 0;
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length <= 0)
    throw new CombatCommandError('INVALID_STATE', 'The combat facing vector is invalid.');
  return { x: x / length, y: y / length };
}

function squaredDistance(
  from: Readonly<{ x: number; y: number }>,
  to: Readonly<{ x: number; y: number }>,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx * dx + dy * dy;
}

function knockbackDestination(
  origin: Readonly<{ x: number; y: number }>,
  target: Readonly<{ x: number; y: number }>,
  distance: number,
): { x: number; y: number } {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: target.x + (dx / length) * distance, y: target.y + (dy / length) * distance };
}

function clampPosition(position: Readonly<{ x: number; y: number }>): { x: number; y: number } {
  const { worldWidth, worldHeight, worldMargin } = DEFAULT_INSTANCE_MOVEMENT_CONFIG;
  return {
    x: Math.min(worldWidth - worldMargin, Math.max(worldMargin, position.x)),
    y: Math.min(worldHeight - worldMargin, Math.max(worldMargin, position.y)),
  };
}

function syncPlayerHealth(
  instances: CombatHealthAccess,
  characterId: string,
  health: number,
): void {
  const player = instances.playerFor(characterId);
  if (player === undefined || player.health === health) return;
  instances.updatePlayer(characterId, {
    health: Math.min(player.maxHealth, Math.max(0, Math.round(health))),
    ...(health === 0 ? { actorState: 'downed' as const } : {}),
  });
}

function seedFor(operationId: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < operationId.length; index += 1) {
    hash ^= operationId.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
