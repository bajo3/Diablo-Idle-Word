import { guardianCombatTuning } from './combat-controller';
import type { Direction4, LocalCharacterState } from './domain';

export type CombatPresentation = Readonly<{
  ability: 'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin';
  state: LocalCharacterState;
  frameRate: number;
  frames: readonly [number, number, number, number];
  impactMs: number;
  durationMs: number;
  tickOffsetsMs: readonly number[];
}>;
const fixedFrames = [0, 1, 2, 3] as const;
export const guardianCombatPresentation: readonly CombatPresentation[] = [
  {
    ability: 'slash',
    state: 'attacking',
    frameRate: 10,
    frames: fixedFrames,
    impactMs: guardianCombatTuning.abilities.slash.impactMs!,
    durationMs: guardianCombatTuning.abilities.slash.recoveryMs!,
    tickOffsetsMs: [],
  },
  {
    ability: 'powerStrike',
    state: 'attacking',
    frameRate: 5,
    frames: fixedFrames,
    impactMs: guardianCombatTuning.abilities.powerStrike.impactMs!,
    durationMs: guardianCombatTuning.abilities.powerStrike.recoveryMs!,
    tickOffsetsMs: [],
  },
  {
    ability: 'whirlwind',
    state: 'channeling',
    frameRate: 40 / 3,
    frames: fixedFrames,
    impactMs: 0,
    durationMs: guardianCombatTuning.abilities.whirlwind.durationMs!,
    tickOffsetsMs: guardianCombatTuning.abilities.whirlwind.tickOffsetsMs!,
  },
  {
    ability: 'ironSkin',
    state: 'casting',
    frameRate: 8,
    frames: fixedFrames,
    impactMs: guardianCombatTuning.abilities.ironSkin.impactMs!,
    durationMs: guardianCombatTuning.abilities.ironSkin.recoveryMs!,
    tickOffsetsMs: [],
  },
];
export function validateGuardianCombatPresentation(entries = guardianCombatPresentation): void {
  if (entries.length !== 4) throw new Error('Missing combat presentation.');
  for (const entry of entries) {
    const tuning = guardianCombatTuning.abilities[entry.ability];
    if (
      entry.frames.join(',') !== fixedFrames.join(',') ||
      entry.impactMs !== (tuning.impactMs ?? 0)
    )
      throw new Error(`Presentation diverges from impact timing: ${entry.ability}`);
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
    const expectedFrameRate =
      entry.ability === 'slash'
        ? 10
        : entry.ability === 'powerStrike'
          ? 5
          : entry.ability === 'whirlwind'
            ? 40 / 3
            : 8;
    if (
      entry.frameRate !== expectedFrameRate ||
      (entry.ability === 'slash' && entry.impactMs !== 200) ||
      (entry.ability === 'powerStrike' && entry.impactMs !== 400)
    )
      throw new Error(`Presentation diverges from frame timing: ${entry.ability}`);
  }
}
export function combatAnimationKey(
  layer: 'body' | 'armor' | 'weapon',
  ability: CombatPresentation['ability'],
  direction: Direction4,
): string {
  return `guardian_placeholder_${layer}:combat:${ability}:${direction}`;
}
