import { describe, expect, it } from 'vitest';

import {
  applyDefeat,
  createForestProgressState,
  currentLevelTuning,
  levelTuning,
  xpToAdvance,
  type ForestEnemyReward,
  type ForestProgressionCurve,
} from './endless-forest.js';

/** A small deterministic curve (5 levels) for unit testing, monotonically scaling. */
function curve(maximumLevel = 5): ForestProgressionCurve {
  const levels = Array.from({ length: maximumLevel }, (_, index) => {
    const level = index + 1;
    return {
      level,
      enemyHealthMultiplier: 1 + index * 0.25,
      enemyDamageMultiplier: 1 + index * 0.1,
      waveSize: 3 + index,
      xpToAdvance: 100 * level,
    };
  });
  return { minimumLevel: 1, maximumLevel, levels };
}

function reward(enemyInstanceId: string, xp: number, gold = 0, materials = 0): ForestEnemyReward {
  return { enemyInstanceId, xp, gold, materials };
}

describe('endless forest — curve access', () => {
  it('returns the tuning for the current level and validates bounds', () => {
    const c = curve();
    const state = createForestProgressState(c);
    expect(currentLevelTuning(state, c).level).toBe(1);
    expect(() => levelTuning(0, c)).toThrow();
    expect(() => levelTuning(6, c)).toThrow();
  });

  it('reports 0 xp to advance when at the maximum level, and the level-1 threshold otherwise', () => {
    const c = curve();
    const atCap = {
      ...createForestProgressState(c),
      level: c.maximumLevel,
      bestLevel: c.maximumLevel,
    };
    expect(xpToAdvance(atCap, c)).toBe(0);
    expect(xpToAdvance(createForestProgressState(c), c)).toBe(100);
  });
});

describe('endless forest — applyDefeat', () => {
  it('accumulates reward XP, gold and materials exactly once per enemy id (idempotency)', () => {
    const c = curve();
    const state = createForestProgressState(c);
    const first = applyDefeat(state, reward('e1', 40, 10, 2), c);
    expect(first.state.totalXp).toBe(40);
    expect(first.state.totalGold).toBe(10);
    expect(first.state.totalMaterials).toBe(2);
    expect(first.leveledUp).toBe(false);
    // Replaying the same defeat id is a no-op.
    const replayed = applyDefeat(first.state, reward('e1', 40, 10, 2), c);
    expect(replayed.state).toEqual(first.state);
    expect(replayed.leveledUp).toBe(false);
    // A different enemy id is counted separately.
    const second = applyDefeat(first.state, reward('e2', 30, 5, 1), c);
    expect(second.state.totalXp).toBe(70);
    expect(second.state.totalGold).toBe(15);
    expect(second.state.totalMaterials).toBe(3);
  });

  it('advances one level when xpInLevel reaches the threshold, carrying the remainder', () => {
    const c = curve();
    let state = createForestProgressState(c);
    state = applyDefeat(state, reward('e1', 100, 0, 0), c).state; // exactly threshold for level 1
    expect(state.level).toBe(2);
    expect(state.xpInLevel).toBe(0);
    expect(state.bestLevel).toBe(2);
    state = applyDefeat(state, reward('e2', 260, 0, 0), c).state; // 260 >= 200 (lvl2), remainder 60 < 300 (lvl3)
    expect(state.level).toBe(3);
    expect(state.xpInLevel).toBe(60);
  });

  it('cascades multiple level-ups in a single big reward', () => {
    const c = curve();
    const state = createForestProgressState(c);
    // One huge reward crossing levels 1→2→3 (thresholds 100+200=300) and landing in level 3.
    const outcome = applyDefeat(state, reward('e1', 350, 0, 0), c);
    expect(outcome.leveledUp).toBe(true);
    expect(outcome.state.level).toBe(3);
    expect(outcome.state.xpInLevel).toBe(50); // 350 - 100 (lvl1) - 200 (lvl2) = 50
    expect(outcome.state.bestLevel).toBe(3);
  });

  it('clamps at the maximum level and zeroes surplus xpInLevel', () => {
    const c = curve(3);
    let state = createForestProgressState(c); // level 1, thresholds 100/200
    state = applyDefeat(state, reward('e1', 1000, 0, 0), c).state;
    expect(state.level).toBe(3); // cap
    expect(state.xpInLevel).toBe(0); // surplus clamped
    expect(state.bestLevel).toBe(3);
    // Further defeats still pay gold/materials and are counted, but cannot raise the level.
    const more = applyDefeat(state, reward('e2', 50, 7, 1), c);
    expect(more.state.level).toBe(3);
    expect(more.state.totalGold).toBe(7);
    expect(more.leveledUp).toBe(false);
  });

  it('is deterministic: the same reward sequence yields the same final state', () => {
    const c = curve();
    const rewards = [
      reward('a', 30),
      reward('b', 80),
      reward('c', 50),
      reward('d', 200),
      reward('e', 10),
    ];
    const runOnce = rewards.reduce(
      (s, r) => applyDefeat(s, r, c).state,
      createForestProgressState(c),
    );
    const runTwice = rewards.reduce(
      (s, r) => applyDefeat(s, r, c).state,
      createForestProgressState(c),
    );
    expect(runOnce).toEqual(runTwice);
  });
});
