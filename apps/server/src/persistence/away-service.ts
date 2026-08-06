import { createHash } from 'node:crypto';
import { BALANCE_VERSION, GAME_DATA, GAME_DATA_VERSION } from '@brecha/game-data';
import {
  AwayMetricsSchema,
  AwayResultSchema,
  BuildSnapshotSchema,
  DifficultySchema,
  awayLootRaritySequence,
  awayRatePerHour,
  calculateAwayReward,
  type AwayMetrics,
  type AwayResult,
  type BuildSnapshot,
  type CharacterClassId,
  type Difficulty,
  type ItemInstance,
} from '@brecha/shared';
import { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';

import { CharacterNotFoundError } from '../characters/character-service.js';
import { applyExperience } from '@brecha/shared';
import type { DatabaseClient } from './database.js';
import { createGeneratedInventoryItem, inventoryItemCreateData } from './inventory-service.js';

const AWAY_SCHEMA_VERSION = 1 as const;
const AWAY_FORMULA_VERSION = GAME_DATA.balance.awayMode.formulaVersion;
const maxRetries = 3;
const CALIBRATION_SECONDS = GAME_DATA.balance.awayMode.calibrationSeconds;
const MAX_DURATION_SECONDS = GAME_DATA.balance.awayMode.maximumRewardSeconds;

const AwayCommandBaseSchema = z.strictObject({
  actorUserId: z.string().trim().min(1).max(128),
  characterId: z.string().trim().min(1).max(128),
});
export const StartAwayCalibrationInputSchema = AwayCommandBaseSchema.extend({
  operationId: z.string().trim().min(1).max(128),
  zoneId: z.literal('corrupted_forest'),
  difficulty: DifficultySchema,
});
export const CompleteAwayCalibrationInputSchema = AwayCommandBaseSchema.extend({
  calibrationId: z.string().trim().min(1).max(128),
});
export const ActivateAwayInputSchema = AwayCommandBaseSchema.extend({
  calibrationId: z.string().trim().min(1).max(128),
  operationId: z.string().trim().min(1).max(128),
});
export const ReturnAwayInputSchema = AwayCommandBaseSchema.extend({
  operationId: z.string().trim().min(1).max(128),
});
export const ClaimAwayInputSchema = AwayCommandBaseSchema;
export type StartAwayCalibrationInput = z.infer<typeof StartAwayCalibrationInputSchema>;
export type CompleteAwayCalibrationInput = z.infer<typeof CompleteAwayCalibrationInputSchema>;
export type ActivateAwayInput = z.infer<typeof ActivateAwayInputSchema>;
export type ReturnAwayInput = z.infer<typeof ReturnAwayInputSchema>;
export type ClaimAwayInput = z.infer<typeof ClaimAwayInputSchema>;

export type AwayCalibrationView = Readonly<{
  id: string;
  state: 'NOT_STARTED' | 'RUNNING' | 'VALID' | 'INVALID' | 'ACTIVATED';
  zoneId: string;
  difficulty: Difficulty;
  buildFingerprint: string;
  startedAtServerMs?: number;
  completedAtServerMs?: number;
  validDurationSeconds: number;
  invalidReason?: string;
  metrics: AwayMetrics;
  estimatePerHour: { experience: number; gold: number; materials: number; enemies: number };
}>;

export type AwaySessionView = Readonly<{
  id: string;
  calibrationId: string;
  state: 'ACTIVE' | 'COMPLETED' | 'REWARD_PENDING' | 'CLAIMED' | 'CANCELLED';
  startedAtServerMs: number;
  endedAtServerMs?: number;
  maxDurationSeconds: number;
  zoneId: string;
  difficulty: Difficulty;
}>;

export type AwayResultView = Readonly<{
  id: string;
  state: 'PENDING' | 'CLAIMED' | 'REJECTED';
  report: AwayResult;
  claimedItems: readonly ItemInstance[];
}>;

export type AwayStatus = Readonly<{
  characterId: string;
  availability: string;
  serverNowMs: number;
  calibration?: AwayCalibrationView;
  session?: AwaySessionView;
  result?: AwayResultView;
}>;

export type AwayClaimReceipt = Readonly<{
  operationId: string;
  result: AwayResultView;
  replayed: boolean;
}>;

export class AwayOperationConflictError extends Error {
  public constructor() {
    super('The away operation was already used with a different request.');
    this.name = 'AwayOperationConflictError';
  }
}
export class AwayStateConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AwayStateConflictError';
  }
}
export class AwayCalibrationIncompleteError extends Error {
  public readonly remainingSeconds: number;
  public constructor(remainingSeconds: number) {
    super(`Calibration needs ${remainingSeconds} more seconds.`);
    this.name = 'AwayCalibrationIncompleteError';
    this.remainingSeconds = remainingSeconds;
  }
}
export class AwayNotFoundError extends Error {
  public constructor() {
    super('Away calibration or session not found.');
    this.name = 'AwayNotFoundError';
  }
}

