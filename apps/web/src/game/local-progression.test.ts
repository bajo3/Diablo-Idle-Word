// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import {
  allocateLocalAttribute,
  applyLocalExperience,
  createLocalProgression,
  loadLocalProgression,
  resetLocalAttributes,
  saveLocalProgression,
} from './local-progression';

afterEach(() => localStorage.clear());

describe('local preview progression', () => {
  it('turns enemy XP into a level and attribute points', () => {
    const result = applyLocalExperience(createLocalProgression('preview:test'), 100);

    expect(result.levelsGained).toBe(1);
    expect(result.snapshot).toMatchObject({
      level: 2,
      experience: 100,
      xpInLevel: 0,
      xpToNextLevel: 150,
      attributePoints: 3,
    });
  });

  it('assigns one point and persists the resulting snapshot', () => {
    const leveled = applyLocalExperience(createLocalProgression('preview:test'), 100).snapshot;
    const allocated = allocateLocalAttribute(leveled, 'strength');

    expect(allocated.attributes.strength).toBe(11);
    expect(allocated.attributePoints).toBe(2);
    saveLocalProgression(allocated);
    expect(loadLocalProgression('preview:test')).toMatchObject({
      attributes: { strength: 11 },
      attributePoints: 2,
    });
  });

  it('restores all earned points when resetting preview attributes', () => {
    const leveled = applyLocalExperience(createLocalProgression('preview:test'), 100).snapshot;
    const allocated = allocateLocalAttribute(leveled, 'vitality', 2);
    const reset = resetLocalAttributes(allocated);

    expect(reset.attributes).toEqual({
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      vitality: 10,
    });
    expect(reset.attributePoints).toBe(3);
  });
});
