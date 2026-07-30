import { describe, expect, it } from 'vitest';

import { arcadeDebugEnabled, arcadeDebugOptIn, layerAnimationKey } from './presentation';

describe('Paso 6 runtime presentation contracts', () => {
  it('keeps body, armor and weapon animation keys on the same state and direction', () => {
    expect([
      layerAnimationKey('body', 'moving', 'left'),
      layerAnimationKey('armor', 'moving', 'left'),
      layerAnimationKey('weapon', 'moving', 'left'),
    ]).toEqual([
      'guardian_placeholder_body:moving:left',
      'guardian_placeholder_armor:moving:left',
      'guardian_placeholder_weapon:moving:left',
    ]);
  });

  it('never enables Arcade debug overlays in production, and keeps them opt-in in development', () => {
    expect(arcadeDebugEnabled(false, false)).toBe(false);
    expect(arcadeDebugEnabled(false, true)).toBe(false);
    expect(arcadeDebugEnabled(true, false)).toBe(false);
    expect(arcadeDebugEnabled(true, true)).toBe(true);
  });

  it('reads the debug opt-in defensively, treating absent or throwing storage as off', () => {
    expect(arcadeDebugOptIn({ getItem: () => '1' })).toBe(true);
    expect(arcadeDebugOptIn({ getItem: () => '0' })).toBe(false);
    expect(arcadeDebugOptIn({ getItem: () => null })).toBe(false);
    expect(arcadeDebugOptIn(undefined)).toBe(false);
    expect(
      arcadeDebugOptIn({
        getItem: () => {
          throw new Error('blocked by browser privacy settings');
        },
      }),
    ).toBe(false);
  });
});
