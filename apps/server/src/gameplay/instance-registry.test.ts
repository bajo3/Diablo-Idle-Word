import { describe, expect, it } from 'vitest';

import { ActiveInstanceConflictError, ActiveInstanceRegistry } from './instance-registry.js';

describe('ActiveInstanceRegistry', () => {
  it('keeps one authoritative instance across reconnects and advances its tick', () => {
    const registry = new ActiveInstanceRegistry({
      worldWidth: 500,
      worldHeight: 400,
      worldMargin: 20,
      playerSpeedPxPerSecond: 100,
      tickMs: 100,
    });
    const first = registry.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    const moved = registry.move('character:one', { x: 1, y: 0 }, 1_500);
    const reconnected = registry.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_600,
    });

    expect(first.instanceId).toBe(reconnected.instanceId);
    expect(moved?.state.players[0]?.position).toEqual({ x: 210, y: 160 });
    expect(reconnected.players[0]?.position).toEqual({ x: 210, y: 160 });
    expect(reconnected.tick).toBe(6);
    expect(registry.size()).toBe(1);
  });

  it('rejects a different owner from reusing the active character instance', () => {
    const registry = new ActiveInstanceRegistry();
    registry.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    expect(() =>
      registry.ensure({
        userId: 'user:two',
        characterId: 'character:one',
        zoneId: 'corrupted_forest',
        difficulty: 'normal',
        nowMs: 1_100,
      }),
    ).toThrow(ActiveInstanceConflictError);
  });

  it('does not move a downed actor through a client intention', () => {
    const registry = new ActiveInstanceRegistry();
    registry.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    registry.updatePlayer('character:one', { actorState: 'downed', health: 0 });
    expect(registry.playerFor('character:one')).toMatchObject({ actorState: 'downed', health: 0 });
    expect(registry.move('character:one', { x: 1, y: 0 }, 1_500)).toMatchObject({
      accepted: false,
      reason: 'invalid_state',
    });
  });

  it('emits each completed interaction once when the authoritative tick reaches it', () => {
    const registry = new ActiveInstanceRegistry();
    registry.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    expect(
      registry.scheduleInteraction('character:one', {
        operationId: 'operation:revive',
        characterId: 'character:one',
        targetId: 'revive:forest:altar',
        resultId: 'revive.forest.altar',
        completesAtMs: 2_500,
      }),
    ).toBe(true);
    expect(registry.advanceWithEvents('character:one', 2_499)?.completedInteractions).toEqual([]);
    const completed = registry.advanceWithEvents('character:one', 2_500);
    expect(completed?.completedInteractions).toEqual([
      expect.objectContaining({ operationId: 'operation:revive' }),
    ]);
    expect(registry.advanceWithEvents('character:one', 2_600)?.completedInteractions).toEqual([]);
  });

  it('marks a pending interaction interrupted when the actor takes damage', () => {
    const registry = new ActiveInstanceRegistry();
    registry.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    expect(
      registry.scheduleInteraction('character:one', {
        operationId: 'operation:revive-interrupted',
        characterId: 'character:one',
        targetId: 'revive:forest:altar',
        resultId: 'revive.forest.altar',
        startedAtMs: 1_000,
        actorHealthAtStart: 220,
        interruptOnDamage: true,
        completesAtMs: 2_500,
      }),
    ).toBe(true);
    registry.updatePlayer('character:one', { health: 120 });
    expect(registry.advanceWithEvents('character:one', 2_500)?.completedInteractions).toEqual([
      expect.objectContaining({
        operationId: 'operation:revive-interrupted',
        interruptedByDamage: true,
      }),
    ]);
    expect(
      registry.interactionWasInterrupted('character:one', 'operation:revive-interrupted'),
    ).toBe(true);
  });

  it('keeps party members in one shared state and enforces the four-player cap', () => {
    const registry = new ActiveInstanceRegistry();
    const host = registry.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    const joined = registry.join({
      userId: 'user:two',
      characterId: 'character:two',
      hostCharacterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });

    expect(joined?.state.instanceId).toBe(host.instanceId);
    expect(joined?.state.players.map((player) => player.characterId)).toEqual([
      'character:one',
      'character:two',
    ]);
    expect(registry.ownerFor('character:two')).toBe('user:two');
    expect(registry.playerCountFor('character:two')).toBe(2);

    const moved = registry.move('character:two', { x: 1, y: 0 }, 1_500);
    expect(moved?.state.players).toHaveLength(2);
    expect(registry.stateFor('character:one')).toEqual(registry.stateFor('character:two'));
    expect(registry.stateFor('character:one')?.players[1]?.position.x).toBeGreaterThan(192);

    registry.join({
      userId: 'user:three',
      characterId: 'character:three',
      hostCharacterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_500,
    });
    registry.join({
      userId: 'user:four',
      characterId: 'character:four',
      hostCharacterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_500,
    });
    expect(() =>
      registry.join({
        userId: 'user:five',
        characterId: 'character:five',
        hostCharacterId: 'character:one',
        zoneId: 'corrupted_forest',
        difficulty: 'normal',
        nowMs: 1_500,
      }),
    ).toThrow(ActiveInstanceConflictError);
  });

  it('shares server-owned enemies across every member snapshot', () => {
    const registry = new ActiveInstanceRegistry();
    registry.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    registry.join({
      userId: 'user:two',
      characterId: 'character:two',
      hostCharacterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    registry.replaceEnemies('character:one', [
      {
        enemyId: 'enemy:forest:1',
        archetype: 'corrupted_minion',
        position: { x: 250, y: 220 },
        status: 'active',
        health: 40,
        maxHealth: 40,
      },
    ]);
    expect(registry.stateFor('character:two')?.enemies).toHaveLength(1);
    expect(registry.stateFor('character:one')).toEqual(registry.stateFor('character:two'));
  });

  it('shares server-owned objectives across reconnects and party members', () => {
    const registry = new ActiveInstanceRegistry();
    const objective = {
      objectiveId: 'objective.forest.level',
      mode: 'endless_forest' as const,
      status: 'active' as const,
      progress: 1,
      target: 20,
    };
    const host = registry.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
      objectives: [objective],
    });
    registry.join({
      userId: 'user:two',
      characterId: 'character:two',
      hostCharacterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    expect(registry.stateFor('character:two')?.objectives).toEqual([objective]);
    expect(
      registry.ensure({
        userId: 'user:one',
        characterId: 'character:one',
        zoneId: 'corrupted_forest',
        difficulty: 'normal',
        nowMs: 1_100,
      })?.objectives,
    ).toEqual([objective]);
    expect(host.objectives).toEqual([objective]);
  });
});
