import { createHash } from 'node:crypto';

import { GAME_DATA } from '@brecha/game-data';
import { applyExperience } from '@brecha/shared';
import { Prisma } from '../generated/prisma/client.js';

import {
  EconomyOperationInputSchema,
  type EconomyOperationInput,
  type EconomyReceipt,
} from './contracts.js';
import type { DatabaseClient } from './database.js';

const maxRetries = 3;

export class CharacterNotFoundError extends Error {
  public constructor() {
    super('The character does not exist or is not owned by this user.');
    this.name = 'CharacterNotFoundError';
  }
}

export class EconomyOperationConflictError extends Error {
  public constructor() {
    super('operationId was already used with a different canonical operation.');
    this.name = 'EconomyOperationConflictError';
  }
}

export class InsufficientResourcesError extends Error {
  public constructor() {
    super('The operation would make an authoritative resource balance negative.');
    this.name = 'InsufficientResourcesError';
  }
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

/** Stable serialization prevents object-key order from changing an idempotency hash. */
export function canonicalEconomyRequestHash(input: EconomyOperationInput): string {
  const canonical = JSON.stringify({
    actorUserId: input.actorUserId,
    characterId: input.characterId,
    source: input.source,
    sourceId: input.sourceId,
    goldDelta: input.goldDelta.toString(),
    materialsDelta: input.materialsDelta.toString(),
    experienceDelta: input.experienceDelta.toString(),
    versions: input.versions,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function toReceipt(log: {
  operationId: string;
  requestHash: string;
  source: string;
  sourceId: string;
  goldDelta: bigint;
  materialsDelta: bigint;
  experienceDelta: bigint;
  goldBalanceAfter: bigint;
  materialsBalanceAfter: bigint;
  experienceBalanceAfter: bigint;
  balanceVersion: string;
  dataVersion: string;
  formulaVersion: string;
  schemaVersion: number;
  revision: number;
}): EconomyReceipt {
  return {
    operationId: log.operationId,
    requestHash: log.requestHash,
    source: log.source,
    sourceId: log.sourceId,
    goldDelta: log.goldDelta,
    materialsDelta: log.materialsDelta,
    experienceDelta: log.experienceDelta,
    goldBalanceAfter: log.goldBalanceAfter,
    materialsBalanceAfter: log.materialsBalanceAfter,
    experienceBalanceAfter: log.experienceBalanceAfter,
    balanceVersion: log.balanceVersion,
    dataVersion: log.dataVersion,
    formulaVersion: log.formulaVersion,
    schemaVersion: log.schemaVersion,
    revision: log.revision,
  };
}

export class EconomyService {
  public constructor(private readonly prisma: DatabaseClient) {}

  /**
   * Applies a canonical, server-validated resource delta exactly once. A durable RewardLog receipt
   * is the replay source of truth, so later operations cannot alter what an earlier retry returns.
   */
  public async applyOnce(input: EconomyOperationInput): Promise<EconomyReceipt> {
    const value = EconomyOperationInputSchema.parse(input);
    const requestHash = canonicalEconomyRequestHash(value);

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const character = await transaction.character.findFirst({
              where: { id: value.characterId, userId: value.actorUserId },
              include: {
                progress: { select: { experience: true, level: true, attributePoints: true } },
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
              ) {
                throw new EconomyOperationConflictError();
              }
              return toReceipt(existing);
            }

            const goldAfter = character.gold + value.goldDelta;
            const materialsAfter = character.materials + value.materialsDelta;
            const progression = applyExperience(
              character.progress,
              value.experienceDelta,
              GAME_DATA.progression,
            );
            const experienceAfter = progression.experience;
            if (goldAfter < 0n || materialsAfter < 0n || experienceAfter < 0n) {
              throw new InsufficientResourcesError();
            }

            const updatedCharacter = await transaction.character.update({
              where: { id: value.characterId },
              data: {
                gold: { increment: value.goldDelta },
                materials: { increment: value.materialsDelta },
                revision: { increment: 1 },
                lastSeenAt: new Date(),
              },
              select: { gold: true, materials: true, revision: true },
            });
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
            const receipt = await transaction.rewardLog.create({
              data: {
                id: `reward:${value.operationId}`,
                characterId: value.characterId,
                operationId: value.operationId,
                requestHash,
                kind: 'ECONOMY',
                source: value.source,
                sourceId: value.sourceId,
                goldDelta: value.goldDelta,
                materialsDelta: value.materialsDelta,
                experienceDelta: value.experienceDelta,
                goldBalanceAfter: updatedCharacter.gold,
                materialsBalanceAfter: updatedCharacter.materials,
                experienceBalanceAfter: updatedProgress.experience,
                balanceVersion: value.versions.balance,
                dataVersion: value.versions.data,
                formulaVersion: value.versions.formula,
                schemaVersion: value.versions.schema,
              },
            });
            return toReceipt(receipt);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (isRetryable(error) && attempt + 1 < maxRetries) continue;
        throw error;
      }
    }
    throw new Error('Economy operation exhausted its serializable transaction retries.');
  }
}
