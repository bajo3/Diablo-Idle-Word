import { describe, expect, it } from 'vitest';

import { createSeededRandom, EnemySpawnDirector, type EnemySpawnDirectorConfig } from './index.js';

type Archetype = 'melee' | 'ranged' | 'support';

const config: EnemySpawnDirectorConfig<Archetype> = {
  minActive: 2,
  maxActive: 2,
  respawnDelayMs: 500,
  cleanupDelayMs: 100,
  safeSpawnRadiusPx: 80,
  spawnPoints: [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 500, y: 100 },
  ],
  composition: ['melee', 'ranged', 'support'],
  idPrefix: 'enemy',
};

const safe = (candidate: { x: number; y: number }, active: readonly { x: number; y: number }[]) =>
  active.every((position) => Math.hypot(candidate.x - position.x, candidate.y - position.y) >= 80);

function spawnActions<T extends string>(actions: readonly { type: string }[]) {
  return actions.filter(
    (action): action is Extract<(typeof actions)[number], { type: 'spawn' }> =>
      action.type === 'spawn',
  ) as Array<{
    type: 'spawn';
    instanceId: string;
    archetype: T;
    position: { x: number; y: number };
  }>;
}

describe('EnemySpawnDirector', () => {
  it('fills the minimum with deterministic safe points and monotonic ids', () => {
    const first = new EnemySpawnDirector(config, createSeededRandom(4201));
    const second = new EnemySpawnDirector(config, createSeededRandom(4201));

    const firstActions = first.initialize(0, safe);
    const secondActions = second.initialize(0, safe);

    expect(firstActions).toEqual(secondActions);
    expect(spawnActions<Archetype>(firstActions)).toHaveLength(2);
    expect(first.activeCount()).toBe(2);
    expect(first.recordsSnapshot().map((record) => record.instanceId)).toEqual([
      'enemy:1',
      'enemy:2',
    ]);
  });

  it('does not replace a defeat before cleanup and respawn windows finish', () => {
    const director = new EnemySpawnDirector(config, createSeededRandom(7));
    const initial = spawnActions<Archetype>(director.initialize(0, safe));
    const defeatedId = initial[0]!.instanceId;

    expect(director.markDefeated(defeatedId, 1)).toBe(true);
    expect(director.markDefeated(defeatedId, 2)).toBe(false);
    expect(director.tick(100, safe).filter((action) => action.type === 'spawn')).toHaveLength(0);
    expect(director.tick(600, safe).filter((action) => action.type === 'spawn')).toHaveLength(0);

    const replacement = spawnActions<Archetype>(director.tick(601, safe));
    expect(replacement).toHaveLength(1);
    expect(replacement[0]!.instanceId).toBe('enemy:3');
    expect(director.activeCount()).toBe(2);
    expect(director.trackedCount()).toBe(2);
  });

  it('retries a safe point instead of spawning inside an invalid location', () => {
    const director = new EnemySpawnDirector(
      {
        ...config,
        minActive: 1,
        maxActive: 1,
        spawnPoints: [
          { x: 10, y: 10 },
          { x: 200, y: 10 },
        ],
      },
      createSeededRandom(1),
    );
    const safeOnlyFarPoint = (candidate: { x: number; y: number }) => candidate.x > 100;

    expect(director.initialize(0, safeOnlyFarPoint)).toHaveLength(1);
    expect(director.recordsSnapshot()[0]?.position).toEqual({ x: 200, y: 10 });
  });

  it('keeps one tracked live slot after 200 consecutive deaths', () => {
    const director = new EnemySpawnDirector(
      { ...config, minActive: 1, maxActive: 1, cleanupDelayMs: 0, respawnDelayMs: 0 },
      createSeededRandom(99),
    );
    let currentId = spawnActions<Archetype>(director.initialize(0, () => true))[0]!.instanceId;

    for (let index = 0; index < 200; index += 1) {
      const atMs = index + 1;
      expect(director.markDefeated(currentId, atMs)).toBe(true);
      const replacement = spawnActions<Archetype>(director.tick(atMs, () => true));
      currentId = replacement[0]!.instanceId;
    }

    expect(currentId).toBe('enemy:201');
    expect(director.activeCount()).toBe(1);
    expect(director.trackedCount()).toBe(1);
  });

  it('applies a larger wave without recreating the director or resetting ids', () => {
    const director = new EnemySpawnDirector(config, createSeededRandom(123));
    const initial = spawnActions<Archetype>(director.initialize(0, safe));

    director.configureWave({ minActive: 3, maxActive: 3, composition: ['support'] });
    const expanded = spawnActions<Archetype>(director.tick(1, safe));

    expect(expanded).toHaveLength(1);
    expect(expanded[0]).toMatchObject({ instanceId: 'enemy:3', archetype: 'support' });
    expect(initial.map(({ instanceId }) => instanceId)).toEqual(['enemy:1', 'enemy:2']);
    expect(director.activeCount()).toBe(3);
  });

  it('rejects a wave that would silently remove live slots', () => {
    const director = new EnemySpawnDirector(config, createSeededRandom(321));
    director.initialize(0, safe);

    expect(() =>
      director.configureWave({ minActive: 1, maxActive: 1, composition: ['melee'] }),
    ).toThrow('below current active count');
  });
});
