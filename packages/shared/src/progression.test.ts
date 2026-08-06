import { describe, expect, it } from 'vitest';

import {
  applyExperience,
  deriveCharacterStats,
  levelForExperience,
  totalAttributePoints,
  type CharacterProgressionConfig,
} from './progression.js';

const config: CharacterProgressionConfig = {
  formulaVersion: 'character-progression.1',
  minimumLevel: 1,
  maximumLevel: 10,
  xpToReachLevel: [0, 100, 250, 450, 700, 1_000, 1_350, 1_750, 2_200, 2_700],
  attributePointsPerLevel: 3,
  resetCostPerLevel: 100,
};

describe('character progression', () => {
  it('uses the centralized cumulative curve and caps at level 10', () => {
    expect(levelForExperience(0n, config)).toBe(1);
    expect(levelForExperience(249n, config)).toBe(2);
    expect(levelForExperience(2_700n, config)).toBe(10);
    expect(levelForExperience(999_999n, config)).toBe(10);
  });

  it('awards only server-derived attribute points when crossing levels', () => {
    expect(applyExperience({ experience: 90n, level: 1, attributePoints: 0 }, 20n, config)).toEqual(
      {
        experience: 110n,
        level: 2,
        levelsGained: 1,
        attributePoints: 3,
      },
    );
  });

  it('derives combat stats from allocated attributes without mutating input', () => {
    const attributes = { strength: 12, dexterity: 8, intelligence: 10, vitality: 15 };
    expect(deriveCharacterStats(attributes)).toMatchObject({
      maxHealth: 280,
      physicalDamageMin: 32,
      armor: 42,
    });
    expect(totalAttributePoints(4, config)).toBe(9);
    expect(attributes).toEqual({ strength: 12, dexterity: 8, intelligence: 10, vitality: 15 });
  });
});
