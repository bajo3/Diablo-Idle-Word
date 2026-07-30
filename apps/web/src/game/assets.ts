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
  /** Groups layers that belong to the same visual entity (Guardian today, an enemy from Paso 8). */
  entityId: string;
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
const ALL_LAYERS: readonly AssetLayer[] = ['shadow', 'body', 'armor', 'weapon'];
/**
 * Entities with a known, exact required layer set (preserves the Guardian's existing contract -
 * runtime.ts hardcodes that its armor/weapon layers exist). Any entity not listed here only needs
 * a non-empty, duplicate-free layer set that includes `body` - the general Paso 8+ case.
 */
const REQUIRED_LAYERS: Readonly<Record<string, readonly AssetLayer[]>> = {
  guardian_placeholder: ['shadow', 'body', 'armor', 'weapon'],
};

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
  entityId: 'guardian_placeholder',
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

function validFrameSize(width: number, height: number): boolean {
  return (width === 64 && height === 64) || (width === 128 && height === 128);
}

/**
 * Validates one or more entities' worth of layered assets. Generalized from a Guardian-only
 * validator (Paso 6/7) so Paso 8's enemies and Paso 10's boss can describe their own layers/frame
 * sizes without a second validator - but the Guardian's own exact 4-layer contract is preserved
 * via REQUIRED_LAYERS, since runtime.ts still hardcodes that those layers exist.
 */
export function validateAssetManifest(entries: readonly AssetManifestEntry[]): void {
  if (entries.length === 0) throw new Error('Missing layer.');
  const ids = new Set<string>();
  const layersByEntity = new Map<string, Set<AssetLayer>>();
  const baselineByEntity = new Map<string, AssetManifestEntry>();
  for (const entry of entries) {
    if (!/^[a-z0-9_]+$/.test(entry.id) || !ALL_LAYERS.includes(entry.layer))
      throw new Error('Invalid asset id.');
    const layers = layersByEntity.get(entry.entityId) ?? new Set<AssetLayer>();
    if (layers.has(entry.layer)) throw new Error(`Duplicate layer: ${entry.layer}.`);
    layers.add(entry.layer);
    layersByEntity.set(entry.entityId, layers);
    if (ids.has(entry.id)) throw new Error('Duplicate asset id.');
    ids.add(entry.id);
    if (entry.id !== `${entry.entityId}_${entry.layer}`)
      throw new Error(`Unexpected asset id: ${entry.id}.`);
    if (
      !entry.path.startsWith('/assets/') ||
      entry.frame.count !== entry.frame.columns * entry.frame.rows ||
      !validFrameSize(entry.frame.width, entry.frame.height)
    )
      throw new Error(`Invalid frame contract for ${entry.id}.`);
    if (
      entry.directions.join(',') !== directions.join(',') ||
      new Set(entry.directions).size !== directions.length
    )
      throw new Error(`Invalid directions for ${entry.id}.`);
    if (entry.source !== 'project-generated' || entry.license !== 'CC0-1.0')
      throw new Error(`Incomplete metadata for ${entry.id}.`);
    const baseline = baselineByEntity.get(entry.entityId) ?? entry;
    baselineByEntity.set(entry.entityId, baseline);
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
  for (const [entityId, layers] of layersByEntity) {
    const requiredLayers = REQUIRED_LAYERS[entityId];
    if (requiredLayers !== undefined) {
      if (
        layers.size !== requiredLayers.length ||
        !requiredLayers.every((layer) => layers.has(layer))
      )
        throw new Error('Missing layer.');
    } else if (!layers.has('body')) {
      throw new Error(`Entity is missing a body layer: ${entityId}.`);
    }
  }
}

/** Phaser creates one base frame in addition to each spritesheet frame. */
export function validateLoadedFrameCount(entry: AssetManifestEntry, frameTotal: number): void {
  if (frameTotal !== entry.frame.count + 1)
    throw new Error(`Invalid loaded frame count for ${entry.id}.`);
}
