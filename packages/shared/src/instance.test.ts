import { describe, expect, it } from 'vitest';

import {
  ActiveInstanceStateSchema,
  DEFAULT_INSTANCE_MOVEMENT_CONFIG,
  addInstancePlayer,
  advanceActiveInstance,
  applyMovementIntent,
  createActiveInstance,
  instancePlayer,
  instanceSnapshot,
  replaceInstanceEnemies,
  replaceInstanceObjectives,
  updateInstancePlayer,
} from './instance.js';

const config = {
  ...DEFAULT_INSTANCE_MOVEMENT_CONFIG,
  worldWidth: 100,
  worldHeight: 80,
  worldMargin: 10,
  playerSpeedPxPerSecond: 20,
  tickMs: 100,
} as const;

function state() {
  return createActiveInstance(
    {
      instanceId: 'instance:forest:test',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      startedAtMs: 1_000,
      characterId: 'character:test',
      spawnPosition: { x: 50, y: 40 },
      maxHealth: 200,
    },
    config,
  );
}

describe('authoritative active instance', () => {
  it('creates a versioned state with a clamped server-owned player', () => {
    const created = createActiveInstance(
      {
        instanceId: 'instance:forest:test',
        zoneId: 'corrupted_forest',
        difficulty: 'normal',
        startedAtMs: 1_000,
        characterId: 'character:test',
        spawnPosition: { x: 999, y: -20 },
        maxHealth: 200,
      },
      config,
    );
    expect(created).toMatchObject({
      schemaVersion: 1,
      tick: 0,
      nowMs: 1_000,
      players: [{ position: { x: 90, y: 10 }, actorState: 'active', health: 200 }],
    });
    expect(ActiveInstanceStateSchema.safeParse(created).success).toBe(true);
    expect(instanceSnapshot(created)).toMatchObject({
      instanceId: 'instance:forest:test',
      serverTimeMs: 1_000,
      players: [{ characterId: 'character:test' }],
    });
  });

  it('advances the monotonic server tick without accepting rewinds', () => {
    const advanced = advanceActiveInstance(state(), 1_350, config);
    expect(advanced).toMatchObject({ nowMs: 1_350, tick: 3, revision: 2 });
    expect(() => advanceActiveInstance(advanced, 1_349, config)).toThrow(/backwards/);
  });

  it('normalizes movement and never trusts an absolute client position', () => {
    const result = applyMovementIntent(state(), 'character:test', { x: 100, y: 0 }, 2_000, config);
    expect(result.accepted).toBe(true);
    expect(instancePlayer(result.state, 'character:test')?.position).toEqual({ x: 70, y: 40 });
  });

  it('clamps movement to world bounds even with an extreme vector', () => {
    const result = applyMovementIntent(
      state(),
      'character:test',
      { x: 1e12, y: 1e12 },
      10_000,
      config,
    );
    expect(result.accepted).toBe(true);
    expect(instancePlayer(result.state, 'character:test')?.position).toEqual({ x: 90, y: 70 });
  });

  it('rejects unknown, malformed and non-active actors without mutation', () => {
    const initial = state();
    expect(
      applyMovementIntent(initial, 'character:missing', { x: 1, y: 0 }, 1_100, config),
    ).toMatchObject({
      accepted: false,
      reason: 'unknown_actor',
    });
    expect(
      applyMovementIntent(initial, 'character:test', { x: Number.NaN, y: 0 }, 1_100, config),
    ).toMatchObject({
      accepted: false,
      reason: 'invalid_vector',
    });
    const downed = updateInstancePlayer(initial, 'character:test', {
      actorState: 'downed',
      health: 0,
    });
    expect(
      applyMovementIntent(downed, 'character:test', { x: 1, y: 0 }, 1_100, config),
    ).toMatchObject({
      accepted: false,
      reason: 'invalid_state',
    });
  });

  it('updates actor state and health only through a bounded server transition', () => {
    const downed = updateInstancePlayer(state(), 'character:test', {
      actorState: 'downed',
      health: 0,
    });
    expect(instancePlayer(downed, 'character:test')).toMatchObject({
      actorState: 'downed',
      health: 0,
    });
    const revived = updateInstancePlayer(downed, 'character:test', {
      actorState: 'active',
      health: 200,
    });
    expect(instancePlayer(revived, 'character:test')).toMatchObject({
      actorState: 'active',
      health: 200,
    });
    expect(() => updateInstancePlayer(revived, 'character:test', { health: 201 })).toThrow();
  });

  it('adds up to four server-authorized players to one shared instance snapshot', () => {
    const withSecond = addInstancePlayer(
      state(),
      {
        characterId: 'character:two',
        spawnPosition: { x: 999, y: -20 },
        maxHealth: 180,
      },
      config,
    );
    expect(withSecond.players).toHaveLength(2);
    expect(withSecond.players[1]).toMatchObject({
      characterId: 'character:two',
      position: { x: 90, y: 10 },
      health: 180,
    });
    expect(instanceSnapshot(withSecond).players.map((player) => player.characterId)).toEqual([
      'character:test',
      'character:two',
    ]);
    expect(() =>
      addInstancePlayer(
        withSecond,
        {
          characterId: 'character:two',
          spawnPosition: { x: 20, y: 20 },
          maxHealth: 180,
        },
        config,
      ),
    ).toThrow(/already/);
  });

  it('replicates a bounded server-owned enemy list and rejects duplicate or over-health state', () => {
    const enemy = {
      enemyId: 'enemy:forest:1',
      archetype: 'corrupted_minion',
      position: { x: 30, y: 30 },
      status: 'active' as const,
      health: 40,
      maxHealth: 40,
    };
    const withEnemy = replaceInstanceEnemies(state(), [enemy]);
    expect(withEnemy.enemies).toEqual([enemy]);
    expect(instanceSnapshot(withEnemy).enemies).toEqual([enemy]);
    expect(() => replaceInstanceEnemies(state(), [enemy, enemy])).toThrow(/same enemy/);
    expect(() => replaceInstanceEnemies(state(), [{ ...enemy, health: 41 }])).toThrow(
      /exceed maxHealth/,
    );
  });

  it('replicates the endless-forest objective and rejects duplicate or over-target progress', () => {
    const objective = {
      objectiveId: 'objective.forest.level',
      mode: 'endless_forest' as const,
      status: 'active' as const,
      progress: 1,
      target: 20,
    };
    const withObjective = createActiveInstance(
      {
        instanceId: 'instance:forest:objective',
        zoneId: 'corrupted_forest',
        difficulty: 'normal',
        startedAtMs: 1_000,
        characterId: 'character:objective',
        spawnPosition: { x: 50, y: 40 },
        maxHealth: 200,
        objectives: [objective],
      },
      config,
    );
    expect(instanceSnapshot(withObjective).objectives).toEqual([objective]);
    const advanced = replaceInstanceObjectives(withObjective, [{ ...objective, progress: 2 }]);
    expect(instanceSnapshot(advanced).objectives[0]).toMatchObject({ progress: 2 });
    expect(() => replaceInstanceObjectives(withObjective, [objective, objective])).toThrow(
      /same objective/,
    );
    expect(() =>
      replaceInstanceObjectives(withObjective, [{ ...objective, progress: 21 }]),
    ).toThrow(/exceed its target/);
  });
});
