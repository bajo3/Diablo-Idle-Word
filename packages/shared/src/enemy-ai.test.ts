import { describe, expect, it } from 'vitest';

import { decideEnemyState, type EnemyAiInput, type EnemyAiTuning } from './enemy-ai.js';

const tuning: EnemyAiTuning = {
  detectRadiusPx: 200,
  loseTargetRadiusPx: 320,
  leashRadiusPx: 500,
  attackRangePx: 60,
};

function input(overrides: Partial<EnemyAiInput> = {}): EnemyAiInput {
  return {
    current: 'idle',
    isDead: false,
    isStunned: false,
    abilityReady: false,
    restState: 'idle',
    perception: { distanceToTargetPx: 1000, hasLineOfSight: false, distanceFromSpawnPx: 0 },
    tuning,
    ...overrides,
  };
}

describe('enemy AI FSM', () => {
  it('is absorbed by dead from any state, and never revives once dead', () => {
    expect(decideEnemyState(input({ current: 'chase', isDead: true }))).toBe('dead');
    expect(decideEnemyState(input({ current: 'dead', isDead: false }))).toBe('dead');
  });

  it('stunned overrides everything and forgets what it was doing on recovery', () => {
    expect(
      decideEnemyState(
        input({
          current: 'attack',
          isStunned: true,
          perception: { distanceToTargetPx: 10, hasLineOfSight: true, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('stunned');
    expect(
      decideEnemyState(
        input({
          current: 'stunned',
          isStunned: false,
          perception: { distanceToTargetPx: 500, hasLineOfSight: true, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('idle');
  });

  it('detects only within radius and with line of sight, otherwise rests', () => {
    expect(
      decideEnemyState(
        input({
          perception: { distanceToTargetPx: 150, hasLineOfSight: true, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('detect');
    expect(
      decideEnemyState(
        input({
          perception: { distanceToTargetPx: 150, hasLineOfSight: false, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('idle');
    expect(
      decideEnemyState(
        input({
          restState: 'patrol',
          current: 'patrol',
          perception: { distanceToTargetPx: 900, hasLineOfSight: true, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('patrol');
  });

  it('sustains a chase through the hysteresis band without needing line of sight', () => {
    expect(
      decideEnemyState(
        input({
          current: 'chase',
          perception: { distanceToTargetPx: 280, hasLineOfSight: false, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('chase');
  });

  it('loses the target only past loseTargetRadiusPx, returning to restState', () => {
    expect(
      decideEnemyState(
        input({
          current: 'chase',
          restState: 'patrol',
          perception: { distanceToTargetPx: 321, hasLineOfSight: false, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('patrol');
  });

  it('enters attack (or use_ability, when ready) inside range and chases when it drifts out', () => {
    expect(
      decideEnemyState(
        input({
          current: 'chase',
          perception: { distanceToTargetPx: 40, hasLineOfSight: false, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('attack');
    expect(
      decideEnemyState(
        input({
          current: 'chase',
          abilityReady: true,
          perception: { distanceToTargetPx: 40, hasLineOfSight: false, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('use_ability');
    expect(
      decideEnemyState(
        input({
          current: 'attack',
          perception: { distanceToTargetPx: 120, hasLineOfSight: false, distanceFromSpawnPx: 0 },
        }),
      ),
    ).toBe('chase');
  });

  it('leashes home regardless of an in-range target, and stays home until close to spawn', () => {
    expect(
      decideEnemyState(
        input({
          current: 'attack',
          perception: { distanceToTargetPx: 10, hasLineOfSight: true, distanceFromSpawnPx: 501 },
        }),
      ),
    ).toBe('retreat');
    expect(
      decideEnemyState(
        input({
          current: 'retreat',
          perception: { distanceToTargetPx: 10, hasLineOfSight: true, distanceFromSpawnPx: 250 },
        }),
      ),
    ).toBe('retreat');
    expect(
      decideEnemyState(
        input({
          current: 'retreat',
          restState: 'patrol',
          perception: { distanceToTargetPx: 10, hasLineOfSight: true, distanceFromSpawnPx: 50 },
        }),
      ),
    ).toBe('patrol');
  });
});
