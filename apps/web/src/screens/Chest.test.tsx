// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gameApi, type ChestSnapshot, type InventorySnapshot } from '../api';
import { Chest } from './Chest';

const baseInventory = (items: InventorySnapshot['items']): InventorySnapshot => ({
  characterId: 'character:chest',
  capacity: 4,
  revision: 1,
  schemaVersion: 1,
  items,
  equipment: [],
  gold: 0,
  materials: 0,
  derivedStats: {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    vitality: 10,
    armor: 0,
    physical_damage: 0,
    critical_chance: 0,
    attack_speed_minor: 0,
    max_health: 0,
  },
  gameDataVersion: 'test',
});
const item = {
  instanceId: 'item:chest:one',
  definitionId: 'item.weapon.iron_sword',
  itemLevel: 1,
  rarity: 'common' as const,
  itemPower: 10,
  baseStats: [],
  affixes: [],
  generationSeed: 'seed:one',
  generatorVersion: 'test',
  source: 'test',
  quantity: 1,
  displayName: 'Espada',
  type: 'weapon_one_hand',
  slot: 'main_hand' as const,
  favorite: false,
  sellValue: 10,
};
const chest = (items: ChestSnapshot['items']): ChestSnapshot => ({
  characterId: 'character:chest',
  capacity: 80,
  revision: 1,
  schemaVersion: 1,
  items,
  gameDataVersion: 'test',
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Chest', () => {
  it('moves an inventory item through the confirmed deposit command', async () => {
    vi.spyOn(gameApi, 'chest').mockResolvedValue({
      chest: chest([]),
      inventory: baseInventory([item]),
    });
    vi.spyOn(gameApi, 'depositChest').mockResolvedValue({
      receipt: {
        operationId: 'deposit',
        requestHash: 'hash',
        kind: 'chest_deposit',
        replayed: false,
        chest: chest([item]),
        inventory: baseInventory([]),
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Chest characterId="character:chest" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(gameApi.depositChest).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: 'item:chest:one', characterId: 'character:chest' }),
      ),
    );
  });
});
