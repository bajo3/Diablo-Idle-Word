import { createHash } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';
import type { DatabaseClient } from '../persistence/database.js';

export type InteractionEffectType = 'revive' | 'dialogue' | 'loot_authorization';
export type InteractionEffectStatus = 'APPLIED' | 'PENDING_DOMAIN';

export type InteractionEffectInput = Readonly<{
  userId: string;
  characterId: string;
  operationId: string;
  resultId: string;
}>;

export type InteractionEffectResult = Readonly<{
  operationId: string;
  characterId: string;
  resultId: string;
  effectType: InteractionEffectType;
  status: InteractionEffectStatus;
  replayed: boolean;
}>;

export class InteractionEffectConflictError extends Error {
  public constructor() {
    super('The interaction effect operation conflicts with an existing effect.');
    this.name = 'InteractionEffectConflictError';
  }
}

export class UnknownInteractionEffectError extends Error {
  public constructor(resultId: string) {
    super(`No authoritative interaction effect is registered for ${resultId}.`);
    this.name = 'UnknownInteractionEffectError';
  }
}

type EffectPlan = Readonly<{
  effectType: InteractionEffectType;
  status: InteractionEffectStatus;
  payload: Readonly<Record<string, string>>;
}>;

const EFFECT_PLANS: Readonly<Record<string, EffectPlan>> = Object.freeze({
  'revive.forest.altar': {
    effectType: 'revive',
    status: 'APPLIED',
    payload: { recovery: 'max_health' },
  },
  'dialogue.forest.scout': {
    effectType: 'dialogue',
    status: 'APPLIED',
    payload: { dialogueId: 'forest.scout.intro' },
  },
  // Step 11/17 will consume this durable authorization to create the actual loot/economy delta.
  'chest.reward.forest.basic': {
    effectType: 'loot_authorization',
    status: 'PENDING_DOMAIN',
    payload: { lootTableId: 'forest.basic' },
  },
});

function requestHash(input: InteractionEffectInput, plan: EffectPlan): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        userId: input.userId,
        characterId: input.characterId,
        operationId: input.operationId,
        resultId: input.resultId,
        effectType: plan.effectType,
        status: plan.status,
      }),
    )
    .digest('hex');
}

function parseStoredEffect(record: {
  operationId: string;
  characterId: string;
  resultId: string;
  effectType: string;
  status: string;
}): InteractionEffectResult {
  if (
    (record.effectType !== 'revive' &&
      record.effectType !== 'dialogue' &&
      record.effectType !== 'loot_authorization') ||
    (record.status !== 'APPLIED' && record.status !== 'PENDING_DOMAIN')
  )
    throw new Error('Stored interaction effect contains an unsupported type or status.');
  return {
    operationId: record.operationId,
    characterId: record.characterId,
    resultId: record.resultId,
    effectType: record.effectType,
    status: record.status,
    replayed: true,
  };
}

function retryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

/** Durable completion ledger for interaction effects; no result can be applied twice. */
export class InteractionEffectService {
  public constructor(private readonly prisma: DatabaseClient) {}

  public async applyOnce(input: InteractionEffectInput): Promise<InteractionEffectResult> {
    const plan = EFFECT_PLANS[input.resultId];
    if (plan === undefined) throw new UnknownInteractionEffectError(input.resultId);
    const hash = requestHash(input, plan);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const character = await transaction.character.findFirst({
              where: { id: input.characterId, userId: input.userId, deletedAt: null },
              select: { id: true },
            });
            if (character === null) throw new Error('The interaction effect actor is unavailable.');
            const existing = await transaction.characterInteractionEffect.findUnique({
              where: { operationId: input.operationId },
            });
            if (existing !== null) {
              if (
                existing.characterId !== input.characterId ||
                existing.requestHash !== hash ||
                existing.resultId !== input.resultId
              )
                throw new InteractionEffectConflictError();
              return parseStoredEffect(existing);
            }
            const created = await transaction.characterInteractionEffect.create({
              data: {
                id: effectId(input.operationId),
                characterId: input.characterId,
                operationId: input.operationId,
                requestHash: hash,
                resultId: input.resultId,
                effectType: plan.effectType,
                status: plan.status,
                payload: plan.payload as Prisma.InputJsonValue,
              },
            });
            return {
              operationId: created.operationId,
              characterId: created.characterId,
              resultId: created.resultId,
              effectType: plan.effectType,
              status: plan.status,
              replayed: false,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (retryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error('Interaction effect exhausted its transaction retries.');
  }
}

function effectId(operationId: string): string {
  return `interaction-effect:${createHash('sha256').update(operationId).digest('hex').slice(0, 40)}`;
}

export function interactionEffectPlan(resultId: string): EffectPlan | undefined {
  return EFFECT_PLANS[resultId];
}
