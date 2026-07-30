import type { CharacterAnimationState } from '@brecha/shared';

export type Direction4 = 'up' | 'down' | 'left' | 'right';
/** The full 11-state visual FSM (GOAL.md "Maquina de estados visual"); reuses the shared contract
 * instead of a second, narrower union, so Paso 8's enemies and this scene can't drift apart. */
export type LocalCharacterState = CharacterAnimationState;

export type Motion = Readonly<{
  x: number;
  y: number;
  direction: Direction4;
  state: LocalCharacterState;
}>;

export function motionFromInput(x: number, y: number, previous: Direction4): Motion {
  const length = Math.hypot(x, y);
  if (length === 0) return { x: 0, y: 0, direction: previous, state: 'idle' };
  const normalizedX = x / length;
  const normalizedY = y / length;
  const direction =
    Math.abs(normalizedX) > Math.abs(normalizedY)
      ? normalizedX > 0
        ? 'right'
        : 'left'
      : normalizedY > 0
        ? 'down'
        : 'up';
  return { x: normalizedX, y: normalizedY, direction, state: 'moving' };
}

const ATTACK_LIKE_STATES: ReadonlySet<LocalCharacterState> = new Set([
  'attacking',
  'casting',
  'channeling',
]);

/**
 * Pure priority/interruption rule for the visual FSM (GOAL.md 6.1): `dead` is a terminal,
 * absorbing state and can never be interrupted; `downed` blocks attacks; `stunned` blocks
 * movement and abilities. Everything else defers to whatever the caller requested. This does not
 * decide *whether* an attack lands - only which visual state wins when two are requested at once.
 */
export function resolveCharacterState(
  current: LocalCharacterState,
  requested: LocalCharacterState,
): LocalCharacterState {
  if (current === 'dead') return 'dead';
  if (requested === 'dead') return 'dead';
  if (current === 'downed' && ATTACK_LIKE_STATES.has(requested)) return current;
  if (current === 'stunned' && (ATTACK_LIKE_STATES.has(requested) || requested === 'moving'))
    return current;
  return requested;
}

export const guardianAnimationCatalog = Object.freeze(
  (['idle', 'moving', 'attacking', 'casting', 'channeling'] as const).flatMap((state) =>
    (['up', 'down', 'left', 'right'] as const).map((direction) => ({
      id: `guardian:${state}:${direction}`,
      state,
      direction,
      frameRate: state === 'moving' ? 8 : state === 'idle' ? 1 : 10,
    })),
  ),
);
