import { describe, expect, it } from 'vitest';

import { createSeededRandom } from '@brecha/shared';

import { scatterPoints } from './environment';

describe('environment scatter', () => {
  it('places every point inside the margin-inset rectangle', () => {
    const points = scatterPoints(200, 1280, 720, 40, createSeededRandom(7));
    expect(points).toHaveLength(200);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(40);
      expect(point.x).toBeLessThanOrEqual(1280 - 40);
      expect(point.y).toBeGreaterThanOrEqual(40);
      expect(point.y).toBeLessThanOrEqual(720 - 40);
    }
  });

  it('paints the identical world for the same seed and a different one otherwise', () => {
    const first = scatterPoints(50, 800, 600, 10, createSeededRandom(99));
    const same = scatterPoints(50, 800, 600, 10, createSeededRandom(99));
    const other = scatterPoints(50, 800, 600, 10, createSeededRandom(100));
    expect(first).toEqual(same);
    expect(first).not.toEqual(other);
  });

  it('returns nothing for a non-positive count instead of throwing', () => {
    expect(scatterPoints(0, 100, 100, 0, createSeededRandom(1))).toEqual([]);
    expect(scatterPoints(-5, 100, 100, 0, createSeededRandom(1))).toEqual([]);
  });
});
