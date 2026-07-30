import { describe, expect, it } from 'vitest';

import { arcadeDebugEnabled, layerAnimationKey } from './presentation';

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

  it('never enables Arcade debug overlays in production', () => {
    expect(arcadeDebugEnabled(false)).toBe(false);
    expect(arcadeDebugEnabled(true)).toBe(true);
  });
});
