import type { Direction4, LocalCharacterState } from './domain';

export function layerAnimationKey(
  layer: 'armor' | 'body' | 'weapon',
  state: LocalCharacterState,
  direction: Direction4,
): string {
  return `guardian_placeholder_${layer}:${state}:${direction}`;
}

export function arcadeDebugEnabled(isDevelopment: boolean): boolean {
  return isDevelopment;
}
