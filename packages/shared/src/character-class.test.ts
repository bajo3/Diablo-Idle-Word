import { describe, expect, it } from 'vitest';

import {
  CHARACTER_CLASS_OPTIONS,
  CharacterClassIdSchema,
  classRegistryIdForCharacterClass,
  isPlayableCharacterClass,
  LEGACY_CHARACTER_CLASS,
  PLAYABLE_CHARACTER_CLASS_IDS,
} from './character-class.js';

describe('character class catalog', () => {
  it('exposes the seven selectable ARPG classes and keeps the legacy Guardian ID', () => {
    expect(PLAYABLE_CHARACTER_CLASS_IDS).toHaveLength(7);
    expect(CHARACTER_CLASS_OPTIONS.map((option) => option.id)).toEqual(
      PLAYABLE_CHARACTER_CLASS_IDS,
    );
    expect(CharacterClassIdSchema.parse(LEGACY_CHARACTER_CLASS)).toBe('GUARDIAN');
  });

  it('marks Barbarian as the first differentiated profile while keeping the others provisional', () => {
    expect(CHARACTER_CLASS_OPTIONS.find((option) => option.id === 'BARBARIAN')?.sharedProfile).toBe(
      'barbarian',
    );
    expect(
      CHARACTER_CLASS_OPTIONS.filter((option) => option.id !== 'BARBARIAN').every(
        (option) => option.sharedProfile === 'guardian',
      ),
    ).toBe(true);
    expect(isPlayableCharacterClass('BARBARIAN')).toBe(true);
    expect(isPlayableCharacterClass('GUARDIAN')).toBe(false);
  });

  it('maps persisted IDs to data-driven registry IDs', () => {
    expect(classRegistryIdForCharacterClass('GUARDIAN')).toBe('guardian');
    expect(classRegistryIdForCharacterClass('BARBARIAN')).toBe('barbarian');
  });
});
