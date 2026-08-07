import { describe, expect, it } from 'vitest';

import { ActiveInstanceRegistry } from './instance-registry.js';
import { CombatAuthority, CombatCommandError } from './combat-authority.js';

function setup() {
  const instances = new ActiveInstanceRegistry();
  instances.ensure({
    userId: 'user:one',
    characterId: 'character:one',
    zoneId: 'corrupted_forest',
    difficulty: 'normal',
    nowMs: 1_000,
  });
  instances.replaceEnemies('character:one', [
    {
      enemyId: 'enemy:forest:one',
      archetype: 'corrupted_minion',
      position: { x: 220, y: 160 },
      status: 'active',
      health: 40,
      maxHealth: 40,
    },
  ]);
  return { instances, authority: new CombatAuthority() };
}

describe('CombatAuthority', () => {
  it('resolves the Barbarian vertical-slice ability through its own profile', () => {
    const { instances, authority } = setup();
    const result = authority.apply(
      {
        userId: 'user:one',
        characterId: 'character:one',
        operationId: 'combat:barbarian-cleave',
        classId: 'BARBARIAN',
        abilityId: 'ability.barbarian.cleave',
        targetId: 'enemy:forest:one',
        nowMs: 1_000,
      },
      instances,
    );
    expect(result).toMatchObject({
      abilityId: 'ability.barbarian.cleave',
      pending: true,
      hits: [],
    });
    const resolved = authority.advance('character:one', 1_220, instances)[0]!;
    expect(resolved).toMatchObject({
      abilityId: 'ability.barbarian.cleave',
      pending: false,
      hits: [{ targetId: 'enemy:forest:one' }],
    });
    expect(resolved.damage).toBeGreaterThan(0);
  });

  it('validates and resolves a server-owned attack with deterministic damage', () => {
    const { instances, authority } = setup();
    const first = authority.apply(
      {
        userId: 'user:one',
        characterId: 'character:one',
        operationId: 'combat:one',
        abilityId: 'ability.guardian.slash',
        targetId: 'enemy:forest:one',
        nowMs: 1_000,
      },
      instances,
    );
    expect(first).toMatchObject({
      replayed: false,
      abilityId: 'ability.guardian.slash',
      pending: true,
      hits: [],
    });
    expect(first.damage).toBe(0);
    expect(authority.advance('character:one', 1_199, instances)).toEqual([]);
    const resolved = authority.advance('character:one', 1_200, instances)[0]!;
    expect(resolved).toMatchObject({
      pending: false,
      damage: expect.any(Number),
      hits: [{ targetId: 'enemy:forest:one' }],
    });
    expect(resolved.damage).toBeGreaterThan(0);
    expect(instances.stateFor('character:one')?.enemies[0]?.health).toBe(resolved.targetHealth);
    expect(
      authority.apply(
        {
          userId: 'user:one',
          characterId: 'character:one',
          operationId: 'combat:one',
          abilityId: 'ability.guardian.slash',
          targetId: 'enemy:forest:one',
          nowMs: 1_100,
        },
        instances,
      ),
    ).toMatchObject({ replayed: true, damage: resolved.damage, pending: false });
  });

  it('rejects cooldown, range, ownership and downed actor violations', () => {
    const { instances, authority } = setup();
    authority.apply(
      {
        userId: 'user:one',
        characterId: 'character:one',
        operationId: 'combat:cooldown:one',
        abilityId: 'ability.guardian.slash',
        targetId: 'enemy:forest:one',
        nowMs: 1_000,
      },
      instances,
    );
    expect(() =>
      authority.apply(
        {
          userId: 'user:one',
          characterId: 'character:one',
          operationId: 'combat:cooldown:two',
          abilityId: 'ability.guardian.slash',
          targetId: 'enemy:forest:one',
          nowMs: 1_100,
        },
        instances,
      ),
    ).toThrowError(new CombatCommandError('COOLDOWN', 'The ability was rejected: cooldown.'));

    instances.replaceEnemies('character:one', [
      {
        enemyId: 'enemy:forest:far',
        archetype: 'corrupted_minion',
        position: { x: 600, y: 600 },
        status: 'active',
        health: 40,
        maxHealth: 40,
      },
    ]);
    expect(() =>
      authority.apply(
        {
          userId: 'user:one',
          characterId: 'character:one',
          operationId: 'combat:far',
          abilityId: 'ability.guardian.slash',
          targetId: 'enemy:forest:far',
          nowMs: 2_000,
        },
        instances,
      ),
    ).toThrow(/outside/);
    expect(() =>
      authority.apply(
        {
          userId: 'user:other',
          characterId: 'character:one',
          operationId: 'combat:owner',
          abilityId: 'ability.guardian.iron_skin',
          nowMs: 3_000,
        },
        instances,
      ),
    ).toThrow(/owned/);
    instances.updatePlayer('character:one', { actorState: 'downed', health: 0 });
    expect(() =>
      authority.apply(
        {
          userId: 'user:one',
          characterId: 'character:one',
          operationId: 'combat:downed',
          abilityId: 'ability.guardian.iron_skin',
          nowMs: 4_000,
        },
        instances,
      ),
    ).toThrow(/downed/);
  });

  it('resolves slash/power strike against the configured arc and max target count', () => {
    const instances = new ActiveInstanceRegistry();
    instances.ensure({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      nowMs: 1_000,
    });
    instances.replaceEnemies('character:one', [
      {
        enemyId: 'enemy:arc:one',
        archetype: 'corrupted_minion',
        position: { x: 220, y: 160 },
        status: 'active',
        health: 1_000,
        maxHealth: 1_000,
      },
      {
        enemyId: 'enemy:arc:two',
        archetype: 'corrupted_minion',
        position: { x: 230, y: 170 },
        status: 'active',
        health: 1_000,
        maxHealth: 1_000,
      },
      {
        enemyId: 'enemy:arc:three',
        archetype: 'corrupted_minion',
        position: { x: 215, y: 200 },
        status: 'active',
        health: 1_000,
        maxHealth: 1_000,
      },
      {
        enemyId: 'enemy:arc:behind',
        archetype: 'corrupted_minion',
        position: { x: 150, y: 220 },
        status: 'active',
        health: 1_000,
        maxHealth: 1_000,
      },
    ]);
    const authority = new CombatAuthority();
    for (const nowMs of [1_000, 1_600, 2_200]) {
      const result = authority.apply(
        {
          userId: 'user:one',
          characterId: 'character:one',
          operationId: `combat:arc:slash:${nowMs}`,
          abilityId: 'ability.guardian.slash',
          targetId: 'enemy:arc:one',
          nowMs,
        },
        instances,
      );
      expect(result).toMatchObject({ pending: true, hits: [] });
      const resolved = authority.advance('character:one', nowMs + 200, instances)[0]!;
      expect(resolved.hits).toHaveLength(3);
      expect(resolved.hits.some((hit) => hit.targetId === 'enemy:arc:behind')).toBe(false);
    }
    const power = authority.apply(
      {
        userId: 'user:one',
        characterId: 'character:one',
        operationId: 'combat:arc:power',
        abilityId: 'ability.guardian.power_strike',
        targetId: 'enemy:arc:one',
        nowMs: 2_800,
      },
      instances,
    );
    expect(power).toMatchObject({ pending: true, hits: [] });
    const resolvedPower = authority.advance('character:one', 3_200, instances)[0]!;
    expect(resolvedPower.hits).toHaveLength(3);
    expect(resolvedPower.hits.map((hit) => hit.position)).toEqual(
      expect.arrayContaining([
        { x: 220, y: 160 },
        { x: 230, y: 170 },
        { x: 215, y: 200 },
      ]),
    );
    expect(instances.stateFor('character:one')?.enemies[3]?.position).toEqual({ x: 150, y: 220 });
  });

  it('validates targetless whirlwind and returns the self-buff window for Iron Skin', () => {
    const { instances, authority } = setup();
    instances.replaceEnemies('character:one', [
      {
        enemyId: 'enemy:forest:one',
        archetype: 'corrupted_minion',
        position: { x: 220, y: 160 },
        status: 'active',
        health: 1_000,
        maxHealth: 1_000,
      },
    ]);
    for (const nowMs of [1_000, 1_600, 2_200, 2_800]) {
      authority.apply(
        {
          userId: 'user:one',
          characterId: 'character:one',
          operationId: `combat:fury:${nowMs}`,
          abilityId: 'ability.guardian.slash',
          targetId: 'enemy:forest:one',
          nowMs,
        },
        instances,
      );
      authority.advance('character:one', nowMs + 200, instances);
    }
    const whirlwind = authority.apply(
      {
        userId: 'user:one',
        characterId: 'character:one',
        operationId: 'combat:whirlwind',
        abilityId: 'ability.guardian.whirlwind',
        nowMs: 3_400,
      },
      instances,
    );
    expect(whirlwind).toMatchObject({ movementMultiplier: 0.65, pending: true, impactAtMs: 3_700 });
    expect(whirlwind.hits).toHaveLength(1);
    expect(authority.advance('character:one', 3_699, instances)).toEqual([]);
    expect(authority.advance('character:one', 3_700, instances)[0]).toMatchObject({
      operationId: 'combat:whirlwind',
      pending: true,
      hits: expect.any(Array),
    });
    expect(authority.advance('character:one', 4_000, instances)[0]).toMatchObject({
      pending: true,
    });
    expect(authority.advance('character:one', 4_300, instances)[0]).toMatchObject({
      pending: false,
    });
    for (const nowMs of [5_000, 5_600, 6_200]) {
      authority.apply(
        {
          userId: 'user:one',
          characterId: 'character:one',
          operationId: `combat:fury:post-whirlwind:${nowMs}`,
          abilityId: 'ability.guardian.slash',
          targetId: 'enemy:forest:one',
          nowMs,
        },
        instances,
      );
      authority.advance('character:one', nowMs + 200, instances);
    }
    const ironSkin = authority.apply(
      {
        userId: 'user:one',
        characterId: 'character:one',
        operationId: 'combat:iron-skin',
        abilityId: 'ability.guardian.iron_skin',
        nowMs: 6_800,
      },
      instances,
    );
    expect(ironSkin).toMatchObject({
      damage: 0,
      hits: [],
      ironSkinStartsAt: 7_050,
      ironSkinEndsAt: 11_050,
    });
    const targeted = setup();
    targeted.instances.replaceEnemies('character:one', [
      {
        enemyId: 'enemy:forest:one',
        archetype: 'corrupted_minion',
        position: { x: 220, y: 160 },
        status: 'active',
        health: 1_000,
        maxHealth: 1_000,
      },
    ]);
    for (const nowMs of [1_000, 1_600, 2_200]) {
      targeted.authority.apply(
        {
          userId: 'user:one',
          characterId: 'character:one',
          operationId: `combat:targeted-fury:${nowMs}`,
          abilityId: 'ability.guardian.slash',
          targetId: 'enemy:forest:one',
          nowMs,
        },
        targeted.instances,
      );
      targeted.authority.advance('character:one', nowMs + 200, targeted.instances);
    }
    expect(() =>
      targeted.authority.apply(
        {
          userId: 'user:one',
          characterId: 'character:one',
          operationId: 'combat:iron-skin-targeted',
          abilityId: 'ability.guardian.iron_skin',
          targetId: 'enemy:forest:one',
          nowMs: 2_800,
        },
        targeted.instances,
      ),
    ).toThrow(/self-targeted/);
  });
});