type Clock = () => Date;
type Transaction = Prisma.TransactionClient;

export class AwayService {
  public constructor(
    private readonly prisma: DatabaseClient,
    private readonly now: Clock = () => new Date(),
  ) {}

  public async status(actorUserId: string, characterId: string): Promise<AwayStatus> {
    const character = await this.prisma.character.findFirst({
      where: { id: characterId, userId: actorUserId, deletedAt: null },
      include: {
        calibrations: { orderBy: { createdAt: 'desc' }, take: 1 },
        awaySessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { result: true },
        },
      },
    });
    if (character === null) throw new CharacterNotFoundError();
    const calibration = character.calibrations[0];
    const session = character.awaySessions[0];
    return {
      characterId,
      availability: character.availability,
      serverNowMs: this.now().getTime(),
      ...(calibration === undefined ? {} : { calibration: calibrationView(calibration) }),
      ...(session === undefined ? {} : { session: sessionView(session) }),
      ...(session?.result === null || session?.result === undefined
        ? {}
        : { result: resultView(session.result) }),
    };
  }

  public async startCalibration(input: StartAwayCalibrationInput): Promise<AwayStatus> {
    const value = StartAwayCalibrationInputSchema.parse(input);
    const startedAt = this.now();
    const calibrationId = `calibration:${value.operationId}`;
    await this.prisma.$transaction(
      async (transaction) => {
        const character = await this.characterWithBuild(
          transaction,
          value.actorUserId,
          value.characterId,
        );
        const existing = await transaction.awayCalibration.findUnique({
          where: { id: calibrationId },
        });
        if (existing !== null) {
          if (
            existing.characterId !== value.characterId ||
            existing.zoneId !== value.zoneId ||
            existing.difficulty !== value.difficulty
          )
            throw new AwayOperationConflictError();
          return;
        }
        if (character.availability !== 'AVAILABLE')
          throw new AwayStateConflictError('Character is not available.');
        const build = buildSnapshot(character);
        await transaction.awayCalibration.create({
          data: {
            id: calibrationId,
            characterId: value.characterId,
            state: 'RUNNING',
            zoneId: value.zoneId,
            difficulty: value.difficulty,
            buildFingerprint: build.fingerprint,
            calculationSeed: `seed:${createHash('sha256').update(calibrationId).digest('hex').slice(0, 48)}`,
            buildSnapshot: build as unknown as Prisma.InputJsonValue,
            buildVersion: build.fingerprint,
            balanceVersion: BALANCE_VERSION,
            dataVersion: GAME_DATA_VERSION,
            formulaVersion: AWAY_FORMULA_VERSION,
            schemaVersion: AWAY_SCHEMA_VERSION,
            startedAt,
            validDurationSeconds: 0,
          },
        });
        await transaction.character.update({
          where: { id: value.characterId },
          data: { availability: 'AWAY_CALIBRATING', revision: { increment: 1 } },
        });
        return;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.status(value.actorUserId, value.characterId);
  }

  public async completeCalibration(input: CompleteAwayCalibrationInput): Promise<AwayStatus> {
    const value = CompleteAwayCalibrationInputSchema.parse(input);
    await this.prisma.$transaction(
      async (transaction) => {
        const calibration = await transaction.awayCalibration.findFirst({
          where: {
            id: value.calibrationId,
            character: { id: value.characterId, userId: value.actorUserId },
          },
        });
        if (calibration === null) throw new AwayNotFoundError();
        if (calibration.state !== 'RUNNING') return;
        const now = this.now();
        const startedAtMs = calibration.startedAt?.getTime() ?? now.getTime();
        const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAtMs) / 1000));
        if (elapsedSeconds < CALIBRATION_SECONDS)
          throw new AwayCalibrationIncompleteError(CALIBRATION_SECONDS - elapsedSeconds);
        const buildCharacter = await this.characterWithBuild(
          transaction,
          value.actorUserId,
          value.characterId,
        );
        const build = buildSnapshot(buildCharacter);
        const completedAt = new Date(startedAtMs + CALIBRATION_SECONDS * 1000);
        const metrics = await this.calibrationMetrics(
          transaction,
          value.characterId,
          calibration.startedAt!,
          completedAt,
        );
        const enemyCount = metrics.normalEnemiesDefeated + metrics.eliteEnemiesDefeated;
        const impossibleRate =
          enemyCount > 10_000 ||
          metrics.rewards.experience > enemyCount * 10_000 ||
          metrics.rewards.gold > enemyCount * 10_000 ||
          metrics.rewards.materials > enemyCount * 10_000;
        const invalidReason =
          build.fingerprint !== calibration.buildFingerprint
            ? 'BUILD_CHANGED'
            : enemyCount === 0
              ? 'INSUFFICIENT_ACTIVITY'
              : impossibleRate
                ? 'IMPOSSIBLE_RATE'
                : undefined;
        const state = invalidReason === undefined ? 'VALID' : 'INVALID';
        const estimatePerHour = {
          experience:
            awayRatePerHour(metrics.rewards.experience, CALIBRATION_SECONDS) *
            GAME_DATA.balance.awayMode.efficiency,
          gold:
            awayRatePerHour(metrics.rewards.gold, CALIBRATION_SECONDS) *
            GAME_DATA.balance.awayMode.efficiency,
          materials:
            awayRatePerHour(metrics.rewards.materials, CALIBRATION_SECONDS) *
            GAME_DATA.balance.awayMode.efficiency,
          enemies:
            awayRatePerHour(
              metrics.normalEnemiesDefeated + metrics.eliteEnemiesDefeated,
              CALIBRATION_SECONDS,
            ) * GAME_DATA.balance.awayMode.efficiency,
        };
        await transaction.awayCalibration.update({
          where: { id: calibration.id },
          data: {
            state,
            completedAt,
            validDurationSeconds: CALIBRATION_SECONDS,
            metrics: metrics as unknown as Prisma.InputJsonValue,
            normalizedRates: estimatePerHour as unknown as Prisma.InputJsonValue,
            ...(invalidReason === undefined ? { invalidReason: null } : { invalidReason }),
            revision: { increment: 1 },
          },
        });
        if (state === 'INVALID') {
          await transaction.character.update({
            where: { id: value.characterId },
            data: { availability: 'AVAILABLE', revision: { increment: 1 } },
          });
        }
        return;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.status(value.actorUserId, value.characterId);
  }

  public async activate(input: ActivateAwayInput): Promise<AwayStatus> {
    const value = ActivateAwayInputSchema.parse(input);
    const startedAt = this.now();
    const sessionId = `away:${value.operationId}`;
    await this.prisma.$transaction(
      async (transaction) => {
        const calibration = await transaction.awayCalibration.findFirst({
          where: {
            id: value.calibrationId,
            character: { id: value.characterId, userId: value.actorUserId },
          },
        });
        if (calibration === null) throw new AwayNotFoundError();
        if (calibration.state === 'ACTIVATED') return;
        if (calibration.state !== 'VALID')
          throw new AwayStateConflictError('Calibration is not valid.');
        const existing = await transaction.awaySession.findUnique({ where: { id: sessionId } });
        if (existing !== null) {
          if (
            existing.characterId !== value.characterId ||
            existing.calibrationId !== value.calibrationId
          )
            throw new AwayOperationConflictError();
          return;
        }
        await transaction.awaySession.create({
          data: {
            id: sessionId,
            characterId: value.characterId,
            calibrationId: calibration.id,
            activationOperationId: value.operationId,
            state: 'ACTIVE',
            startedAt,
            maxDurationSeconds: MAX_DURATION_SECONDS,
            snapshot: calibration.buildSnapshot as Prisma.InputJsonValue,
            zoneId: calibration.zoneId,
            difficulty: calibration.difficulty,
            calculationSeed: calibration.calculationSeed,
            schemaVersion: AWAY_SCHEMA_VERSION,
            activeMarker: 'active',
          },
        });
        await transaction.awayCalibration.update({
          where: { id: calibration.id },
          data: { state: 'ACTIVATED' },
        });
        await transaction.character.update({
          where: { id: value.characterId },
          data: { availability: 'AWAY_FARMING', revision: { increment: 1 } },
        });
        return;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.status(value.actorUserId, value.characterId);
  }

  public async returnFromAway(input: ReturnAwayInput): Promise<AwayStatus> {
    const value = ReturnAwayInputSchema.parse(input);
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        await this.prisma.$transaction(
          async (transaction) => {
            const session = await transaction.awaySession.findFirst({
              where: {
                characterId: value.characterId,
                character: { userId: value.actorUserId },
                state: 'ACTIVE',
              },
              include: { calibration: true, result: true },
            });
            if (session === null) {
              const character = await transaction.character.findFirst({
                where: { id: value.characterId, userId: value.actorUserId, deletedAt: null },
              });
              if (character === null) throw new CharacterNotFoundError();
              const existing = await transaction.awayResult.findUnique({
                where: { operationId: value.operationId },
              });
              if (existing !== null) return;
              throw new AwayStateConflictError('Character has no active away session.');
            }
            const endedAt = this.now();
            const elapsedSeconds = Math.max(
              0,
              Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000),
            );
            const metrics = AwayMetricsSchema.parse(session.calibration.metrics);
            const calculation = calculateAwayReward({
              metrics,
              elapsedSeconds,
              maxDurationSeconds: session.maxDurationSeconds,
              efficiency: GAME_DATA.balance.awayMode.efficiency,
              calculationSeed: session.calculationSeed,
            });
            const report = AwayResultSchema.parse({
              schemaVersion: AWAY_SCHEMA_VERSION,
              awaySessionId: session.id,
              calibrationId: session.calibrationId,
              zoneId: session.zoneId,
              difficulty: DifficultySchema.parse(session.difficulty),
              startedAtServerMs: session.startedAt.getTime(),
              endedAtServerMs: endedAt.getTime(),
              elapsedSeconds: calculation.elapsedSeconds,
              computedSeconds: calculation.computedSeconds,
              discardedSeconds: calculation.discardedSeconds,
              efficiency: calculation.efficiency,
              survivalFactor: calculation.survivalFactor,
              estimatedEnemiesDefeated: calculation.estimatedEnemiesDefeated,
              rewards: calculation.rewards,
              generatedItemsByRarity: calculation.generatedItemsByRarity,
              reductions: calculation.reductions,
              balanceVersion: BALANCE_VERSION,
              gameDataVersion: GAME_DATA_VERSION,
              calculationSeed: session.calculationSeed,
            });
            const payload = { report, claimedItems: [] } as unknown as Prisma.InputJsonValue;
            await transaction.awayResult.create({
              data: {
                id: `away-result:${value.operationId}`,
                characterId: value.characterId,
                sessionId: session.id,
                operationId: value.operationId,
                state: 'PENDING',
                startedAt: session.startedAt,
                endedAt,
                elapsedSeconds: report.elapsedSeconds,
                computedSeconds: report.computedSeconds,
                discardedSeconds: report.discardedSeconds,
                efficiency: report.efficiency,
                rewards: report.rewards as unknown as Prisma.InputJsonValue,
                balanceVersion: BALANCE_VERSION,
                dataVersion: GAME_DATA_VERSION,
                formulaVersion: AWAY_FORMULA_VERSION,
                schemaVersion: AWAY_SCHEMA_VERSION,
                result: payload,
              },
            });
            await transaction.awaySession.update({
              where: { id: session.id },
              data: {
                state: 'REWARD_PENDING',
                endedAt,
                activeMarker: null,
                revision: { increment: 1 },
              },
            });
            await transaction.character.update({
              where: { id: value.characterId },
              data: { availability: 'AWAY_REWARD_PENDING', revision: { increment: 1 } },
            });
            return;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return this.status(value.actorUserId, value.characterId);
      } catch (error: unknown) {
        if (isRetryable(error) && attempt + 1 < maxRetries) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const existing = await this.prisma.awayResult.findUnique({
            where: { operationId: value.operationId },
          });
          if (existing !== null) return this.status(value.actorUserId, value.characterId);
        }
        throw error;
      }
    }
    throw new AwayStateConflictError('The away return transaction exhausted its retries.');
  }

  public async claim(input: ClaimAwayInput): Promise<AwayClaimReceipt> {
    const value = ClaimAwayInputSchema.parse(input);
    const operationIdPrefix = 'away-claim:';
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const result = await transaction.awayResult.findFirst({
              where: {
                characterId: value.characterId,
                character: { userId: value.actorUserId },
                state: { in: ['PENDING', 'CLAIMED'] },
              },
              include: { session: true },
            });
            if (result === null)
              throw new AwayStateConflictError('There is no pending away reward.');
            const claimOperationId = `${operationIdPrefix}${result.id}`;
            const existingLog = await transaction.rewardLog.findUnique({
              where: { operationId: claimOperationId },
            });
            if (existingLog !== null) return claimReceiptFromLog(existingLog);
            if (result.state !== 'PENDING')
              throw new AwayStateConflictError('Away reward is already claimed.');
            const report = reportFromStored(result.result);
            const character = await transaction.character.findFirst({
              where: { id: value.characterId, userId: value.actorUserId, deletedAt: null },
              include: {
                progress: true,
                inventory: { include: { items: { select: { id: true } } } },
              },
            });
            if (character === null || character.progress === null)
              throw new CharacterNotFoundError();
            const inventory =
              character.inventory ??
              (await transaction.inventory.create({
                data: { id: `inventory:${character.id}`, characterId: character.id, capacity: 40 },
                include: { items: { select: { id: true } } },
              }));
            const available = Math.max(0, inventory.capacity - inventory.items.length);
            const candidates =
              GAME_DATA.lootTables
                .find((table) => table.source === 'enemy_defeat')
                ?.entries.filter(
                  (entry) => entry.definitionId !== 'item.weapon.corrupted_guardian',
                ) ?? [];
            const random = awayLootRandom(`${report.calculationSeed}:definitions`);
            const rarities = awayLootRaritySequence(
              report.calculationSeed,
              report.generatedItemsByRarity.common +
                report.generatedItemsByRarity.magic +
                report.generatedItemsByRarity.rare,
            );
            const claimedItems: ItemInstance[] = [];
            for (let index = 0; index < Math.min(available, rarities.length); index += 1) {
              const entry = chooseWeighted(candidates, random);
              if (entry === undefined) break;
              const item = createGeneratedInventoryItem({
                instanceId: `item:${createHash('sha256').update(`${result.id}:item:${index}`).digest('hex').slice(0, 48)}`,
                definitionId: entry.definitionId,
                itemLevel: 1,
                seed: `${report.calculationSeed}:item:${index}:${GAME_DATA_VERSION}`,
                source: 'away_mode',
                ...(rarities[index] === undefined ? {} : { rarity: rarities[index] }),
              });
              await transaction.inventoryItem.create({
                data: inventoryItemCreateData(item, character.id, inventory.id),
              });
              claimedItems.push(item);
            }
            if (claimedItems.length > 0) {
              await transaction.inventory.update({
                where: { id: inventory.id },
                data: { revision: { increment: 1 } },
              });
            }
            const progression = applyExperience(
              character.progress,
              BigInt(report.rewards.experience),
              GAME_DATA.progression,
            );
            const updatedCharacter = await transaction.character.update({
              where: { id: character.id },
              data: {
                gold: { increment: BigInt(report.rewards.gold) },
                materials: { increment: BigInt(report.rewards.materials) },
                availability: 'AVAILABLE',
                revision: { increment: 1 },
                lastSeenAt: this.now(),
              },
            });
            const updatedProgress = await transaction.characterProgress.update({
              where: { characterId: character.id },
              data: {
                experience: progression.experience,
                level: progression.level,
                attributePoints: progression.attributePoints,
                revision: { increment: 1 },
              },
            });
            const receiptPayload = { report, claimedItems };
            const log = await transaction.rewardLog.create({
              data: {
                id: `reward:${claimOperationId}`,
                characterId: character.id,
                operationId: claimOperationId,
                requestHash: createHash('sha256')
                  .update(JSON.stringify({ resultId: result.id, report }))
                  .digest('hex'),
                kind: 'AWAY',
                goldDelta: BigInt(report.rewards.gold),
                materialsDelta: BigInt(report.rewards.materials),
                experienceDelta: BigInt(report.rewards.experience),
                goldBalanceAfter: updatedCharacter.gold,
                materialsBalanceAfter: updatedCharacter.materials,
                experienceBalanceAfter: updatedProgress.experience,
                source: 'away_mode',
                sourceId: result.id,
                balanceVersion: BALANCE_VERSION,
                dataVersion: GAME_DATA_VERSION,
                formulaVersion: AWAY_FORMULA_VERSION,
                schemaVersion: AWAY_SCHEMA_VERSION,
                payload: receiptPayload as unknown as Prisma.InputJsonValue,
              },
            });
            await transaction.awayResult.update({
              where: { id: result.id },
              data: {
                state: 'CLAIMED',
                claimedAt: this.now(),
                result: receiptPayload as unknown as Prisma.InputJsonValue,
                revision: { increment: 1 },
              },
            });
            await transaction.awaySession.update({
              where: { id: result.sessionId },
              data: { state: 'CLAIMED', revision: { increment: 1 } },
            });
            return {
              operationId: log.operationId,
              result: resultView({ ...result, state: 'CLAIMED', result: receiptPayload }),
              replayed: false,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (isRetryable(error) && attempt + 1 < maxRetries) continue;
        if (isRetryable(error)) {
          const existing = await this.prisma.rewardLog
            .findFirst({
              where: { characterId: value.characterId, source: 'away_mode' },
              orderBy: { createdAt: 'desc' },
            })
            .catch(() => null);
          if (existing !== null) return claimReceiptFromLog(existing);
        }
        throw error;
      }
    }
    throw new AwayStateConflictError('The away claim transaction exhausted its retries.');
  }

  private async characterWithBuild(transaction: Transaction, userId: string, characterId: string) {
    const character = await transaction.character.findFirst({
      where: { id: characterId, userId, deletedAt: null },
      include: {
        progress: true,
        skills: { where: { equipped: true }, orderBy: { barSlot: 'asc' } },
        inventory: { include: { items: true } },
        equipment: { include: { inventoryItem: true }, orderBy: { slot: 'asc' } },
      },
    });
    if (character === null || character.progress === null) throw new CharacterNotFoundError();
    return character;
  }

  private async calibrationMetrics(
    transaction: Transaction,
    characterId: string,
    startedAt: Date,
    completedAt: Date,
  ): Promise<AwayMetrics> {
    const logs = await transaction.rewardLog.findMany({
      where: {
        characterId,
        source: 'enemy_defeat',
        createdAt: { gte: startedAt, lte: completedAt },
      },
      orderBy: { createdAt: 'asc' },
    });
    const droppedItemsByRarity = { common: 0, magic: 0, rare: 0, legendary: 0 };
    let normalEnemiesDefeated = 0;
    for (const log of logs) {
      normalEnemiesDefeated += 1;
      const payload = asRecord(log.payload);
      const drop = asRecord(payload.drop as Prisma.JsonValue);
      const rarity = drop.rarity;
      if (rarity === 'common' || rarity === 'magic' || rarity === 'rare' || rarity === 'legendary')
        droppedItemsByRarity[rarity] += 1;
    }
    return AwayMetricsSchema.parse({
      validDurationSeconds: CALIBRATION_SECONDS,
      normalEnemiesDefeated,
      eliteEnemiesDefeated: 0,
      rewards: {
        experience: sumLogs(logs.map((log) => log.experienceDelta)),
        gold: sumLogs(logs.map((log) => log.goldDelta)),
        materials: sumLogs(logs.map((log) => log.materialsDelta)),
      },
      damageDealt: 0,
      damageTaken: 0,
      deathsOrDowns: 0,
      effectiveCombatSeconds: normalEnemiesDefeated > 0 ? CALIBRATION_SECONDS : 0,
      droppedItemsByRarity,
      magicFind: 0,
    });
  }
}

