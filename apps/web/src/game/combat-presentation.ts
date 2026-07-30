import { GAME_DATA } from '@brecha/game-data';

import { guardianCombatTuning } from './combat-controller';
import type { Direction4, LocalCharacterState } from './domain';

export type GuardianAbilityKey = 'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin';

export type CombatPresentation = Readonly<{
  ability: GuardianAbilityKey;
  state: LocalCharacterState;
  frameRate: number;
  frames: readonly number[];
  impactMs: number;
  durationMs: number;
  tickOffsetsMs: readonly number[];
}>;

/** Maps the local ability key to the catalog ids that carry its animation/timing metadata. */
const abilityCatalogId: Readonly<Record<GuardianAbilityKey, string>> = {
  slash: 'ability.guardian.slash',
  powerStrike: 'ability.guardian.power_strike',
  whirlwind: 'ability.guardian.whirlwind',
  ironSkin: 'ability.guardian.iron_skin',
};
const combatStateByAbility: Readonly<Record<GuardianAbilityKey, LocalCharacterState>> = {
  slash: 'attacking',
  powerStrike: 'attacking',
  whirlwind: 'channeling',
  ironSkin: 'casting',
};
const guardianAbilityKeys = Object.keys(abilityCatalogId) as readonly GuardianAbilityKey[];

function animationFor(ability: GuardianAbilityKey) {
  const abilityId = abilityCatalogId[ability];
  const abilityMeta = GAME_DATA.abilities.find(({ id }) => id === abilityId);
  if (abilityMeta === undefined) throw new Error(`Missing ability metadata: ${abilityId}`);
  const animation = GAME_DATA.animations.find(({ id }) => id === abilityMeta.animationId);
  if (animation === undefined)
    throw new Error(`Missing animation catalog entry: ${abilityMeta.animationId}`);
  return animation;
}

/** impactMs is 0 for whirlwind: its damage is driven by tickOffsetsMs, not a single impact. */
function impactMsFor(ability: GuardianAbilityKey): number {
  if (ability === 'whirlwind') return 0;
  return guardianCombatTuning.abilities[ability].impactMs ?? 0;
}
function durationMsFor(ability: GuardianAbilityKey): number {
  const tuning = guardianCombatTuning.abilities[ability];
  return ability === 'whirlwind' ? (tuning.durationMs ?? 0) : (tuning.recoveryMs ?? 0);
}

function buildPresentation(ability: GuardianAbilityKey): CombatPresentation {
  const animation = animationFor(ability);
  return {
    ability,
    state: combatStateByAbility[ability],
    frameRate: animation.frameRate,
    frames: Array.from(
      { length: animation.endFrame - animation.startFrame + 1 },
      (_unused, index) => animation.startFrame + index,
    ),
    impactMs: impactMsFor(ability),
    durationMs: durationMsFor(ability),
    tickOffsetsMs:
      ability === 'whirlwind' ? (guardianCombatTuning.abilities.whirlwind.tickOffsetsMs ?? []) : [],
  };
}

export const guardianCombatPresentation: readonly CombatPresentation[] =
  guardianAbilityKeys.map(buildPresentation);

/**
 * Pure so it is directly testable: if the catalog's impactMs moves without moving the matching
 * animation's hitFrame (or vice versa), this returns the divergence in milliseconds instead of
 * undefined. Half a frame of slack absorbs rounding; anything past that is a real drift.
 */
export function hitFrameImpactDivergenceMs(
  animation: Readonly<{ hitFrame?: number | undefined; startFrame: number; frameRate: number }>,
  impactMs: number,
): number | undefined {
  if (animation.hitFrame === undefined) return undefined;
  const frameDurationMs = 1000 / animation.frameRate;
  const hitFrameMs = (animation.hitFrame - animation.startFrame) * frameDurationMs;
  const divergence = hitFrameMs - impactMs;
  return Math.abs(divergence) > frameDurationMs / 2 + 1e-6 ? divergence : undefined;
}

/**
 * Every timing number here must trace back to the versioned catalog: an ability's impact must
 * land on the frame its animation declares as `hitFrame`, and the frame rate/duration must be the
 * catalog's, not a literal re-typed by hand. This is what closes the "orphan data" gap: before
 * this, GAME_DATA.animations' hitFrame/eventFrames were declared but nothing ever read them.
 */
export function validateGuardianCombatPresentation(entries = guardianCombatPresentation): void {
  if (entries.length !== guardianAbilityKeys.length)
    throw new Error('Missing combat presentation.');
  for (const entry of entries) {
    const tuning = guardianCombatTuning.abilities[entry.ability];
    const animation = animationFor(entry.ability);
    if (entry.frames.length !== 4)
      throw new Error(`Presentation must declare four frames: ${entry.ability}`);
    if (entry.frameRate !== animation.frameRate)
      throw new Error(`Presentation frame rate diverges from the catalog: ${entry.ability}`);
    if (entry.impactMs !== impactMsFor(entry.ability))
      throw new Error(`Presentation diverges from impact timing: ${entry.ability}`);
    if (hitFrameImpactDivergenceMs(animation, entry.impactMs) !== undefined)
      throw new Error(`Animation hit frame does not line up with impactMs: ${entry.ability}`);
    if (
      entry.ability === 'whirlwind' &&
      (entry.durationMs !== tuning.durationMs ||
        entry.tickOffsetsMs.join(',') !== tuning.tickOffsetsMs?.join(','))
    )
      throw new Error('Presentation diverges from whirlwind ticks.');
    if (
      entry.ability !== 'whirlwind' &&
      entry.durationMs !== (tuning.recoveryMs ?? tuning.impactMs ?? 0)
    )
      throw new Error(`Presentation diverges from duration: ${entry.ability}`);
  }
}
export function combatAnimationKey(
  layer: 'body' | 'armor' | 'weapon',
  ability: CombatPresentation['ability'],
  direction: Direction4,
): string {
  return `guardian_placeholder_${layer}:combat:${ability}:${direction}`;
}
