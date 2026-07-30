import { describe, expect, it } from 'vitest';

import {
  EMPTY_ENEMY_REWARD_LEDGER,
  grantEnemyDefeatReward,
  isReadyForCleanup,
  totalPendingXp,
} from './enemy-lifecycle.js';

describe('enemy reward ledger', () => {
  it('starts empty and accumulates distinct defeats', () => {
    expect(totalPendingXp(EMPTY_ENEMY_REWARD_LEDGER)).toBe(0);
    const first = grantEnemyDefeatReward(EMPTY_ENEMY_REWARD_LEDGER, 'goblin-1', 10, 1000);
    const second = grantEnemyDefeatReward(first, 'goblin-2', 14, 1500);
    expect(totalPendingXp(second)).toBe(24);
    expect(second).toHaveLength(2);
  });

  it('never double-pays a repeated defeat of the same instance', () => {
    const first = grantEnemyDefeatReward(EMPTY_ENEMY_REWARD_LEDGER, 'goblin-1', 10, 1000);
    const replayed = grantEnemyDefeatReward(first, 'goblin-1', 10, 2000);
    expect(replayed).toBe(first);
    expect(totalPendingXp(replayed)).toBe(10);
  });
});

describe('enemy cleanup timing', () => {
  it('is not ready before the cleanup delay elapses, and is ready exactly at it', () => {
    expect(isReadyForCleanup(1000, 1999, 1000)).toBe(false);
    expect(isReadyForCleanup(1000, 2000, 1000)).toBe(true);
    expect(isReadyForCleanup(1000, 5000, 1000)).toBe(true);
  });
});
