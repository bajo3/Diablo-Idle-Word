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

  it('requires enemy tuning to have distinct IDs and detection hysteresis', () => {
    const duplicateTuning: unknown = {
      ...GAME_DATA,
      enemyTuning: [
        GAME_DATA.enemyTuning[0]!,
        { ...GAME_DATA.enemyTuning[1]!, enemyId: GAME_DATA.enemyTuning[0]!.enemyId },
        ...GAME_DATA.enemyTuning.slice(2),
      ],
    };
    expect(() => validateGameData(duplicateTuning)).toThrow('Duplicate enemy tuning IDs');
    const noHysteresis: unknown = {
      ...GAME_DATA,
      enemyTuning: [
        {
          ...GAME_DATA.enemyTuning[0]!,
          loseTargetRadiusPx: GAME_DATA.enemyTuning[0]!.detectRadiusPx,
        },
        ...GAME_DATA.enemyTuning.slice(1),
      ],
    };
    expect(() => validateGameData(noHysteresis)).toThrow('needs hysteresis');
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

  it('validates the endless forest is a monotonic 1-20 progression', () => {
    const data = validateGameData(GAME_DATA);
    expect(data.endlessForest.minimumLevel).toBe(1);
    expect(data.endlessForest.maximumLevel).toBe(20);
    expect(data.endlessForest.levels).toHaveLength(20);
    for (let i = 0; i < data.endlessForest.levels.length; i += 1) {
      expect(data.endlessForest.levels[i]!.level).toBe(i + 1);
      if (i > 0) {
        const prev = data.endlessForest.levels[i - 1]!;
        const current = data.endlessForest.levels[i]!;
        expect(current.enemyHealthMultiplier).toBeGreaterThanOrEqual(prev.enemyHealthMultiplier);
        expect(current.enemyDamageMultiplier).toBeGreaterThanOrEqual(prev.enemyDamageMultiplier);
        expect(current.waveSize).toBeGreaterThanOrEqual(prev.waveSize);
      }
    }
    const nonMonotonic: unknown = {
      ...GAME_DATA,
      endlessForest: {
        ...GAME_DATA.endlessForest,
        levels: GAME_DATA.endlessForest.levels.map((level, index) =>
          index === 10
            ? { ...level, enemyHealthMultiplier: level.enemyHealthMultiplier - 1 }
            : level,
        ),
      },
    };
    expect(() => validateGameData(nonMonotonic)).toThrow('Endless forest scaling is not monotonic');
    const outOfSequence: unknown = {
      ...GAME_DATA,
      endlessForest: {
        ...GAME_DATA.endlessForest,
        levels: GAME_DATA.endlessForest.levels.map((level, index) =>
          index === 5 ? { ...level, level: 99 } : level,
        ),
      },
    };
    expect(() => validateGameData(outOfSequence)).toThrow('out-of-sequence level number');
  });

  it('validates the M1 class registry and rejects a broken one', () => {
    const data = validateGameData(GAME_DATA);
    expect(data.classRegistry.classes).toContainEqual(
      expect.objectContaining({ classId: 'guardian', resource: 'fury' }),
    );
    expect(data.classRegistry.classes.map(({ classId }) => classId)).toEqual([
      'guardian',
      'amazon',
      'assassin',
      'barbarian',
      'druid',
      'necromancer',
      'paladin',
      'sorceress',
    ]);
    expect(data.classRegistry.classes.find(({ classId }) => classId === 'barbarian')).toMatchObject(
      {
        resource: 'rage',
        branchIds: ['branch.barbarian.bloodsong'],
      },
    );
    expect(data.classRegistry.branches).toContainEqual(
      expect.objectContaining({
        branchId: 'branch.barbarian.bloodsong',
        classId: 'barbarian',
      }),
    );
    expect(data.classRegistry.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'node.barbarian.bloodsong.berserker_oath',
          kind: 'ultimate',
          abilityId: 'ability.barbarian.berserker_oath',
        }),
      ]),
    );
    const missingGuardian: unknown = {
      ...GAME_DATA,
      classRegistry: { ...GAME_DATA.classRegistry, classes: [] },
    };
    // An empty `classes` array already fails ClassRegistrySchema's `.min(1)`, one layer before the
    // "missing Guardian" cross-check below ever runs — both are real guards worth having.
    expect(() => validateGameData(missingGuardian)).toThrow();
    const orphanBranch: unknown = {
      ...GAME_DATA,
      classRegistry: {
        ...GAME_DATA.classRegistry,
        branches: [
          {
            branchId: 'branch.ghost.branch',
            classId: 'ghost_class',
            displayName: 'Fantasma',
            nodeIds: [],
          },
        ],
      },
    };
    expect(() => validateGameData(orphanBranch)).toThrow('Class registry is invalid');
    const mismatchedAttributes: unknown = {
      ...GAME_DATA,
      classRegistry: {
        ...GAME_DATA.classRegistry,
        classes: [
          ...GAME_DATA.classRegistry.classes.map((classDefinition, index) =>
            index === 0
              ? {
                  ...classDefinition,
                  // Same length as the real attribute set (schema requires exactly 4) but missing
                  // "vitality" and duplicating "strength", so it fails the *semantic* cross-check below
                  // rather than the Zod shape check.
                  attributeIds: ['strength', 'strength', 'dexterity', 'intelligence'],
                }
              : classDefinition,
          ),
        ],
      },
    };
    expect(() => validateGameData(mismatchedAttributes)).toThrow(
      'Guardian class registry entry has mismatched attribute references',
    );
  });

  it('validates the M1 expansion registry for five enemies and three zones', () => {
    const data = validateGameData(GAME_DATA);
    expect(data.contentExpansion.enemies.map(({ id }) => id)).toEqual([
      'spore_stalker',
      'ash_crawler',
      'veil_wraith',
      'stonebound_sentinel',
      'rift_howler',
    ]);
    expect(data.contentExpansion.maps).toHaveLength(3);
    expect(data.contentExpansion.zones).toHaveLength(3);
    const orphanZone: unknown = {
      ...GAME_DATA,
      contentExpansion: {
        ...GAME_DATA.contentExpansion,
        zones: [
          ...GAME_DATA.contentExpansion.zones,
          {
            id: 'orphan_zone',
            displayName: 'Zona huérfana',
            mapId: 'map.unknown',
            enemyIds: ['spore_stalker'],
            awayModeEligible: false,
            tuningStatus: 'TBD',
          },
        ],
      },
    };
    expect(() => validateGameData(orphanZone)).toThrow('Expansion zone references unknown map');
  });

  it('ships the Step 11 MVP content budget and a boss legendary entry', () => {
    const data = validateGameData(GAME_DATA);
    expect(data.itemDefinitions.filter((item) => item.type.startsWith('weapon'))).toHaveLength(10);
    expect(
      data.itemDefinitions.filter((item) =>
        ['helmet', 'chest', 'gloves', 'boots'].includes(item.type),
      ),
    ).toHaveLength(10);
    expect(
      data.itemDefinitions.filter((item) => ['amulet', 'ring'].includes(item.type)),
    ).toHaveLength(5);
    expect(data.affixes).toHaveLength(12);
    expect(
      data.itemDefinitions.some(
        (item) => item.id === 'item.weapon.corrupted_guardian' && item.itemPowerRange[0] >= 90,
      ),
    ).toBe(true);
    expect(
      data.lootTables[0]?.entries.some(
        (entry) =>
          entry.definitionId === 'item.weapon.corrupted_guardian' && entry.dropChance < 0.05,
      ),
    ).toBe(true);
  });
});
