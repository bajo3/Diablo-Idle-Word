import { createSeededRandom } from './random.js';

import type { ForestLevelTuning, ForestProgressionCurve } from './endless-forest.js';

/** A single slot in a deterministic Forest wave plan. */
export type ForestWaveSpawn<TArchetype extends string> = Readonly<{
  /** Stable within the wave; the runtime turns this into its monotonic enemy instance id. */
  slot: number;
  archetype: TArchetype;
  spawnKey: string;
}>;

/** Pure encounter plan consumed later by the Phaser/server adapters. */
export type ForestWavePlan<TArchetype extends string> = Readonly<{
  level: number;
  waveIndex: number;
  seed: number;
  tuning: ForestLevelTuning;
  spawns: readonly ForestWaveSpawn<TArchetype>[];
}>;

/**
 * Builds one level-scaled wave without Phaser, clocks or global state.
 *
 * A seeded shuffle-bag keeps the composition legible: every archetype appears once before any
 * archetype repeats. When a wave is smaller than the catalog, the first `waveSize` shuffled slots
 * still provide deterministic variety. `seed` is carried in the result so a server or bug report
 * can replay the exact encounter.
 */
export function createForestWave<TArchetype extends string>(
  curve: ForestProgressionCurve,
  level: number,
  waveIndex: number,
  seed: number,
  composition: readonly TArchetype[],
): ForestWavePlan<TArchetype> {
  validateWaveInput(level, waveIndex, seed, composition);
  const tuning = levelTuningForWave(level, curve);
  const random = createSeededRandom(seed);
  const shuffled = composition.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = random.nextInt(0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  const spawns = Array.from({ length: tuning.waveSize }, (_, slot) => ({
    slot,
    archetype: shuffled[slot % shuffled.length]!,
    spawnKey: `forest:${seed}:${level}:${waveIndex}:${slot}`,
  }));
  return { level, waveIndex, seed, tuning, spawns };
}

function levelTuningForWave(level: number, curve: ForestProgressionCurve): ForestLevelTuning {
  if (!Number.isInteger(level) || level < curve.minimumLevel || level > curve.maximumLevel)
    throw new Error(
      `Forest wave level ${level} is outside [${curve.minimumLevel}, ${curve.maximumLevel}].`,
    );
  const tuning = curve.levels[level - curve.minimumLevel];
  if (tuning === undefined) throw new Error(`Forest curve is missing tuning for level ${level}.`);
  return tuning;
}

function validateWaveInput<TArchetype extends string>(
  level: number,
  waveIndex: number,
  seed: number,
  composition: readonly TArchetype[],
): void {
  if (!Number.isInteger(waveIndex) || waveIndex < 0)
    throw new Error('Forest wave index must be a non-negative integer.');
  if (!Number.isSafeInteger(seed)) throw new Error('Forest wave seed must be a safe integer.');
  if (composition.length === 0) throw new Error('Forest wave composition cannot be empty.');
  if (composition.some((archetype) => archetype.trim().length === 0))
    throw new Error('Forest wave composition cannot contain empty archetype ids.');
  if (!Number.isInteger(level)) throw new Error('Forest wave level must be an integer.');
}
