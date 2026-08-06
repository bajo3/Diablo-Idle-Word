import { describe, expect, it } from 'vitest';

import {
  CHARACTER_CLASS_OPTIONS,
  CharacterClassIdSchema,
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

  it('marks every selectable class as the same provisional combat profile', () => {
    expect(CHARACTER_CLASS_OPTIONS.every((option) => option.sharedProfile === 'guardian')).toBe(
      true,
    );
    expect(isPlayableCharacterClass('BARBARIAN')).toBe(true);
    expect(isPlayableCharacterClass('GUARDIAN')).toBe(false);
  });
});
