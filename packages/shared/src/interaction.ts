/**
 * Shared interaction contract for NPCs, chests and revive points.
 *
 * The result is intentionally pure and serializable: Phaser/UI turns an input into a request,
 * while the server (when the interaction becomes multiplayer) can run the same transition as the
 * authority. A receipt is keyed by operationId so retries cannot grant a one-shot interaction
 * twice or execute an operation against a different target.
 */
import { z } from 'zod';

import { IdSchema } from './ids.js';

export const InteractionKindSchema = z.enum([
  'npc',
  'chest',
  'revive',
  'altar',
  'portal',
  'ground_item',
  'door',
  'merchant',
  'quest',
]);
export type InteractionKind = z.infer<typeof InteractionKindSchema>;

/** Server-visible actor states that can gate an interaction. */
export const InteractionActorStateSchema = z.enum(['active', 'downed', 'dead', 'disabled']);
export type InteractionActorState = z.infer<typeof InteractionActorStateSchema>;

export const InteractionAuthoritySchema = z.enum(['local', 'server']);
export type InteractionAuthority = z.infer<typeof InteractionAuthoritySchema>;

export const InteractionUiSchema = z.strictObject({
  label: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(160),
});
export type InteractionUi = z.infer<typeof InteractionUiSchema>;

export const InteractionPointSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
});
export type InteractionPoint = z.infer<typeof InteractionPointSchema>;

export const InteractionTargetSchema = z.strictObject({
  interactionId: z.string().trim().min(1).max(128),
  kind: InteractionKindSchema,
  position: InteractionPointSchema,
  radiusPx: z.number().finite().positive(),
  available: z.boolean(),
  oneShot: z.boolean(),
  durationMs: z.number().int().nonnegative().optional(),
  allowedActorStates: z.array(InteractionActorStateSchema).min(1).optional(),
  interruptOnDamage: z.boolean().optional(),
  authority: InteractionAuthoritySchema.optional(),
  resultId: z.string().trim().min(1).max(128).optional(),
  cooldownMs: z.number().int().nonnegative().optional(),
  ui: InteractionUiSchema.optional(),
});
export type InteractionTarget = z.infer<typeof InteractionTargetSchema>;

export type ResolvedInteractionTarget = Omit<
  InteractionTarget,
  'durationMs' | 'allowedActorStates' | 'interruptOnDamage' | 'authority' | 'cooldownMs'
> & {
  durationMs: number;
  allowedActorStates: readonly InteractionActorState[];
  interruptOnDamage: boolean;
  authority: InteractionAuthority;
  cooldownMs: number;
};

export const InteractionRequestSchema = z.strictObject({
  operationId: z.string().trim().min(1).max(128),
  actorId: z.string().trim().min(1).max(128),
  targetId: z.string().trim().min(1).max(128),
  requestedAtMs: z.number().finite().nonnegative(),
});
export type InteractionRequest = z.infer<typeof InteractionRequestSchema>;

export const InteractionContextSchema = z.strictObject({
  actorPosition: InteractionPointSchema,
  actorState: InteractionActorStateSchema,
  nowMs: z.number().int().nonnegative(),
  interruptedByDamage: z.boolean(),
});
export type InteractionContext = z.infer<typeof InteractionContextSchema>;

/** Versioned client intention used by an authoritative transport. Identity and position are server-owned. */
export const InteractionCommandSchema = z.strictObject({
  schemaVersion: z.literal(1),
  operationId: z.string().trim().min(1).max(128),
  zoneId: IdSchema,
  targetId: IdSchema,
});
export type InteractionCommand = z.infer<typeof InteractionCommandSchema>;

export type InteractionRejectReason =
  | 'invalid_request'
  | 'unknown_target'
  | 'unavailable'
  | 'invalid_state'
  | 'interrupted'
  | 'cooldown'
  | 'out_of_range'
  | 'already_consumed'
  | 'operation_conflict';

export type InteractionReceipt = Readonly<{
  operationId: string;
  actorId: string;
  targetId: string;
  accepted: boolean;
  kind?: InteractionKind;
  reason?: InteractionRejectReason;
  resultId?: string;
  durationMs?: number;
  startedAtMs?: number;
  completesAtMs?: number;
  /** Server-derived actor that receives a domain effect (for example, a teammate being revived). */
  effectCharacterId?: string;
}>;

