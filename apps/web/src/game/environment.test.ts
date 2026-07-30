import { describe, expect, it } from 'vitest';

import { createSeededRandom } from '@brecha/shared';

import { borderBandPoints, scatterPoints } from './environment';

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

describe('border band placement', () => {
  const width = 1280;
  const height = 720;
  const band = 90;

  it('keeps every point inside the border band, never in the open arena', () => {
    const points = borderBandPoints(300, width, height, band, createSeededRandom(4));
    expect(points).toHaveLength(300);
    for (const point of points) {
      const inBand =
        point.x <= band || point.x >= width - band || point.y <= band || point.y >= height - band;
      expect(inBand).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(height);
    }
  });

  it('lays out the same forest for the same seed', () => {
    expect(borderBandPoints(40, width, height, band, createSeededRandom(11))).toEqual(
      borderBandPoints(40, width, height, band, createSeededRandom(11)),
    );
    expect(borderBandPoints(40, width, height, band, createSeededRandom(11))).not.toEqual(
      borderBandPoints(40, width, height, band, createSeededRandom(12)),
    );
  });
});
