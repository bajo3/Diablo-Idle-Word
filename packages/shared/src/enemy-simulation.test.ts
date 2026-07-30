import { describe, expect, it } from 'vitest';

import {
  stepEnemy,
  type EnemySimInput,
  type EnemySimState,
  type EnemySimTuning,
} from './enemy-simulation.js';

const tuning: EnemySimTuning = {
  ai: { detectRadiusPx: 200, loseTargetRadiusPx: 320, leashRadiusPx: 500, attackRangePx: 60 },
  moveSpeedPxPerSec: 100,
  separationRadiusPx: 40,
};

function state(overrides: Partial<EnemySimState> = {}): EnemySimState {
  return {
    aiState: 'idle',
    position: { x: 0, y: 0 },
    spawnPosition: { x: 0, y: 0 },
    ...overrides,
  };
}

function input(overrides: Partial<EnemySimInput> = {}): EnemySimInput {
  return {
    targetPosition: { x: 1000, y: 0 },
    hasLineOfSight: false,
    neighbors: [],
    isDead: false,
    isStunned: false,
    abilityReady: false,
    restState: 'idle',
    fromMs: 0,
    toMs: 1000,
    ...overrides,
  };
}

describe('enemy simulation step', () => {
  it('stays put while idle/patrol/detect/attack/stunned/dead', () => {
    for (const aiState of ['idle', 'patrol', 'detect', 'attack', 'use_ability'] as const) {
      const result = stepEnemy(state({ aiState }), input(), tuning);
      expect(result.position).toEqual({ x: 0, y: 0 });
    }
    const stunned = stepEnemy(
      state({ aiState: 'chase' }),
      input({ isStunned: true, targetPosition: { x: 10, y: 0 } }),
      tuning,
    );
    expect(stunned.aiState).toBe('stunned');
    expect(stunned.position).toEqual({ x: 0, y: 0 });
    const dead = stepEnemy(state({ aiState: 'chase' }), input({ isDead: true }), tuning);
    expect(dead.aiState).toBe('dead');
    expect(dead.position).toEqual({ x: 0, y: 0 });
  });

  it('moves toward the target at moveSpeedPxPerSec while chasing, integrated over elapsed time', () => {
    const result = stepEnemy(
      state({ aiState: 'chase' }),
      input({ targetPosition: { x: 300, y: 0 }, toMs: 500 }),
      tuning,
    );
    expect(result.aiState).toBe('chase');
    expect(result.position.x).toBeCloseTo(50);
    expect(result.position.y).toBeCloseTo(0);
  });

  it('produces no movement when fromMs equals toMs regardless of state', () => {
    const result = stepEnemy(
      state({ aiState: 'chase' }),
      input({ targetPosition: { x: 1000, y: 0 }, fromMs: 500, toMs: 500 }),
      tuning,
    );
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it('retreats toward spawn once leashed, ramping down near the detection radius', () => {
    const result = stepEnemy(
      state({ aiState: 'attack', position: { x: 600, y: 0 }, spawnPosition: { x: 0, y: 0 } }),
      input({ targetPosition: { x: 601, y: 0 }, hasLineOfSight: true, toMs: 1000 }),
      tuning,
    );
    expect(result.aiState).toBe('retreat');
    expect(result.position.x).toBeLessThan(600);
  });

  it('nudges away from a crowding neighbor while chasing, without exceeding moveSpeedPxPerSec', () => {
    const crowded = stepEnemy(
      state({ aiState: 'chase' }),
      input({
        targetPosition: { x: 300, y: 0 },
        neighbors: [{ position: { x: 5, y: 0 } }],
        toMs: 100,
      }),
      tuning,
    );
    const clear = stepEnemy(
      state({ aiState: 'chase' }),
      input({ targetPosition: { x: 300, y: 0 }, toMs: 100 }),
      tuning,
    );
    expect(crowded.position.x).toBeLessThan(clear.position.x);
    const speed = Math.hypot(crowded.position.x, crowded.position.y) / 0.1;
    expect(speed).toBeLessThanOrEqual(tuning.moveSpeedPxPerSec + 1e-6);
  });
});
