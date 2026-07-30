/** Deterministic, seedable RNG. No Math.random(), no Date.now() — pure state transition. */
import type { RandomSource } from './combat.js';

/** Numeric PRNG seed. Distinct from the string `Seed` id in ids.ts (an away-mode/loot seed identifier). */
export type RandomSeed = number;

/** mulberry32: small-state, fast, adequate distribution for gameplay (not cryptographic). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A run built from the same seed and the same command sequence must be replayable. */
export function createSeededRandom(seed: RandomSeed): RandomSource {
  const next01 = mulberry32(seed);
  return {
    next: () => next01(),
    nextInt: (minimum, maximum) => {
      if (maximum < minimum) throw new Error('nextInt: maximum must be >= minimum.');
      return minimum + Math.floor(next01() * (maximum - minimum + 1));
    },
  };
}

/** Derives a 32-bit seed from an arbitrary string (e.g. a session id) for logging and bug repro. */
export function seedFromString(value: string): RandomSeed {
  let hash = 2166136261; // FNV-1a offset basis
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
