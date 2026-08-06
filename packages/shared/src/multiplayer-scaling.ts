import { DifficultySchema, type Difficulty } from './away.js';

/** Balance inputs used by the authoritative multiplayer difficulty formula. */
export type MultiplayerScalingConfig = Readonly<{
  multiplayer: Readonly<{
    healthPerAdditionalPlayer: number;
    damagePerAdditionalPlayer: number;
  }>;
  difficulty: Readonly<
    Record<Difficulty, Readonly<{ enemyHealthMultiplier: number; enemyDamageMultiplier: number }>>
  >;
}>;

export type EnemyDifficultyMultipliers = Readonly<{
  health: number;
  damage: number;
}>;

/**
 * Resolves enemy scaling from server-owned party state. The formula is deliberately pure so the
 * instance creator, respawn path and tests cannot drift apart or read client-provided counts.
 */
export function enemyDifficultyMultipliers(
  input: Readonly<{
    players: number;
    difficulty: Difficulty;
    config: MultiplayerScalingConfig;
  }>,
): EnemyDifficultyMultipliers {
  const players = Number.isInteger(input.players) ? input.players : 0;
  if (players < 1 || players > 4)
    throw new Error('Multiplayer player count must be between 1 and 4.');
  const difficulty = DifficultySchema.parse(input.difficulty);
  const tuning = input.config.difficulty[difficulty];
  if (tuning === undefined) throw new Error(`Missing difficulty tuning for ${difficulty}.`);
  const additionalPlayers = players - 1;
  return {
    health:
      tuning.enemyHealthMultiplier +
      input.config.multiplayer.healthPerAdditionalPlayer * additionalPlayers,
    damage:
      tuning.enemyDamageMultiplier +
      input.config.multiplayer.damagePerAdditionalPlayer * additionalPlayers,
  };
}
