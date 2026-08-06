import { z } from 'zod';

import { type ForestProgressState, levelTuning } from './endless-forest.js';
import { IdSchema, VersionSchema } from './ids.js';

/** Version of the durable envelope, independent from the forest balance/catalog version. */
export const ForestProgressSaveFormatVersion = 1 as const;
/** Version of the serialized forest state payload. */
export const ForestProgressStateSchemaVersion = 1 as const;

const ForestProgressStatePayloadSchema = z
  .strictObject({
    level: z.number().int().positive(),
    xpInLevel: z.number().int().nonnegative(),
    bestLevel: z.number().int().positive(),
    totalXp: z.number().int().nonnegative(),
    totalGold: z.number().int().nonnegative(),
    totalMaterials: z.number().int().nonnegative(),
    countedDefeats: z.array(IdSchema),
  })
  .superRefine((payload, context) => {
    if (new Set(payload.countedDefeats).size !== payload.countedDefeats.length) {
      context.addIssue({
        code: 'custom',
        path: ['countedDefeats'],
        message: 'countedDefeats must not contain duplicate ids',
      });
    }
  });

export const ForestProgressSaveV1Schema = z.strictObject({
  formatVersion: z.literal(ForestProgressSaveFormatVersion),
  stateSchemaVersion: z.literal(ForestProgressStateSchemaVersion),
  characterId: IdSchema,
  revision: z.number().int().positive(),
  savedAtServerMs: z.number().int().nonnegative(),
  dataVersion: VersionSchema,
  balanceVersion: VersionSchema,
  payload: ForestProgressStatePayloadSchema,
});

export type ForestProgressStatePayload = z.infer<typeof ForestProgressStatePayloadSchema>;
export type ForestProgressSaveV1 = z.infer<typeof ForestProgressSaveV1Schema>;

export class UnknownForestProgressSaveVersionError extends Error {
  public constructor(version: unknown) {
    super(`Unsupported forest progress save format version: ${String(version)}`);
    this.name = 'UnknownForestProgressSaveVersionError';
  }
}

export class InvalidForestProgressStateError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidForestProgressStateError';
  }
}

/** Converts the in-memory Set into stable JSON-safe data without mutating the state. */
export function forestProgressStateToPayload(
  state: ForestProgressState,
): ForestProgressStatePayload {
  return ForestProgressStatePayloadSchema.parse({
    level: state.level,
    xpInLevel: state.xpInLevel,
    bestLevel: state.bestLevel,
    totalXp: state.totalXp,
    totalGold: state.totalGold,
    totalMaterials: state.totalMaterials,
    countedDefeats: [...state.countedDefeats].sort(),
  });
}

/** Rebuilds the immutable domain state and validates it against the current curve. */
export function forestProgressStateFromPayload(
  value: unknown,
  curve: Parameters<typeof levelTuning>['1'],
): ForestProgressState {
  const payload = ForestProgressStatePayloadSchema.parse(value);
  if (payload.level < curve.minimumLevel || payload.level > curve.maximumLevel) {
    throw new InvalidForestProgressStateError(
      `Forest level ${payload.level} is outside the configured curve.`,
    );
  }
  if (payload.bestLevel < payload.level || payload.bestLevel > curve.maximumLevel) {
    throw new InvalidForestProgressStateError(
      `Forest bestLevel ${payload.bestLevel} is inconsistent with level ${payload.level}.`,
    );
  }
  if (payload.level === curve.maximumLevel && payload.xpInLevel !== 0) {
    throw new InvalidForestProgressStateError('A capped forest state must have zero xpInLevel.');
  }
  if (
    payload.level < curve.maximumLevel &&
    payload.xpInLevel >= levelTuning(payload.level, curve).xpToAdvance
  ) {
    throw new InvalidForestProgressStateError(
      'xpInLevel must be below the current level threshold before persistence.',
    );
  }
  return {
    level: payload.level,
    xpInLevel: payload.xpInLevel,
    bestLevel: payload.bestLevel,
    totalXp: payload.totalXp,
    totalGold: payload.totalGold,
    totalMaterials: payload.totalMaterials,
    countedDefeats: new Set(payload.countedDefeats),
  };
}

export function createForestProgressSave(input: {
  characterId: string;
  revision: number;
  savedAtServerMs: number;
  dataVersion: string;
  balanceVersion: string;
  state: ForestProgressState;
}): ForestProgressSaveV1 {
  return ForestProgressSaveV1Schema.parse({
    formatVersion: ForestProgressSaveFormatVersion,
    stateSchemaVersion: ForestProgressStateSchemaVersion,
    characterId: input.characterId,
    revision: input.revision,
    savedAtServerMs: input.savedAtServerMs,
    dataVersion: input.dataVersion,
    balanceVersion: input.balanceVersion,
    payload: forestProgressStateToPayload(input.state),
  });
}

/**
 * Sequential migration entry point. V1 is the first durable format; future versions must add an
 * explicit N -> N+1 function here instead of silently coercing unknown data to the latest shape.
 */
export function migrateForestProgressSave(value: unknown): ForestProgressSaveV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UnknownForestProgressSaveVersionError(undefined);
  }
  const version = (value as { formatVersion?: unknown }).formatVersion;
  if (version !== ForestProgressSaveFormatVersion) {
    throw new UnknownForestProgressSaveVersionError(version);
  }
  return ForestProgressSaveV1Schema.parse(value);
}
