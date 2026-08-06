import { createHash } from 'node:crypto';

import { BALANCE_VERSION, GAME_DATA, GAME_DATA_VERSION } from '@brecha/game-data';
import {
  applyDefeat,
  createForestProgressState,
  forestProgressStateFromPayload,
  forestProgressStateToPayload,
  ItemInstanceSchema,
  createSeededRandom,
  DifficultySchema,
  seedFromString,
  applyExperience,
  type ForestProgressState,
} from '@brecha/shared';
import { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';

import { CharacterNotFoundError } from '../characters/character-service.js';
import type { DatabaseClient } from './database.js';
import { createGeneratedInventoryItem, inventoryItemCreateData } from './inventory-service.js';

const REWARD_SCHEMA_VERSION = 1 as const;
const REWARD_FORMULA_VERSION = 'forest-enemy-reward.1' as const;
const maxRetries = 3;

const EnemyDefeatRewardInputSchema = z.strictObject({
  actorUserId: z.string().trim().min(1).max(128),
  characterId: z.string().trim().min(1).max(128),
  operationId: z.string().trim().min(1).max(128),
  instanceId: z.string().trim().min(1).max(128),
  enemyId: z.string().trim().min(1).max(128),
  archetype: z.string().trim().min(1).max(128),
  experience: z.number().int().positive().max(1_000_000),
  gold: z.number().int().nonnegative().max(1_000_000),
  materials: z.number().int().nonnegative().max(1_000_000),
  difficulty: DifficultySchema.optional(),
  partySize: z.number().int().min(1).max(4).optional(),
  atMs: z.number().int().nonnegative(),
});
export type EnemyDefeatRewardInput = z.infer<typeof EnemyDefeatRewardInputSchema>;
type EnemyDefeatRewardValue = Omit<EnemyDefeatRewardInput, 'difficulty' | 'partySize'> & {
  difficulty: z.infer<typeof DifficultySchema>;
  partySize: number;
};

export type EnemyRewardReceipt = Readonly<{
  operationId: string;
  characterId: string;
  instanceId: string;
  enemyId: string;
  archetype: string;
  experienceDelta: bigint;
  goldDelta: bigint;
  materialsDelta: bigint;
  experienceBalanceAfter: bigint;
  goldBalanceAfter: bigint;
  materialsBalanceAfter: bigint;
  forestLevel: number;
  forestXpInLevel: number;
  forestBestLevel: number;
  leveledUp: boolean;
  replayed: boolean;
  requestHash: string;
  dataVersion: string;
  balanceVersion: string;
  formulaVersion: string;
  schemaVersion: number;
  drop?: z.infer<typeof ItemInstanceSchema>;
  dropStatus: 'granted' | 'no_drop' | 'inventory_full';
  difficulty: z.infer<typeof DifficultySchema>;
  partySize: number;
  visibility: 'private';
}>;

export class EnemyRewardOperationConflictError extends Error {
  public constructor() {
    super('operationId was already used with a different enemy reward.');
    this.name = 'EnemyRewardOperationConflictError';
  }
}

export class EnemyRewardPersistenceError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EnemyRewardPersistenceError';
  }
}

type RewardPayload = Readonly<{
  instanceId: string;
  enemyId: string;
  archetype: string;
  forestLevel: number;
  forestXpInLevel: number;
  forestBestLevel: number;
  leveledUp: boolean;
  drop?: z.infer<typeof ItemInstanceSchema>;
  dropStatus: 'granted' | 'no_drop' | 'inventory_full';
  difficulty: z.infer<typeof DifficultySchema>;
  partySize: number;
  visibility: 'private';
}>;

const RewardPayloadSchema = z.strictObject({
  instanceId: z.string().min(1),
  enemyId: z.string().min(1),
  archetype: z.string().min(1),
  forestLevel: z.number().int().positive(),
  forestXpInLevel: z.number().int().nonnegative(),
  forestBestLevel: z.number().int().positive(),
  leveledUp: z.boolean(),
  drop: ItemInstanceSchema.optional(),
  dropStatus: z.enum(['granted', 'no_drop', 'inventory_full']).default('no_drop'),
  difficulty: DifficultySchema.default('normal'),
  partySize: z.number().int().min(1).max(4).default(1),
  visibility: z.literal('private').default('private'),
});

