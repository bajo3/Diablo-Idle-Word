import type { CombatVector } from '@brecha/shared';

export const DEFAULT_ENEMY_STRESS_COUNT = 3;
export const MAX_ENEMY_STRESS_COUNT = 40;
export const STRESS_FRAME_SAMPLE_CAPACITY = 600;

/** Internal profiling is available only in development builds. */
export function enemyStressEnabled(search: string, isDevelopment: boolean): boolean {
  return isDevelopment && hasEnemyStressQuery(search);
}

export function hasEnemyStressQuery(search: string): boolean {
  return new URLSearchParams(search).has('enemyStress');
}

/** Reads the opt-in preview query without changing the normal three-enemy scene. */
export function parseEnemyStressCount(search: string): number {
  const raw = new URLSearchParams(search).get('enemyStress');
  if (raw === null || raw.trim() === '') return DEFAULT_ENEMY_STRESS_COUNT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return DEFAULT_ENEMY_STRESS_COUNT;
  return Math.min(MAX_ENEMY_STRESS_COUNT, Math.max(DEFAULT_ENEMY_STRESS_COUNT, parsed));
}

/** Stable grid with enough candidates for the 40-entity render/AI stress scenario. */
export function enemyStressSpawnPoints(): readonly CombatVector[] {
  const points: CombatVector[] = [];
  for (let y = 80; y <= 650; y += 90) for (let x = 260; x <= 1160; x += 90) points.push({ x, y });
  return points;
}

/** Numeric percentile for the bounded frame sample ring. */
export function percentile(samples: readonly number[], quantile: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1));
  return sorted[index]!;
}
