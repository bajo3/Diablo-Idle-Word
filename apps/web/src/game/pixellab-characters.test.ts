import { describe, expect, it } from 'vitest';

import {
  darkKnight,
  mapDirection,
  mapState,
  pixelLabKey,
  pixelLabSheetsToLoad,
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
});
