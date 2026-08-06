import {
  DEFAULT_INSTANCE_MOVEMENT_CONFIG,
  DifficultySchema,
  addInstancePlayer,
  applyMovementIntent,
  advanceActiveInstance,
  createActiveInstance,
  instancePlayer,
  removeInstancePlayer,
  replaceInstanceEnemies,
  replaceInstanceObjectives,
  updateInstancePlayer,
  type ActiveInstanceState,
  type InstanceMovementConfig,
  type InstanceEnemyState,
  type InstanceObjectiveState,
  type MovementIntent,
  type MovementResult,
} from '@brecha/shared';
import { z } from 'zod';

type Difficulty = z.infer<typeof DifficultySchema>;

export class ActiveInstanceConflictError extends Error {
  public constructor(message = 'The character already belongs to a different active instance.') {
    super(message);
    this.name = 'ActiveInstanceConflictError';
  }
}

type ActiveInstanceEntry = Readonly<{
  state: ActiveInstanceState;
  owners: ReadonlyMap<string, string>;
  pendingInteractions: ReadonlyMap<string, PendingInstanceInteraction>;
}>;

export type PendingInstanceInteraction = Readonly<{
  operationId: string;
  characterId: string;
  targetId: string;
  resultId: string;
  completesAtMs: number;
  /** Actor health at interaction start, used to detect damage interruption server-side. */
  actorHealthAtStart?: number;
  startedAtMs?: number;
  interruptOnDamage?: boolean;
  /** A revive effect may target another party member; the actor remains `characterId`. */
  effectCharacterId?: string;
}>;

export type CompletedInstanceInteraction = PendingInstanceInteraction &
  Readonly<{
    interruptedByDamage?: boolean;
  }>;
export type InstanceTickResult = Readonly<{
  state: ActiveInstanceState;
  completedInteractions: readonly CompletedInstanceInteraction[];
}>;

export type EnsureInstanceInput = Readonly<{
  userId: string;
  characterId: string;
  zoneId: string;
  difficulty: Difficulty;
  nowMs: number;
  objectives?: readonly InstanceObjectiveState[];
}>;

export type JoinInstanceInput = EnsureInstanceInput &
  Readonly<{
    hostCharacterId: string;
    spawnPosition?: Readonly<{ x: number; y: number }>;
    maxHealth?: number;
  }>;

const PARTY_SPAWN_POSITIONS = Object.freeze([
  { x: 160, y: 160 },
  { x: 192, y: 160 },
  { x: 160, y: 192 },
  { x: 192, y: 192 },
]);

/**
 * Process-local registry for active sessions. PostgreSQL stores durable character state/results,
 * never every tick; this registry is the authoritative source while a session is active. Members
 * of one party share one immutable state value, so every snapshot observes the same tick/revision.
 */
export class ActiveInstanceRegistry {
  private readonly entries = new Map<string, ActiveInstanceEntry>();
  private readonly characterInstances = new Map<string, string>();
  private readonly interruptedInteractions = new Map<string, Set<string>>();

  public constructor(
    private readonly config: InstanceMovementConfig = DEFAULT_INSTANCE_MOVEMENT_CONFIG,
    private readonly defaultMaxHealth = 220,
  ) {}

  public ensure(input: EnsureInstanceInput): ActiveInstanceState {
    return this.ensureWithEvents(input).state;
  }

  public ensureWithEvents(input: EnsureInstanceInput): InstanceTickResult {
    const instanceId = this.characterInstances.get(input.characterId);
    if (instanceId !== undefined) {
      const existing = this.entries.get(instanceId);
      if (existing === undefined) throw new Error('The character instance index is inconsistent.');
      this.assertMembership(existing, input);
      const advanced = this.advanceWithEvents(input.characterId, input.nowMs);
      if (advanced === undefined)
        throw new Error('The active instance disappeared during advance.');
      return advanced;
    }

    const state = createActiveInstance(
      {
        instanceId: `instance:${input.zoneId}:${input.characterId}`,
        zoneId: input.zoneId,
        difficulty: input.difficulty,
        startedAtMs: input.nowMs,
        characterId: input.characterId,
        spawnPosition: { x: 160, y: 160 },
        maxHealth: this.defaultMaxHealth,
        ...(input.objectives === undefined ? {} : { objectives: input.objectives }),
      },
      this.config,
    );
    this.entries.set(state.instanceId, {
      state,
      owners: new Map([[input.characterId, input.userId]]),
      pendingInteractions: new Map(),
    });
    this.characterInstances.set(input.characterId, state.instanceId);
    return { state, completedInteractions: [] };
  }

