import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ENEMY_STRESS_COUNT,
  MAX_ENEMY_STRESS_COUNT,
  enemyStressEnabled,
  enemyStressSpawnPoints,
  hasEnemyStressQuery,
  parseEnemyStressCount,
  percentile,
} from './enemy-stress';

describe('enemy stress harness', () => {
  it('never enables the internal stress mode in production builds', () => {
    expect(enemyStressEnabled('?enemyStress=40', true)).toBe(true);
    expect(enemyStressEnabled('?enemyStress=40', false)).toBe(false);
    expect(enemyStressEnabled('', true)).toBe(false);
  });

  it('keeps the normal preview at three enemies and clamps the opt-in query to 40', () => {
    expect(hasEnemyStressQuery('')).toBe(false);
    expect(hasEnemyStressQuery('?enemyStress=3')).toBe(true);
    expect(parseEnemyStressCount('')).toBe(DEFAULT_ENEMY_STRESS_COUNT);
    expect(parseEnemyStressCount('?enemyStress=40')).toBe(MAX_ENEMY_STRESS_COUNT);
    expect(parseEnemyStressCount('?enemyStress=99')).toBe(MAX_ENEMY_STRESS_COUNT);
    expect(parseEnemyStressCount('?enemyStress=1')).toBe(DEFAULT_ENEMY_STRESS_COUNT);
    expect(parseEnemyStressCount('?enemyStress=nope')).toBe(DEFAULT_ENEMY_STRESS_COUNT);
  });

  it('provides at least 40 deterministic candidate points with stable spacing', () => {
    const points = enemyStressSpawnPoints();
    expect(points.length).toBeGreaterThanOrEqual(MAX_ENEMY_STRESS_COUNT);
    expect(points).toEqual(enemyStressSpawnPoints());
    expect(new Set(points.map((point) => `${point.x}:${point.y}`)).size).toBe(points.length);
  });

  it('calculates deterministic p50/p95 percentiles', () => {
    expect(percentile([3, 1, 2, 4], 0.5)).toBe(2);
    expect(percentile([3, 1, 2, 4], 0.95)).toBe(4);
    expect(percentile([], 0.95)).toBe(0);
  });
});
