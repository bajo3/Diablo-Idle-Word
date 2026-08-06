import { describe, expect, it } from 'vitest';

import {
  darkKnight,
  mapDirection,
  mapState,
  pickAnimation,
  pixelLabKey,
  pixelLabSheetsToLoad,
  ranger,
  rootBrute,
} from './pixellab-characters';

describe('PixelLab character mapping', () => {
  it('maps the four gameplay directions onto three generated sheets, mirroring west', () => {
    expect(mapDirection('up')).toEqual({ sheet: 'north', flipX: false });
    expect(mapDirection('down')).toEqual({ sheet: 'south', flipX: false });
    expect(mapDirection('right')).toEqual({ sheet: 'east', flipX: false });
    expect(mapDirection('left')).toEqual({ sheet: 'east', flipX: true });
  });

  it('maps every visual FSM state onto an animation that was actually generated', () => {
    expect(mapState('moving')).toBe('walk');
    expect(mapState('attacking')).toBe('basic_attack');
    expect(mapState('casting')).toBe('basic_attack');
    expect(mapState('channeling')).toBe('basic_attack');
    expect(mapState('stunned')).toBe('hit');
    expect(mapState('knocked_back')).toBe('hit');
    expect(mapState('dead')).toBe('death');
    expect(mapState('downed')).toBe('death');
    expect(mapState('idle')).toBe('idle');
    expect(mapState('interacting')).toBe('idle');
    expect(mapState('reviving')).toBe('idle');
  });

  it('builds stable keys and lists every sheet the preloader must fetch', () => {
    expect(pixelLabKey(darkKnight, 'walk', 'east')).toBe('dark_knight:walk:east');
    const sheets = pixelLabSheetsToLoad(darkKnight);
    expect(sheets).toHaveLength(15);
    expect(new Set(sheets.map(({ key }) => key)).size).toBe(15);
    for (const sheet of sheets) {
      expect(sheet.path.startsWith('/assets/characters/dark_knight/full/')).toBe(true);
      expect(sheet.path.endsWith('.png')).toBe(true);
      expect(sheet.frameWidth).toBe(92);
      expect(sheet.frameHeight).toBe(92);
    }
  });

  it('declares a positive frame count for every generated animation and direction', () => {
    for (const animation of Object.values(darkKnight.animations))
      for (const direction of ['north', 'south', 'east'] as const)
        expect(animation.sheets[direction].frameCount).toBeGreaterThan(0);
  });

  it('declares the ranger enemy with the complete five-animation contract', () => {
    expect(Object.keys(ranger.animations).sort()).toEqual([
      'basic_attack',
      'death',
      'hit',
      'idle',
      'walk',
    ]);
    expect(pixelLabSheetsToLoad(ranger)).toHaveLength(15);
    expect(pickAnimation(ranger, 'stunned')).toBe('hit');
    expect(pickAnimation(ranger, 'dead')).toBe('death');
  });

  it('declares the root_brute enemy with only the three generated animations at 248x248', () => {
    expect(Object.keys(rootBrute.animations).sort()).toEqual(['basic_attack', 'idle', 'walk']);
    expect(rootBrute.frameWidth).toBe(248);
    expect(rootBrute.frameHeight).toBe(248);
    const sheets = pixelLabSheetsToLoad(rootBrute);
    expect(sheets).toHaveLength(9);
    for (const sheet of sheets) {
      expect(sheet.path.startsWith('/assets/characters/root_brute/full/')).toBe(true);
      expect(sheet.path.endsWith('.png')).toBe(true);
      expect(sheet.frameWidth).toBe(248);
      expect(sheet.frameHeight).toBe(248);
    }
    // idle is a single frame (generated from the v3 base rotations); walk/attack are six each.
    expect(rootBrute.animations.idle?.sheets.south.frameCount).toBe(1);
    expect(rootBrute.animations.walk?.sheets.south.frameCount).toBe(6);
    expect(rootBrute.animations.basic_attack?.sheets.south.frameCount).toBe(6);
  });

  it('falls back to idle when the mapped animation was not generated for a character', () => {
    // root_brute has no hit/death: stunned/dead must fall back to idle, moving/attacking resolve
    // to their own generated animations.
    expect(pickAnimation(rootBrute, 'stunned')).toBe('idle');
    expect(pickAnimation(rootBrute, 'dead')).toBe('idle');
    expect(pickAnimation(rootBrute, 'moving')).toBe('walk');
    expect(pickAnimation(rootBrute, 'attacking')).toBe('basic_attack');
    // dark_knight has all five: no fallback needed.
    expect(pickAnimation(darkKnight, 'stunned')).toBe('hit');
    expect(pickAnimation(darkKnight, 'dead')).toBe('death');
  });
});
