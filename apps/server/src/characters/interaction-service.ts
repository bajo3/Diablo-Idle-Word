import { createHash } from 'node:crypto';

import { CORRUPTED_FOREST_INTERACTION_TARGETS } from '@brecha/game-data';
import {
  applyInteraction,
  InteractionCommandSchema,
  InteractionCooldownSchema,
  InteractionActorStateSchema,
  InteractionLedgerSchema,
  InteractionPointSchema,
  InteractionReceiptSchema,
  resolveInteractionTarget,
  type InteractionCommand,
  type InteractionCooldown,
  type InteractionLedger,
  type InteractionPoint,
  type InteractionReceipt,
} from '@brecha/shared';
import { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';

import { CharacterNotAvailableError, CharacterNotFoundError } from './character-service.js';
import type { DatabaseClient } from '../persistence/database.js';

const interactionStateSchema = z.strictObject({
  consumedTargetIds: z.array(z.string().trim().min(1).max(128)),
  cooldowns: z.array(InteractionCooldownSchema).default([]),
});

const INTERACTION_STATE_SCHEMA_VERSION = 2 as const;

const targetsByZone = {
  corrupted_forest: CORRUPTED_FOREST_INTERACTION_TARGETS,
} as const;

export class InteractionOperationConflictError extends Error {
  public constructor() {
    super('operationId was already used with a different interaction command.');
    this.name = 'InteractionOperationConflictError';
  }
}

export class InteractionZoneUnavailableError extends Error {
  public constructor() {
    super('The requested interaction zone is not available on this server.');
    this.name = 'InteractionZoneUnavailableError';
  }
}

export class InteractionPersistenceError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InteractionPersistenceError';
  }
}

export type AuthoritativeInteractionContext = Readonly<{
  /** Position from the server's active instance/tick, never from the command payload. */
  actorPosition: InteractionPoint;
  /** State from the server's active instance/tick, never from the command payload. */
  actorState?: z.infer<typeof InteractionActorStateSchema>;
  /** Server-side damage interruption signal for a currently attempted interaction. */
  interruptedByDamage?: boolean;
  /** Server clock in milliseconds; client requestedAt values are intentionally ignored. */
  nowMs: number;
  /** Optional server-derived recipient for a domain effect; never accepted from the client. */
  effectCharacterId?: string;
}>;

export type AuthoritativeInteractionResult = Readonly<{
  receipt: InteractionReceipt;
  replayed: boolean;
  stateRevision: number;
}>;

function canonicalInteractionCommandHash(
  characterId: string,
  command: InteractionCommand,
  effectCharacterId?: string,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        characterId,
        schemaVersion: command.schemaVersion,
        zoneId: command.zoneId,
        targetId: command.targetId,
        ...(effectCharacterId === undefined ? {} : { effectCharacterId }),
      }),
    )
    .digest('hex');
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

function parseReceipt(value: unknown): InteractionReceipt {
  const parsed = InteractionReceiptSchema.safeParse(value);
  if (!parsed.success) {
    throw new InteractionPersistenceError('Stored interaction receipt failed validation.', {
      cause: parsed.error,
    });
  }
  return Object.freeze({
    operationId: parsed.data.operationId,
    actorId: parsed.data.actorId,
    targetId: parsed.data.targetId,
    accepted: parsed.data.accepted,
    ...(parsed.data.kind === undefined ? {} : { kind: parsed.data.kind }),
    ...(parsed.data.reason === undefined ? {} : { reason: parsed.data.reason }),
    ...(parsed.data.resultId === undefined ? {} : { resultId: parsed.data.resultId }),
    ...(parsed.data.durationMs === undefined ? {} : { durationMs: parsed.data.durationMs }),
    ...(parsed.data.startedAtMs === undefined ? {} : { startedAtMs: parsed.data.startedAtMs }),
    ...(parsed.data.completesAtMs === undefined
      ? {}
      : { completesAtMs: parsed.data.completesAtMs }),
    ...(parsed.data.effectCharacterId === undefined
      ? {}
      : { effectCharacterId: parsed.data.effectCharacterId }),
  }) as InteractionReceipt;
}

function parseInteractionState(value: unknown): {
  consumedTargetIds: readonly string[];
  cooldowns: readonly InteractionCooldown[];
} {
  const parsed = interactionStateSchema.safeParse(value);
  if (!parsed.success) {
    throw new InteractionPersistenceError('Stored interaction state failed validation.', {
      cause: parsed.error,
    });
  }
  const ledger = InteractionLedgerSchema.parse({
    consumedTargetIds: parsed.data.consumedTargetIds,
    cooldowns: parsed.data.cooldowns,
    receipts: [],
  });
  return { consumedTargetIds: ledger.consumedTargetIds, cooldowns: ledger.cooldowns };
}

export class InteractionAuthorityService {
  public constructor(private readonly prisma: DatabaseClient) {}