function buildSnapshot(character: {
  id: string;
  class: CharacterClassId;
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  progress: { level: number } | null;
  skills: readonly { abilityId: string }[];
  equipment: readonly {
    slot: string;
    inventoryItem: { id: string; definitionId: string; rarity: string; itemPower: number };
  }[];
}): BuildSnapshot {
  if (character.progress === null) throw new CharacterNotFoundError();
  const equippedAbilityIds = character.skills.map((skill) => skill.abilityId).slice(0, 4);
  const equippedItems = character.equipment.map((equipment) => ({
    instanceId: equipment.inventoryItem.id,
    definitionId: equipment.inventoryItem.definitionId,
    slot: normalizeSlot(equipment.slot),
    rarity: equipment.inventoryItem.rarity,
    itemPower: equipment.inventoryItem.itemPower,
  }));
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        characterId: character.id,
        level: character.progress.level,
        attributes: {
          strength: character.strength,
          dexterity: character.dexterity,
          intelligence: character.intelligence,
          vitality: character.vitality,
        },
        equippedAbilityIds,
        equippedItems,
      }),
    )
    .digest('hex');
  return BuildSnapshotSchema.parse({
    schemaVersion: 1,
    characterId: character.id,
    classId: 'guardian',
    level: character.progress.level,
    attributes: {
      strength: character.strength,
      dexterity: character.dexterity,
      intelligence: character.intelligence,
      vitality: character.vitality,
    },
    equippedItems,
    equippedAbilityIds,
    fingerprint,
    gameDataVersion: GAME_DATA_VERSION,
    balanceVersion: BALANCE_VERSION,
  });
}

