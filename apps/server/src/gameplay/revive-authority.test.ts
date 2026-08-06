import { describe, expect, it } from 'vitest';

import { createActiveInstance, updateInstancePlayer } from '@brecha/shared';

import { selectReviveTarget } from './revive-authority.js';

function state() {
  return createActiveInstance({
    instanceId: 'instance:forest:revive',
    zoneId: 'corrupted_forest',
    difficulty: 'normal',
    startedAtMs: 1_000,
    characterId: 'character:actor',
    spawnPosition: { x: 160, y: 160 },
    maxHealth: 220,
  });
}

describe('revive authority', () => {
  it('selects the nearest downed party member deterministically', () => {
    let current = state();
    current = updateInstancePlayer(current, 'character:actor', {
      actorState: 'active',
      health: 220,
    });
    current = {
      ...current,
      players: [
        ...current.players,
        {
          characterId: 'character:near',
          position: { x: 180, y: 160 },
          actorState: 'downed',
          health: 0,
          maxHealth: 220,
        },
        {
          characterId: 'character:far',
          position: { x: 300, y: 160 },
          actorState: 'downed',
          health: 0,
          maxHealth: 220,
        },
      ],
    };
    expect(selectReviveTarget(current, 'character:actor')).toBe('character:near');
  });

  it('uses character id as a tie-break and never selects the actor', () => {
    const current = {
      ...state(),
      players: [
        ...state().players,
        {
          characterId: 'character:z',
          position: { x: 180, y: 160 },
          actorState: 'downed' as const,
          health: 0,
          maxHealth: 220,
        },
        {
          characterId: 'character:a',
          position: { x: 140, y: 160 },
          actorState: 'downed' as const,
          health: 0,
          maxHealth: 220,
        },
      ],
    };
    expect(selectReviveTarget(current, 'character:actor')).toBe('character:a');
    expect(selectReviveTarget(current, 'character:z')).toBeUndefined();
  });

  it('rejects a downed actor and an instance without a downed teammate', () => {
    const initial = state();
    expect(selectReviveTarget(initial, 'character:actor')).toBeUndefined();
    const downed = updateInstancePlayer(initial, 'character:actor', {
      actorState: 'downed',
      health: 0,
    });
    expect(selectReviveTarget(downed, 'character:actor')).toBeUndefined();
  });
});
