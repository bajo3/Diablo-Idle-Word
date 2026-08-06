import { describe, expect, it } from 'vitest';

import type { AttackerStats } from './combat.js';
import { createSeededRandom } from './random.js';
import {
  chooseHealTarget,
  enemyCanAct,
  resolveEnemyAction,
  resolveEnemyTelegraph,
  type EnemyAbilityContext,
  type EnemyAbilityProfile,
  type EnemyAbilityTarget,
} from './enemy-abilities.js';

const attacker: AttackerStats = {
  weaponDamage: [8, 12],
  power: 6,
  level: 1,
  criticalChance: 0,
  criticalMultiplier: 1.5,
};

function target(
  id: string,
  position: { x: number; y: number },
  overrides: Partial<EnemyAbilityTarget> = {},
): EnemyAbilityTarget {
  return { id, position, armor: 0, health: 100, maxHealth: 100, ...overrides };
}

let idCounter = 0;
function context(overrides: Partial<EnemyAbilityContext> = {}): EnemyAbilityContext {
  idCounter = 0;
  return {
    position: { x: 0, y: 0 },
    attacker,
    abilityMultiplier: 1,
    telegraphMs: 700,
    atMs: 1000,
    random: createSeededRandom(42),
    nextId: () => `e${idCounter++}`,
    ...overrides,
  };
}

describe('enemy abilities — melee_strike', () => {
  const profile: EnemyAbilityProfile = { kind: 'melee_strike' };

  it('resolves symmetric damage against every target via resolveAttack', () => {
    const targets = [target('a', { x: 10, y: 0 }, { armor: 5 })];
    const effects = resolveEnemyAction(profile, targets, context());
    const damages = effects.filter((effect) => effect.type === 'damage');
    expect(damages).toHaveLength(1);
    expect(damages[0]!.targetId).toBe('a');
    expect(damages[0]!.result.amount).toBeGreaterThan(0);
    expect(damages[0]!.result.amount).toBeLessThanOrEqual(12 + 6);
  });

  it('produces no effects when there are no targets', () => {
    expect(resolveEnemyAction(profile, [], context())).toEqual([]);
  });

  it('is deterministic: same seed + targets => identical damage', () => {
    const targets = [target('a', { x: 10, y: 0 }, { armor: 4 })];
    const first = resolveEnemyAction(profile, targets, context());
    const second = resolveEnemyAction(profile, targets, context());
    expect(first).toEqual(second);
  });
});

describe('enemy abilities — ranged_shot (possessed_archer)', () => {
  const profile: EnemyAbilityProfile = {
    kind: 'ranged_shot',
    projectileSpeedPxPerSec: 400,
    projectileMaxRangePx: 260,
    hitRadiusPx: 16,
  };

  it('spawns a projectile aimed straight at the primary target', () => {
    const targets = [target('player', { x: 400, y: 0 })];
    const effects = resolveEnemyAction(profile, targets, context({ position: { x: 100, y: 0 } }));
    expect(effects).toHaveLength(1);
    expect(effects[0]!.type).toBe('spawn_projectile');
    if (effects[0]!.type !== 'spawn_projectile') return;
    const projectile = effects[0]!.projectile;
    expect(projectile.direction).toEqual({ x: 1, y: 0 });
    expect(projectile.origin).toEqual({ x: 100, y: 0 });
    expect(projectile.maxRangePx).toBe(260);
  });

  it('produces no projectile when the primary target is missing', () => {
    expect(resolveEnemyAction(profile, [], context())).toEqual([]);
  });
});

describe('enemy abilities — heal_allies (dark_shaman)', () => {
  const profile: EnemyAbilityProfile = {
    kind: 'heal_allies',
    tuning: { healMissingFraction: 0.5, ignoreAboveFraction: 0.9 },
  };

  it('heals the ally with the lowest health fraction, not the first in the list', () => {
    const allies = [
      target('a', { x: 10, y: 0 }, { health: 50, maxHealth: 100 }), // 50%
      target('b', { x: 20, y: 0 }, { health: 20, maxHealth: 100 }), // 20% — most wounded
      target('c', { x: 30, y: 0 }, { health: 80, maxHealth: 100 }), // 80%
    ];
    const effects = resolveEnemyAction(profile, allies, context());
    const heals = effects.filter((effect) => effect.type === 'heal');
    expect(heals).toHaveLength(1);
    expect(heals[0]!.targetId).toBe('b');
    // missing = 80, heal 0.5 => 40
    expect(heals[0]!.amount).toBe(40);
  });

  it('skips allies already at or above the ignore threshold', () => {
    const allies = [
      target('a', { x: 10, y: 0 }, { health: 95, maxHealth: 100 }), // 95% >= 0.9
      target('b', { x: 20, y: 0 }, { health: 98, maxHealth: 100 }), // 98% >= 0.9
    ];
    expect(resolveEnemyAction(profile, allies, context())).toEqual([]);
  });

  it('breaks ties by id deterministically (same fraction => lower id wins)', () => {
    const allies = [
      target('z', { x: 10, y: 0 }, { health: 25, maxHealth: 100 }),
      target('a', { x: 20, y: 0 }, { health: 25, maxHealth: 100 }), // same fraction, lower id
    ];
    const effects = resolveEnemyAction(profile, allies, context());
    const heals = effects.filter((effect) => effect.type === 'heal');
    expect(heals).toHaveLength(1);
    expect(heals[0]!.targetId).toBe('a');
  });

  it('produces no heal when every ally is at full health', () => {
    const allies = [target('a', { x: 10, y: 0 }, { health: 100, maxHealth: 100 })];
    expect(resolveEnemyAction(profile, allies, context())).toEqual([]);
  });
});

