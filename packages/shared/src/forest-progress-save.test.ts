import { describe, expect, it } from 'vitest';

import {
  createForestProgressSave,
  forestProgressStateFromPayload,
  forestProgressStateToPayload,
  InvalidForestProgressStateError,
  migrateForestProgressSave,
  UnknownForestProgressSaveVersionError,
} from './forest-progress-save.js';
import {
  applyDefeat,
  createForestProgressState,
  type ForestProgressionCurve,
} from './endless-forest.js';

function curve(): ForestProgressionCurve {
  return {
    minimumLevel: 1,
    maximumLevel: 3,
    levels: [
      {
        level: 1,
        enemyHealthMultiplier: 1,
        enemyDamageMultiplier: 1,
        waveSize: 3,
        xpToAdvance: 100,
      },
      {
        level: 2,
        enemyHealthMultiplier: 1.2,
        enemyDamageMultiplier: 1.1,
        waveSize: 4,
        xpToAdvance: 200,
      },
      {
        level: 3,
        enemyHealthMultiplier: 1.4,
        enemyDamageMultiplier: 1.2,
        waveSize: 5,
        xpToAdvance: 0,
      },
    ],
  };
}

describe('forest progress save format', () => {
  it('round-trips immutable state with deterministic defeat ordering', () => {
    const state = applyDefeat(
      applyDefeat(
        createForestProgressState(curve()),
        {
          enemyInstanceId: 'enemy:b',
          xp: 20,
          gold: 4,
          materials: 1,
        },
        curve(),
      ).state,
      { enemyInstanceId: 'enemy:a', xp: 30, gold: 5, materials: 2 },
      curve(),
    ).state;

    const payload = forestProgressStateToPayload(state);
    expect(payload.countedDefeats).toEqual(['enemy:a', 'enemy:b']);
    expect(forestProgressStateFromPayload(payload, curve())).toEqual(state);
    expect(state.countedDefeats).toEqual(new Set(['enemy:b', 'enemy:a']));
  });

  it('creates and validates a versioned envelope', () => {
    const state = createForestProgressState(curve());
    const save = createForestProgressSave({
      characterId: 'character:test',
      revision: 1,
      savedAtServerMs: 123,
      dataVersion: 'data.test',
      balanceVersion: 'balance.test',
      state,
    });
    expect(migrateForestProgressSave(save)).toEqual(save);
    expect(() => migrateForestProgressSave({ ...save, formatVersion: 999 })).toThrow(
      UnknownForestProgressSaveVersionError,
    );
  });

  it('rejects a state that would resume above the current threshold or past the cap', () => {
    expect(() =>
      forestProgressStateFromPayload(
        {
          level: 1,
          xpInLevel: 100,
          bestLevel: 1,
          totalXp: 100,
          totalGold: 0,
          totalMaterials: 0,
          countedDefeats: [],
        },
        curve(),
      ),
    ).toThrow(InvalidForestProgressStateError);
    expect(() =>
      forestProgressStateFromPayload(
        {
          level: 3,
          xpInLevel: 1,
          bestLevel: 3,
          totalXp: 1,
          totalGold: 0,
          totalMaterials: 0,
          countedDefeats: [],
        },
        curve(),
      ),
    ).toThrow(InvalidForestProgressStateError);
  });

  it('rejects duplicate defeat ids instead of losing replay protection', () => {
    expect(() =>
      forestProgressStateFromPayload(
        {
          level: 1,
          xpInLevel: 0,
          bestLevel: 1,
          totalXp: 0,
          totalGold: 0,
          totalMaterials: 0,
          countedDefeats: ['enemy:1', 'enemy:1'],
        },
        curve(),
      ),
    ).toThrow();
  });
});
