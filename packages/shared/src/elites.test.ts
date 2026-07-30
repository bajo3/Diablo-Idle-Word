import { describe, expect, it } from 'vitest';

import {
  applyEliteModifier,
  selectEliteModifier,
  ELITE_MODIFIERS,
  type EliteScalableTuning,
} from './elites.js';

const base: EliteScalableTuning = { maxHealth: 40, armor: 5, moveSpeedPxPerSec: 90 };

describe('elite modifiers', () => {
  it('has at least two distinct modifiers', () => {
    expect(ELITE_MODIFIERS.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ELITE_MODIFIERS.map(({ id }) => id)).size).toBe(ELITE_MODIFIERS.length);
  });

  it('selects deterministically from the seeded random source', () => {
    expect(selectEliteModifier({ nextInt: () => 0, next: () => 0 }).id).toBe('veloz');
    expect(
      selectEliteModifier({ nextInt: () => ELITE_MODIFIERS.length - 1, next: () => 0 }).id,
    ).toBe('resistente');
  });

  it('Veloz scales speed only, leaving health and armor untouched', () => {
    const veloz = ELITE_MODIFIERS.find(({ id }) => id === 'veloz')!;
    expect(applyEliteModifier(base, veloz)).toEqual({
      maxHealth: 40,
      armor: 5,
      moveSpeedPxPerSec: 135,
    });
  });

  it('Resistente scales health and armor only, leaving speed untouched', () => {
    const resistente = ELITE_MODIFIERS.find(({ id }) => id === 'resistente')!;
    expect(applyEliteModifier(base, resistente)).toEqual({
      maxHealth: 70,
      armor: 15,
      moveSpeedPxPerSec: 90,
    });
  });
});