function calibrationView(calibration: {
  id: string;
  state: AwayCalibrationView['state'];
  zoneId: string;
  difficulty: string;
  buildFingerprint: string;
  startedAt: Date | null;
  completedAt: Date | null;
  validDurationSeconds: number;
  invalidReason: string | null;
  metrics: Prisma.JsonValue;
  normalizedRates: Prisma.JsonValue;
}): AwayCalibrationView {
  const metrics = AwayMetricsSchema.safeParse(calibration.metrics).success
    ? AwayMetricsSchema.parse(calibration.metrics)
    : AwayMetricsSchema.parse({
        validDurationSeconds: calibration.validDurationSeconds,
        normalEnemiesDefeated: 0,
        eliteEnemiesDefeated: 0,
        rewards: { experience: 0, gold: 0, materials: 0 },
        damageDealt: 0,
        damageTaken: 0,
        deathsOrDowns: 0,
        effectiveCombatSeconds: 0,
        droppedItemsByRarity: { common: 0, magic: 0, rare: 0, legendary: 0 },
        magicFind: 0,
      });
  const rates = asRecord(calibration.normalizedRates);
  return {
    id: calibration.id,
    state: calibration.state,
    zoneId: calibration.zoneId,
    difficulty: DifficultySchema.parse(calibration.difficulty),
    buildFingerprint: calibration.buildFingerprint,
    ...(calibration.startedAt === null
      ? {}
      : { startedAtServerMs: calibration.startedAt.getTime() }),
    ...(calibration.completedAt === null
      ? {}
      : { completedAtServerMs: calibration.completedAt.getTime() }),
    validDurationSeconds: calibration.validDurationSeconds,
    ...(calibration.invalidReason === null ? {} : { invalidReason: calibration.invalidReason }),
    metrics,
    estimatePerHour: {
      experience: typeof rates.experience === 'number' ? rates.experience : 0,
      gold: typeof rates.gold === 'number' ? rates.gold : 0,
      materials: typeof rates.materials === 'number' ? rates.materials : 0,
      enemies: typeof rates.enemies === 'number' ? rates.enemies : 0,
    },
  };
}

