import type { Direction4, LocalCharacterState } from './domain';

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
