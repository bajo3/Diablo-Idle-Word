import { describe, expect, it } from 'vitest';

import { createSeededRandom, seedFromString } from './random.js';

describe('deterministic seeded RNG', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const sequenceA = Array.from({ length: 20 }, () => a.next());
    const sequenceB = Array.from({ length: 20 }, () => b.next());
    expect(sequenceA).toEqual(sequenceB);
  });
  it('produces a different sequence for a different seed', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const sequenceA = Array.from({ length: 10 }, () => a.next());
    const sequenceB = Array.from({ length: 10 }, () => b.next());
    expect(sequenceA).not.toEqual(sequenceB);
  });
  it('keeps next() within [0, 1) over many samples', () => {
    const random = createSeededRandom(7);
    for (let index = 0; index < 2000; index += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
  it('keeps nextInt within an inclusive range and reaches both bounds over many samples', () => {
    const random = createSeededRandom(99);
    const seen = new Set<number>();
    for (let index = 0; index < 2000; index += 1) {
      const value = random.nextInt(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      seen.add(value);
    }
    expect(seen.has(3)).toBe(true);
    expect(seen.has(7)).toBe(true);
  });
  it('returns the fixed point when minimum equals maximum', () => {
    const random = createSeededRandom(5);
    expect(random.nextInt(4, 4)).toBe(4);
  });
  it('rejects an inverted range', () => {
    const random = createSeededRandom(5);
    expect(() => random.nextInt(5, 4)).toThrow();
  });
  it('derives a deterministic seed from a string', () => {
    expect(seedFromString('run:one')).toBe(seedFromString('run:one'));
    expect(seedFromString('run:one')).not.toBe(seedFromString('run:two'));
  });
});
