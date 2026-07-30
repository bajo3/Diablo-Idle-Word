import { describe, expect, it } from 'vitest';

import { arrive, combineSteering, flee, seek, separation } from './steering.js';

describe('steering', () => {
  it('seeks straight at the target, capped at maxSpeed', () => {
    const result = seek({ x: 0, y: 0 }, { x: 100, y: 0 }, 40);
    expect(result.x).toBeCloseTo(40);
    expect(result.y).toBeCloseTo(0);
  });

  it('flees in exactly the opposite direction of seek', () => {
    const away = flee({ x: 0, y: 0 }, { x: 100, y: 0 }, 40);
    expect(away.x).toBeCloseTo(-40);
    expect(away.y).toBeCloseTo(0);
  });

  it('arrives at full speed outside the slowing radius and ramps down inside it', () => {
    const far = arrive({ x: 0, y: 0 }, { x: 200, y: 0 }, 40, 50);
    expect(far.x).toBeCloseTo(40);
    const halfway = arrive({ x: 0, y: 0 }, { x: 25, y: 0 }, 40, 50);
    expect(halfway.x).toBeCloseTo(20);
    expect(arrive({ x: 10, y: 10 }, { x: 10, y: 10 }, 40, 50)).toEqual({ x: 0, y: 0 });
  });

  it('separates away from close neighbors, ignoring ones outside the radius or on the same spot', () => {
    const pushed = separation(
      { x: 0, y: 0 },
      [
        { position: { x: 10, y: 0 } },
        { position: { x: 0, y: 1000 } },
        { position: { x: 0, y: 0 } },
      ],
      50,
      40,
    );
    expect(pushed.x).toBeLessThan(0);
    expect(pushed.y).toBeCloseTo(0);
    expect(separation({ x: 0, y: 0 }, [{ position: { x: 1000, y: 0 } }], 50, 40)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('clamps the magnitude of combined steering vectors to maxSpeed', () => {
    const combined = combineSteering(
      [
        { x: 40, y: 0 },
        { x: 40, y: 0 },
      ],
      40,
    );
    expect(Math.hypot(combined.x, combined.y)).toBeCloseTo(40);
    expect(combined.x).toBeCloseTo(40);
  });
});
