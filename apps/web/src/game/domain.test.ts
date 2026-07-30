import { describe, expect, it } from 'vitest';

import {
  animationRange,
  localAssetManifest,
  validateAssetManifest,
  validateLoadedFrameCount,
} from './assets';
import { motionFromInput, resolveCharacterState } from './domain';

describe('Paso 6 local game contracts', () => {
  it('normalizes diagonal movement and keeps a valid four-direction facing', () => {
    const motion = motionFromInput(1, -1, 'down');
    expect(Math.hypot(motion.x, motion.y)).toBeCloseTo(1);
    expect(motion.direction).toBe('up');
    expect(motion.state).toBe('moving');
    expect(motionFromInput(0, 0, 'left')).toEqual({ x: 0, y: 0, direction: 'left', state: 'idle' });
  });

  it('never interrupts dead, in either direction', () => {
    expect(resolveCharacterState('dead', 'idle')).toBe('dead');
    expect(resolveCharacterState('dead', 'moving')).toBe('dead');
    expect(resolveCharacterState('idle', 'dead')).toBe('dead');
    expect(resolveCharacterState('attacking', 'dead')).toBe('dead');
  });
  it('blocks attack-like requests while downed but allows everything else', () => {
    expect(resolveCharacterState('downed', 'attacking')).toBe('downed');
    expect(resolveCharacterState('downed', 'casting')).toBe('downed');
    expect(resolveCharacterState('downed', 'channeling')).toBe('downed');
    expect(resolveCharacterState('downed', 'reviving')).toBe('reviving');
    expect(resolveCharacterState('downed', 'idle')).toBe('idle');
  });
  it('blocks movement and abilities while stunned but allows idle/dead/downed', () => {
    expect(resolveCharacterState('stunned', 'moving')).toBe('stunned');
    expect(resolveCharacterState('stunned', 'attacking')).toBe('stunned');
    expect(resolveCharacterState('stunned', 'casting')).toBe('stunned');
    expect(resolveCharacterState('stunned', 'channeling')).toBe('stunned');
    expect(resolveCharacterState('stunned', 'idle')).toBe('idle');
    expect(resolveCharacterState('stunned', 'downed')).toBe('downed');
  });
  it('otherwise defers to whatever state was requested', () => {
    expect(resolveCharacterState('idle', 'moving')).toBe('moving');
    expect(resolveCharacterState('attacking', 'idle')).toBe('idle');
    expect(resolveCharacterState('channeling', 'stunned')).toBe('stunned');
  });
  it('rejects incomplete placeholder layer metadata', () => {
    expect(() => validateAssetManifest(localAssetManifest)).not.toThrow();
    expect(() => validateAssetManifest(localAssetManifest.slice(0, 3))).toThrow('Missing layer');
    expect(() =>
      validateAssetManifest([
        { ...localAssetManifest[0]!, path: 'bad' },
        ...localAssetManifest.slice(1),
      ]),
    ).toThrow('frame contract');
    expect(() =>
      validateAssetManifest([
        { ...localAssetManifest[0]!, frame: { ...localAssetManifest[0]!.frame, count: 15 } },
        ...localAssetManifest.slice(1),
      ]),
    ).toThrow('frame contract');
    expect(() =>
      validateAssetManifest([
        { ...localAssetManifest[0]!, directions: ['up', 'up', 'left', 'right'] },
        ...localAssetManifest.slice(1),
      ]),
    ).toThrow('directions');
    expect(() =>
      validateAssetManifest([
        {
          ...localAssetManifest[0]!,
          animations: [{ ...localAssetManifest[0]!.animations[0]!, end: 99 }],
        },
        ...localAssetManifest.slice(1),
      ]),
    ).toThrow('animation');
    expect(() =>
      validateAssetManifest([
        { ...localAssetManifest[0]!, animations: localAssetManifest[0]!.animations.slice(1) },
        ...localAssetManifest.slice(1),
      ]),
    ).toThrow('Orphan');
    expect(() =>
      validateAssetManifest([
        { ...localAssetManifest[0]!, layer: 'body', id: 'guardian_placeholder_body' },
        ...localAssetManifest.slice(1),
      ]),
    ).toThrow('Duplicate layer');
    expect(() =>
      validateAssetManifest([
        {
          ...localAssetManifest[0]!,
          animations: [
            { ...localAssetManifest[0]!.animations[0]!, start: 2, end: 2 },
            ...localAssetManifest[0]!.animations.slice(1),
          ],
        },
        ...localAssetManifest.slice(1),
      ]),
    ).toThrow('animation');
  });

  it('requires exact post-load frame counts and aligned state/direction ranges', () => {
    for (const asset of localAssetManifest) {
      expect(() => validateLoadedFrameCount(asset, 17)).not.toThrow();
      expect(() => validateLoadedFrameCount(asset, 16)).toThrow('loaded frame count');
      expect(asset.animations).toEqual(
        expect.arrayContaining([
          animationRange('idle', 'up'),
          animationRange('moving', 'up'),
          animationRange('idle', 'down'),
          animationRange('moving', 'down'),
          animationRange('idle', 'left'),
          animationRange('moving', 'left'),
          animationRange('idle', 'right'),
          animationRange('moving', 'right'),
        ]),
      );
    }
  });
});