export function canonicalEnemyRewardHash(input: EnemyDefeatRewardInput): string {
  const value: EnemyDefeatRewardValue = {
    ...input,
    difficulty: input.difficulty ?? 'normal',
    partySize: input.partySize ?? 1,
  };
  const canonical = JSON.stringify({
    actorUserId: input.actorUserId,
    characterId: input.characterId,
    operationId: input.operationId,
    instanceId: input.instanceId,
    enemyId: input.enemyId,
    archetype: input.archetype,
    experience: input.experience,
    gold: input.gold,
    materials: input.materials,
    difficulty: value.difficulty,
    partySize: value.partySize,
    versions: {
      data: GAME_DATA_VERSION,
      balance: BALANCE_VERSION,
      formula: REWARD_FORMULA_VERSION,
      schema: REWARD_SCHEMA_VERSION,
    },
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

function toReceipt(
  log: {
    operationId: string;
    characterId: string;
    requestHash: string;
    experienceDelta: bigint;
    goldDelta: bigint;
    materialsDelta: bigint;
    experienceBalanceAfter: bigint;
    goldBalanceAfter: bigint;
    materialsBalanceAfter: bigint;
    dataVersion: string;
    balanceVersion: string;
    formulaVersion: string;
    schemaVersion: number;
    payload: Prisma.JsonValue;
  },
  replayed: boolean,
): EnemyRewardReceipt {
  const payload = RewardPayloadSchema.parse(log.payload) as RewardPayload;
  return {
    operationId: log.operationId,
    characterId: log.characterId,
    instanceId: payload.instanceId,
    enemyId: payload.enemyId,
    archetype: payload.archetype,
    experienceDelta: log.experienceDelta,
    goldDelta: log.goldDelta,
    materialsDelta: log.materialsDelta,
    experienceBalanceAfter: log.experienceBalanceAfter,
    goldBalanceAfter: log.goldBalanceAfter,
    materialsBalanceAfter: log.materialsBalanceAfter,
    forestLevel: payload.forestLevel,
    forestXpInLevel: payload.forestXpInLevel,
    forestBestLevel: payload.forestBestLevel,
    leveledUp: payload.leveledUp,
    replayed,
    requestHash: log.requestHash,
    dataVersion: log.dataVersion,
    balanceVersion: log.balanceVersion,
    formulaVersion: log.formulaVersion,
    schemaVersion: log.schemaVersion,
    ...(payload.drop === undefined ? {} : { drop: payload.drop }),
    dropStatus: payload.dropStatus,
    difficulty: payload.difficulty,
    partySize: payload.partySize,
    visibility: payload.visibility,
  };
}

export type EnemyRewardHistoryEntry = Readonly<{
  operationId: string;
  characterId: string;
  archetype: string;
  experienceDelta: string;
  goldDelta: string;
  materialsDelta: string;
  forestLevel: number;
  forestXpInLevel: number;
  forestBestLevel: number;
  leveledUp: boolean;
  drop?: z.infer<typeof ItemInstanceSchema>;
  dropStatus: 'granted' | 'no_drop' | 'inventory_full';
  difficulty: z.infer<typeof DifficultySchema>;
  partySize: number;
  visibility: 'private';
  createdAtMs: number;
}>;

function currentForestState(payload: Prisma.JsonValue | null): ForestProgressState {
  return payload === null
    ? createForestProgressState(GAME_DATA.endlessForest)
    : forestProgressStateFromPayload(payload, GAME_DATA.endlessForest);
}

async function grantEnemyDrop(
  transaction: Prisma.TransactionClient,
  character: {
    id: string;
    inventory: { id: string; capacity: number; items: readonly { id: string }[] } | null;
  },
  input: EnemyDefeatRewardInput,
  itemLevel: number,
): Promise<
  | { status: 'no_drop' | 'inventory_full' }
  | { status: 'granted'; item: z.infer<typeof ItemInstanceSchema> }
> {
  const inventory =
    character.inventory ??
    (await transaction.inventory.create({
      data: { id: `inventory:${character.id}`, characterId: character.id, capacity: 40 },
      select: { id: true, capacity: true },
    }));
  const itemCount = character.inventory?.items.length ?? 0;
  if (itemCount >= inventory.capacity) return { status: 'inventory_full' };

  const table = GAME_DATA.lootTables.find((candidate) => candidate.source === 'enemy_defeat');
  if (table === undefined) return { status: 'no_drop' };
  const random = createSeededRandom(seedFromString(`${input.operationId}:drop`));
  const candidates = table.entries.filter(
    (entry) => itemLevel >= entry.minimumLevel && itemLevel <= entry.maximumLevel,
  );
  const totalWeight = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  if (candidates.length === 0 || totalWeight <= 0) return { status: 'no_drop' };
  let cursor = random.nextInt(1, totalWeight);
  let selected = candidates[0]!;
  for (const entry of candidates) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      selected = entry;
      break;
    }
  }
  if (random.next() >= selected.dropChance) return { status: 'no_drop' };
  const instanceId = `item:${createHash('sha256')
    .update(`${input.operationId}:item`)
    .digest('hex')
    .slice(0, 48)}`;
  const item = createGeneratedInventoryItem({
    instanceId,
    definitionId: selected.definitionId,
    itemLevel,
    seed: `${input.operationId}:item:${GAME_DATA_VERSION}`,
    source: 'enemy_defeat',
  });
  await transaction.inventoryItem.create({
    data: inventoryItemCreateData(item, character.id, inventory.id),
  });
  await transaction.inventory.update({
    where: { id: inventory.id },
    data: { revision: { increment: 1 } },
  });
  return { status: 'granted', item };
}

/**
 * Grants an individual enemy defeat reward and forest progression in one serializable transaction.
 * RewardLog is the durable replay source; the same operation can safely be retried after a lost
 * response or reconnect without incrementing resources twice.
 */
export class EnemyRewardService {
  public constructor(private readonly prisma: DatabaseClient) {}

  public async applyOnce(input: EnemyDefeatRewardInput): Promise<EnemyRewardReceipt> {
    const parsed = EnemyDefeatRewardInputSchema.parse(input);
    const value: EnemyDefeatRewardValue = {
      ...parsed,
      difficulty: parsed.difficulty ?? 'normal',
      partySize: parsed.partySize ?? 1,
    };
    const requestHash = canonicalEnemyRewardHash(value);
    const experienceDelta = BigInt(value.experience);
    const goldDelta = BigInt(value.gold);
    const materialsDelta = BigInt(value.materials);

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const character = await transaction.character.findFirst({
              where: { id: value.characterId, userId: value.actorUserId, deletedAt: null },
              include: {
                progress: true,
                forestProgress: true,
                inventory: { include: { items: { select: { id: true } } } },
              },
            });
            if (character === null || character.progress === null)
              throw new CharacterNotFoundError();

            const existing = await transaction.rewardLog.findUnique({
              where: { operationId: value.operationId },
            });
            if (existing !== null) {
              if (
                existing.characterId !== value.characterId ||
                existing.requestHash !== requestHash
              )
                throw new EnemyRewardOperationConflictError();
              return toReceipt(existing, true);
            }

            const before = currentForestState(character.forestProgress?.state ?? null);
            const outcome = applyDefeat(
              before,
              {
                enemyInstanceId: value.enemyId,
                xp: value.experience,
                gold: value.gold,
                materials: value.materials,
              },
              GAME_DATA.endlessForest,
            );
            const forestAlreadyCounted = outcome.state === before;
            const effectiveExperience = forestAlreadyCounted ? 0n : experienceDelta;
            const effectiveGold = forestAlreadyCounted ? 0n : goldDelta;
            const effectiveMaterials = forestAlreadyCounted ? 0n : materialsDelta;
            const dropResult = forestAlreadyCounted
              ? { status: 'no_drop' as const }
              : await grantEnemyDrop(transaction, character, value, outcome.state.level);
            const updatedCharacter = await transaction.character.update({
              where: { id: value.characterId },
              data: {
                gold: { increment: effectiveGold },
                materials: { increment: effectiveMaterials },
                revision: { increment: 1 },
                lastSeenAt: new Date(value.atMs),
              },
              select: { gold: true, materials: true },
            });
            const progression = applyExperience(
              character.progress,
              effectiveExperience,
              GAME_DATA.progression,
            );
            const updatedProgress = await transaction.characterProgress.update({
              where: { characterId: value.characterId },
              data: {
                experience: progression.experience,
                level: progression.level,
                attributePoints: progression.attributePoints,
                revision: { increment: 1 },
              },
              select: { experience: true },
            });
            const forestPayload = forestProgressStateToPayload(outcome.state);
            if (character.forestProgress === null) {
              await transaction.characterForestProgress.create({
                data: {
                  id: `forest-progress:${value.characterId}`,
                  characterId: value.characterId,
                  formatVersion: 1,
                  stateSchemaVersion: 1,
                  dataVersion: GAME_DATA_VERSION,
                  balanceVersion: BALANCE_VERSION,
                  state: forestPayload,
                },
              });
            } else if (!forestAlreadyCounted) {
              await transaction.characterForestProgress.update({
                where: { characterId: value.characterId },
                data: {
                  formatVersion: 1,
                  stateSchemaVersion: 1,
                  dataVersion: GAME_DATA_VERSION,
                  balanceVersion: BALANCE_VERSION,
                  state: forestPayload,
                  revision: { increment: 1 },
                },
              });
            }
            const payload = {
              instanceId: value.instanceId,
              enemyId: value.enemyId,
              archetype: value.archetype,
              forestLevel: outcome.state.level,
              forestXpInLevel: outcome.state.xpInLevel,
              forestBestLevel: outcome.state.bestLevel,
              leveledUp: !forestAlreadyCounted && outcome.leveledUp,
              ...(dropResult.status === 'granted' ? { drop: dropResult.item } : {}),
              dropStatus: dropResult.status,
              difficulty: value.difficulty,
              partySize: value.partySize,
              visibility: 'private',
            } satisfies RewardPayload;
            const log = await transaction.rewardLog.create({
              data: {
                id: `reward:${value.operationId}`,
                characterId: value.characterId,
                operationId: value.operationId,
                requestHash,
                kind: 'ECONOMY',
                goldDelta: effectiveGold,
                materialsDelta: effectiveMaterials,
                experienceDelta: effectiveExperience,
                goldBalanceAfter: updatedCharacter.gold,
                materialsBalanceAfter: updatedCharacter.materials,
                experienceBalanceAfter: updatedProgress.experience,
                source: 'enemy_defeat',
                sourceId: `enemy_defeat:${requestHash}`,
                balanceVersion: BALANCE_VERSION,
                dataVersion: GAME_DATA_VERSION,
                formulaVersion: REWARD_FORMULA_VERSION,
                schemaVersion: REWARD_SCHEMA_VERSION,
                payload,
              },
            });
            return toReceipt(log, false);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (isRetryable(error) && attempt + 1 < maxRetries) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError)
          throw new EnemyRewardPersistenceError('The enemy reward transaction could not commit.', {
            cause: error,
          });
        throw error;
      }
    }
    throw new EnemyRewardPersistenceError('The enemy reward transaction exhausted its retries.');
  }

  /** Returns only this user's recent enemy receipts; no party member can query another character. */
  public async recentOwned(
    actorUserId: string,
    characterId: string,
    limit = 20,
  ): Promise<readonly EnemyRewardHistoryEntry[]> {
    const boundedLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
    const character = await this.prisma.character.findFirst({
      where: { id: characterId, userId: actorUserId, deletedAt: null },
      select: { id: true },
    });
    if (character === null) throw new CharacterNotFoundError();
    const logs = await this.prisma.rewardLog.findMany({
      where: { characterId, source: 'enemy_defeat' },
      orderBy: { createdAt: 'desc' },
      take: boundedLimit,
    });
    return logs.map((log) => {
      const payload = RewardPayloadSchema.parse(log.payload) as RewardPayload;
      return {
        operationId: log.operationId,
        characterId: log.characterId,
        archetype: payload.archetype,
        experienceDelta: log.experienceDelta.toString(),
        goldDelta: log.goldDelta.toString(),
        materialsDelta: log.materialsDelta.toString(),
        forestLevel: payload.forestLevel,
        forestXpInLevel: payload.forestXpInLevel,
        forestBestLevel: payload.forestBestLevel,
        leveledUp: payload.leveledUp,
        ...(payload.drop === undefined ? {} : { drop: payload.drop }),
        dropStatus: payload.dropStatus,
        difficulty: payload.difficulty,
        partySize: payload.partySize,
        visibility: payload.visibility,
        createdAtMs: log.createdAt.getTime(),
      };
    });
  }
}
