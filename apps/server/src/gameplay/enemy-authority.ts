import {
  GAME_DATA,
  resolveEnemyAbilityProfile,
  resolveEnemyMovementStyle,
} from '@brecha/game-data';
import {
  createSeededRandom,
  enemyDifficultyMultipliers,
  hasProjectileExpired,
  isReadyForCleanup,
  projectileHitsTarget,
  resolveAttack,
  resolveEnemyAction,
  resolveEnemyTelegraph,
  stepEnemy,
  telegraphResolvedThisTick,
  type AttackerStats,
  type EnemyAbilityEffect,
  type EnemyAbilityTarget,
  type EnemyAbilityProfile,
  type EnemyAiState,
  type EnemySpawnedProjectile,
  type EnemySpawnedTelegraph,
  type InstanceEnemyState,
} from '@brecha/shared';

import type { CombatAuthority } from './combat-authority.js';
import type { ActiveInstanceRegistry } from './instance-registry.js';

const WORLD_MARGIN_PX = 24;

export type EnemyLifecycleConfig = Readonly<{
  cleanupDelayMs: number;
  respawnDelayMs: number;
  safeSpawnRadiusPx: number;
  spawnPoints: readonly Readonly<{ x: number; y: number }>[];
}>;

export const DEFAULT_ENEMY_LIFECYCLE_CONFIG: EnemyLifecycleConfig = Object.freeze({
  cleanupDelayMs: 500,
  respawnDelayMs: 1_500,
  safeSpawnRadiusPx: 140,
  spawnPoints: Object.freeze([
    { x: 360, y: 180 },
    { x: 400, y: 260 },
    { x: 300, y: 330 },
    { x: 420, y: 430 },
    { x: 560, y: 160 },
    { x: 900, y: 180 },
    { x: 1_020, y: 350 },
    { x: 980, y: 560 },
  ]),
});

type EnemyRuntimeState = {
  aiState: EnemyAiState;
  spawnPosition: Readonly<{ x: number; y: number }>;
  nextActionAtMs: number;
  stunnedUntilMs: number;
};

type PendingProjectile = Readonly<{
  enemyId: string;
  targetId: string;
  projectile: EnemySpawnedProjectile;
  attacker: AttackerStats;
}>;

type PendingTelegraph = Readonly<{
  enemyId: string;
  telegraph: EnemySpawnedTelegraph;
  attacker: AttackerStats;
}>;

type PendingEnemyAction = Readonly<{
  enemyId: string;
  targetId?: string;
  profile: EnemyAbilityProfile;
  attacker: AttackerStats;
  abilityMultiplier: number;
  telegraphMs: number;
  actionId: string;
  resolveAtMs: number;
}>;

type PendingRespawn = Readonly<{
  enemyId: string;
  archetype: string;
  respawnAtMs: number;
}>;

type EnemyAccess = Pick<
  ActiveInstanceRegistry,
  'stateFor' | 'replaceEnemies' | 'playerFor' | 'updatePlayer'
>;
type EnemyCombat = Pick<CombatAuthority, 'targetForEnemy' | 'applyResolvedEnemyDamage'>;

export type EnemyAuthorityEvent = Readonly<{
  eventId: string;
  characterId: string;
  enemyId: string;
  type: 'damage' | 'heal' | 'projectile' | 'telegraph' | 'stun' | 'cleanup' | 'spawn';
  targetId?: string;
  amount?: number;
  atMs: number;
  resolvesAtMs?: number;
}>;

/**
 * Server-owned enemy simulation adapter. The pure FSM, steering and ability profiles stay in
 * `@brecha/shared`; this class only wires them to the active-instance registry and the Guardian's
 * combat authority. It never reads client positions or uses renderer timing as authority.
 */
export class EnemyAuthority {
  private readonly runtime = new Map<string, Map<string, EnemyRuntimeState>>();
  private readonly projectiles = new Map<string, PendingProjectile[]>();
  private readonly telegraphs = new Map<string, PendingTelegraph[]>();
  private readonly actions = new Map<string, PendingEnemyAction[]>();
  private readonly respawns = new Map<string, PendingRespawn[]>();
  private readonly respawnSequence = new Map<string, number>();
  private readonly lastNow = new Map<string, number>();

  public constructor(
    private readonly lifecycle: EnemyLifecycleConfig = DEFAULT_ENEMY_LIFECYCLE_CONFIG,
  ) {}