  /**
   * Adds a character to an existing instance after an outer party service has authorized the
   * invitation/code. The registry still enforces capacity, zone/difficulty and duplicate joins.
   */
  public join(input: JoinInstanceInput): InstanceTickResult | undefined {
    const hostInstanceId = this.characterInstances.get(input.hostCharacterId);
    if (hostInstanceId === undefined) return undefined;
    const hostEntry = this.entries.get(hostInstanceId);
    if (hostEntry === undefined) throw new Error('The host instance index is inconsistent.');
    if (hostEntry.state.zoneId !== input.zoneId || hostEntry.state.difficulty !== input.difficulty)
      throw new ActiveInstanceConflictError(
        'The party member requested a different zone or difficulty.',
      );

    const targetInstanceId = this.characterInstances.get(input.characterId);
    if (targetInstanceId !== undefined) {
      if (targetInstanceId !== hostInstanceId) throw new ActiveInstanceConflictError();
      this.assertMembership(hostEntry, input);
      return this.advanceWithEvents(input.characterId, input.nowMs);
    }

    const tick = this.advanceWithEvents(input.hostCharacterId, input.nowMs);
    if (tick === undefined) return undefined;
    const state = tick.state;
    const spawnPosition =
      input.spawnPosition ??
      PARTY_SPAWN_POSITIONS[state.players.length] ??
      PARTY_SPAWN_POSITIONS[0]!;
    let joined: ActiveInstanceState;
    try {
      joined = addInstancePlayer(
        state,
        {
          characterId: input.characterId,
          spawnPosition,
          maxHealth: input.maxHealth ?? this.defaultMaxHealth,
        },
        this.config,
      );
    } catch (error: unknown) {
      if (error instanceof Error && /four players|already in this/.test(error.message))
        throw new ActiveInstanceConflictError(error.message);
      throw error;
    }
    const currentEntry = this.entries.get(hostInstanceId);
    if (currentEntry === undefined) throw new Error('The host instance disappeared during join.');
    const owners = new Map(currentEntry.owners);
    owners.set(input.characterId, input.userId);
    this.entries.set(hostInstanceId, {
      ...currentEntry,
      state: joined,
      owners,
    });
    this.characterInstances.set(input.characterId, hostInstanceId);
    return { state: joined, completedInteractions: tick.completedInteractions };
  }

  public advance(characterId: string, nowMs: number): ActiveInstanceState | undefined {
    return this.advanceWithEvents(characterId, nowMs)?.state;
  }

  public advanceWithEvents(characterId: string, nowMs: number): InstanceTickResult | undefined {
    const entry = this.entryForCharacter(characterId);
    if (entry === undefined) return undefined;
    const state = advanceActiveInstance(entry.state, nowMs, this.config);
    const completedInteractions = [...entry.pendingInteractions.values()]
      .filter((interaction) => interaction.completesAtMs <= state.nowMs)
      .sort(
        (left, right) =>
          left.completesAtMs - right.completesAtMs ||
          left.operationId.localeCompare(right.operationId),
      )
      .map((interaction) => {
        const actor = state.players.find(
          (player) => player.characterId === interaction.characterId,
        );
        const interruptedByDamage =
          interaction.interruptOnDamage === true &&
          interaction.actorHealthAtStart !== undefined &&
          actor !== undefined &&
          actor.health < interaction.actorHealthAtStart;
        if (interruptedByDamage) {
          const interrupted =
            this.interruptedInteractions.get(interaction.characterId) ?? new Set();
          interrupted.add(interaction.operationId);
          this.interruptedInteractions.set(interaction.characterId, interrupted);
        }
        return interruptedByDamage ? { ...interaction, interruptedByDamage: true } : interaction;
      });
    const pendingInteractions = new Map(entry.pendingInteractions);
    for (const interaction of completedInteractions)
      pendingInteractions.delete(interaction.operationId);
    this.replaceEntry(characterId, { ...entry, state, pendingInteractions });
    return { state, completedInteractions };
  }

  public move(
    characterId: string,
    intent: MovementIntent,
    nowMs: number,
  ): MovementResult | undefined {
    const entry = this.entryForCharacter(characterId);
    if (entry === undefined) return undefined;
    const result = applyMovementIntent(entry.state, characterId, intent, nowMs, this.config);
    this.replaceEntry(characterId, { ...entry, state: result.state });
    return result;
  }

  public scheduleInteraction(
    characterId: string,
    interaction: PendingInstanceInteraction,
  ): boolean {
    const entry = this.entryForCharacter(characterId);
    if (
      entry === undefined ||
      interaction.characterId !== characterId ||
      !Number.isInteger(interaction.completesAtMs) ||
      interaction.completesAtMs < entry.state.nowMs
    )
      return false;
    if (entry.pendingInteractions.has(interaction.operationId)) return true;
    const pendingInteractions = new Map(entry.pendingInteractions);
    pendingInteractions.set(interaction.operationId, Object.freeze({ ...interaction }));
    this.replaceEntry(characterId, { ...entry, pendingInteractions });
    return true;
  }

