import { describe, expect, it } from 'vitest';

import { createSeededRandom } from './random.js';
import {
  generateItemInstance,
  ItemDefinitionSchema,
  ItemGenerationConfigSchema,
  rollRarity,
  type AffixDefinition,
  type ItemDefinition,
  type ItemGenerationConfig,
} from './items.js';

const definition: ItemDefinition = {
  id: 'weapon.guardian.test',
  displayName: 'Espada de prueba',
  type: 'weapon_one_hand',
  slot: 'main_hand',
  itemPowerRange: [10, 14],
  baseStats: [{ stat: 'strength', min: 2, max: 4 }],
  tuningStatus: 'PROVISIONAL',
};
const affixes: readonly AffixDefinition[] = [
  {
    id: 'affix.power.test',
    displayName: 'Fuerza',
    family: 'offense',
    stat: 'strength',
    min: 1,
    max: 3,
    tuningStatus: 'PROVISIONAL',
  },
  {
    id: 'affix.armor.test',
    displayName: 'Armadura',
    family: 'defense',
    stat: 'armor',
    min: 2,
    max: 4,
    tuningStatus: 'PROVISIONAL',
  },
];
const config: ItemGenerationConfig = {
  generatorVersion: 'items.mvp.1',
  rarityWeights: [
    { rarity: 'common' as const, weight: 80 },
    { rarity: 'magic' as const, weight: 15 },
    { rarity: 'rare' as const, weight: 4 },
    { rarity: 'legendary' as const, weight: 1 },
  ],
  affixCountByRarity: { common: 0, magic: 1, rare: 2, legendary: 1 },
};

describe('shared item generation', () => {
  it('validates definition/config contracts and produces the same instance for a fixed seed', () => {
    expect(ItemDefinitionSchema.parse(definition)).toEqual(definition);
    expect(ItemGenerationConfigSchema.parse(config)).toEqual(config);
    const first = generateItemInstance({
      definition,
      affixes,
      config,
      instanceId: 'item:test:one',
      seed: 'seed:test:one',
      source: 'enemy_defeat',
      itemLevel: 3,
      rarity: 'rare',
    });
    const replay = generateItemInstance({
      definition,
      affixes,
      config,
      instanceId: 'item:test:one',
      seed: 'seed:test:one',
      source: 'enemy_defeat',
      itemLevel: 3,
      rarity: 'rare',
    });
    expect(first).toEqual(replay);
    expect(first.affixes).toHaveLength(2);
    expect(first.baseStats).toHaveLength(1);
    expect(new Set(first.affixes.map((affix) => affix.id)).size).toBe(2);
  });

  it('keeps rarity rolls bounded and deterministic', () => {
    const random = createSeededRandom(42);
    const result = rollRarity(config.rarityWeights, random);
    expect(['common', 'magic', 'rare', 'legendary']).toContain(result);
    expect(rollRarity([{ rarity: 'common', weight: 1 }], createSeededRandom(1))).toBe('common');
  });

  it('rejects definitions with no compatible slot for equipment', () => {
    expect(() =>
      ItemDefinitionSchema.parse({ ...definition, type: 'helmet', slot: undefined }),
    ).toThrow();
  });
});