  public advance(
    characterId: string,
    nowMs: number,
    instances: EnemyAccess,
    combat: EnemyCombat,
  ): readonly EnemyAuthorityEvent[] {
    const instance = instances.stateFor(characterId);
    if (instance === undefined) return [];
    const previousMs = this.lastNow.get(characterId) ?? instance.nowMs;
    if (nowMs < previousMs) throw new Error('The enemy clock cannot move backwards.');
    this.lastNow.set(characterId, nowMs);

    const events: EnemyAuthorityEvent[] = [];
    const states = new Map(this.runtime.get(characterId) ?? []);
    const currentEnemies = [...instance.enemies];
    let enemiesChanged = this.advanceRespawns(
      characterId,
      instance.instanceId,
      nowMs,
      currentEnemies,
      instance.players,
      instance.difficulty,
      events,
    );
    this.resolvePendingActions(characterId, nowMs, currentEnemies, instances, combat, events);
    this.resolveProjectiles(characterId, previousMs, nowMs, instances, combat, events);
    this.resolveTelegraphs(characterId, previousMs, nowMs, instances, combat, events);

    const players = instance.players.filter(
      (player) => player.actorState === 'active' && player.health > 0,
    );

    for (const enemy of [...currentEnemies]) {
      const definition = GAME_DATA.enemies.find(({ id }) => id === enemy.archetype);
      const tuning = GAME_DATA.enemyTuning.find(({ enemyId }) => enemyId === enemy.archetype);
      if (definition === undefined || tuning === undefined) continue;
      const state = states.get(enemy.enemyId) ?? {
        aiState: enemy.aiState ?? (enemy.status === 'dead' ? 'dead' : 'idle'),
        spawnPosition: enemy.position,
        nextActionAtMs: nowMs + tuning.attack.windupMs,
        stunnedUntilMs: 0,
      };
      const deadAtMs = enemy.deadAtMs ?? nowMs;
      if (
        enemy.status === 'dead' &&
        isReadyForCleanup(deadAtMs, nowMs, this.lifecycle.cleanupDelayMs)
      ) {
        const index = currentEnemies.findIndex((candidate) => candidate.enemyId === enemy.enemyId);
        if (index >= 0) currentEnemies.splice(index, 1);
        const nextSequence = (this.respawnSequence.get(characterId) ?? 0) + 1;
        this.respawnSequence.set(characterId, nextSequence);
        const queued = this.respawns.get(characterId) ?? [];
        this.respawns.set(characterId, [
          ...queued,
          {
            enemyId: `${instance.instanceId}:respawn:${nextSequence}`,
            archetype: enemy.archetype,
            respawnAtMs: nowMs + this.lifecycle.respawnDelayMs,
          },
        ]);
        states.delete(enemy.enemyId);
        this.actions.set(
          characterId,
          (this.actions.get(characterId) ?? []).filter(
            (action) => action.enemyId !== enemy.enemyId,
          ),
        );
        this.projectiles.set(
          characterId,
          (this.projectiles.get(characterId) ?? []).filter(
            (projectile) => projectile.enemyId !== enemy.enemyId,
          ),
        );
        this.telegraphs.set(
          characterId,
          (this.telegraphs.get(characterId) ?? []).filter(
            (telegraph) => telegraph.enemyId !== enemy.enemyId,
          ),
        );
        events.push({
          eventId: `${characterId}:${enemy.enemyId}:cleanup`,
          characterId,
          enemyId: enemy.enemyId,
          type: 'cleanup',
          atMs: nowMs,
        });
        enemiesChanged = true;
        continue;
      }
      const target = nearestPlayer(enemy, players);
      const targetPosition = target?.position ?? state.spawnPosition;
      const profile = resolveEnemyAbilityProfile(
        definition.behaviors,
        GAME_DATA.enemyAbilityTuning,
      );
      const abilityReady = nowMs >= state.nextActionAtMs;
      const stepped = stepEnemy(
        {
          aiState: state.aiState,
          position: enemy.position,
          spawnPosition: state.spawnPosition,
        },
        {
          targetPosition,
          hasLineOfSight: target !== undefined,
          neighbors: currentEnemies
            .filter(
              (candidate) => candidate.enemyId !== enemy.enemyId && candidate.status === 'active',
            )
            .map(({ position }) => ({ position })),
          isDead: enemy.status === 'dead' || enemy.health === 0,
          isStunned: state.stunnedUntilMs > nowMs,
          abilityReady,
          restState: 'idle',
          movementStyle: resolveEnemyMovementStyle(definition.behaviors),
          fromMs: previousMs,
          toMs: nowMs,
        },
        {
          ai: {
            detectRadiusPx: tuning.detectRadiusPx,
            loseTargetRadiusPx: tuning.loseTargetRadiusPx,
            leashRadiusPx: tuning.leashRadiusPx,
            attackRangePx: tuning.attack.rangePx,
          },
          moveSpeedPxPerSec: tuning.moveSpeedPxPerSec,
          separationRadiusPx: tuning.separationRadiusPx,
        },
      );
      const nextPosition = clampPosition(stepped.position);
      const nextEnemy: InstanceEnemyState = {
        ...enemy,
        position: nextPosition,
        aiState: stepped.aiState,
      };
      const enemyIndex = currentEnemies.findIndex(
        (candidate) => candidate.enemyId === enemy.enemyId,
      );
      if (enemyIndex >= 0) currentEnemies[enemyIndex] = nextEnemy;
      enemiesChanged ||= enemy.position.x !== nextPosition.x || enemy.position.y !== nextPosition.y;
      enemiesChanged ||= enemy.aiState !== stepped.aiState;
      states.set(enemy.enemyId, { ...state, aiState: stepped.aiState });

      if (target === undefined || enemy.status === 'dead' || enemy.health === 0) continue;
      if (!['attack', 'use_ability'].includes(stepped.aiState) || !abilityReady) continue;

      const attacker = attackerFor(
        tuning.attack,
        enemyDifficultyMultipliers({
          players: instance.players.length,
          difficulty: instance.difficulty,
          config: GAME_DATA.balance,
        }).damage,
      );
      const actionTargets =
        profile.kind === 'heal_allies'
          ? currentEnemies
              .filter(
                (candidate) => candidate.status === 'active' && candidate.enemyId !== enemy.enemyId,
              )
              .map((candidate) => enemyTarget(candidate))
          : profile.kind === 'melee_strike' || profile.kind === 'ranged_shot'
            ? [combat.targetForEnemy(target.characterId, nowMs, instances)].filter(
                (candidate): candidate is EnemyAbilityTarget => candidate !== undefined,
              )
            : [];
      const actionId = `${characterId}:${enemy.enemyId}:${nowMs}`;
      if (
        profile.kind === 'melee_strike' ||
        profile.kind === 'ranged_shot' ||
        profile.kind === 'heal_allies'
      ) {
        const queued = this.actions.get(characterId) ?? [];
        this.actions.set(characterId, [
          ...queued,
          {
            enemyId: enemy.enemyId,
            ...(profile.kind === 'melee_strike' || profile.kind === 'ranged_shot'
              ? { targetId: target.characterId }
              : {}),
            profile,
            attacker,
            abilityMultiplier: tuning.attack.damageMultiplier,
            telegraphMs: tuning.telegraphMs,
            actionId,
            resolveAtMs: nowMs + tuning.attack.impactMs,
          },
        ]);
        continue;
      }
      const effects = resolveEnemyAction(profile, actionTargets, {
        position: enemy.position,
        attacker,
        abilityMultiplier: tuning.attack.damageMultiplier,
        telegraphMs: tuning.telegraphMs,
        atMs: nowMs,
        random: createSeededRandom(seedFor(actionId)),
        nextId: () => `${actionId}:effect`,
      });
      states.set(enemy.enemyId, { ...state, nextActionAtMs: nowMs + tuning.attack.cooldownMs });
      this.applyEffects(
        characterId,
        enemy,
        effects,
        attacker,
        nowMs,
        instances,
        combat,
        events,
        currentEnemies,
      );
    }

    this.runtime.set(characterId, states);
    if (enemiesChanged || events.some((event) => event.type === 'heal'))
      instances.replaceEnemies(characterId, currentEnemies);
    return events;
  }

