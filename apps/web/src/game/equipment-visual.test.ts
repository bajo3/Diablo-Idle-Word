import { describe, expect, it } from 'vitest';

import {
  equipmentRarityColor,
  equipmentVisualFromSnapshot,
  isTwoHandedWeapon,
  validateEquipmentVisualCompatibility,
  weaponSilhouetteForDefinition,
} from './equipment-visual';
import { darkKnight } from './pixellab-characters';

describe('equipment visual adapter', () => {
  it('only exposes server-equipped weapons and armor in a stable order', () => {
    const loadout = equipmentVisualFromSnapshot({
      equipment: [
        { itemId: 'armor:chest', slot: 'chest' },
        { itemId: 'weapon:main', slot: 'main_hand' },
      ],
      items: [
        {
          instanceId: 'weapon:unused',
          definitionId: 'item.weapon.iron_sword',
          rarity: 'common',
          slot: 'main_hand',
        },
        {
          instanceId: 'armor:chest',
          definitionId: 'item.armor.root_plate',
          rarity: 'rare',
          slot: 'chest',
        },
        {
          instanceId: 'weapon:main',
          definitionId: 'item.weapon.corrupted_greatsword',
          rarity: 'legendary',
          slot: 'main_hand',
        },
        {
          instanceId: 'ring:one',
          definitionId: 'item.accessory.ash_ring',
          rarity: 'magic',
          slot: 'ring_1',
        },
      ],
    });
    expect(loadout.weapon).toMatchObject({
      instanceId: 'weapon:main',
      rarity: 'legendary',
      slot: 'main_hand',
    });
    expect(loadout.armor).toHaveLength(1);
    expect(loadout.armor[0]).toMatchObject({ instanceId: 'armor:chest', slot: 'chest' });
  });

  it('keeps rarity colors distinct and identifies two-handed silhouettes', () => {
    expect(
      new Set(
        ['common', 'magic', 'rare', 'legendary'].map((rarity) =>
          equipmentRarityColor(rarity as 'common' | 'magic' | 'rare' | 'legendary'),
        ),
      ).size,
    ).toBe(4);
    expect(isTwoHandedWeapon('item.weapon.corrupted_greatsword')).toBe(true);
    expect(isTwoHandedWeapon('item.weapon.iron_sword')).toBe(false);
  });

  it('validates that procedural layers inherit every generated animation and direction', () => {
    expect(() => validateEquipmentVisualCompatibility(darkKnight)).not.toThrow();
  });

  it('reads a weapon silhouette from its item id, defaulting to sword', () => {
    expect(weaponSilhouetteForDefinition('item.weapon.dusk_axe')).toBe('axe');
    expect(weaponSilhouetteForDefinition('item.weapon.root_hammer')).toBe('hammer');
    expect(weaponSilhouetteForDefinition('item.weapon.briar_spear')).toBe('polearm');
    expect(weaponSilhouetteForDefinition('item.weapon.guardian_halberd')).toBe('polearm');
    expect(weaponSilhouetteForDefinition('item.weapon.iron_sword')).toBe('sword');
    expect(weaponSilhouetteForDefinition('item.weapon.corrupted_greatsword')).toBe('sword');
    expect(weaponSilhouetteForDefinition('item.weapon.unlisted_flail')).toBe('sword');
  });
});
