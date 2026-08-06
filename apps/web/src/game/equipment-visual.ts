import type { EquipmentSlot, ItemRarity } from '@brecha/shared';
import type { PixelLabCharacter } from './pixellab-characters';

/**
 * The runtime only receives the small, server-derived part of an inventory snapshot that is
 * needed to render equipment. It never receives stats or invents an equipped item locally.
 */
export type EquipmentVisualItem = Readonly<{
  instanceId: string;
  definitionId: string;
  rarity: ItemRarity;
  slot: EquipmentSlot;
}>;

export type EquipmentVisualLoadout = Readonly<{
  weapon: EquipmentVisualItem | undefined;
  armor: readonly EquipmentVisualItem[];
}>;

export type InventoryVisualSnapshot = Readonly<{
  items: readonly Readonly<{
    instanceId: string;
    definitionId: string;
    rarity: ItemRarity;
    slot?: EquipmentSlot;
    equippedSlot?: EquipmentSlot;
  }>[];
  equipment: readonly Readonly<{ itemId: string; slot: EquipmentSlot }>[];
}>;

const ARMOR_SLOTS: readonly EquipmentSlot[] = ['helmet', 'chest', 'gloves', 'boots'];
const WEAPON_SLOTS: readonly EquipmentSlot[] = ['main_hand', 'off_hand'];

/** Convert the authoritative inventory/equipment join into a deterministic render loadout. */
export function equipmentVisualFromSnapshot(
  snapshot: InventoryVisualSnapshot,
): EquipmentVisualLoadout {
  const equippedByItem = new Map(
    snapshot.equipment.map((entry) => [entry.itemId, entry.slot] as const),
  );
  const equipped = snapshot.items.flatMap((item) => {
    const slot = equippedByItem.get(item.instanceId) ?? item.equippedSlot;
    if (slot === undefined || item.slot === undefined) return [];
    return [
      {
        instanceId: item.instanceId,
        definitionId: item.definitionId,
        rarity: item.rarity,
        slot,
      } satisfies EquipmentVisualItem,
    ];
  });
  const weapon = equipped
    .filter((item) => WEAPON_SLOTS.includes(item.slot))
    .sort(
      (left, right) =>
        left.slot.localeCompare(right.slot) || left.instanceId.localeCompare(right.instanceId),
    )[0];
  const armor = equipped
    .filter((item) => ARMOR_SLOTS.includes(item.slot))
    .sort(
      (left, right) =>
        left.slot.localeCompare(right.slot) || left.instanceId.localeCompare(right.instanceId),
    );
  return Object.freeze({ weapon, armor: Object.freeze(armor) });
}

/** Stable palette used by the placeholder overlays until authored layered sprites arrive. */
export function equipmentRarityColor(rarity: ItemRarity): number {
  return {
    common: 0xb8c5c0,
    magic: 0x68a7ff,
    rare: 0xf2c14e,
    legendary: 0xd874ff,
  }[rarity];
}

export function isTwoHandedWeapon(definitionId: string): boolean {
  return definitionId.includes('two_hand') || definitionId.includes('greatsword');
}

/**
 * Procedural overlays inherit the generated character's frame contract. This validator makes that
 * inheritance explicit so an authored replacement can be swapped in without silently drifting from
 * the base animation set.
 */
export function validateEquipmentVisualCompatibility(character: PixelLabCharacter): void {
  if (character.frameWidth <= 0 || character.frameHeight <= 0)
    throw new Error('Equipment layers require positive frame dimensions.');
  if (character.origin.x !== 0.5 || character.origin.y <= 0 || character.origin.y > 1)
    throw new Error('Equipment layers require a feet-relative origin.');
  const requiredAnimations = ['idle', 'walk', 'basic_attack', 'hit', 'death'] as const;
  for (const animationName of requiredAnimations) {
    const animation = character.animations[animationName];
    if (animation === undefined) throw new Error(`Missing equipment animation: ${animationName}.`);
    for (const direction of ['north', 'south', 'east'] as const) {
      const sheet = animation.sheets[direction];
      if (!sheet.path.startsWith('/assets/') || sheet.frameCount <= 0)
        throw new Error(`Invalid equipment sheet: ${animationName}:${direction}.`);
    }
  }
}
