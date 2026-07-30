import { z } from 'zod';

import { BuildSnapshotSchema, DomainSchemaVersion } from './domain.js';
import { SeedSchema, VersionSchema, ZoneIdSchema } from './ids.js';

export const CalibrationStateSchema = z.enum([
  'NOT_STARTED',
  'RUNNING',
  'VALID',
  'INVALID',
  'ACTIVATED',
]);
export const CalibrationInvalidReasonSchema = z.enum([
  'BUILD_CHANGED',
  'ZONE_CHANGED',
  'DIFFICULTY_CHANGED',
  'DISCONNECTED',
  'INSUFFICIENT_VALID_DURATION',
  'INSUFFICIENT_ACTIVITY',
  'INVALID_REWARD_SOURCE',
  'UNIQUE_OR_BOSS_REWARD',
  'IMPOSSIBLE_RATE',
  'EXCESSIVE_INACTIVITY',
]);
export const DifficultySchema = z.enum(['normal', 'veteran']);
export const ResourceTotalsSchema = z.strictObject({
  experience: z.number().int().nonnegative(),
  gold: z.number().int().nonnegative(),
  materials: z.number().int().nonnegative(),
});
export const RarityCountsSchema = z.strictObject({
  common: z.number().int().nonnegative(),
  magic: z.number().int().nonnegative(),
  rare: z.number().int().nonnegative(),
  legendary: z.number().int().nonnegative(),
});
export const AwayMetricsSchema = z.strictObject({
  validDurationSeconds: z.number().int().nonnegative(),
  normalEnemiesDefeated: z.number().int().nonnegative(),
  eliteEnemiesDefeated: z.number().int().nonnegative(),
  rewards: ResourceTotalsSchema,
  damageDealt: z.number().nonnegative(),
  damageTaken: z.number().nonnegative(),
  deathsOrDowns: z.number().int().nonnegative(),
  effectiveCombatSeconds: z.number().int().nonnegative(),
  droppedItemsByRarity: RarityCountsSchema,
  magicFind: z.number().nonnegative(),
});
export const CalibrationSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(DomainSchemaVersion),
    calibrationId: z.string().trim().min(1).max(128),
    state: CalibrationStateSchema,
    zoneId: ZoneIdSchema,
    difficulty: DifficultySchema,
    startedAtServerMs: z.number().int().nonnegative(),
    completedAtServerMs: z.number().int().nonnegative().optional(),
    build: BuildSnapshotSchema,
    metrics: AwayMetricsSchema,
    calculationSeed: SeedSchema,
    invalidReason: CalibrationInvalidReasonSchema.optional(),
  })
  .superRefine((value, context) => {
    if (
      value.completedAtServerMs !== undefined &&
      value.completedAtServerMs < value.startedAtServerMs
    ) {
      context.addIssue({
        code: 'custom',
        message: 'completedAtServerMs must not precede startedAtServerMs',
        path: ['completedAtServerMs'],
      });
    }
    if (value.state === 'VALID') {
      if (value.completedAtServerMs === undefined)
        context.addIssue({
          code: 'custom',
          message: 'VALID calibration requires completedAtServerMs',
          path: ['completedAtServerMs'],
        });
      if (value.metrics.validDurationSeconds !== 300)
        context.addIssue({
          code: 'custom',
          message: 'VALID calibration requires exactly 300 valid seconds',
          path: ['metrics', 'validDurationSeconds'],
        });
      if (value.invalidReason !== undefined)
        context.addIssue({
          code: 'custom',
          message: 'VALID calibration cannot have invalidReason',
          path: ['invalidReason'],
        });
    }
    if (value.state === 'INVALID' && value.invalidReason === undefined)
      context.addIssue({
        code: 'custom',
        message: 'INVALID calibration requires invalidReason',
        path: ['invalidReason'],
      });
    if (value.state !== 'INVALID' && value.invalidReason !== undefined)
      context.addIssue({
        code: 'custom',
        message: 'Only INVALID calibration can have invalidReason',
        path: ['invalidReason'],
      });
  });
export const AwayResultSchema = z
  .strictObject({
    schemaVersion: z.literal(DomainSchemaVersion),
    awaySessionId: z.string().trim().min(1).max(128),
    calibrationId: z.string().trim().min(1).max(128),
    zoneId: ZoneIdSchema,
    difficulty: DifficultySchema,
    startedAtServerMs: z.number().int().nonnegative(),
    endedAtServerMs: z.number().int().nonnegative(),
    elapsedSeconds: z.number().int().nonnegative(),
    computedSeconds: z.number().int().nonnegative(),
    discardedSeconds: z.number().int().nonnegative(),
    efficiency: z.number().min(0).max(1),
    survivalFactor: z.number().min(0).max(1),
    estimatedEnemiesDefeated: z.number().int().nonnegative(),
    rewards: ResourceTotalsSchema,
    generatedItemsByRarity: RarityCountsSchema,
    reductions: z.array(z.string().trim().min(1).max(160)),
    balanceVersion: VersionSchema,
    gameDataVersion: VersionSchema,
    calculationSeed: SeedSchema,
  })
  .superRefine((value, context) => {
    if (value.endedAtServerMs < value.startedAtServerMs)
      context.addIssue({
        code: 'custom',
        message: 'endedAtServerMs must not precede startedAtServerMs',
        path: ['endedAtServerMs'],
      });
    if (value.computedSeconds > value.elapsedSeconds)
      context.addIssue({
        code: 'custom',
        message: 'computedSeconds cannot exceed elapsedSeconds',
        path: ['computedSeconds'],
      });
    if (value.discardedSeconds !== value.elapsedSeconds - value.computedSeconds)
      context.addIssue({
        code: 'custom',
        message: 'discardedSeconds must equal elapsedSeconds minus computedSeconds',
        path: ['discardedSeconds'],
      });
  });

export type CalibrationState = z.infer<typeof CalibrationStateSchema>;
export type CalibrationInvalidReason = z.infer<typeof CalibrationInvalidReasonSchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;
export type ResourceTotals = z.infer<typeof ResourceTotalsSchema>;
export type RarityCounts = z.infer<typeof RarityCountsSchema>;
export type AwayMetrics = z.infer<typeof AwayMetricsSchema>;
export type CalibrationSnapshot = z.infer<typeof CalibrationSnapshotSchema>;
export type AwayResult = z.infer<typeof AwayResultSchema>;
