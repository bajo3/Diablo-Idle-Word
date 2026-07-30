import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import type { DatabaseClient } from '../persistence/database.js';
import { CharacterNotAvailableError, CharacterNotFoundError } from './character-service.js';

export const CheckpointIntentSchema = z.strictObject({
  operationId: z.string().uuid(),
  schemaVersion: z.literal(1),
  characterId: z.string().min(1).max(128),
  sceneId: z.literal('local:test'),
  checkpointId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9:_-]+$/),
});
export type CheckpointIntent = z.infer<typeof CheckpointIntentSchema>;
export class CheckpointConflictError extends Error {
  public constructor() {
    super('Checkpoint operation conflicts with its prior intent.');
    this.name = 'CheckpointConflictError';
  }
}

export class CheckpointService {
  public constructor(private readonly prisma: DatabaseClient) {}
  public async record(userId: string, intent: CheckpointIntent) {
    const requestHash = createHash('sha256').update(JSON.stringify(intent)).digest('hex');
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const character = await transaction.character.findFirst({
          where: { id: intent.characterId, userId, deletedAt: null },
          include: { selection: true },
        });
        if (character === null || character.selection === null) throw new CharacterNotFoundError();
        if (character.availability !== 'AVAILABLE') throw new CharacterNotAvailableError();
        const existing = await transaction.characterCheckpointReceipt.findUnique({
          where: { operationId: intent.operationId },
        });
        if (existing !== null) {
          if (existing.characterId !== character.id || existing.requestHash !== requestHash)
            throw new CheckpointConflictError();
          return existing;
        }
        return transaction.characterCheckpointReceipt.create({
          data: {
            id: `checkpoint:${randomUUID()}`,
            characterId: character.id,
            operationId: intent.operationId,
            requestHash,
            schemaVersion: 1,
            sceneId: intent.sceneId,
            checkpointId: intent.checkpointId,
            serverState: {
              spawn: 'test:gate',
              coordinates: { x: 160, y: 160 },
              sceneConfigVersion: 1,
            },
          },
        });
      });
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error;
      const receipt = await this.prisma.characterCheckpointReceipt.findUnique({
        where: { operationId: intent.operationId },
      });
      if (receipt === null || receipt.requestHash !== requestHash)
        throw new CheckpointConflictError();
      return receipt;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
