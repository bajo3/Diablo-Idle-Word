/**
 * Endless Corrupted Forest — progression core (Paso 9). Replaces the finite mission (3 altars →
 * boss door → boss → victory/defeat) with an idle-RPG infinite-level loop: the player advances
 * through levels 1..maximumLevel, each harder than the last, with no terminal win/lose condition
 * (GOAL.md §1, §0.1). Combat stays semi-automatic; defeating enemies accumulates XP that drives
 * level progression.
 *
 * Pure: no Phaser, no transport, no storage, no clock reads. Every function is a pure transition
 * of state, mirroring `combat.ts`/`enemy-simulation.ts` — replaying the same defeat sequence always
 * reproduces the same progression. Numerical scaling (XP thresholds, enemy multipliers per level)
 * lives in `GAME_DATA.endlessForest` in `game-data`, passed in by the caller; this module only
 * *applies* it, carrying no magic numbers of its own (AGENTS.md).
 */

/** A single level's tuning in the endless forest: how much harder than level 1 it is, and how much
 *  XP the player must accumulate *within that level* to advance to the next one. */
export type ForestLevelTuning = Readonly<{
  level: number;
  /** Enemy health multiplier at this level (1 at level 1, monotonically non-decreasing). */
  enemyHealthMultiplier: number;
  /** Enemy damage multiplier at this level (1 at level 1, monotonically non-decreasing). */
  enemyDamageMultiplier: number;
  /** How many enemies spawn in one wave at this level (monotonically non-decreasing). */
  waveSize: number;
  /** XP required to advance from this level to the next. The final level has no next, so its
   *  threshold is irrelevant (the player caps there). */
  xpToAdvance: number;
}>;

/** The whole forest curve: ordered levels 1..maximumLevel, monotonically scaling. */
export type ForestProgressionCurve = Readonly<{
  minimumLevel: number;
  maximumLevel: number;
  levels: readonly ForestLevelTuning[];
}>;

/** Mutable-by-replacement progression state for one player's forest run. */
export type ForestProgressState = Readonly<{
  /** Current forest level the player is on (1..maximumLevel). */
  level: number;
  /** XP accumulated toward the *current* level's `xpToAdvance`. Reset to the remainder on level-up. */
  xpInLevel: number;
  /** Best (highest) forest level the player has ever reached. */
  bestLevel: number;
  /** Total XP earned across the whole run (never decreases; useful for reports/idle calibration). */
  totalXp: number;
  /** Total gold earned across the whole run. */
  totalGold: number;
  /** Total materials earned across the whole run. */
  totalMaterials: number;
  /** Defeat ids already counted, so a replayed/re-sent defeat event never pays twice (idempotency,
   *  same pattern as `EnemyRewardLedger`/Battle Thirst). Bounded by the caller, not this module. */
  countedDefeats: ReadonlySet<string>;
}>;

/** What applying a defeat produced: state delta + whether it triggered a level-up (and to which). */
export type ForestDefeatOutcome = Readonly<{
  state: ForestProgressState;
  leveledUp: boolean;
  /** The level the player landed on after this defeat (== previous unless a level-up happened). */
  resultingLevel: number;
}>;

/** Reward granted by one defeated enemy (XP/gold/materials). Caller-derived from `enemyTuning.xpReward`. */
export type ForestEnemyReward = Readonly<{
  enemyInstanceId: string;
  xp: number;
  gold: number;
  materials: number;
}>;

export function createForestProgressState(curve: ForestProgressionCurve): ForestProgressState {
  return {
    level: curve.minimumLevel,
    xpInLevel: 0,
    bestLevel: curve.minimumLevel,
    totalXp: 0,
    totalGold: 0,
    totalMaterials: 0,
    countedDefeats: new Set(),
  };
}

/** The tuning for the level the player is currently on (throws if the curve is inconsistent). */
export function currentLevelTuning(
  state: ForestProgressState,
  curve: ForestProgressionCurve,
): ForestLevelTuning {
  return levelTuning(state.level, curve);
}

/** The tuning for an arbitrary level number, validating it against the curve's bounds. */
export function levelTuning(level: number, curve: ForestProgressionCurve): ForestLevelTuning {
  if (level < curve.minimumLevel || level > curve.maximumLevel) {
    throw new Error(
      `Forest level ${level} is outside [${curve.minimumLevel}, ${curve.maximumLevel}].`,
    );
  }
  const tuning = curve.levels[level - curve.minimumLevel];
  if (tuning === undefined) throw new Error(`Forest curve is missing tuning for level ${level}.`);
  return tuning;
}

/** How much XP the player still needs at the current level to advance; 0 if already at the cap. */
export function xpToAdvance(state: ForestProgressState, curve: ForestProgressionCurve): number {
  if (state.level >= curve.maximumLevel) return 0;
  const tuning = currentLevelTuning(state, curve);
  return Math.max(0, tuning.xpToAdvance - state.xpInLevel);
}

/**
 * Applies one enemy defeat: adds its reward exactly once (idempotent by `enemyInstanceId`), then
 * resolves any level-ups caused by the accumulated XP. Multiple level-ups in a single defeat are
 * possible if a reward is large relative to a level's threshold; each is resolved in order. A
 * defeat whose id was already counted is a no-op (returns the unchanged state, `leveledUp: false`).
 *
 * Pure: returns a new state, never mutates the input. The `countedDefeats` set is rebuilt each call
 * rather than mutated in place, so the previous state stays valid for replay/debugging.
 */
export function applyDefeat(
  state: ForestProgressState,
  reward: ForestEnemyReward,
  curve: ForestProgressionCurve,
): ForestDefeatOutcome {
  if (state.countedDefeats.has(reward.enemyInstanceId)) {
    return { state, leveledUp: false, resultingLevel: state.level };
  }
  let next: ForestProgressState = {
    ...state,
    xpInLevel: state.xpInLevel + reward.xp,
    totalXp: state.totalXp + reward.xp,
    totalGold: state.totalGold + reward.gold,
    totalMaterials: state.totalMaterials + reward.materials,
    countedDefeats: new Set(state.countedDefeats).add(reward.enemyInstanceId),
  };
  let leveledUp = false;
  // Resolve cascading level-ups: a single big reward can cross several thresholds at once.
  while (next.level < curve.maximumLevel) {
    const threshold = levelTuning(next.level, curve).xpToAdvance;
    if (next.xpInLevel < threshold) break;
    const advancedLevel = next.level + 1;
    next = {
      ...next,
      level: advancedLevel,
      xpInLevel: next.xpInLevel - threshold,
      bestLevel: Math.max(next.bestLevel, advancedLevel),
    };
    leveledUp = true;
  }
  // At the cap, surplus XP is clamped (no level beyond maximumLevel).
  if (next.level >= curve.maximumLevel) next = { ...next, xpInLevel: 0 };
  return { state: next, leveledUp, resultingLevel: next.level };
}
