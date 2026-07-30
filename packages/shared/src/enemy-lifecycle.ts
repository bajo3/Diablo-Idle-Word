/**
 * Death, cleanup and pending rewards (Paso 8.7). No inventory/loot system exists yet (Fuera de
 * alcance), so a "reward" here is just a deduplicated XP counter to credit later - the same
 * defeat-dedup shape `applyBattleThirst` already uses in `combat.ts` (dedup by a stable id, not by
 * counting events), so a retried or replayed defeat never double-pays.
 */
export type PendingReward = Readonly<{
  enemyInstanceId: string;
  xp: number;
  awardedAt: number;
}>;

export type EnemyRewardLedger = readonly PendingReward[];

export const EMPTY_ENEMY_REWARD_LEDGER: EnemyRewardLedger = [];

/** Records a defeat's XP exactly once per `enemyInstanceId`; a duplicate call (e.g. a replayed or
 * re-delivered defeat event) is a no-op, returning the same ledger unchanged. */
export function grantEnemyDefeatReward(
  ledger: EnemyRewardLedger,
  enemyInstanceId: string,
  xpReward: number,
  at: number,
): EnemyRewardLedger {
  if (ledger.some((reward) => reward.enemyInstanceId === enemyInstanceId)) return ledger;
  return [...ledger, { enemyInstanceId, xp: xpReward, awardedAt: at }];
}

export function totalPendingXp(ledger: EnemyRewardLedger): number {
  return ledger.reduce((total, reward) => total + reward.xp, 0);
}

/**
 * Whether a dead enemy's entity/sprite is due for removal from the simulation. Death itself is
 * immediate (health hits 0 -> `dead` in `enemy-ai.ts`), but cleanup is deliberately delayed by
 * `cleanupDelayMs` so a death animation has time to play before the entity disappears.
 */
export function isReadyForCleanup(deadAt: number, atMs: number, cleanupDelayMs: number): boolean {
  return atMs >= deadAt + cleanupDelayMs;
}
