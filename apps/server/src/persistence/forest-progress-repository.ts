import { BALANCE_VERSION, GAME_DATA } from '@brecha/game-data';
import {
  forestProgressStateFromPayload,
  forestProgressStateToPayload,
  migrateForestProgressSave,
  type ForestProgressSaveV1,
  type ForestProgressState,
} from '@brecha/shared';
import { Prisma } from '../generated/prisma/client.js';

import { CharacterNotFoundError } from '../characters/character-service.js';
import type { DatabaseClient } from './database.js';

export class ForestProgressRevisionConflictError extends Error {
  public constructor() {
    super('The forest progress revision is stale and cannot overwrite newer progress.');
    this.name = 'ForestProgressRevisionConflictError';
  }
}

export class ForestProgressPersistenceError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ForestProgressPersistenceError';
  }
}

type ForestProgressRecord = {
  characterId: string;
  formatVersion: number;
  stateSchemaVersion: number;
  dataVersion: string;
  balanceVersion: string;
  state: Prisma.JsonValue;
  revision: number;
  updatedAt: Date;
};

const initialForestState = {
  level: GAME_DATA.endlessForest.minimumLevel,
  xpInLevel: 0,
  bestLevel: GAME_DATA.endlessForest.minimumLevel,
  totalXp: 0,
  totalGold: 0,
  totalMaterials: 0,
  countedDefeats: [],
} satisfies Prisma.InputJsonObject;

function toSnapshot(record: ForestProgressRecord): ForestProgressSaveV1 {
  try {
    const save = migrateForestProgressSave({
      formatVersion: record.formatVersion,
      stateSchemaVersion: record.stateSchemaVersion,
      characterId: record.characterId,
      revision: record.revision,
      savedAtServerMs: record.updatedAt.getTime(),
      dataVersion: record.dataVersion,
      balanceVersion: record.balanceVersion,
      payload: record.state,
    });
    forestProgressStateFromPayload(save.payload, GAME_DATA.endlessForest);
    return save;
  } catch (error: unknown) {
    throw new ForestProgressPersistenceError(
      `Stored forest progress for ${record.characterId} failed validation.`,
      { cause: error },
    );
  }
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

export class ForestProgressRepository {
  public constructor(private readonly prisma: DatabaseClient) {}

  /** Loads only an owned character and creates a valid initial row for legacy characters. */
  public async getOwned(userId: string, characterId: string): Promise<ForestProgressSaveV1> {
    return this.prisma.$transaction(async (transaction) => {
      const character = await transaction.character.findFirst({
        where: { id: characterId, userId, deletedAt: null },
        select: { id: true, forestProgress: true },
      });
      if (character === null) throw new CharacterNotFoundError();
      const record =
        character.forestProgress ??
        (await transaction.characterForestProgress.create({
          data: {
            id: `forest-progress:${character.id}`,
            characterId: character.id,
            formatVersion: 1,
            stateSchemaVersion: 1,
            dataVersion: GAME_DATA.version,
            balanceVersion: BALANCE_VERSION,
            state: initialForestState,
          },
        }));
      return toSnapshot(record);
    });
  }

  /**
   * Persists a server-produced state with optimistic concurrency. `expectedRevision: 0` is only
   * valid for a legacy character whose forest row has not been created yet.
   */
  public async saveOwned(
    userId: string,
    characterId: string,
    state: ForestProgressState,
    expectedRevision: number,
  ): Promise<ForestProgressSaveV1> {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw new ForestProgressRevisionConflictError();
    }
    const payload = forestProgressStateToPayload(state);
    forestProgressStateFromPayload(payload, GAME_DATA.endlessForest);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const character = await transaction.character.findFirst({
              where: { id: characterId, userId, deletedAt: null },
              select: { id: true, forestProgress: true },
            });
            if (character === null) throw new CharacterNotFoundError();
            const current = character.forestProgress;
            if (current === null) {
              if (expectedRevision !== 0) throw new ForestProgressRevisionConflictError();
              const created = await transaction.characterForestProgress.create({
                data: {
                  id: `forest-progress:${character.id}`,
                  characterId: character.id,
                  formatVersion: 1,
                  stateSchemaVersion: 1,
                  dataVersion: GAME_DATA.version,
                  balanceVersion: BALANCE_VERSION,
                  state: payload,
                },
              });
              return toSnapshot(created);
            }
            if (current.revision !== expectedRevision) {
              throw new ForestProgressRevisionConflictError();
            }
            const updated = await transaction.characterForestProgress.update({
              where: { characterId: character.id },
              data: {
                formatVersion: 1,
                stateSchemaVersion: 1,
                dataVersion: GAME_DATA.version,
                balanceVersion: BALANCE_VERSION,
                state: payload,
                revision: { increment: 1 },
              },
            });
            return toSnapshot(updated);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error('Forest progress persistence exhausted its transaction retries.');
  }
}
