import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CharacterRepository } from './character-repository.js';
import {
  EconomyOperationConflictError,
  EconomyService,
  InsufficientResourcesError,
} from './economy-service.js';
import { migrateCharacterSave, UnknownSaveVersionError } from './contracts.js';
import { createTestPostgres, type TestPostgres } from './test-postgres.js';

let database: TestPostgres | undefined;

function db(): TestPostgres {
  if (database === undefined) throw new Error('Test database did not initialize.');
  return database;
}

function characterInput(suffix: string, item = true) {
  return {
    user: { id: `user:${suffix}`, email: `${suffix}@local.invalid` },
    character: {
      id: `character:${suffix}`,
      name: `Character ${suffix}`,
      attributes: { strength: 21, dexterity: 12, intelligence: 8, vitality: 17 },
      materials: 7n,
      inventory: {
        id: `inventory:${suffix}`,
        capacity: 60,
        schemaVersion: 1 as const,
        items: item
          ? [
              {
                id: `item:${suffix}`,
                definitionId: 'guardian:starter_sword',
                rarity: 'common',
                itemPower: 12,
                favorite: true,
                affixes: [{ key: 'strength', value: 2 }],
                generationData: { seed: suffix },
                quantity: 1,
              },
            ]
          : [],
      },
      equipment: item
        ? [{ id: `equipment:${suffix}`, inventoryItemId: `item:${suffix}`, slot: 'MAIN_HAND' }]
        : [],
      progress: {
        id: `progress:${suffix}`,
        level: 2,
        experience: 50n,
        attributePoints: 1,
        schemaVersion: 1 as const,
      },
      skills: [
        {
          id: `skill:${suffix}`,
          abilityId: 'guardian:basic_attack',
          level: 1,
          unlocked: true,
          equipped: true,
          barSlot: 0,
        },
      ],
    },
  };
}

beforeAll(async () => {
  database = await createTestPostgres();
});

afterAll(async () => {
  await database?.cleanup();
});

