import type { Direction4, LocalCharacterState } from './domain';

/**
 * Real generated character art (PixelLab), as opposed to the layered `guardian_placeholder_*`
 * SVG contract in `assets.ts`. These sheets are a deliberately different shape: 92x92 frames, one
 * sheet per animation *and* direction, and only three generated directions — `west` is `east`
 * mirrored on X, which is how the art was budgeted when it was generated (see
 * ASSET_PROVENANCE.md). Kept in its own module so the placeholder contract, its validator and its
 * tests stay untouched and honest about what they describe.
 */
export type PixelLabDirection = 'north' | 'south' | 'east';
export type PixelLabAnimationName = 'idle' | 'walk' | 'basic_attack' | 'hit' | 'death';

export type PixelLabSheet = Readonly<{
  path: string;
  frameCount: number;
}>;
export type PixelLabAnimation = Readonly<{
  frameRate: number;
  repeat: number;
  sheets: Readonly<Record<PixelLabDirection, PixelLabSheet>>;
}>;
export type PixelLabCharacter = Readonly<{
  id: string;
  displayName: string;
  frameWidth: number;
  frameHeight: number;
  /** Feet-relative origin: the art has empty headroom, so the sprite anchors on its bottom edge. */
  origin: Readonly<{ x: number; y: number }>;
  /**
   * Partial on purpose: not every character generates all five animations (e.g. an enemy may ship
   * only idle/walk/basic_attack). `mapState` falls back to `idle` when the mapped animation is
   * missing, so a character is never left without a frame to show.
   */
  animations: Readonly<Partial<Record<PixelLabAnimationName, PixelLabAnimation>>>;
}>;

function sheets(
  character: string,
  animation: string,
  frameCount: number,
): PixelLabAnimation['sheets'] {
  const directions: readonly PixelLabDirection[] = ['north', 'south', 'east'];
  return Object.freeze(
    Object.fromEntries(
      directions.map((direction) => [
        direction,
        {
          path: `/assets/characters/${character}/full/${character}_${animation}_${direction}.png`,
          frameCount,
        },
      ]),
    ),
  ) as PixelLabAnimation['sheets'];
}

/** Mirrors `apps/web/public/assets/characters/dark_knight/metadata/manifest.json`. */
export const darkKnight: PixelLabCharacter = Object.freeze({
  id: 'dark_knight',
  displayName: 'Caballero Oscuro',
  frameWidth: 92,
  frameHeight: 92,
  origin: { x: 0.5, y: 0.86 },
  animations: Object.freeze({
    idle: { frameRate: 6, repeat: -1, sheets: sheets('dark_knight', 'idle', 4) },
    walk: { frameRate: 10, repeat: -1, sheets: sheets('dark_knight', 'walk', 8) },
    basic_attack: { frameRate: 12, repeat: 0, sheets: sheets('dark_knight', 'basic_attack', 7) },
    hit: { frameRate: 10, repeat: 0, sheets: sheets('dark_knight', 'hit', 6) },
    death: { frameRate: 8, repeat: 0, sheets: sheets('dark_knight', 'death', 7) },
  }),
});

/** Mirrors `apps/web/public/assets/characters/ranger/metadata/manifest.json`. */
export const ranger: PixelLabCharacter = Object.freeze({
  id: 'ranger',
  displayName: 'Ranger',
  frameWidth: 92,
  frameHeight: 92,
  origin: { x: 0.5, y: 0.86 },
  animations: Object.freeze({
    idle: { frameRate: 6, repeat: -1, sheets: sheets('ranger', 'idle', 4) },
    walk: { frameRate: 10, repeat: -1, sheets: sheets('ranger', 'walk', 8) },
    basic_attack: { frameRate: 12, repeat: 0, sheets: sheets('ranger', 'basic_attack', 7) },
    hit: { frameRate: 10, repeat: 0, sheets: sheets('ranger', 'hit', 6) },
    death: { frameRate: 8, repeat: 0, sheets: sheets('ranger', 'death', 7) },
  }),
});

/**
 * The approved Bruto sprite (user-provided upload, 2026-08-04). Mirrors
 * `apps/web/public/assets/characters/root_brute/metadata/manifest.json`.
 * Only idle/walk/basic_attack are authored today; every frame uses the same approved reference
 * until directional animation art is supplied, so an unrelated fallback sprite can never appear.
 */
export const rootBrute: PixelLabCharacter = Object.freeze({
  id: 'root_brute',
  displayName: 'Bruto de raíces',
  frameWidth: 248,
  frameHeight: 248,
  origin: { x: 0.5, y: 0.86 },
  animations: Object.freeze({
    idle: { frameRate: 6, repeat: -1, sheets: sheets('root_brute', 'idle', 1) },
    walk: { frameRate: 10, repeat: -1, sheets: sheets('root_brute', 'walk', 6) },
    basic_attack: { frameRate: 12, repeat: 0, sheets: sheets('root_brute', 'basic_attack', 6) },
  }),
});

export type DirectionMapping = Readonly<{ sheet: PixelLabDirection; flipX: boolean }>;

/**
 * Four gameplay directions onto three generated sheets. `left` reuses the `east` art mirrored,
 * which is exactly how the west-facing frames were budgeted rather than generated.
 */
export function mapDirection(direction: Direction4): DirectionMapping {
  if (direction === 'up') return { sheet: 'north', flipX: false };
  if (direction === 'down') return { sheet: 'south', flipX: false };
  if (direction === 'right') return { sheet: 'east', flipX: false };
  return { sheet: 'east', flipX: true };
}

