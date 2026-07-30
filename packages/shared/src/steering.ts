import type { CombatVector } from './combat.js';

/**
 * Pure "simple navigation" (Paso 8.3, GOAL.md explicitly rules out A* for the MVP): seek, flee,
 * arrive and separation, the same textbook steering primitives, composed by the caller into
 * whatever behavior an enemy profile (Paso 8.4) needs. No Phaser, no physics body, no `delta` -
 * each function is a pure function of position(s) to a desired velocity vector.
 */
export type SteeringVector = CombatVector;
export type SeparationNeighbor = Readonly<{ position: SteeringVector }>;

function magnitude(vector: SteeringVector): number {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector: SteeringVector): SteeringVector {
  const length = magnitude(vector);
  return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length };
}

function scale(vector: SteeringVector, factor: number): SteeringVector {
  return { x: vector.x * factor, y: vector.y * factor };
}

function add(a: SteeringVector, b: SteeringVector): SteeringVector {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: SteeringVector, b: SteeringVector): SteeringVector {
  return { x: a.x - b.x, y: a.y - b.y };
}

function clampMagnitude(vector: SteeringVector, maxMagnitude: number): SteeringVector {
  const length = magnitude(vector);
  return length <= maxMagnitude || length === 0 ? vector : scale(vector, maxMagnitude / length);
}

/** Full speed straight at the target. */
export function seek(
  position: SteeringVector,
  target: SteeringVector,
  maxSpeed: number,
): SteeringVector {
  return scale(normalize(subtract(target, position)), maxSpeed);
}

/** Full speed straight away from the target - `seek`'s mirror image. */
export function flee(
  position: SteeringVector,
  target: SteeringVector,
  maxSpeed: number,
): SteeringVector {
  return scale(normalize(subtract(position, target)), maxSpeed);
}

/** Like `seek`, but linearly ramps speed down inside `slowingRadiusPx` so the mover settles at the
 * target instead of overshooting and oscillating around it. */
export function arrive(
  position: SteeringVector,
  target: SteeringVector,
  maxSpeed: number,
  slowingRadiusPx: number,
): SteeringVector {
  const offset = subtract(target, position);
  const distance = magnitude(offset);
  if (distance === 0) return { x: 0, y: 0 };
  const rampedSpeed = maxSpeed * Math.min(distance / slowingRadiusPx, 1);
  return scale(normalize(offset), rampedSpeed);
}

/** Pushes away from every neighbor closer than `radiusPx`, weighted by how close each one is, then
 * averaged and clamped to `maxSpeed` - keeps a pack of enemies from stacking on the same pixel. */
export function separation(
  position: SteeringVector,
  neighbors: readonly SeparationNeighbor[],
  radiusPx: number,
  maxSpeed: number,
): SteeringVector {
  let total: SteeringVector = { x: 0, y: 0 };
  let count = 0;
  for (const neighbor of neighbors) {
    const offset = subtract(position, neighbor.position);
    const distance = magnitude(offset);
    if (distance > 0 && distance < radiusPx) {
      total = add(total, scale(normalize(offset), (radiusPx - distance) / radiusPx));
      count += 1;
    }
  }
  return count === 0 ? total : clampMagnitude(scale(total, 1 / count), maxSpeed);
}

/** Sums any number of steering vectors (seek + separation, arrive + separation, ...) and clamps
 * the result to `maxSpeed` so combining behaviors never exceeds the mover's own speed cap. */
export function combineSteering(
  vectors: readonly SteeringVector[],
  maxSpeed: number,
): SteeringVector {
  return clampMagnitude(
    vectors.reduce((acc, vector) => add(acc, vector), { x: 0, y: 0 }),
    maxSpeed,
  );
}