  public clearCharacter(characterId: string): void {
    this.runtime.delete(characterId);
    this.projectiles.delete(characterId);
    this.telegraphs.delete(characterId);
    this.actions.delete(characterId);
    this.respawns.delete(characterId);
    this.respawnSequence.delete(characterId);
    this.lastNow.delete(characterId);
  }

  private advanceRespawns(
    characterId: string,
    instanceId: string,
    nowMs: number,
    currentEnemies: InstanceEnemyState[],
    players: readonly Readonly<{
      characterId: string;
      position: Readonly<{ x: number; y: number }>;
    }>[],
    difficulty: 'normal' | 'veteran',
    events: EnemyAuthorityEvent[],
  ): boolean {
    const queued = this.respawns.get(characterId) ?? [];
    const remaining: PendingRespawn[] = [];
    let changed = false;
    for (const respawn of queued) {
      if (respawn.respawnAtMs > nowMs) {
        remaining.push(respawn);
        continue;
      }
      const position = this.chooseSafeSpawn(respawn.enemyId, currentEnemies, players);
      if (position === undefined) {
        remaining.push(respawn);
        continue;
      }
      const tuning = GAME_DATA.enemyTuning.find(({ enemyId }) => enemyId === respawn.archetype);
      if (tuning === undefined) continue;
      const maxHealth = Math.max(
        1,
        Math.round(
          tuning.maxHealth *
            enemyDifficultyMultipliers({
              players: players.length,
              difficulty,
              config: GAME_DATA.balance,
            }).health,
        ),
      );
      currentEnemies.push({
        enemyId: respawn.enemyId,
        archetype: respawn.archetype,
        position,
        status: 'active',
        health: maxHealth,
        maxHealth,
        aiState: 'idle',
      });
      events.push({
        eventId: `${instanceId}:${respawn.enemyId}:spawn`,
        characterId,
        enemyId: respawn.enemyId,
        type: 'spawn',
        atMs: nowMs,
      });
      changed = true;
    }
    this.respawns.set(characterId, remaining);
    return changed;
  }

