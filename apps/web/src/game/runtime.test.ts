import { describe, expect, it } from 'vitest';

import {
  arcadeDebugEnabled,
  arcadeDebugOptIn,
  layeredCharacterFromSearch,
  BASE_CAMERA_ZOOM,
  CAMERA_FOLLOW_DEADZONE,
  CAMERA_FOLLOW_LERP,
  CAMERA_DISTANCE_FACTOR,
  CAMERA_ZOOM,
  layerAnimationKey,
} from './presentation';
import { clampWorldPosition, constrainDummyKnockback } from './runtime-movement';

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

  it('uses a more overhead view and keeps the camera locked to the player', () => {
    expect(CAMERA_DISTANCE_FACTOR).toBe(1.75);
    expect(CAMERA_ZOOM).toBeCloseTo(BASE_CAMERA_ZOOM / CAMERA_DISTANCE_FACTOR, 8);
    expect(CAMERA_ZOOM).toBeCloseTo(0.914286, 5);
    expect(CAMERA_FOLLOW_LERP).toBe(1);
    expect(CAMERA_FOLLOW_DEADZONE).toBe(0);
  });

  it('keeps movement free across decorative scenery and only applies world bounds', () => {
    expect(constrainDummyKnockback({ x: 200, y: 300 }, { x: 500, y: 300 })).toEqual({
      x: 500,
      y: 300,
    });
    expect(clampWorldPosition({ x: -100, y: 900 })).toEqual({ x: 72, y: 648 });
  });

  it('holds the whole 92px silhouette inside the arena when walking north', () => {
    // The sprite reaches ~79px above its world position, so the top edge needs a taller margin
    // than the sides: at y = 72 the head would leave the world and the camera could not follow it.
    expect(clampWorldPosition({ x: 640, y: 0 }).y).toBe(88);
    expect(clampWorldPosition({ x: 640, y: 80 }).y).toBe(88);
    expect(clampWorldPosition({ x: 640, y: 300 }).y).toBe(300);
  });
});

describe('layeredCharacterFromSearch', () => {
  it('resolves the rig-generated hunter only in development', () => {
    expect(layeredCharacterFromSearch('?character=hunter', true)?.id).toBe('hunter');
    // Production must keep rendering the shipped Guardian no matter what the URL asks for: the
    // rig art is still under review and is not part of the approved asset set.
    expect(layeredCharacterFromSearch('?character=hunter', false)).toBeUndefined();
    expect(layeredCharacterFromSearch('', true)).toBeUndefined();
    expect(layeredCharacterFromSearch('?character=nope', true)).toBeUndefined();
  });

  it('exposes three pixel-aligned layers sharing one origin', () => {
    const character = layeredCharacterFromSearch('?character=hunter', true);
    const layers = [character?.body, character?.armor, character?.weapon];
    for (const layer of layers) {
      expect(layer?.frameWidth).toBe(92);
      expect(layer?.origin).toEqual({ x: 0.5, y: 0.86 });
      // Equipment that does not animate frame-for-frame with the body would slide off it.
      expect(Object.keys(layer?.animations ?? {})).toEqual(
        Object.keys(character?.body.animations ?? {}),
      );
    }
    expect(new Set(layers.map((layer) => layer?.id)).size).toBe(3);
  });
});
