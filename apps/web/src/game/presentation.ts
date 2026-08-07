import type { CharacterClassId } from '@brecha/shared';

import {
  assassin,
  barbarian,
  darkKnight,
  druid,
  hunter,
  necromancer,
  paladin,
  sorceress,
  type LayeredCharacter,
  type PixelLabCharacter,
} from './pixellab-characters';

import type { Direction4, LocalCharacterState } from './domain';

/** Previous camera scale used by the local combat preview. */
export const BASE_CAMERA_ZOOM = 1.6;
/** Visible-world multiplier for the more overhead combat read requested by the player. */
export const CAMERA_DISTANCE_FACTOR = 1.75;
/** Phaser zoom is the inverse of visible-world distance. */
export const CAMERA_ZOOM = BASE_CAMERA_ZOOM / CAMERA_DISTANCE_FACTOR;
/**
 * Combat is simulated on the ground plane: every position is a pair of feet. Drawing a projectile
 * there makes an archer look like it is shooting at ankles, so the *visual* is lifted to roughly
 * chest height on a 92px silhouette anchored at `origin.y = 0.86`. Simulation still resolves on the
 * ground — this offset never reaches `projectiles.ts`, so hit detection stays deterministic.
 */
export const PROJECTILE_VISUAL_CHEST_LIFT_PX = 30;

/**
 * Breathing room the camera may scroll past the arena's edges. Without it the camera clamps hard to
 * the world rectangle, so a character standing near an edge is pinned against the canvas border
 * (worst at the top, where the HUD's floating panels sit) instead of staying comfortably in frame.
 * The backdrop is drawn over this padding too, so scrolling into it never reveals empty space.
 */
export const CAMERA_WORLD_PADDING_PX = 96;

/**
 * Health-potion belt. Charges are a per-run supply rather than a stack pulled from the inventory:
 * the item catalog has no consumable type yet, so inventing a fake `InventoryItem` would be a mock
 * dressed as a feature. The heal itself is real, so the belt can be repointed at the inventory
 * later without touching the HUD or the keybinding. Lives here (not in `runtime.ts`) so the HUD can
 * read the cooldown without importing Phaser.
 */
export const POTION = Object.freeze({ charges: 25, healFraction: 0.35, cooldownMs: 8_000 });

/** Snap the camera to the player so it never lags behind during movement. */
export const CAMERA_FOLLOW_LERP = 1;
/** No dead-zone: the local character remains the camera's target at all times. */
export const CAMERA_FOLLOW_DEADZONE = 0;

export function layerAnimationKey(
  layer: 'armor' | 'body' | 'weapon',
  state: LocalCharacterState,
  direction: Direction4,
): string {
  return `guardian_placeholder_${layer}:${state}:${direction}`;
}

/** Storage key that opts a developer into Arcade's debug gizmos. */
export const ARCADE_DEBUG_STORAGE_KEY = 'brecha:arcade-debug';

/**
 * Arcade's debug overlay draws magenta body and velocity gizmos on top of every sprite. It is
 * genuinely useful while tuning hitboxes, but it also covers the character art, so it is opt-in
 * even in development. Production can never enable it regardless of the opt-in.
 */
export function arcadeDebugEnabled(isDevelopment: boolean, optedIn: boolean): boolean {
  return isDevelopment && optedIn;
}

/** Reads the opt-in without letting a blocked or absent `localStorage` break the game boot. */
export function arcadeDebugOptIn(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    return storage?.getItem(ARCADE_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Resolves `?character=hunter` into a layered character, in development builds only.
 *
 * Lives here rather than in `runtime.ts` because this module is the Phaser-free half of the
 * presentation layer — the runtime's own unit tests deliberately never import the scene, so a
 * gate that only exists there cannot be tested.
 *
 * Gated the same way the enemy stress harness is: this is a manual override for trying rig art
 * that has no class wired to it yet, so a production bundle must keep rendering the Guardian
 * regardless of what the URL asks for. `layeredCharacterForClass` is the real, ungated path.
 */
export function layeredCharacterFromSearch(
  search: string,
  developmentMode: boolean,
): LayeredCharacter | undefined {
  if (!developmentMode) return undefined;
  const requested = new URLSearchParams(search).get('character');
  return requested === 'hunter' ? hunter : undefined;
}

/**
 * Maps a character's chosen class to its layered rig art, in every build.
 *
 * Only Amazona has approved rig art so far (`hunter` — see `scripts/aseprite-gen/README.md`); every
 * other class, and a character with no class on record yet, falls back to `undefined` so the caller
 * keeps rendering the shipped Guardian. Extend this switch as more classes get their own rig.
 */
export function layeredCharacterForClass(
  classId: CharacterClassId | undefined,
): LayeredCharacter | undefined {
  return classId === 'AMAZON' ? hunter : undefined;
}

/**
 * Resolves merged generated art for classes that do not use the layered Amazon rig. Guardian stays
 * on the shipped dark-knight asset in runtime; returning undefined here preserves that fallback.
 */
export function characterForClass(
  classId: CharacterClassId | undefined,
): PixelLabCharacter | undefined {
  return {
    ASSASSIN: assassin,
    BARBARIAN: barbarian,
    DRUID: druid,
    NECROMANCER: necromancer,
    PALADIN: paladin,
    SORCERESS: sorceress,
  }[classId as Exclude<CharacterClassId, 'GUARDIAN' | 'AMAZON'>];
}

export type ResolvedCharacterVisual = Readonly<{
  /** The sprite used as the player's base body in Phaser. */
  character: PixelLabCharacter;
  /** Present when the class uses frame-synchronised body/armor/weapon layers. */
  layeredCharacter: LayeredCharacter | undefined;
}>;

/**
 * Resolves the complete player visual in one place so a class cannot silently fall back to the
 * Guardian asset. Layered rigs use their body as the base sprite; merged classes use their own
 * generated sheet; only the legacy Guardian (or an unknown/missing class) uses darkKnight.
 */
export function resolveCharacterVisual(
  classId: CharacterClassId | undefined,
  search = '',
  developmentMode = false,
): ResolvedCharacterVisual {
  const layeredCharacter =
    layeredCharacterForClass(classId) ?? layeredCharacterFromSearch(search, developmentMode);
  if (layeredCharacter !== undefined) return { character: layeredCharacter.body, layeredCharacter };
  return { character: characterForClass(classId) ?? darkKnight, layeredCharacter: undefined };
}