export const InteractionReceiptSchema = z.strictObject({
  operationId: z.string().trim().min(1).max(128),
  actorId: IdSchema,
  targetId: IdSchema,
  accepted: z.boolean(),
  kind: InteractionKindSchema.optional(),
  reason: z
    .enum([
      'invalid_request',
      'unknown_target',
      'unavailable',
      'invalid_state',
      'interrupted',
      'cooldown',
      'out_of_range',
      'already_consumed',
      'operation_conflict',
    ])
    .optional(),
  resultId: z.string().trim().min(1).max(128).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  startedAtMs: z.number().int().nonnegative().optional(),
  completesAtMs: z.number().int().nonnegative().optional(),
  effectCharacterId: IdSchema.optional(),
});

export const InteractionCooldownSchema = z.strictObject({
  targetId: IdSchema,
  availableAtMs: z.number().int().nonnegative(),
});
export type InteractionCooldown = z.infer<typeof InteractionCooldownSchema>;

export type InteractionLedger = Readonly<{
  consumedTargetIds: readonly string[];
  cooldowns: readonly InteractionCooldown[];
  receipts: readonly InteractionReceipt[];
}>;

export const InteractionLedgerSchema = z
  .strictObject({
    consumedTargetIds: z.array(IdSchema),
    cooldowns: z.array(InteractionCooldownSchema),
    receipts: z.array(InteractionReceiptSchema),
  })
  .superRefine((ledger, context) => {
    if (new Set(ledger.consumedTargetIds).size !== ledger.consumedTargetIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['consumedTargetIds'],
        message: 'consumedTargetIds must not contain duplicates',
      });
    }
    const operationIds = ledger.receipts.map((receipt) => receipt.operationId);
    if (new Set(operationIds).size !== operationIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['receipts'],
        message: 'receipts must not contain duplicate operation ids',
      });
    }
    const cooldownTargetIds = ledger.cooldowns.map((cooldown) => cooldown.targetId);
    if (new Set(cooldownTargetIds).size !== cooldownTargetIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['cooldowns'],
        message: 'cooldowns must not contain duplicate target ids',
      });
    }
  });

export const EMPTY_INTERACTION_LEDGER: InteractionLedger = Object.freeze({
  consumedTargetIds: Object.freeze([]),
  cooldowns: Object.freeze([]),
  receipts: Object.freeze([]),
});

export type InteractionResult = Readonly<{
  ledger: InteractionLedger;
  receipt: InteractionReceipt;
  replayed: boolean;
}>;

/**
 * Resolves one interaction against a snapshot of targets. It does not mutate a target, consume a
 * chest, or read a clock; callers replace their ledger with the returned value and apply the
 * accepted receipt to the authoritative domain action.
 */