describe('enemy abilities — area_attack (root_brute)', () => {
  const profile: EnemyAbilityProfile = {
    kind: 'area_attack',
    tuning: { radiusPx: 80, stunMs: 1200 },
  };

  it('opens a telegraph at the caster position, never resolving damage immediately', () => {
    const targets = [target('player', { x: 10, y: 0 })];
    const effects = resolveEnemyAction(profile, targets, context({ position: { x: 50, y: 50 } }));
    expect(effects).toHaveLength(1);
    expect(effects[0]!.type).toBe('open_telegraph');
    if (effects[0]!.type !== 'open_telegraph') return;
    expect(effects[0]!.telegraph.center).toEqual({ x: 50, y: 50 });
    expect(effects[0]!.telegraph.radiusPx).toBe(80);
    expect(effects[0]!.telegraph.stunMs).toBe(1200);
  });

  it('resolves area damage + stun to every target inside the radius on the resolution tick', () => {
    const ctx = context({ position: { x: 0, y: 0 } });
    const open = resolveEnemyAction(profile, [], ctx);
    if (open[0]!.type !== 'open_telegraph') throw new Error('expected telegraph');
    const telegraph = open[0]!.telegraph;
    const inside = [target('a', { x: 30, y: 0 }), target('b', { x: 70, y: 0 }, { armor: 3 })];
    const outside = [target('c', { x: 200, y: 0 })];
    const effects = resolveEnemyTelegraph(
      telegraph,
      [...inside, ...outside],
      attacker,
      createSeededRandom(7),
    );
    const damages = effects.filter((effect) => effect.type === 'damage');
    const stuns = effects.filter((effect) => effect.type === 'stun');
    expect(damages.map((effect) => effect.targetId).sort()).toEqual(['a', 'b']);
    expect(stuns.map((effect) => effect.targetId).sort()).toEqual(['a', 'b']);
    if (stuns[0]!.type !== 'stun') return;
    expect(stuns[0]!.durationMs).toBe(1200);
  });

  it('does not stun when stunMs is absent', () => {
    const ctx = context({ position: { x: 0, y: 0 } });
    const open = resolveEnemyAction(profile, [], ctx);
    if (open[0]!.type !== 'open_telegraph') throw new Error('expected telegraph');
    // Rebuild without stunMs to test a non-stunning area telegraph (exactOptionalPropertyTypes
    // forbids assigning undefined to the optional, so omit it entirely instead).
    const original = open[0]!.telegraph;
    const telegraph = {
      id: original.id,
      center: original.center,
      radiusPx: original.radiusPx,
      startedAt: original.startedAt,
      telegraphMs: original.telegraphMs,
      abilityMultiplier: original.abilityMultiplier,
    };
    const effects = resolveEnemyTelegraph(
      telegraph,
      [target('a', { x: 10, y: 0 })],
      attacker,
      createSeededRandom(7),
    );
    expect(effects.some((effect) => effect.type === 'stun')).toBe(false);
  });
});

describe('enemy abilities — telegraphed_explosion (unstable_beast)', () => {
  const profile: EnemyAbilityProfile = {
    kind: 'telegraphed_explosion',
    tuning: { radiusPx: 90, telegraphMs: 900, damageMultiplier: 1.8 },
  };

  it('opens a telegraph that announces the burst before any damage lands', () => {
    const effects = resolveEnemyAction(profile, [], context({ position: { x: 100, y: 100 } }));
    expect(effects).toHaveLength(1);
    expect(effects[0]!.type).toBe('open_telegraph');
    if (effects[0]!.type !== 'open_telegraph') return;
    expect(effects[0]!.telegraph.telegraphMs).toBe(900);
    expect(effects[0]!.telegraph.abilityMultiplier).toBe(1.8);
  });

  it('resolves the explosion damage only against targets inside the radius, using its own multiplier', () => {
    const ctx = context({ position: { x: 0, y: 0 }, abilityMultiplier: 1 });
    const open = resolveEnemyAction(profile, [], ctx);
    if (open[0]!.type !== 'open_telegraph') throw new Error('expected telegraph');
    const telegraph = open[0]!.telegraph;
    const effects = resolveEnemyTelegraph(
      telegraph,
      [target('a', { x: 50, y: 0 }), target('b', { x: 150, y: 0 })],
      attacker,
      createSeededRandom(3),
    );
    const damages = effects.filter((effect) => effect.type === 'damage');
    expect(damages).toHaveLength(1);
    expect(damages[0]!.targetId).toBe('a');
    // explosion must never stun (no stunMs set)
    expect(effects.some((effect) => effect.type === 'stun')).toBe(false);
  });
});

describe('enemy abilities — guard helpers', () => {
  it('enemyCanAct is true only for attack/use_ability', () => {
    expect(enemyCanAct('attack')).toBe(true);
    expect(enemyCanAct('use_ability')).toBe(true);
    expect(enemyCanAct('chase')).toBe(false);
    expect(enemyCanAct('idle')).toBe(false);
    expect(enemyCanAct('dead')).toBe(false);
  });

  it('chooseHealTarget is exported and deterministic for the same input set', () => {
    const profile = {
      kind: 'heal_allies' as const,
      tuning: { healMissingFraction: 0.3, ignoreAboveFraction: 0.9 },
    };
    const allies = [
      target('x', { x: 0, y: 0 }, { health: 10, maxHealth: 100 }),
      target('y', { x: 0, y: 0 }, { health: 40, maxHealth: 100 }),
    ];
    expect(chooseHealTarget(profile, allies)?.id).toBe('x');
  });
});
