export type Direction4 = 'up' | 'down' | 'left' | 'right';
export type LocalCharacterState = 'idle' | 'moving' | 'attacking' | 'casting' | 'channeling';

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