  private chooseSafeSpawn(
    seedValue: string,
    currentEnemies: readonly InstanceEnemyState[],
    players: readonly Readonly<{ position: Readonly<{ x: number; y: number }> }>[],
  ): Readonly<{ x: number; y: number }> | undefined {
    if (this.lifecycle.spawnPoints.length === 0) return undefined;
    const start = seedFor(seedValue) % this.lifecycle.spawnPoints.length;
    const occupied = [
      ...players.map(({ position }) => position),
      ...currentEnemies
        .filter((enemy) => enemy.status === 'active')
        .map(({ position }) => position),
    ];
    for (let offset = 0; offset < this.lifecycle.spawnPoints.length; offset += 1) {
      const candidate =
        this.lifecycle.spawnPoints[(start + offset) % this.lifecycle.spawnPoints.length]!;
      if (
        occupied.every(
          (position) =>
            squaredDistance(candidate, position) >= this.lifecycle.safeSpawnRadiusPx ** 2,
        )
      )
        return candidate;
    }
    return undefined;
  }

  private resolvePendingActions(
    characterId: string,
    nowMs: number,
    currentEnemies: InstanceEnemyState[],
    instances: EnemyAccess,
    combat: EnemyCombat,
    events: EnemyAuthorityEvent[],
  ): void {
    const queued = this.actions.get(characterId) ?? [];
    const remaining: PendingEnemyAction[] = [];
    for (const action of queued) {
      if (action.resolveAtMs > nowMs) {
        remaining.push(action);
        continue;
      }
      const enemy = currentEnemies.find(
        (candidate) => candidate.enemyId === action.enemyId && candidate.status === 'active',
      );
      if (enemy === undefined) continue;
      const targets =
        action.profile.kind === 'heal_allies'
          ? currentEnemies
              .filter(
                (candidate) => candidate.status === 'active' && candidate.enemyId !== enemy.enemyId,
              )
              .map((candidate) => enemyTarget(candidate))
          : action.targetId === undefined
            ? []
            : [combat.targetForEnemy(action.targetId, nowMs, instances)].filter(
                (candidate): candidate is EnemyAbilityTarget => candidate !== undefined,
              );
      const effects = resolveEnemyAction(action.profile, targets, {
        position: enemy.position,
        attacker: action.attacker,
        abilityMultiplier: action.abilityMultiplier,
        telegraphMs: action.telegraphMs,
        atMs: action.resolveAtMs,
        random: createSeededRandom(seedFor(action.actionId)),
        nextId: () => `${action.actionId}:effect`,
      });
      this.applyEffects(
        characterId,
        enemy,
        effects,
        action.attacker,
        nowMs,
        instances,
        combat,
        events,
        currentEnemies,
      );
    }
    this.actions.set(characterId, remaining);
  }