function sessionView(session: {
  id: string;
  calibrationId: string;
  state: AwaySessionView['state'];
  startedAt: Date;
  endedAt: Date | null;
  maxDurationSeconds: number;
  zoneId: string;
  difficulty: string;
}): AwaySessionView {
  return {
    id: session.id,
    calibrationId: session.calibrationId,
    state: session.state,
    startedAtServerMs: session.startedAt.getTime(),
    ...(session.endedAt === null ? {} : { endedAtServerMs: session.endedAt.getTime() }),
    maxDurationSeconds: session.maxDurationSeconds,
    zoneId: session.zoneId,
    difficulty: DifficultySchema.parse(session.difficulty),
  };
}

function resultView(result: {
  id: string;
  state: AwayResultView['state'];
  result: Prisma.JsonValue;
}): AwayResultView {
  const payload = asRecord(result.result);
  const report = AwayResultSchema.parse(payload.report ?? payload);
  const claimed = Array.isArray(payload.claimedItems) ? payload.claimedItems : [];
  return {
    id: result.id,
    state: result.state,
    report,
    claimedItems: claimed as ItemInstance[],
  };
}

function reportFromStored(value: Prisma.JsonValue): AwayResult {
  const payload = asRecord(value);
  return AwayResultSchema.parse(payload.report ?? payload);
}

