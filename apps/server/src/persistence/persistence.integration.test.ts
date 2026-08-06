import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GAME_DATA } from '@brecha/game-data';
import { applyDefeat, forestProgressStateFromPayload } from '@brecha/shared';

import { CharacterRepository } from './character-repository.js';
import {
  InteractionAuthorityService,
  InteractionOperationConflictError,
} from '../characters/interaction-service.js';
import {
  InteractionEffectConflictError,
  InteractionEffectService,
} from '../characters/interaction-effects.js';
import {
  EconomyOperationConflictError,
  EconomyService,
  InsufficientResourcesError,
} from './economy-service.js';
import { EnemyRewardOperationConflictError, EnemyRewardService } from './enemy-reward-service.js';
import { migrateCharacterSave, UnknownSaveVersionError } from './contracts.js';
import {
  ForestProgressRepository,
  ForestProgressRevisionConflictError,
} from './forest-progress-repository.js';
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
      class: 'GUARDIAN' as const,
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
        'CharacterForestProgress',
        'CharacterInteractionState',
        'CharacterInteractionReceipt',
        'CharacterInteractionEffect',
      ]),
    );
    const constraints = await db().prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname IN (
        'Character_values_valid', 'InventoryItem_values_valid', 'Equipment_inventoryItemId_characterId_fkey',
        'CharacterSkill_values_valid', 'AwaySession_values_valid', 'RewardLog_values_valid',
        'CharacterForestProgress_values_valid', 'CharacterInteractionState_values_valid',
        'CharacterInteractionEffect_values_valid'
      )
    `;
    expect(constraints).toHaveLength(9);
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

  it('round-trips forest progress with a versioned snapshot and rejects stale revisions', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create(characterInput('forest-progress', false));
    const forest = new ForestProgressRepository(db().prisma);
    const initial = await forest.getOwned('user:forest-progress', 'character:forest-progress');
    expect(initial.revision).toBe(1);
    expect(initial.payload).toMatchObject({ level: 1, xpInLevel: 0, countedDefeats: [] });

    const current = forestProgressStateFromPayload(initial.payload, GAME_DATA.endlessForest);
    const next = applyDefeat(
      current,
      { enemyInstanceId: 'enemy:forest-progress:1', xp: 10, gold: 0, materials: 0 },
      GAME_DATA.endlessForest,
    ).state;
    const saved = await forest.saveOwned(
      'user:forest-progress',
      'character:forest-progress',
      next,
      initial.revision,
    );
    expect(saved.revision).toBe(2);
    expect(saved.payload.countedDefeats).toEqual(['enemy:forest-progress:1']);
    expect(await forest.getOwned('user:forest-progress', 'character:forest-progress')).toEqual(
      saved,
    );
    await expect(
      forest.saveOwned(
        'user:forest-progress',
        'character:forest-progress',
        current,
        initial.revision,
      ),
    ).rejects.toBeInstanceOf(ForestProgressRevisionConflictError);
  });

  it('authorizes interactions from server position, persists receipts and rejects replay conflicts', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create(characterInput('interaction-authority', false));
    const interactions = new InteractionAuthorityService(db().prisma);
    const chestCommand = {
      schemaVersion: 1,
      operationId: '33333333-3333-4333-8333-333333333333',
      zoneId: 'corrupted_forest',
      targetId: 'chest:forest:01',
    } as const;
    const first = await interactions.apply(
      'user:interaction-authority',
      'character:interaction-authority',
      chestCommand,
      { actorPosition: { x: 220, y: 160 }, nowMs: 100 },
    );
    expect(first).toMatchObject({
      replayed: false,
      stateRevision: 2,
      receipt: {
        accepted: true,
        actorId: 'character:interaction-authority',
        targetId: 'chest:forest:01',
        kind: 'chest',
      },
    });
    expect(
      await db().prisma.characterInteractionState.findUniqueOrThrow({
        where: { characterId: 'character:interaction-authority' },
      }),
    ).toMatchObject({
      schemaVersion: 2,
      state: { consumedTargetIds: ['chest:forest:01'], cooldowns: [] },
    });

    const replay = await interactions.apply(
      'user:interaction-authority',
      'character:interaction-authority',
      chestCommand,
      { actorPosition: { x: 999, y: 999 }, nowMs: 999 },
    );
    expect(replay).toEqual({ ...first, replayed: true });

    const consumedAgain = await interactions.apply(
      'user:interaction-authority',
      'character:interaction-authority',
      {
        ...chestCommand,
        operationId: '44444444-4444-4444-8444-444444444444',
      },
      { actorPosition: { x: 220, y: 160 }, nowMs: 200 },
    );
    expect(consumedAgain.receipt).toMatchObject({ accepted: false, reason: 'already_consumed' });

    await expect(
      interactions.apply(
        'user:interaction-authority',
        'character:interaction-authority',
        { ...chestCommand, targetId: 'npc:forest:scout' },
        { actorPosition: { x: 160, y: 285 }, nowMs: 300 },
      ),
    ).rejects.toBeInstanceOf(InteractionOperationConflictError);

    const distantCommand = {
      ...chestCommand,
      operationId: '55555555-5555-4555-8555-555555555555',
      targetId: 'npc:forest:scout',
    };
    const distant = await interactions.apply(
      'user:interaction-authority',
      'character:interaction-authority',
      distantCommand,
      { actorPosition: { x: 900, y: 900 }, nowMs: 400 },
    );
    expect(distant.receipt).toMatchObject({ accepted: false, reason: 'out_of_range' });
    const npcCommand = {
      schemaVersion: 1,
      operationId: '66666666-6666-4666-8666-666666666666',
      zoneId: 'corrupted_forest',
      targetId: 'npc:forest:scout',
    } as const;
    const npc = await interactions.apply(
      'user:interaction-authority',
      'character:interaction-authority',
      npcCommand,
      { actorPosition: { x: 160, y: 285 }, nowMs: 500 },
    );
    expect(npc).toMatchObject({
      replayed: false,
      stateRevision: 3,
      receipt: {
        accepted: true,
        resultId: 'dialogue.forest.scout',
        durationMs: 250,
        startedAtMs: 500,
        completesAtMs: 750,
      },
    });
    const npcCooldown = await interactions.apply(
      'user:interaction-authority',
      'character:interaction-authority',
      { ...npcCommand, operationId: '77777777-7777-4777-8777-777777777777' },
      { actorPosition: { x: 160, y: 285 }, nowMs: 600 },
    );
    expect(npcCooldown.receipt).toMatchObject({ accepted: false, reason: 'cooldown' });
    const reviveCommand = {
      schemaVersion: 1,
      operationId: '99999999-9999-4999-8999-999999999999',
      zoneId: 'corrupted_forest',
      targetId: 'revive:forest:altar',
    } as const;
    const revive = await interactions.apply(
      'user:interaction-authority',
      'character:interaction-authority',
      reviveCommand,
      {
        actorPosition: { x: 330, y: 160 },
        actorState: 'active',
        nowMs: 1_000,
        effectCharacterId: 'character:downed-party-member',
      },
    );
    expect(revive.receipt).toMatchObject({
      accepted: true,
      resultId: 'revive.forest.altar',
      effectCharacterId: 'character:downed-party-member',
    });
    expect(
      await interactions.effectCharacterForOperation(
        'user:interaction-authority',
        'character:interaction-authority',
        reviveCommand.operationId,
      ),
    ).toBe('character:downed-party-member');
    expect(await db().prisma.characterInteractionReceipt.count()).toBe(6);

    await repository.create(characterInput('interaction-legacy', false));
    await db().prisma.characterInteractionState.update({
      where: { characterId: 'character:interaction-legacy' },
      data: { schemaVersion: 1, state: { consumedTargetIds: [] } },
    });
    const legacy = await interactions.apply(
      'user:interaction-legacy',
      'character:interaction-legacy',
      { ...chestCommand, operationId: '88888888-8888-4888-8888-888888888888' },
      { actorPosition: { x: 220, y: 160 }, nowMs: 900 },
    );
    expect(legacy.receipt).toMatchObject({ accepted: true, resultId: 'chest.reward.forest.basic' });
    expect(
      await db().prisma.characterInteractionState.findUniqueOrThrow({
        where: { characterId: 'character:interaction-legacy' },
      }),
    ).toMatchObject({ schemaVersion: 2, state: { cooldowns: [] } });
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

  it('grants individual enemy rewards with forest progress and durable replay', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create(characterInput('enemy-reward', false));
    const rewards = new EnemyRewardService(db().prisma);
    const input = {
      actorUserId: 'user:enemy-reward',
      characterId: 'character:enemy-reward',
      operationId: 'reward:forest:enemy:one',
      instanceId: 'instance:corrupted_forest:enemy-reward',
      enemyId: 'enemy:forest:one',
      archetype: 'corrupted_minion',
      experience: 10,
      gold: 5,
      materials: 1,
      atMs: 10_000,
    } as const;
    const first = await rewards.applyOnce(input);
    expect(first).toMatchObject({
      replayed: false,
      enemyId: input.enemyId,
      experienceDelta: 10n,
      goldDelta: 5n,
      materialsDelta: 1n,
      forestLevel: 1,
      forestXpInLevel: 10,
    });
    expect(await rewards.applyOnce(input)).toEqual({ ...first, replayed: true });
    await expect(rewards.applyOnce({ ...input, gold: 6 })).rejects.toBeInstanceOf(
      EnemyRewardOperationConflictError,
    );
    const character = await repository.getOwned('user:enemy-reward', 'character:enemy-reward');
    expect(character?.gold).toBe(5n);
    expect(character?.materials).toBe(8n);
    expect(character?.progress.experience).toBe(60n);
    expect(
      (
        await db().prisma.characterForestProgress.findUnique({
          where: { characterId: 'character:enemy-reward' },
        })
      )?.state,
    ).toMatchObject({ level: 1, xpInLevel: 10, countedDefeats: [input.enemyId] });
    expect(await db().prisma.rewardLog.count({ where: { operationId: input.operationId } })).toBe(
      1,
    );
  });

  it('serializes concurrent rewards, keeps drops private and exposes only owned results', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create(characterInput('reward-concurrent-a', false));
    await repository.create(characterInput('reward-concurrent-b', false));
    const rewards = new EnemyRewardService(db().prisma);
    const base = {
      actorUserId: 'user:reward-concurrent-a',
      characterId: 'character:reward-concurrent-a',
      instanceId: 'instance:corrupted_forest:reward-concurrent',
      archetype: 'corrupted_minion',
      experience: 10,
      gold: 5,
      materials: 1,
      difficulty: 'veteran' as const,
      partySize: 2,
      atMs: 20_000,
    };
    const operation = { ...base, operationId: 'reward:drop:1', enemyId: 'enemy:drop:1' };
    const receipts = await Promise.all([
      rewards.applyOnce(operation),
      rewards.applyOnce(operation),
    ]);
    expect(receipts.map(({ replayed }) => replayed).sort()).toEqual([false, true]);
    const first = receipts.find(({ replayed }) => !replayed);
    const replay = receipts.find(({ replayed }) => replayed);
    expect(first).toBeDefined();
    expect(replay).toBeDefined();
    expect(first).toMatchObject({
      dropStatus: 'granted',
      difficulty: 'veteran',
      partySize: 2,
      visibility: 'private',
    });
    expect(replay).toMatchObject({ replayed: true, drop: first?.drop });
    expect(
      await db().prisma.inventoryItem.count({
        where: { characterId: 'character:reward-concurrent-a' },
      }),
    ).toBe(1);

    const history = await rewards.recentOwned(
      'user:reward-concurrent-a',
      'character:reward-concurrent-a',
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ operationId: operation.operationId, visibility: 'private' });
    await expect(
      rewards.recentOwned('user:reward-concurrent-b', 'character:reward-concurrent-a'),
    ).rejects.toBeInstanceOf(Error);

    const other = await rewards.applyOnce({
      ...base,
      actorUserId: 'user:reward-concurrent-b',
      characterId: 'character:reward-concurrent-b',
      operationId: 'reward:drop:4',
      enemyId: 'enemy:drop:4',
    });
    expect(other.characterId).toBe('character:reward-concurrent-b');
    expect(
      await db().prisma.rewardLog.count({
        where: {
          source: 'enemy_defeat',
          characterId: { in: ['character:reward-concurrent-a', 'character:reward-concurrent-b'] },
        },
      }),
    ).toBe(2);
  });

  it('records interaction effects exactly once and preserves pending loot authorization', async () => {
    const repository = new CharacterRepository(db().prisma);
    await repository.create(characterInput('interaction-effects', false));
    const effects = new InteractionEffectService(db().prisma);
    const chest = {
      userId: 'user:interaction-effects',
      characterId: 'character:interaction-effects',
      operationId: 'effect:chest',
      resultId: 'chest.reward.forest.basic',
    };
    const first = await effects.applyOnce(chest);
    expect(first).toMatchObject({
      effectType: 'loot_authorization',
      status: 'PENDING_DOMAIN',
      replayed: false,
    });
    expect(await effects.applyOnce(chest)).toEqual({ ...first, replayed: true });
    await expect(
      effects.applyOnce({ ...chest, resultId: 'dialogue.forest.scout' }),
    ).rejects.toBeInstanceOf(InteractionEffectConflictError);
    const revive = await effects.applyOnce({
      ...chest,
      operationId: 'effect:revive',
      resultId: 'revive.forest.altar',
    });
    expect(revive).toMatchObject({ effectType: 'revive', status: 'APPLIED' });
    expect(
      await db().prisma.characterInteractionEffect.count({
        where: { characterId: 'character:interaction-effects' },
      }),
    ).toBe(2);
  });
});
