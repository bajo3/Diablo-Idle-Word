import type { Direction4, LocalCharacterState } from './domain';

export type AssetLayer = 'shadow' | 'body' | 'armor' | 'weapon';
export type AnimationRange = Readonly<{
  id: string;
  state: LocalCharacterState;
  direction: Direction4;
  start: number;
  end: number;
}>;
export type AssetManifestEntry = Readonly<{
  id: string;
  layer: AssetLayer;
  path: string;
  frame: Readonly<{ width: number; height: number; columns: number; rows: number; count: number }>;
  directions: readonly Direction4[];
  origin: Readonly<{ x: number; y: number }>;
  offset: Readonly<{ x: number; y: number }>;
  animations: readonly AnimationRange[];
  source: 'project-generated';
  license: 'CC0-1.0';
}>;

const directions = ['up', 'down', 'left', 'right'] as const;
const states = ['idle', 'moving', 'attacking', 'casting', 'channeling'] as const;

export function animationRange(state: LocalCharacterState, direction: Direction4): AnimationRange {
  const directionIndex = directions.indexOf(direction);
  const start = directionIndex * 4;
  return {
    id: `${state}:${direction}`,
    state,
    direction,
    start,
    end: start + 3,
  };
}

const animations = states.flatMap((state) =>
  directions.map((direction) => animationRange(state, direction)),
);

export const localAssetManifest: readonly AssetManifestEntry[] = [
  'shadow',
  'body',
  'armor',
  'weapon',
].map((layer) => ({
  id: `guardian_placeholder_${layer}`,
  layer: layer as AssetLayer,
  path: `/assets/characters/guardian_placeholder_${layer}.svg`,
  frame: { width: 64, height: 64, columns: 4, rows: 4, count: 16 },
  directions: [...directions],
  origin: { x: 0.5, y: 1 },
  offset: { x: 0, y: 0 },
  animations,
  source: 'project-generated',
  license: 'CC0-1.0',
}));

export function validateAssetManifest(entries: readonly AssetManifestEntry[]): void {
  const expectedLayers: readonly AssetLayer[] = ['shadow', 'body', 'armor', 'weapon'];
  if (entries.length !== expectedLayers.length) throw new Error('Missing layer.');
  const baseline = entries[0];
  if (baseline === undefined) throw new Error('Missing layer.');
  const ids = new Set<string>();
  const layers = new Set<AssetLayer>();
  for (const entry of entries) {
    if (!/^[a-z0-9_]+$/.test(entry.id) || !expectedLayers.includes(entry.layer))
      throw new Error('Invalid asset id.');
    if (layers.has(entry.layer)) throw new Error(`Duplicate layer: ${entry.layer}.`);
    layers.add(entry.layer);
    if (ids.has(entry.id)) throw new Error('Duplicate asset id.');
    ids.add(entry.id);
    if (entry.id !== `guardian_placeholder_${entry.layer}`)
      throw new Error(`Unexpected asset id: ${entry.id}.`);
    if (
      !entry.path.startsWith('/assets/') ||
      entry.frame.count !== entry.frame.columns * entry.frame.rows ||
      entry.frame.width !== 64 ||
      entry.frame.height !== 64
    )
      throw new Error(`Invalid frame contract for ${entry.id}.`);
    if (
      entry.directions.join(',') !== directions.join(',') ||
      new Set(entry.directions).size !== directions.length
    )
      throw new Error(`Invalid directions for ${entry.id}.`);
    if (entry.source !== 'project-generated' || entry.license !== 'CC0-1.0')
      throw new Error(`Incomplete metadata for ${entry.id}.`);
    if (
      JSON.stringify(entry.frame) !== JSON.stringify(baseline.frame) ||
      JSON.stringify(entry.origin) !== JSON.stringify(baseline.origin) ||
      JSON.stringify(entry.offset) !== JSON.stringify(baseline.offset)
    )
      throw new Error(`Layer mismatch for ${entry.id}.`);
    const animationIds = new Set<string>();
    for (const animation of entry.animations) {
      const expected = animationRange(animation.state, animation.direction);
      if (
        animationIds.has(animation.id) ||
        animation.id !== expected.id ||
        !entry.directions.includes(animation.direction) ||
        animation.start !== expected.start ||
        animation.end !== expected.end
      )
        throw new Error(`Invalid animation range for ${entry.id}.`);
      animationIds.add(animation.id);
    }
    if (
      animationIds.size !== states.length * directions.length ||
      states.some((state) =>
        directions.some((direction) => !animationIds.has(`${state}:${direction}`)),
      )
    )
      throw new Error(`Orphan or missing animation for ${entry.id}.`);
  }
}

/** Phaser creates one base frame in addition to each spritesheet frame. */
export function validateLoadedFrameCount(entry: AssetManifestEntry, frameTotal: number): void {
  if (frameTotal !== entry.frame.count + 1)
    throw new Error(`Invalid loaded frame count for ${entry.id}.`);
}
