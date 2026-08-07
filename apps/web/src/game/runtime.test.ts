import { describe, expect, it } from 'vitest';
import type { CharacterClassId } from '@brecha/shared';

import {
  arcadeDebugEnabled,
  arcadeDebugOptIn,
  characterForClass,
  layeredCharacterForClass,
  layeredCharacterFromSearch,
  BASE_CAMERA_ZOOM,
  CAMERA_FOLLOW_DEADZONE,
  CAMERA_FOLLOW_LERP,
  CAMERA_DISTANCE_FACTOR,
  CAMERA_ZOOM,
  layerAnimationKey,
  resolveCharacterVisual,
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

describe('layeredCharacterForClass', () => {
  it('gives the Amazona her rig art in every build, no query flag required', () => {
    expect(layeredCharacterForClass('AMAZON')?.id).toBe('hunter');
  });

  it('keeps every other class, and no class at all, on the shipped Guardian', () => {
    expect(layeredCharacterForClass('GUARDIAN')).toBeUndefined();
    expect(layeredCharacterForClass('BARBARIAN')).toBeUndefined();
    expect(layeredCharacterForClass(undefined)).toBeUndefined();
  });
});

describe('characterForClass', () => {
  it('resolves generated merged art for every non-layered playable class', () => {
    for (const [classId, expectedId] of [
      ['ASSASSIN', 'assassin'],
      ['BARBARIAN', 'barbarian'],
      ['DRUID', 'druid'],
      ['NECROMANCER', 'necromancer'],
      ['PALADIN', 'paladin'],
      ['SORCERESS', 'sorceress'],
    ] as const) {
      expect(characterForClass(classId)?.id).toBe(expectedId);
      expect(characterForClass(classId)?.frameWidth).toBe(92);
    }
    expect(characterForClass('AMAZON')).toBeUndefined();
    expect(characterForClass('GUARDIAN')).toBeUndefined();
  });
});

describe('resolveCharacterVisual', () => {
  it('uses the selected class art and only keeps darkKnight for the legacy Guardian', () => {
    const expected: Readonly<Record<string, string>> = {
      GUARDIAN: 'dark_knight',
      AMAZON: 'hunter_body',
      ASSASSIN: 'assassin',
      BARBARIAN: 'barbarian',
      DRUID: 'druid',
      NECROMANCER: 'necromancer',
      PALADIN: 'paladin',
      SORCERESS: 'sorceress',
    };
    for (const [classId, characterId] of Object.entries(expected)) {
      const visual = resolveCharacterVisual(classId as CharacterClassId);
      expect(visual.character.id).toBe(characterId);
    }
    expect(resolveCharacterVisual('AMAZON').layeredCharacter?.id).toBe('hunter');
    expect(resolveCharacterVisual('GUARDIAN').layeredCharacter).toBeUndefined();
  });

  it('keeps the development hunter override layered without changing production fallback rules', () => {
    expect(resolveCharacterVisual(undefined, '?character=hunter', true).character.id).toBe(
      'hunter_body',
    );
    expect(resolveCharacterVisual(undefined, '?character=hunter', false).character.id).toBe(
      'dark_knight',
    );
  });
});