  public stateFor(characterId: string): ActiveInstanceState | undefined {
    return this.entryForCharacter(characterId)?.state;
  }

  public playerFor(characterId: string): ReturnType<typeof instancePlayer> {
    const state = this.stateFor(characterId);
    return state === undefined ? undefined : instancePlayer(state, characterId);
  }

  public updatePlayer(
    characterId: string,
    update: Parameters<typeof updateInstancePlayer>[2],
  ): ActiveInstanceState | undefined {
    const entry = this.entryForCharacter(characterId);
    if (entry === undefined) return undefined;
    const state = updateInstancePlayer(entry.state, characterId, update);
    this.replaceEntry(characterId, { ...entry, state });
    return state;
  }

  public leave(characterId: string): ActiveInstanceState | undefined {
    const instanceId = this.characterInstances.get(characterId);
    if (instanceId === undefined) return undefined;
    const entry = this.entries.get(instanceId);
    if (entry === undefined) return undefined;
    const state = removeInstancePlayer(entry.state, characterId);
    this.characterInstances.delete(characterId);
    this.interruptedInteractions.delete(characterId);
    if (state === undefined) {
      this.entries.delete(instanceId);
      for (const memberId of entry.owners.keys()) this.interruptedInteractions.delete(memberId);
      for (const memberId of entry.owners.keys()) this.characterInstances.delete(memberId);
      return undefined;
    }
    const owners = new Map(entry.owners);
    owners.delete(characterId);
    const pendingInteractions = new Map(entry.pendingInteractions);
    for (const interaction of pendingInteractions.values()) {
      if (interaction.characterId === characterId)
        pendingInteractions.delete(interaction.operationId);
    }
    this.entries.set(instanceId, { ...entry, state, owners, pendingInteractions });
    return state;
  }

  public interactionWasInterrupted(characterId: string, operationId: string): boolean {
    return this.interruptedInteractions.get(characterId)?.has(operationId) ?? false;
  }

  /** Records a same-tick damage interruption after another authority has resolved its hit. */
  public markInteractionInterrupted(characterId: string, operationId: string): void {
    const interrupted = this.interruptedInteractions.get(characterId) ?? new Set();
    interrupted.add(operationId);
    this.interruptedInteractions.set(characterId, interrupted);
  }

  public replaceEnemies(
    characterId: string,
    enemies: readonly InstanceEnemyState[],
  ): ActiveInstanceState | undefined {
    const entry = this.entryForCharacter(characterId);
    if (entry === undefined) return undefined;
    const state = replaceInstanceEnemies(entry.state, enemies);
    this.replaceEntry(characterId, { ...entry, state });
    return state;
  }

  public replaceObjectives(
    characterId: string,
    objectives: readonly InstanceObjectiveState[],
  ): ActiveInstanceState | undefined {
    const entry = this.entryForCharacter(characterId);
    if (entry === undefined) return undefined;
    const state = replaceInstanceObjectives(entry.state, objectives);
    this.replaceEntry(characterId, { ...entry, state });
    return state;
  }

  public ownerFor(characterId: string): string | undefined {
    return this.entryForCharacter(characterId)?.owners.get(characterId);
  }

  public instanceFor(characterId: string): string | undefined {
    return this.characterInstances.get(characterId);
  }

  public playerCountFor(characterId: string): number {
    return this.stateFor(characterId)?.players.length ?? 0;
  }

  public size(): number {
    return this.entries.size;
  }

  /** Stable character IDs currently owned by active instances, for server-side tick systems. */
  public activeCharacterIds(): readonly string[] {
    return [...this.characterInstances.keys()].sort();
  }

  private entryForCharacter(characterId: string): ActiveInstanceEntry | undefined {
    const instanceId = this.characterInstances.get(characterId);
    return instanceId === undefined ? undefined : this.entries.get(instanceId);
  }

  private replaceEntry(characterId: string, entry: ActiveInstanceEntry): void {
    const instanceId = this.characterInstances.get(characterId);
    if (instanceId === undefined) return;
    this.entries.set(instanceId, entry);
  }

  private assertMembership(entry: ActiveInstanceEntry, input: EnsureInstanceInput): void {
    if (
      entry.owners.get(input.characterId) !== input.userId ||
      entry.state.zoneId !== input.zoneId ||
      entry.state.difficulty !== input.difficulty
    )
      throw new ActiveInstanceConflictError();
  }
}
