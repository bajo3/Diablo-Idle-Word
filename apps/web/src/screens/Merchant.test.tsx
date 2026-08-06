// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gameApi, type InventorySnapshot, type TownSnapshot } from '../api';
import { Merchant } from './Merchant';

const inventory = (overrides: Partial<InventorySnapshot> = {}): InventorySnapshot => ({
  characterId: 'character:merchant',
  capacity: 4,
  revision: 1,
  schemaVersion: 1,
  items: [],
  equipment: [],
  gold: 200,
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
  ...overrides,
});
const town = (): TownSnapshot => ({
  characterId: 'character:merchant',
  characterName: 'Muro',
  level: 1,
  availability: 'AVAILABLE',
  gold: 200,
  materials: 0,
  inventory: { occupied: 0, capacity: 4 },
  portal: {
    zoneId: 'corrupted_forest',
    label: 'Bosque Corrupto',
    active: true,
    destination: 'expedition',
    awayAvailable: true,
  },
  merchant: {
    catalogVersion: 'town.mvp.1',
    items: [
      {
        stockId: 'merchant.iron-sword',
        definitionId: 'item.weapon.iron_sword',
        itemLevel: 1,
        rarity: 'common',
        price: 80,
        displayName: 'Espada de hierro',
        type: 'weapon_one_hand',
        slot: 'main_hand',
        itemPowerRange: [8, 14],
      },
    ],
  },
  chest: { capacity: 80, occupied: 0, revision: 1, schemaVersion: 1 },
  tutorial: { id: 'town-intro.v1', status: 'COMPLETED', runs: 1, updatedAtServerMs: 1 },
  gameDataVersion: 'test',
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Merchant', () => {
  it('confirms and sends a server-side buy operation', async () => {
    vi.spyOn(gameApi, 'town').mockResolvedValue({ town: town() });
    vi.spyOn(gameApi, 'inventory').mockResolvedValue({ inventory: inventory() });
    vi.spyOn(gameApi, 'buyItem').mockResolvedValue({
      receipt: {
        operationId: 'buy',
        requestHash: 'hash',
        kind: 'buy',
        replayed: false,
        snapshot: inventory({ gold: 120, items: [] }),
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Merchant characterId="character:merchant" onBack={vi.fn()} />);
    await screen.findByText('Espada de hierro');
    fireEvent.click(screen.getAllByRole('button', { name: 'Comprar' })[1]!);
    await waitFor(() =>
      expect(gameApi.buyItem).toHaveBeenCalledWith(
        expect.objectContaining({
          stockId: 'merchant.iron-sword',
          characterId: 'character:merchant',
        }),
      ),
    );
  });
});