  private applyEffects(
    characterId: string,
    enemy: InstanceEnemyState,
    effects: readonly EnemyAbilityEffect[],
    attacker: AttackerStats,
    nowMs: number,
    instances: EnemyAccess,
    combat: EnemyCombat,
    events: EnemyAuthorityEvent[],
    currentEnemies: InstanceEnemyState[],
  ): void {
    for (const effect of effects) {
      const eventId = `${characterId}:${enemy.enemyId}:${nowMs}:${effect.type}`;
      if (effect.type === 'damage') {
        const target = combat.targetForEnemy(effect.targetId, nowMs, instances);
        if (target === undefined) continue;
        const result = combat.applyResolvedEnemyDamage(
          effect.targetId,
          effect.result.amount,
          nowMs,
          instances,
        );
        if (result === undefined) continue;
        events.push({
          eventId,
          characterId,
          enemyId: enemy.enemyId,
          type: 'damage',
          targetId: effect.targetId,
          amount: result.damage,
          atMs: nowMs,
        });
        continue;
      }
      if (effect.type === 'heal') {
        const healed = currentEnemies.map((candidate) =>
          candidate.enemyId === effect.targetId
            ? {
                ...candidate,
                health: Math.min(candidate.maxHealth, candidate.health + effect.amount),
              }
            : candidate,
        );
        currentEnemies.splice(0, currentEnemies.length, ...healed);
        events.push({
          eventId,
          characterId,
          enemyId: enemy.enemyId,
          type: 'heal',
          targetId: effect.targetId,
          amount: effect.amount,
          atMs: nowMs,
        });
        continue;
      }
      if (effect.type === 'spawn_projectile') {
        const target = nearestPlayer(enemy, instances.stateFor(characterId)?.players ?? []);
        if (target !== undefined) {
          const queued = this.projectiles.get(characterId) ?? [];
          this.projectiles.set(characterId, [
            ...queued,
            {
              enemyId: enemy.enemyId,
              targetId: target.characterId,
              projectile: effect.projectile,
              attacker,
            },
          ]);
        }
        events.push({
          eventId,
          characterId,
          enemyId: enemy.enemyId,
          type: 'projectile',
          atMs: nowMs,
        });
        continue;
      }
      if (effect.type === 'open_telegraph') {
        const queued = this.telegraphs.get(characterId) ?? [];
        this.telegraphs.set(characterId, [
          ...queued,
          { enemyId: enemy.enemyId, telegraph: effect.telegraph, attacker },
        ]);
        events.push({
          eventId,
          characterId,
          enemyId: enemy.enemyId,
          type: 'telegraph',
          atMs: nowMs,
          resolvesAtMs: effect.telegraph.startedAt + effect.telegraph.telegraphMs,
        });
        continue;
      }
      if (effect.type === 'stun')
        events.push({
          eventId,
          characterId,
          enemyId: enemy.enemyId,
          type: 'stun',
          targetId: effect.targetId,
          atMs: nowMs,
        });
    }
  }

  private resolveProjectiles(
    characterId: string,
    _fromMs: number,
    nowMs: number,
    instances: EnemyAccess,
    combat: EnemyCombat,
    events: EnemyAuthorityEvent[],
  ): void {
    const queued = this.projectiles.get(characterId) ?? [];
    const remaining: PendingProjectile[] = [];
    for (const pending of queued) {
      const target = combat.targetForEnemy(pending.targetId, nowMs, instances);
      if (target === undefined || target.health === 0) {
        if (target === undefined || target.health === 0) continue;
        remaining.push(pending);
        continue;
      }
      if (projectileHitsTarget(pending.projectile, nowMs, target, pending.projectile.hitRadiusPx)) {
        const result = resolveAttack(
          pending.attacker,
          defenderFor(target),
          pending.projectile.abilityMultiplier,
          createSeededRandom(seedFor(pending.projectile.id)),
        );
        const damage = combat.applyResolvedEnemyDamage(
          pending.targetId,
          result.amount,
          nowMs,
          instances,
        );
        if (damage !== undefined)
          events.push({
            eventId: pending.projectile.id,
            characterId,
            enemyId: pending.enemyId,
            type: 'damage',
            targetId: pending.targetId,
            amount: damage.damage,
            atMs: nowMs,
          });
        continue;
      }
      if (!hasProjectileExpired(pending.projectile, nowMs)) remaining.push(pending);
    }
    this.projectiles.set(characterId, remaining);
  }