describe('PostgreSQL persistence', () => {
  it('migrates an empty isolated database with all required tables and constraints', async () => {
    const tables = await db().prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `;
    expect(tables.map((table) => table.table_name)).toEqual(
      expect.arrayContaining([
        'User',
        'Character',
        'Inventory',
        'InventoryItem',
        'Equipment',
        'CharacterSkill',
        'CharacterProgress',
        'AwayCalibration',
        'AwaySession',
        'AwayResult',
        'MissionResult',
        'RewardLog',
      ]),
    );
    const constraints = await db().prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname IN (
        'Character_values_valid', 'InventoryItem_values_valid', 'Equipment_inventoryItemId_characterId_fkey',
        'CharacterSkill_values_valid', 'AwaySession_values_valid', 'RewardLog_values_valid'
      )
    `;
    expect(constraints).toHaveLength(6);
  });

  it('runs the explicit seed twice without duplicating its aggregate', async () => {
    await db().seed();
    await db().seed();
    expect(await db().prisma.user.count({ where: { id: 'user:seed' } })).toBe(1);
    expect(await db().prisma.character.count({ where: { id: 'character:seed-guardian' } })).toBe(1);
  });

  it('round-trips attributes, materials, inventory, equipment, skills and progress', async () => {
    const repository = new CharacterRepository(db().prisma);
    const created = await repository.create(characterInput('roundtrip'));
    const loaded = await repository.getOwned('user:roundtrip', 'character:roundtrip');
    expect(loaded).toEqual(created);
    expect(loaded?.attributes).toEqual({
      strength: 21,
      dexterity: 12,
      intelligence: 8,
      vitality: 17,
    });
    expect(loaded?.materials).toBe(7n);
    expect(loaded?.inventory.items[0]?.affixes).toEqual([{ key: 'strength', value: 2 }]);
    expect(loaded?.equipment[0]?.inventoryItemId).toBe('item:roundtrip');
    expect(loaded?.skills[0]).toMatchObject({ unlocked: true, equipped: true, barSlot: 0 });
    expect(await repository.getOwned('user:other', 'character:roundtrip')).toBeNull();
  });

  it('enforces database ownership and value checks', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create(characterInput('owner-a'));
    await repository.create(characterInput('owner-b', false));
    await db().prisma.inventoryItem.create({
      data: {
        id: 'item:owner-a-unlocked',
        characterId: 'character:owner-a',
        inventoryId: 'inventory:owner-a',
        definitionId: 'guardian:starter_shield',
        rarity: 'common',
        itemPower: 1,
        quantity: 1,
      },
    });
    await expect(
      db().prisma.equipment.create({
        data: {
          id: 'equipment:cross-owner',
          characterId: 'character:owner-b',
          inventoryItemId: 'item:owner-a-unlocked',
          slot: 'OFF_HAND',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db().prisma.$executeRawUnsafe(
        'UPDATE "InventoryItem" SET "quantity" = 0 WHERE "id" = $1',
        'item:owner-a',
      ),
    ).rejects.toThrow();
    await expect(
      db().prisma.$executeRawUnsafe(
        'UPDATE "CharacterSkill" SET "barSlot" = 4 WHERE "id" = $1',
        'skill:owner-a',
      ),
    ).rejects.toThrow();
  });

  it('accepts version 1 saves and rejects unknown save versions', () => {
    expect(
      migrateCharacterSave({
        formatVersion: 1,
        userId: 'user:roundtrip',
        characterId: 'character:roundtrip',
        revision: 1,
        savedAtServerMs: 0,
        inventorySchemaVersion: 1,
        awaySnapshotSchemaVersion: 1,
        payload: { gold: 0n, materials: 0n, level: 1, experience: 0n },
      }).formatVersion,
    ).toBe(1);
    expect(() => migrateCharacterSave({ formatVersion: 999 })).toThrow(UnknownSaveVersionError);
  });

  it('returns an immutable original economy receipt across retries and concurrent operations', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create(characterInput('economy', false));
    const economy = new EconomyService(db().prisma);
    const base = {
      actorUserId: 'user:economy',
      characterId: 'character:economy',
      source: 'test_grant',
      sourceId: 'source:economy',
      goldDelta: 100n,
      materialsDelta: 9n,
      experienceDelta: 20n,
      versions: { balance: '1', data: '1', formula: '1', schema: 1 as const },
    };
    const receiptA = await economy.applyOnce({ ...base, operationId: 'operation:a' });
    await economy.applyOnce({
      ...base,
      operationId: 'operation:b',
      sourceId: 'source:b',
      goldDelta: 7n,
    });
    expect(await economy.applyOnce({ ...base, operationId: 'operation:a' })).toEqual(receiptA);

    const concurrent = {
      ...base,
      operationId: 'operation:concurrent',
      sourceId: 'source:concurrent',
    };
    const [receiptC1, receiptC2] = await Promise.all([
      economy.applyOnce(concurrent),
      economy.applyOnce(concurrent),
    ]);
    expect(receiptC1).toEqual(receiptC2);
    await expect(
      economy.applyOnce({ ...base, operationId: 'operation:a', goldDelta: 101n }),
    ).rejects.toBeInstanceOf(EconomyOperationConflictError);
    await expect(
      economy.applyOnce({ ...base, operationId: 'operation:a', sourceId: 'source:changed' }),
    ).rejects.toBeInstanceOf(EconomyOperationConflictError);
    await expect(
      economy.applyOnce({ ...base, operationId: 'operation:rollback', materialsDelta: -999n }),
    ).rejects.toBeInstanceOf(InsufficientResourcesError);

    const character = await repository.getOwned('user:economy', 'character:economy');
    expect(character?.gold).toBe(207n);
    expect(character?.materials).toBe(34n);
    expect(character?.progress.experience).toBe(110n);
    expect(await db().prisma.rewardLog.count({ where: { characterId: 'character:economy' } })).toBe(
      3,
    );
  });
});
