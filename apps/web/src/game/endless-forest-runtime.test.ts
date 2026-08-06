import { describe, expect, it } from 'vitest';

import { GAME_DATA } from '@brecha/game-data';
import { applyDefeat, createForestProgressState, type ForestProgressState } from '@brecha/shared';

describe('endless forest runtime progression contract', () => {
  it('reaches every level from 1 through 20 with catalog defeat rewards', () => {
    let state: ForestProgressState = createForestProgressState(GAME_DATA.endlessForest);
    const visited = new Set([state.level]);
    let defeatIndex = 0;

    while (state.level < GAME_DATA.endlessForest.maximumLevel) {
      const tuning = GAME_DATA.enemyTuning[defeatIndex % GAME_DATA.enemyTuning.length]!;
      const outcome = applyDefeat(
        state,
        {
          enemyInstanceId: `playtest:forest:${defeatIndex}`,
          xp: tuning.xpReward,
          gold: 0,
          materials: 0,
        },
        GAME_DATA.endlessForest,
      );
      state = outcome.state;
      visited.add(state.level);
      defeatIndex += 1;
      expect(defeatIndex).toBeLessThan(10_000);
    }

    expect([...visited]).toEqual(
      Array.from({ length: GAME_DATA.endlessForest.maximumLevel }, (_, index) => index + 1),
    );
    expect(state.level).toBe(20);
    expect(state.bestLevel).toBe(20);
    expect(state.xpInLevel).toBe(0);
  });
});