  private resolveTelegraphs(
    characterId: string,
    fromMs: number,
    nowMs: number,
    instances: EnemyAccess,
    combat: EnemyCombat,
    events: EnemyAuthorityEvent[],
  ): void {
    const queued = this.telegraphs.get(characterId) ?? [];
    const remaining: PendingTelegraph[] = [];
    const players = instances.stateFor(characterId)?.players ?? [];
    for (const pending of queued) {
      if (!telegraphResolvedThisTick(pending.telegraph, fromMs, nowMs)) {
        remaining.push(pending);
        continue;
      }
      const targets = players
        .map((player) => combat.targetForEnemy(player.characterId, nowMs, instances))
        .filter(
          (target): target is EnemyAbilityTarget => target !== undefined && target.health > 0,
        );
      const effects = resolveEnemyTelegraph(
        pending.telegraph,
        targets,
        pending.attacker,
        createSeededRandom(seedFor(pending.telegraph.id)),
      );
      for (const effect of effects) {
        if (effect.type === 'damage') {
          const damage = combat.applyResolvedEnemyDamage(
            effect.targetId,
            effect.result.amount,
            nowMs,
            instances,
          );
          if (damage !== undefined)
            events.push({
              eventId: `${pending.telegraph.id}:${effect.targetId}`,
              characterId,
              enemyId: pending.enemyId,
              type: 'damage',
              targetId: effect.targetId,
              amount: damage.damage,
              atMs: nowMs,
            });
        } else if (effect.type === 'stun')
          events.push({
            eventId: `${pending.telegraph.id}:${effect.targetId}:stun`,
            characterId,
            enemyId: pending.enemyId,
            type: 'stun',
            targetId: effect.targetId,
            atMs: nowMs,
          });
      }
    }
    this.telegraphs.set(characterId, remaining);
  }
}

function nearestPlayer(
  enemy: Pick<InstanceEnemyState, 'position'>,
  players: readonly Readonly<{
    characterId: string;
    position: Readonly<{ x: number; y: number }>;
  }>[],
): Readonly<{ characterId: string; position: Readonly<{ x: number; y: number }> }> | undefined {
  return [...players].sort(
    (left, right) =>
      squaredDistance(enemy.position, left.position) -
        squaredDistance(enemy.position, right.position) ||
      left.characterId.localeCompare(right.characterId),
  )[0];
}

function enemyTarget(enemy: InstanceEnemyState): EnemyAbilityTarget {
  const tuning = GAME_DATA.enemyTuning.find(({ enemyId }) => enemyId === enemy.archetype);
  return {
    id: enemy.enemyId,
    position: enemy.position,
    armor: tuning?.armor ?? 0,
    health: enemy.health,
    maxHealth: enemy.maxHealth,
  };
}

function attackerFor(
  attack: (typeof GAME_DATA.enemyTuning)[number]['attack'],
  damageMultiplier = 1,
): AttackerStats {
  return {
    weaponDamage: [
      Math.max(1, Math.round(attack.weaponDamage[0] * damageMultiplier)),
      Math.max(1, Math.round(attack.weaponDamage[1] * damageMultiplier)),
    ],
    power: Math.max(0, Math.round(attack.power * damageMultiplier)),
    level: attack.level,
    criticalChance: attack.criticalChance,
    criticalMultiplier: attack.criticalMultiplier,
  };
}

function defenderFor(target: EnemyAbilityTarget): Readonly<{
  armor: number;
  armorDenominatorBase: number;
  armorDenominatorPerLevel: number;
  armorReductionCap: number;
  incomingDamageMultiplier?: number;
}> {
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

function clampPosition(position: Readonly<{ x: number; y: number }>): { x: number; y: number } {
  return {
    x: Math.min(1280 - WORLD_MARGIN_PX, Math.max(WORLD_MARGIN_PX, position.x)),
    y: Math.min(720 - WORLD_MARGIN_PX, Math.max(WORLD_MARGIN_PX, position.y)),
  };
}

function squaredDistance(
  from: Readonly<{ x: number; y: number }>,
  to: Readonly<{ x: number; y: number }>,
): number {
  return (to.x - from.x) ** 2 + (to.y - from.y) ** 2;
}

function seedFor(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
