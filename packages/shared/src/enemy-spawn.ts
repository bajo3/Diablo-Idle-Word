import type { CombatVector, RandomSource } from './combat.js';

/** A candidate position supplied by the encounter/zone configuration. */
export type EnemySpawnPoint = Readonly<CombatVector>;

export type EnemySpawnDirectorConfig<TArchetype extends string> = Readonly<{
  /** The director tries to keep this many live instances when no slot is waiting to respawn. */
  minActive: number;
  /** Hard upper bound for live instances. A spawn can never exceed this value. */
  maxActive: number;
  /** Time between the end of death cleanup and the replacement spawn. */
  respawnDelayMs: number;
  /** Time reserved for the death presentation before the entity is removed. */
  cleanupDelayMs: number;
  /** Used by the safety callback and recorded as encounter configuration. */
  safeSpawnRadiusPx: number;
  /** Candidate points are tried in a deterministic RNG-derived order. */
  spawnPoints: readonly EnemySpawnPoint[];
  /** Data-driven composition. The director cycles through it; no archetype ids are special-cased. */
  composition: readonly TArchetype[];
  /** Stable prefix for monotonic instance ids. */
  idPrefix?: string;
}>;

export type EnemySpawnSafetyCheck = (
  candidate: EnemySpawnPoint,
  activePositions: readonly EnemySpawnPoint[],
) => boolean;

/**
 * Mutable encounter knobs applied between waves. The director keeps its records and monotonic
 * id sequence; only the target capacity and archetype bag change.
 */
export type EnemySpawnWave<TArchetype extends string> = Readonly<{
  minActive: number;
  maxActive: number;
  composition: readonly TArchetype[];
}>;

export type EnemySpawnAction<TArchetype extends string> =
  | Readonly<{
      type: 'spawn';
      instanceId: string;
      archetype: TArchetype;
      position: EnemySpawnPoint;
    }>
  | Readonly<{
      type: 'cleanup';
      instanceId: string;
      archetype: TArchetype;
      position: EnemySpawnPoint;
      defeatedAt: number;
    }>;

export type EnemySpawnRecord<TArchetype extends string> = Readonly<{
  instanceId: string;
  archetype: TArchetype;
  position: EnemySpawnPoint;
  status: 'active' | 'defeated' | 'waiting';
  defeatedAt?: number;
  cleanupAt?: number;
  respawnAt?: number;
}>;

type MutableEnemySpawnRecord<TArchetype extends string> = {
  instanceId: string;
  archetype: TArchetype;
  position: EnemySpawnPoint;
  status: 'active' | 'defeated' | 'waiting';
  defeatedAt?: number;
  cleanupAt?: number;
  respawnAt?: number;
};

/**
 * Deterministic encounter lifecycle for local and future server adapters.
 *
 * The director owns only slot state and timing. It never creates sprites, reads a clock, checks
 * Phaser geometry or grants loot. The adapter supplies `atMs`, a seeded RNG and a spawn-safety
 * predicate, then applies the returned commands. This keeps death/cleanup/respawn replayable and
 * prevents a visual callback from becoming the authority for a new enemy.
 */
export class EnemySpawnDirector<TArchetype extends string> {
  private readonly records = new Map<string, MutableEnemySpawnRecord<TArchetype>>();
  private readonly idPrefix: string;
  private minActive: number;
  private maxActive: number;
  private composition: readonly TArchetype[];
  private nextSequence = 1;
  private compositionIndex = 0;

  public constructor(
    private readonly config: EnemySpawnDirectorConfig<TArchetype>,
    private readonly random: RandomSource,
  ) {
    validateConfig(config);
    this.idPrefix = config.idPrefix ?? 'enemy';
    this.minActive = config.minActive;
    this.maxActive = config.maxActive;
    this.composition = config.composition.slice();
  }

  public activeCount(): number {
    return [...this.records.values()].filter((record) => record.status === 'active').length;
  }

  public trackedCount(): number {
    return this.records.size;
  }

