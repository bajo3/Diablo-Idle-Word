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
  animations: Readonly<Record<PixelLabAnimationName, PixelLabAnimation>>;
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
  return names.flatMap((name) =>
    directions.map((direction) => ({
      key: pixelLabKey(character, name, direction),
      path: character.animations[name].sheets[direction].path,
      frameWidth: character.frameWidth,
      frameHeight: character.frameHeight,
    })),
  );
}