function claimReceiptFromLog(log: {
  operationId: string;
  sourceId: string;
  payload: Prisma.JsonValue;
}): AwayClaimReceipt {
  const payload = asRecord(log.payload);
  const report = AwayResultSchema.parse(payload.report);
  const claimedItems = Array.isArray(payload.claimedItems)
    ? (payload.claimedItems as ItemInstance[])
    : [];
  return {
    operationId: log.operationId,
    replayed: true,
    result: { id: log.sourceId, state: 'CLAIMED', report, claimedItems },
  };
}

function normalizeSlot(
  slot: string,
):
  | 'helmet'
  | 'chest'
  | 'gloves'
  | 'boots'
  | 'main_hand'
  | 'off_hand'
  | 'amulet'
  | 'ring_1'
  | 'ring_2' {
  const normalized = slot.toLowerCase();
  if (normalized === 'ring1') return 'ring_1';
  if (normalized === 'ring2') return 'ring_2';
  if (normalized === 'mainhand') return 'main_hand';
  if (normalized === 'offhand') return 'off_hand';
  return normalized as ReturnType<typeof normalizeSlot>;
}

function sumLogs(values: readonly bigint[]): number {
  const total = values.reduce((sum, value) => sum + value, 0n);
  return Number(total > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : total);
}

function asRecord(value: Prisma.JsonValue | undefined): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)
  );
}

function awayLootRandom(seed: string) {
  let state = seedFromHash(seed);
  return {
    nextInt(minimum: number, maximum: number) {
      state = (Math.imul(state ^ (state >>> 16), 2246822519) + 3266489917) >>> 0;
      return minimum + (state % (maximum - minimum + 1));
    },
  };
}

function seedFromHash(value: string): number {
  return Number.parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16) >>> 0;
}

function chooseWeighted<T extends { weight: number }>(
  entries: readonly T[],
  random: { nextInt: (min: number, max: number) => number },
): T | undefined {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (entries.length === 0 || total <= 0) return undefined;
  let cursor = random.nextInt(1, total);
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry;
  }
  return entries.at(-1);
}
