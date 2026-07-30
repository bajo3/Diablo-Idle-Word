import { describe, expect, it } from 'vitest';

import {
  hasProjectileExpired,
  isTelegraphActive,
  projectileHitsTarget,
  projectilePositionAt,
  telegraphHitsTarget,
  telegraphResolvedThisTick,
  telegraphResolvesAt,
  type Projectile,
  type Telegraph,
} from './projectiles.js';

const projectile: Projectile = {
  id: 'arrow-1',
  origin: { x: 0, y: 0 },
  direction: { x: 1, y: 0 },
  speedPxPerSec: 200,
  spawnedAt: 1000,
  maxRangePx: 300,
};

describe('projectiles', () => {
  it('flies at speedPxPerSec from its origin along its direction', () => {
    expect(projectilePositionAt(projectile, 1000)).toEqual({ x: 0, y: 0 });
    expect(projectilePositionAt(projectile, 1500)).toEqual({ x: 100, y: 0 });
  });

  it('clamps travel distance to maxRangePx and reports expiry from that point on', () => {
    expect(projectilePositionAt(projectile, 3000)).toEqual({ x: 300, y: 0 });
    expect(hasProjectileExpired(projectile, 2499)).toBe(false);
    expect(hasProjectileExpired(projectile, 2500)).toBe(true);
    expect(hasProjectileExpired(projectile, 5000)).toBe(true);
  });

  it('hits a target only when the projectile position is within hitRadiusPx', () => {
    const target = { id: 'dummy', position: { x: 100, y: 0 }, armor: 0, health: 10 };
    expect(projectileHitsTarget(projectile, 1500, target, 10)).toBe(true);
    expect(projectileHitsTarget(projectile, 1500, target, 5)).toBe(true);
    expect(projectileHitsTarget(projectile, 1200, target, 10)).toBe(false);
  });
});

describe('telegraphs', () => {
  const oneShot: Telegraph = {
    id: 'shot-1',
    center: { x: 0, y: 0 },
    radiusPx: 50,
    startedAt: 1000,
    telegraphMs: 500,
  };

  it('is active only during its warning window, then resolves once', () => {
    expect(isTelegraphActive(oneShot, 999)).toBe(false);
    expect(isTelegraphActive(oneShot, 1000)).toBe(true);
    expect(isTelegraphActive(oneShot, 1499)).toBe(true);
    expect(isTelegraphActive(oneShot, 1500)).toBe(false);
    expect(telegraphResolvesAt(oneShot, 1000)).toBe(1500);
    expect(telegraphResolvedThisTick(oneShot, 1490, 1500)).toBe(true);
    expect(telegraphResolvedThisTick(oneShot, 1500, 1510)).toBe(false);
  });

  it('repeats on a fixed period and reports the correct cycle each time', () => {
    const repeating: Telegraph = { ...oneShot, repeatMs: 2000 };
    expect(telegraphResolvesAt(repeating, 1000)).toBe(1500);
    expect(telegraphResolvesAt(repeating, 1600)).toBe(3500);
    expect(telegraphResolvesAt(repeating, 3600)).toBe(5500);
    expect(telegraphResolvedThisTick(repeating, 3490, 3500)).toBe(true);
    expect(telegraphResolvedThisTick(repeating, 1490, 1500)).toBe(true);
    expect(isTelegraphActive(repeating, 3400)).toBe(true);
    expect(isTelegraphActive(repeating, 3500)).toBe(false);
  });

  it('detects a target inside its radius, ignoring anything outside it', () => {
    const inside = { id: 'a', position: { x: 10, y: 10 }, armor: 0, health: 10 };
    const outside = { id: 'b', position: { x: 1000, y: 0 }, armor: 0, health: 10 };
    expect(telegraphHitsTarget(oneShot, inside)).toBe(true);
    expect(telegraphHitsTarget(oneShot, outside)).toBe(false);
  });
});
