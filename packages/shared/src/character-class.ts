import { z } from 'zod';

/** Stable persisted IDs. GUARDIAN is retained for characters created before class selection. */
export const CharacterClassIdSchema = z.enum([
  'GUARDIAN',
  'AMAZON',
  'ASSASSIN',
  'BARBARIAN',
  'DRUID',
  'NECROMANCER',
  'PALADIN',
  'SORCERESS',
]);
export type CharacterClassId = z.infer<typeof CharacterClassIdSchema>;

export const PLAYABLE_CHARACTER_CLASS_IDS = [
  'AMAZON',
  'ASSASSIN',
  'BARBARIAN',
  'DRUID',
  'NECROMANCER',
  'PALADIN',
  'SORCERESS',
] as const satisfies readonly CharacterClassId[];

export type CharacterClassOption = Readonly<{
  id: (typeof PLAYABLE_CHARACTER_CLASS_IDS)[number];
  displayName: string;
  archetype: string;
  description: string;
  sharedProfile: 'guardian';
}>;

/** UI may present these names, but combat intentionally resolves every option to Guardian for now. */
export const CHARACTER_CLASS_OPTIONS: readonly CharacterClassOption[] = Object.freeze([
  {
    id: 'AMAZON',
    displayName: 'Amazona',
    archetype: 'Cazadora',
    description: 'Perfil común provisional: combate del Guardián.',
    sharedProfile: 'guardian',
  },
  {
    id: 'ASSASSIN',
    displayName: 'Asesina',
    archetype: 'Ágil',
    description: 'Perfil común provisional: combate del Guardián.',
    sharedProfile: 'guardian',
  },
  {
    id: 'BARBARIAN',
    displayName: 'Bárbara',
    archetype: 'Melee',
    description: 'Perfil común provisional: combate del Guardián.',
    sharedProfile: 'guardian',
  },
  {
    id: 'DRUID',
    displayName: 'Druida',
    archetype: 'Híbrida',
    description: 'Perfil común provisional: combate del Guardián.',
    sharedProfile: 'guardian',
  },
  {
    id: 'NECROMANCER',
    displayName: 'Nigromante',
    archetype: 'Invocador',
    description: 'Perfil común provisional: combate del Guardián.',
    sharedProfile: 'guardian',
  },
  {
    id: 'PALADIN',
    displayName: 'Paladín',
    archetype: 'Defensiva',
    description: 'Perfil común provisional: combate del Guardián.',
    sharedProfile: 'guardian',
  },
  {
    id: 'SORCERESS',
    displayName: 'Hechicera',
    archetype: 'Mística',
    description: 'Perfil común provisional: combate del Guardián.',
    sharedProfile: 'guardian',
  },
]);

export const LEGACY_CHARACTER_CLASS: CharacterClassId = 'GUARDIAN';

export function characterClassDisplayName(id: CharacterClassId): string {
  if (id === LEGACY_CHARACTER_CLASS) return 'Guardián';
  return CHARACTER_CLASS_OPTIONS.find((option) => option.id === id)?.displayName ?? id;
}

export function isPlayableCharacterClass(value: CharacterClassId): boolean {
  return PLAYABLE_CHARACTER_CLASS_IDS.includes(
    value as (typeof PLAYABLE_CHARACTER_CLASS_IDS)[number],
  );
}