/**
 * The visual FSM's eleven states onto the five animations that were actually generated. States
 * without dedicated art fall back to the closest one that exists rather than to nothing, so the
 * character is never left without a frame to show.
 */
export function mapState(state: LocalCharacterState): PixelLabAnimationName {
  if (state === 'moving') return 'walk';
  if (state === 'attacking' || state === 'casting' || state === 'channeling') return 'basic_attack';
  if (state === 'stunned' || state === 'knocked_back') return 'hit';
  if (state === 'dead' || state === 'downed') return 'death';
  return 'idle';
}

/**
 * The animation to play for a character in a given state, with a fallback to `idle` (and then to
 * whichever animation exists) when the mapped one wasn't generated for that character. Needed
 * because `PixelLabCharacter.animations` is `Partial` — an enemy may ship only idle/walk/attack.
 */
export function pickAnimation(
  character: PixelLabCharacter,
  state: LocalCharacterState,
): PixelLabAnimationName {
  const mapped = mapState(state);
  if (character.animations[mapped] !== undefined) return mapped;
  if (character.animations.idle !== undefined) return 'idle';
  // Last resort: the first animation that exists (a character always has at least one).
  return Object.keys(character.animations)[0] as PixelLabAnimationName;
}

/** Stable Phaser texture/animation key for one character + animation + generated direction. */
export function pixelLabKey(
  character: PixelLabCharacter,
  animation: PixelLabAnimationName,
  direction: PixelLabDirection,
): string {
  return `${character.id}:${animation}:${direction}`;
}

/** Every (animation, direction) sheet a character needs loaded, flattened for the preloader. */
export function pixelLabSheetsToLoad(
  character: PixelLabCharacter,
): readonly Readonly<{ key: string; path: string; frameWidth: number; frameHeight: number }>[] {
  const names = Object.keys(character.animations) as PixelLabAnimationName[];
  const directions: readonly PixelLabDirection[] = ['north', 'south', 'east'];
  return names.flatMap((name) => {
    const animation = character.animations[name];
    if (animation === undefined) return [];
    return directions.map((direction) => ({
      key: pixelLabKey(character, name, direction),
      path: animation.sheets[direction].path,
      frameWidth: character.frameWidth,
      frameHeight: character.frameHeight,
    }));
  });
}

/**
 * Layer path variant. Layered characters keep their sheets under `layers/` with the layer name in
 * the filename, so a merged character and a layered one can coexist in the same asset tree.
 */
function layerSheets(
  character: string,
  layer: string,
  animation: string,
  frameCount: number,
): PixelLabAnimation['sheets'] {
  const directions: readonly PixelLabDirection[] = ['north', 'south', 'east'];
  return Object.freeze(
    Object.fromEntries(
      directions.map((direction) => [
        direction,
        {
          path: `/assets/characters/${character}/layers/${character}_${layer}_${animation}_${direction}.png`,
          frameCount,
        },
      ]),
    ),
  ) as PixelLabAnimation['sheets'];
}

export type CharacterLayerName = 'body' | 'armor' | 'weapon';

/**
 * A character drawn as separate, pixel-aligned layers.
 *
 * Each layer is an ordinary `PixelLabCharacter` with its own id, which is the point: the loader,
 * the animation registration and the frame contract all work on it unchanged. Stacking three
 * sprites on one origin is what finally lets equipped gear be real art instead of the translucent
 * rarity-tinted vector shapes `renderEquipmentVisuals` falls back to for merged characters.
 */
export type LayeredCharacter = Readonly<{
  id: string;
  displayName: string;
  body: PixelLabCharacter;
  armor: PixelLabCharacter;
  weapon: PixelLabCharacter;
}>;

function hunterLayer(layer: CharacterLayerName): PixelLabCharacter {
  const id = `hunter_${layer}`;
  return Object.freeze({
    id,
    displayName: `Cazadora (${layer})`,
    frameWidth: 92,
    frameHeight: 92,
    origin: { x: 0.5, y: 0.86 },
    animations: Object.freeze({
      idle: { frameRate: 6, repeat: -1, sheets: layerSheets('hunter', layer, 'idle', 4) },
      walk: { frameRate: 10, repeat: -1, sheets: layerSheets('hunter', layer, 'walk', 8) },
      basic_attack: {
        frameRate: 12,
        repeat: 0,
        sheets: layerSheets('hunter', layer, 'basic_attack', 7),
      },
      hit: { frameRate: 10, repeat: 0, sheets: layerSheets('hunter', layer, 'hit', 6) },
      death: { frameRate: 8, repeat: 0, sheets: layerSheets('hunter', layer, 'death', 7) },
    }),
  });
}

/**
 * Mirrors `apps/web/public/assets/characters/hunter/metadata/hunter_*.json`. Generated by the rig
 * in `scripts/aseprite-gen/` — see that directory's README for the measurements it is built from.
 */
export const hunter: LayeredCharacter = Object.freeze({
  id: 'hunter',
  displayName: 'Cazadora',
  body: hunterLayer('body'),
  armor: hunterLayer('armor'),
  weapon: hunterLayer('weapon'),
});

/** Every layer of a layered character, in back-to-front render order. */
export function layeredCharacterSheets(character: LayeredCharacter): readonly PixelLabCharacter[] {
  return [character.body, character.armor, character.weapon];
}
