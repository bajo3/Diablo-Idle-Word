import { describe, expect, it } from 'vitest';

import { GAME_DATA } from './catalog.js';
import { ItemTypeDefinitionSchema } from './schemas.js';
import { validateGameData } from './validation.js';

describe('game data catalog', () => {
  it('validates the complete Step 2 catalog and semantic Guardian definitions', () => {
    const data = validateGameData(GAME_DATA);
    expect(data).toMatchObject({
      guardian: { id: 'guardian' },
      zone: { id: 'corrupted_forest' },
      mission: { id: 'mission.corrupted_forest.breach' },
    });
    expect(data.attributes.find(({ id }) => id === 'strength')?.semanticEffects).toEqual([
      'physical_damage',
      'heavy_equipment_access',
      'armor',
    ]);
    expect(data.abilities.find(({ id }) => id === 'ability.guardian.slash')?.mechanics).toEqual([
      'short_frontal_targeting',
      'nearby_multi_target',
      'generates_fury',
    ]);
    expect(
      data.abilities.find(({ id }) => id === 'ability.guardian.iron_skin')?.mechanics,
    ).toContain('not_invulnerable');
  });

  it('rejects strict-schema extras and invalid data-driven types as unknown inputs', () => {
    expect(() => validateGameData({ ...GAME_DATA, unexpected: true })).toThrow();
    const invalidEnemy: unknown = {
      ...GAME_DATA,
      enemies: [
        { ...GAME_DATA.enemies[0], behaviors: ['invisible'] },
        ...GAME_DATA.enemies.slice(1),
      ],
    };
    expect(() => validateGameData(invalidEnemy)).toThrow();
    const invalidAbility: unknown = {
      ...GAME_DATA,
      abilities: [
        { ...GAME_DATA.abilities[0], mechanics: ['teleport_everywhere'] },
        ...GAME_DATA.abilities.slice(1),
      ],
    };
    expect(() => validateGameData(invalidAbility)).toThrow();
  });

  it('makes materials non-equippable and rejects incompatible equipment slots', () => {
    expect(
      ItemTypeDefinitionSchema.safeParse({
        id: 'material',
        compatibleSlots: [],
        tuningStatus: 'TBD',
      }).success,
    ).toBe(true);
    expect(
      ItemTypeDefinitionSchema.safeParse({
        id: 'material',
        compatibleSlots: ['main_hand'],
        tuningStatus: 'TBD',
      }).success,
    ).toBe(false);
    expect(
      ItemTypeDefinitionSchema.safeParse({
        id: 'shield',
        compatibleSlots: ['main_hand'],
        tuningStatus: 'TBD',
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate IDs, orphaned references and incomplete AI graphs', () => {
    const duplicate: unknown = {
      ...GAME_DATA,
      abilities: [
        { ...GAME_DATA.abilities[0] },
        { ...GAME_DATA.abilities[1], id: GAME_DATA.abilities[0]!.id },
        ...GAME_DATA.abilities.slice(2),
      ],
    };
    expect(() => validateGameData(duplicate)).toThrow('Duplicate ability IDs');
    const orphan: unknown = { ...GAME_DATA, zone: { ...GAME_DATA.zone, mapId: 'map.unknown' } };
    expect(() => validateGameData(orphan)).toThrow('Zone references unknown map');
    const incompleteAi: unknown = {
      ...GAME_DATA,
      enemies: [
        {
          ...GAME_DATA.enemies[0],
          aiStates: [
            'idle',
            'patrol',
            'detect',
            'chase',
            'attack',
            'use_ability',
            'retreat',
            'stunned',
            'stunned',
          ],
        },
        ...GAME_DATA.enemies.slice(1),
      ],
    };
    expect(() => validateGameData(incompleteAi)).toThrow('Enemy has invalid AI state graph');
  });

  it('requires versioned provisional combat tuning for every Guardian ability', () => {
    expect(GAME_DATA.guardianCombat).toMatchObject({
      combatFormulaVersion: 'guardian-combat.1',
      tuningStatus: 'PROVISIONAL',
    });
    const missingCombatAbility: unknown = {
      ...GAME_DATA,
      guardianCombat: {
        ...GAME_DATA.guardianCombat,
        abilities: [
          GAME_DATA.guardianCombat.abilities[0]!,
          GAME_DATA.guardianCombat.abilities[1]!,
          GAME_DATA.guardianCombat.abilities[2]!,
          GAME_DATA.guardianCombat.abilities[3]!,
          GAME_DATA.guardianCombat.abilities[3]!,
        ],
      },
    };
    expect(() => validateGameData(missingCombatAbility)).toThrow(
      'Guardian combat tuning is missing ability',
    );
  });

  it('rejects asset, sheet and animation graph failures', () => {
    const unknownAnimation: unknown = {
      ...GAME_DATA,
      assets: [{ ...GAME_DATA.assets[0], animationIds: ['animation.unknown'] }],
    };
    expect(() => validateGameData(unknownAnimation)).toThrow('Asset references unknown animation');
    const missingManifestAnimation: unknown = {
      ...GAME_DATA,
      assets: [
        { ...GAME_DATA.assets[0], animationIds: GAME_DATA.assets[0]!.animationIds.slice(1) },
      ],
    };
    expect(() => validateGameData(missingManifestAnimation)).toThrow(
      'Animation is missing from asset manifest',
    );
    const sheetMismatch: unknown = {
      ...GAME_DATA,
      assets: [
        {
          ...GAME_DATA.assets[0],
          spriteSheet: { ...GAME_DATA.assets[0]!.spriteSheet!, id: 'sheet.unknown' },
        },
      ],
    };
    expect(() => validateGameData(sheetMismatch)).toThrow(
      'Sprite sheet has no matching asset manifest entry',
    );
  });
});