export function applyInteraction(
  ledger: InteractionLedger,
  targets: readonly InteractionTarget[],
  request: unknown,
  context: unknown,
): InteractionResult {
  const parsedRequest = InteractionRequestSchema.safeParse(request);
  const parsedContext = parseInteractionContext(context);
  if (!parsedRequest.success || parsedContext === undefined) {
    return rejected(ledger, request, 'invalid_request');
  }

  const validRequest = parsedRequest.data;
  const validContext = parsedContext;
  const prior = ledger.receipts.find((receipt) => receipt.operationId === validRequest.operationId);
  if (prior !== undefined) {
    if (prior.actorId !== validRequest.actorId || prior.targetId !== validRequest.targetId) {
      return {
        ledger,
        receipt: {
          operationId: validRequest.operationId,
          actorId: validRequest.actorId,
          targetId: validRequest.targetId,
          accepted: false,
          reason: 'operation_conflict',
        },
        replayed: true,
      };
    }
    return { ledger, receipt: prior, replayed: true };
  }

  const targetRecord = targets.find(
    (candidate) => candidate.interactionId === validRequest.targetId,
  );
  const target = targetRecord === undefined ? undefined : resolveInteractionTarget(targetRecord);
  if (target === undefined) return rejected(ledger, validRequest, 'unknown_target');
  if (!target.available) return rejected(ledger, validRequest, 'unavailable');
  if (!target.allowedActorStates.includes(validContext.actorState))
    return rejected(ledger, validRequest, 'invalid_state');
  if (target.interruptOnDamage && validContext.interruptedByDamage)
    return rejected(ledger, validRequest, 'interrupted');
  if (ledger.consumedTargetIds.includes(target.interactionId))
    return rejected(ledger, validRequest, 'already_consumed');

  const activeCooldown = ledger.cooldowns.find(
    (cooldown) =>
      cooldown.targetId === target.interactionId && cooldown.availableAtMs > validContext.nowMs,
  );
  if (activeCooldown !== undefined) return rejected(ledger, validRequest, 'cooldown');

  const distance = Math.hypot(
    target.position.x - validContext.actorPosition.x,
    target.position.y - validContext.actorPosition.y,
  );
  if (distance > target.radiusPx) return rejected(ledger, validRequest, 'out_of_range');

  const completesAtMs = validContext.nowMs + target.durationMs;
  const receipt: InteractionReceipt = {
    operationId: validRequest.operationId,
    actorId: validRequest.actorId,
    targetId: validRequest.targetId,
    accepted: true,
    kind: target.kind,
    ...(target.resultId === undefined ? {} : { resultId: target.resultId }),
    durationMs: target.durationMs,
    startedAtMs: validContext.nowMs,
    completesAtMs,
  };
  const consumedTargetIds = target.oneShot
    ? [...ledger.consumedTargetIds, target.interactionId]
    : ledger.consumedTargetIds;
  const cooldowns =
    target.cooldownMs > 0
      ? [
          ...ledger.cooldowns.filter((cooldown) => cooldown.targetId !== target.interactionId),
          { targetId: target.interactionId, availableAtMs: completesAtMs + target.cooldownMs },
        ]
      : ledger.cooldowns.filter((cooldown) => cooldown.availableAtMs > validContext.nowMs);
  return {
    ledger: createLedger(consumedTargetIds, cooldowns, [...ledger.receipts, receipt]),
    receipt,
    replayed: false,
  };
}

/** Fills optional presentation/map fields with deterministic contract defaults. */
export function resolveInteractionTarget(target: InteractionTarget): ResolvedInteractionTarget {
  return {
    ...target,
    durationMs: target.durationMs ?? 0,
    allowedActorStates: Object.freeze([...(target.allowedActorStates ?? ['active'])]),
    interruptOnDamage: target.interruptOnDamage ?? false,
    authority: target.authority ?? 'server',
    cooldownMs: target.cooldownMs ?? 0,
  };
}

function parseInteractionContext(value: unknown): InteractionContext | undefined {
  const point = InteractionPointSchema.safeParse(value);
  if (point.success) {
    return {
      actorPosition: point.data,
      actorState: 'active',
      nowMs: 0,
      interruptedByDamage: false,
    };
  }
  const context = InteractionContextSchema.safeParse(value);
  return context.success ? context.data : undefined;
}

function rejected(
  ledger: InteractionLedger,
  request: unknown,
  reason: InteractionRejectReason,
): InteractionResult {
  const record = typeof request === 'object' && request !== null ? request : {};
  const operationId = readString(record, 'operationId');
  const actorId = readString(record, 'actorId');
  const targetId = readString(record, 'targetId');
  return {
    ledger,
    receipt: {
      operationId,
      actorId,
      targetId,
      accepted: false,
      reason,
    },
    replayed: false,
  };
}

function readString(record: object, key: string): string {
  const value = Reflect.get(record, key);
  return typeof value === 'string' ? value : '';
}

function createLedger(
  consumedTargetIds: readonly string[],
  cooldowns: readonly InteractionCooldown[],
  receipts: readonly InteractionReceipt[],
): InteractionLedger {
  return Object.freeze({
    consumedTargetIds: Object.freeze([...consumedTargetIds]),
    cooldowns: Object.freeze(cooldowns.map((cooldown) => Object.freeze({ ...cooldown }))),
    receipts: Object.freeze([...receipts]),
  });
}