  /**
   * Applies an interaction using server identity, server position and server map data. The method
   * records both accepted and rejected receipts so retries return the exact prior decision; no
   * reward is inferred from client data. A domain effect (loot, dialogue, revive) consumes the
   * accepted receipt in a later authoritative subsystem.
   */
  public async apply(
    userId: string,
    characterId: string,
    input: unknown,
    context: AuthoritativeInteractionContext,
  ): Promise<AuthoritativeInteractionResult> {
    const command = InteractionCommandSchema.parse(input);
    const actorPosition = InteractionPointSchema.parse(context.actorPosition);
    const actorState = InteractionActorStateSchema.parse(context.actorState ?? 'active');
    const interruptedByDamage = context.interruptedByDamage ?? false;
    if (!Number.isInteger(context.nowMs) || context.nowMs < 0)
      throw new InteractionPersistenceError('The authoritative interaction clock is invalid.');
    const targets = targetsByZone[command.zoneId as keyof typeof targetsByZone];
    if (targets === undefined) throw new InteractionZoneUnavailableError();
    const serverTargets = targets.filter(
      (target) => resolveInteractionTarget(target).authority === 'server',
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const character = await transaction.character.findFirst({
              where: { id: characterId, userId, deletedAt: null },
              select: { id: true, availability: true, interactionState: true },
            });
            if (character === null) throw new CharacterNotFoundError();
            if (character.availability !== 'AVAILABLE') throw new CharacterNotAvailableError();

            const requestHash = canonicalInteractionCommandHash(
              character.id,
              command,
              context.effectCharacterId,
            );
            const existing = await transaction.characterInteractionReceipt.findUnique({
              where: { operationId: command.operationId },
            });
            if (existing !== null) {
              if (existing.characterId !== character.id || existing.requestHash !== requestHash) {
                throw new InteractionOperationConflictError();
              }
              const state = character.interactionState;
              return {
                receipt: parseReceipt(existing.receipt),
                replayed: true,
                stateRevision: state?.revision ?? 1,
              };
            }

            const state =
              character.interactionState ??
              (await transaction.characterInteractionState.create({
                data: {
                  id: `interaction-state:${character.id}`,
                  characterId: character.id,
                  schemaVersion: INTERACTION_STATE_SCHEMA_VERSION,
                  state: { consumedTargetIds: [], cooldowns: [] },
                },
              }));
            const parsedState = parseInteractionState(state.state);
            const ledger: InteractionLedger = {
              consumedTargetIds: parsedState.consumedTargetIds,
              cooldowns: parsedState.cooldowns,
              receipts: [],
            };
            const resolved = applyInteraction(
              ledger,
              serverTargets,
              {
                operationId: command.operationId,
                actorId: character.id,
                targetId: command.targetId,
                requestedAtMs: context.nowMs,
              },
              {
                actorPosition,
                actorState,
                nowMs: context.nowMs,
                interruptedByDamage,
              },
            );
            const receipt = parseReceipt({
              ...resolved.receipt,
              ...(context.effectCharacterId === undefined
                ? {}
                : { effectCharacterId: context.effectCharacterId }),
            });
            let stateRevision = state.revision;
            const stateChanged =
              resolved.ledger.consumedTargetIds.length !== parsedState.consumedTargetIds.length ||
              JSON.stringify(resolved.ledger.cooldowns) !== JSON.stringify(parsedState.cooldowns);
            if (stateChanged) {
              const updated = await transaction.characterInteractionState.update({
                where: { characterId: character.id },
                data: {
                  schemaVersion: INTERACTION_STATE_SCHEMA_VERSION,
                  state: {
                    consumedTargetIds: resolved.ledger.consumedTargetIds,
                    cooldowns: resolved.ledger.cooldowns,
                  },
                  revision: { increment: 1 },
                },
              });
              stateRevision = updated.revision;
            }
            await transaction.characterInteractionReceipt.create({
              data: {
                id: `interaction:${command.operationId}`,
                characterId: character.id,
                operationId: command.operationId,
                requestHash,
                schemaVersion: command.schemaVersion,
                receipt: receipt as unknown as Prisma.InputJsonValue,
              },
            });
            return { receipt, replayed: false, stateRevision };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error('Interaction authority exhausted its transaction retries.');
  }

  /** Reads the server-derived effect recipient for an idempotent retry after a reconnect. */
  public async effectCharacterForOperation(
    userId: string,
    characterId: string,
    operationId: string,
  ): Promise<string | undefined> {
    const receipt = await this.prisma.characterInteractionReceipt.findFirst({
      where: {
        operationId,
        characterId,
        character: { userId, deletedAt: null },
      },
      select: { receipt: true },
    });
    if (receipt === null) return undefined;
    return parseReceipt(receipt.receipt).effectCharacterId;
  }
}

export { canonicalInteractionCommandHash };
