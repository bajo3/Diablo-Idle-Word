import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CharacterRepository } from './character-repository.js';
import { InventoryService } from './inventory-service.js';
import { TownService, TownTutorialConflictError } from './town-service.js';
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

describe('authoritative town economy and chest', () => {
  it('buys, replays, sells and moves an item through the persistent chest', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create({
      user: { id: 'user:town', email: 'town@local.invalid' },
      character: {
        id: 'character:town',
        name: 'Pueblo',
        class: 'GUARDIAN',
        attributes: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 },
        materials: 0n,
        inventory: { id: 'inventory:town', capacity: 4, schemaVersion: 1, items: [] },
        equipment: [],
        progress: {
          id: 'progress:town',
          level: 1,
          experience: 0n,
          attributePoints: 0,
          schemaVersion: 1,
        },
        skills: [],
      },
    });
    await db().prisma.character.update({
      where: { id: 'character:town' },
      data: { gold: 500n },
    });

    const inventory = new InventoryService(db().prisma);
    const town = new TownService(db().prisma, () => new Date(1_000));
    const initial = await town.getOwned('user:town', 'character:town');
    expect(initial.merchant.items.length).toBeGreaterThanOrEqual(5);
    expect(initial.chest).toMatchObject({ occupied: 0, capacity: 80 });
    expect(initial.tutorial.status).toBe('NOT_STARTED');

    const bought = await inventory.buy({
      actorUserId: 'user:town',
      characterId: 'character:town',
      stockId: 'merchant.iron-sword',
      operationId: 'town:buy:one',
    });
    expect(bought.replayed).toBe(false);
    expect(bought.snapshot.gold).toBe(420);
    expect(bought.snapshot.items).toHaveLength(1);
    const replay = await inventory.buy({
      actorUserId: 'user:town',
      characterId: 'character:town',
      stockId: 'merchant.iron-sword',
      operationId: 'town:buy:one',
    });
    expect(replay).toEqual({ ...bought, replayed: true });
    expect(
      await db().prisma.inventoryItem.count({ where: { characterId: 'character:town' } }),
    ).toBe(1);
    expect(await db().prisma.rewardLog.count({ where: { characterId: 'character:town' } })).toBe(1);

    const concurrent = await Promise.all([
      inventory.buy({
        actorUserId: 'user:town',
        characterId: 'character:town',
        stockId: 'merchant.iron-helm',
        operationId: 'town:buy:concurrent',
      }),
      inventory.buy({
        actorUserId: 'user:town',
        characterId: 'character:town',
        stockId: 'merchant.iron-helm',
        operationId: 'town:buy:concurrent',
      }),
    ]);
    expect(concurrent.map((receipt) => receipt.replayed).sort()).toEqual([false, true]);
    expect(
      await db().prisma.inventoryItem.count({ where: { characterId: 'character:town' } }),
    ).toBe(2);
    expect(await db().prisma.rewardLog.count({ where: { characterId: 'character:town' } })).toBe(2);

    const itemId = bought.snapshot.items[0]!.instanceId;
    const chest = await inventory.depositToChest({
      actorUserId: 'user:town',
      characterId: 'character:town',
      itemId,
      operationId: 'town:chest:deposit',
    });
    expect(chest.chest.items.map((item) => item.instanceId)).toEqual([itemId]);
    expect(chest.inventory.items).toHaveLength(1);
    expect(await db().prisma.inventoryItem.count({ where: { id: itemId } })).toBe(0);

    const chestReplay = await inventory.depositToChest({
      actorUserId: 'user:town',
      characterId: 'character:town',
      itemId,
      operationId: 'town:chest:deposit',
    });
    expect(chestReplay).toEqual({ ...chest, replayed: true });

    const withdrawn = await inventory.withdrawFromChest({
      actorUserId: 'user:town',
      characterId: 'character:town',
      itemId,
      operationId: 'town:chest:withdraw',
    });
    expect(withdrawn.inventory.items.map((item) => item.instanceId)).toContain(itemId);
    const sold = await inventory.sell({
      actorUserId: 'user:town',
      characterId: 'character:town',
      itemId,
      operationId: 'town:sell:one',
    });
    expect(sold.snapshot.gold).toBeGreaterThan(360);
    expect(await db().prisma.rewardLog.count({ where: { characterId: 'character:town' } })).toBe(3);
  });

  it('persists tutorial transitions, replay and rejects invalid transition', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create({
      user: { id: 'user:tutorial', email: 'tutorial@local.invalid' },
      character: {
        id: 'character:tutorial',
        name: 'Tutorial',
        class: 'GUARDIAN',
        attributes: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 },
        materials: 0n,
        inventory: { id: 'inventory:tutorial', capacity: 4, schemaVersion: 1, items: [] },
        equipment: [],
        progress: {
          id: 'progress:tutorial',
          level: 1,
          experience: 0n,
          attributePoints: 0,
          schemaVersion: 1,
        },
        skills: [],
      },
    });
    const town = new TownService(db().prisma, () => new Date(2_000));
    const startInput = {
      actorUserId: 'user:tutorial',
      characterId: 'character:tutorial',
      tutorialId: 'town-intro.v1' as const,
      action: 'start' as const,
      operationId: 'town:tutorial:start',
    };
    const started = await town.updateTutorial(startInput);
    expect(started.town.tutorial).toMatchObject({
      status: 'ACTIVE',
      runs: 1,
      updatedAtServerMs: 2_000,
    });
    expect(await town.updateTutorial(startInput)).toEqual({ ...started, replayed: true });
    const completed = await town.updateTutorial({
      ...startInput,
      action: 'complete',
      operationId: 'town:tutorial:complete',
    });
    expect(completed.town.tutorial.status).toBe('COMPLETED');
    const repeated = await town.updateTutorial({
      ...startInput,
      action: 'replay',
      operationId: 'town:tutorial:replay',
    });
    expect(repeated.town.tutorial).toMatchObject({ status: 'ACTIVE', runs: 2 });
    await expect(
      town.updateTutorial({ ...startInput, action: 'complete', operationId: 'town:tutorial:bad' }),
    ).resolves.toMatchObject({ town: { tutorial: { status: 'COMPLETED' } } });
    await expect(
      town.updateTutorial({
        ...startInput,
        action: 'complete',
        operationId: 'town:tutorial:invalid-after-complete',
      }),
    ).rejects.toBeInstanceOf(TownTutorialConflictError);
    expect(
      await db().prisma.characterTownOperation.count({
        where: { characterId: 'character:tutorial' },
      }),
    ).toBe(4);
  });
});
