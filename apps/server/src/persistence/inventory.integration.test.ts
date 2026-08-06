import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CharacterRepository } from './character-repository.js';
import {
  InventoryOperationConflictError,
  InventoryService,
  ProtectedInventoryItemError,
  createGeneratedInventoryItem,
  inventoryItemCreateData,
} from './inventory-service.js';
import { createTestPostgres, type TestPostgres } from './test-postgres.js';

let database: TestPostgres | undefined;
function db(): TestPostgres {
  if (database === undefined) throw new Error('Test database did not initialize.');
  return database;
}

beforeAll(async () => {
  database = await createTestPostgres();
});
afterAll(async () => {
  await database?.cleanup();
});

describe('authoritative inventory operations', () => {
  it('equips, derives stats, replays idempotently and protects favorites', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create({
      user: { id: 'user:inventory', email: 'inventory@local.invalid' },
      character: {
        id: 'character:inventory',
        name: 'Inventario',
        class: 'GUARDIAN',
        attributes: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 },
        materials: 0n,
        inventory: { id: 'inventory:inventory', capacity: 4, schemaVersion: 1, items: [] },
        equipment: [],
        progress: {
          id: 'progress:inventory',
          level: 1,
          experience: 0n,
          attributePoints: 0,
          schemaVersion: 1,
        },
        skills: [],
      },
    });
    const item = createGeneratedInventoryItem({
      instanceId: 'item:inventory:sword',
      definitionId: 'item.weapon.iron_sword',
      itemLevel: 1,
      seed: 'seed:inventory:sword',
      source: 'test',
    });
    await db().prisma.inventoryItem.create({
      data: inventoryItemCreateData(item, 'character:inventory', 'inventory:inventory'),
    });

    const service = new InventoryService(db().prisma);
    const equipped = await service.equip({
      actorUserId: 'user:inventory',
      characterId: 'character:inventory',
      itemId: item.instanceId,
      operationId: 'inventory-op:equip',
    });
    expect(equipped.snapshot.equipment).toContainEqual({
      itemId: item.instanceId,
      slot: 'main_hand',
    });
    expect(equipped.snapshot.derivedStats.strength).toBeGreaterThan(10);

    const replay = await service.equip({
      actorUserId: 'user:inventory',
      characterId: 'character:inventory',
      itemId: item.instanceId,
      operationId: 'inventory-op:equip',
    });
    expect(replay.replayed).toBe(true);
    expect(await db().prisma.inventoryOperation.count()).toBe(1);

    await service.favorite({
      actorUserId: 'user:inventory',
      characterId: 'character:inventory',
      itemId: item.instanceId,
      favorite: true,
      operationId: 'inventory-op:favorite',
    });
    await expect(
      service.sell({
        actorUserId: 'user:inventory',
        characterId: 'character:inventory',
        itemId: item.instanceId,
        operationId: 'inventory-op:sell-protected',
      }),
    ).rejects.toBeInstanceOf(ProtectedInventoryItemError);

    await expect(
      service.equip({
        actorUserId: 'user:other',
        characterId: 'character:inventory',
        itemId: item.instanceId,
        operationId: 'inventory-op:foreign',
      }),
    ).rejects.toThrow('Character');
  });

  it('rejects operation reuse with a changed canonical command', async () => {
    const service = new InventoryService(db().prisma);
    await expect(
      service.favorite({
        actorUserId: 'user:inventory',
        characterId: 'character:inventory',
        itemId: 'item:inventory:sword',
        favorite: false,
        operationId: 'inventory-op:favorite',
      }),
    ).rejects.toBeInstanceOf(InventoryOperationConflictError);
  });
});
