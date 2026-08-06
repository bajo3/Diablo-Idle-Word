import { constrainKnockbackSweep } from './combat-controller';

/** Shared world dimensions; decorative scenery never enters this collision model. */
export const TEST_WORLD = Object.freeze({ width: 1280, height: 720, margin: 24 });
export const ACTOR_WORLD_MARGIN = 72;
/**
 * Actor sprites are 92px tall and anchored at `origin.y = 0.86`, so the silhouette reaches ~79px
 * *above* its world position and only ~13px below it. A single margin therefore cannot hold the
 * whole body inside the arena: walking north used to push the head past the world's top edge, where
 * the camera can no longer follow it. The top edge gets its own, taller margin for that reason.
 */
export const ACTOR_WORLD_MARGIN_TOP = 88;

export function clampWorldPosition(position: Readonly<{ x: number; y: number }>): {
  x: number;
  y: number;
} {
  return {
    x: Math.min(TEST_WORLD.width - ACTOR_WORLD_MARGIN, Math.max(ACTOR_WORLD_MARGIN, position.x)),
    y: Math.min(
      TEST_WORLD.height - ACTOR_WORLD_MARGIN,
      Math.max(ACTOR_WORLD_MARGIN_TOP, position.y),
    ),
  };
}

/** Knockback is constrained by map bounds only; decorative background art is not a wall. */
export function constrainDummyKnockback(
  from: Readonly<{ x: number; y: number }>,
  proposed: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  return constrainKnockbackSweep(from, proposed, [], {
    minimumX: TEST_WORLD.margin,
    minimumY: TEST_WORLD.margin,
    maximumX: TEST_WORLD.width - TEST_WORLD.margin,
    maximumY: TEST_WORLD.height - TEST_WORLD.margin,
  });
}
