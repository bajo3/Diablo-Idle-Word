import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import { GAME_DATA } from '@brecha/game-data';
import { applyExperience } from '@brecha/shared';

import type { DatabaseClient } from '../persistence/database.js';
import { CharacterNotAvailableError, CharacterNotFoundError } from './character-service.js';

/**
 * Upper bound on the experience a single checkpoint can grant. The client-simulated local arena
 * has no server-tracked enemies to validate kills against (that authority exists only for the
 * server-instanced party/forest loop — see `grantDefeatRewards` in app.ts), so this value is
 * fundamentally client-reported. The cap keeps a compromised or buggy client from vaulting levels
 * in one call; it is not a substitute for real per-kill anti-cheat, which needs the local runtime
 * to report kills against a server-tracked instance the way the party flow already does.
 */
const MAX_CHECKPOINT_EXPERIENCE = 5_000n;

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
  /** Session XP earned in the local arena since the last successful checkpoint, if any. */
  experienceGained: z.string().regex(/^\d+$/).max(15).optional(),
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
          include: { selection: true, progress: true, forestProgress: true },
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
        const savedAt = new Date();
        const updatedCharacter = await transaction.character.update({
          where: { id: character.id },
          data: { lastSeenAt: savedAt, revision: { increment: 1 } },
          select: { revision: true },
        });
        // Session XP from the client-simulated local arena is applied here, once, on the same
        // idempotent operationId as the rest of the checkpoint — a retried request cannot grant it
        // twice. Capped by MAX_CHECKPOINT_EXPERIENCE; see that constant for what this does and does
        // not protect against.
        const requestedExperience =
          intent.experienceGained === undefined ? 0n : BigInt(intent.experienceGained);
        const grantedExperience =
          requestedExperience > MAX_CHECKPOINT_EXPERIENCE
            ? MAX_CHECKPOINT_EXPERIENCE
            : requestedExperience;
        const priorProgress = character.progress;
        const updatedProgress =
          priorProgress === null || grantedExperience <= 0n
            ? priorProgress
            : await (async () => {
                const outcome = applyExperience(
                  priorProgress,
                  grantedExperience,
                  GAME_DATA.progression,
                );
                return transaction.characterProgress.update({
                  where: { characterId: character.id },
                  data: {
                    experience: outcome.experience,
                    level: outcome.level,
                    attributePoints: outcome.attributePoints,
                    revision: { increment: 1 },
                  },
                });
              })();
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
              saveVersion: 2,
              savedAtServerMs: savedAt.getTime(),
              characterRevision: updatedCharacter.revision,
              spawn: 'test:gate',
              coordinates: { x: 160, y: 160 },
              sceneConfigVersion: 1,
              progression:
                updatedProgress === null
                  ? null
                  : {
                      level: updatedProgress.level,
                      experience: updatedProgress.experience.toString(),
                      attributePoints: updatedProgress.attributePoints,
                      revision: updatedProgress.revision,
                    },
              forestProgress:
                character.forestProgress === null
                  ? null
                  : {
                      formatVersion: character.forestProgress.formatVersion,
                      stateSchemaVersion: character.forestProgress.stateSchemaVersion,
                      revision: character.forestProgress.revision,
                      state: character.forestProgress.state,
                    },
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