  public recordsSnapshot(): readonly EnemySpawnRecord<TArchetype>[] {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  /**
   * Applies the next wave without replacing this director. Existing records keep their lifecycle;
   * pending cleanup/respawn windows are honored, while newly available capacity uses the new
   * deterministic composition. The id sequence is intentionally never reset.
   */
  public configureWave(wave: EnemySpawnWave<TArchetype>): void {
    validateWave(wave);
    if (wave.maxActive < this.activeCount())
      throw new Error('EnemySpawnDirector: wave maxActive cannot be below current active count');
    this.minActive = wave.minActive;
    this.maxActive = wave.maxActive;
    this.composition = wave.composition.slice();
    this.compositionIndex = 0;
  }

  /** Keeps adapter movement reflected in the safety snapshot without exposing mutable records. */
  public updatePosition(instanceId: string, position: EnemySpawnPoint): boolean {
    const record = this.records.get(instanceId);
    if (record === undefined || record.status !== 'active') return false;
    record.position = { ...position };
    return true;
  }

  /** Fills the initial encounter up to `minActive`. Repeated calls are idempotent. */
  public initialize(
    atMs: number,
    isSafe: EnemySpawnSafetyCheck,
  ): readonly EnemySpawnAction<TArchetype>[] {
    return this.tick(atMs, isSafe);
  }

  /**
   * Marks a live instance defeated exactly once. The cleanup and respawn windows are calculated
   * from the explicit defeat timestamp, never from wall-clock time or a render callback.
   */
  public markDefeated(instanceId: string, atMs: number): boolean {
    const record = this.records.get(instanceId);
    if (record === undefined || record.status !== 'active') return false;
    record.status = 'defeated';
    record.defeatedAt = atMs;
    record.cleanupAt = atMs + this.config.cleanupDelayMs;
    record.respawnAt = record.cleanupAt + this.config.respawnDelayMs;
    return true;
  }

  /**
   * Emits cleanup commands when the death window ends, then replacement spawns when their delay
   * has elapsed. A blocked safety predicate leaves a waiting slot untouched for the next tick.
   */
  public tick(
    atMs: number,
    isSafe: EnemySpawnSafetyCheck,
  ): readonly EnemySpawnAction<TArchetype>[] {
    const actions: EnemySpawnAction<TArchetype>[] = [];
    const records = [...this.records.values()];

    for (const record of records) {
      if (record.status !== 'defeated' || record.cleanupAt === undefined) continue;
      if (atMs < record.cleanupAt) continue;
      record.status = 'waiting';
      actions.push({
        type: 'cleanup',
        instanceId: record.instanceId,
        archetype: record.archetype,
        position: record.position,
        defeatedAt: record.defeatedAt!,
      });
    }

    const waiting = records
      .filter(
        (record): record is MutableEnemySpawnRecord<TArchetype> =>
          record.status === 'waiting' && record.respawnAt !== undefined && atMs >= record.respawnAt,
      )
      .sort(
        (left, right) =>
          left.respawnAt! - right.respawnAt! || compareIds(left.instanceId, right.instanceId),
      );

    for (const record of waiting) {
      if (this.activeCount() >= this.maxActive) break;
      const position = this.chooseSafePoint(isSafe);
      if (position === undefined) continue;
      this.records.delete(record.instanceId);
      actions.push(this.spawnRecord(record.archetype, position));
    }

    // Initial fill (or recovery if a slot was intentionally absent) never creates extra slots
    // while an existing death is waiting for its configured cleanup/respawn window.
    while (
      this.activeCount() < this.minActive &&
      this.records.size < this.maxActive &&
      ![...this.records.values()].some((record) => record.status !== 'active')
    ) {
      const position = this.chooseSafePoint(isSafe);
      if (position === undefined) break;
      actions.push(this.spawnRecord(this.nextArchetype(), position));
    }

    return actions;
  }

  private spawnRecord(
    archetype: TArchetype,
    position: EnemySpawnPoint,
  ): Extract<EnemySpawnAction<TArchetype>, { type: 'spawn' }> {
    const instanceId = `${this.idPrefix}:${this.nextSequence++}`;
    this.records.set(instanceId, {
      instanceId,
      archetype,
      position: { ...position },
      status: 'active',
    });
    return { type: 'spawn', instanceId, archetype, position: { ...position } };
  }

  private nextArchetype(): TArchetype {
    const archetype = this.composition[this.compositionIndex % this.composition.length]!;
    this.compositionIndex += 1;
    return archetype;
  }

  private chooseSafePoint(isSafe: EnemySpawnSafetyCheck): EnemySpawnPoint | undefined {
    const points = this.config.spawnPoints;
    if (points.length === 0) return undefined;
    const start = this.random.nextInt(0, points.length - 1);
    const activePositions = [...this.records.values()]
      .filter((record) => record.status === 'active')
      .map((record) => record.position);
    for (let offset = 0; offset < points.length; offset += 1) {
      const candidate = points[(start + offset) % points.length]!;
      if (isSafe(candidate, activePositions)) return candidate;
    }
    return undefined;
  }
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateConfig<TArchetype extends string>(
  config: EnemySpawnDirectorConfig<TArchetype>,
): void {
  if (!Number.isInteger(config.minActive) || config.minActive < 0)
    throw new Error('EnemySpawnDirector: minActive must be a non-negative integer');
  if (!Number.isInteger(config.maxActive) || config.maxActive < config.minActive)
    throw new Error('EnemySpawnDirector: maxActive must be an integer >= minActive');
  if (!Number.isInteger(config.respawnDelayMs) || config.respawnDelayMs < 0)
    throw new Error('EnemySpawnDirector: respawnDelayMs must be a non-negative integer');
  if (!Number.isInteger(config.cleanupDelayMs) || config.cleanupDelayMs < 0)
    throw new Error('EnemySpawnDirector: cleanupDelayMs must be a non-negative integer');
  if (!Number.isFinite(config.safeSpawnRadiusPx) || config.safeSpawnRadiusPx <= 0)
    throw new Error('EnemySpawnDirector: safeSpawnRadiusPx must be positive');
  if (config.spawnPoints.length === 0)
    throw new Error('EnemySpawnDirector: spawnPoints cannot be empty');
  if (config.composition.length === 0)
    throw new Error('EnemySpawnDirector: composition cannot be empty');
}

function validateWave<TArchetype extends string>(wave: EnemySpawnWave<TArchetype>): void {
  if (!Number.isInteger(wave.minActive) || wave.minActive < 0)
    throw new Error('EnemySpawnDirector: wave minActive must be a non-negative integer');
  if (!Number.isInteger(wave.maxActive) || wave.maxActive < wave.minActive)
    throw new Error('EnemySpawnDirector: wave maxActive must be an integer >= minActive');
  if (wave.composition.length === 0)
    throw new Error('EnemySpawnDirector: wave composition cannot be empty');
  if (wave.composition.some((archetype) => archetype.trim().length === 0))
    throw new Error('EnemySpawnDirector: wave composition cannot contain empty archetype ids');
}
