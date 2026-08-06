import { describe, expect, it } from 'vitest';

import { CombatAuthority } from './combat-authority.js';
import { EnemyAuthority } from './enemy-authority.js';
import { ActiveInstanceRegistry } from './instance-registry.js';

function setup(
  enemy: {
    enemyId: string;
    archetype: string;
    position: { x: number; y: number };
    health?: number;
    maxHealth?: number;
  },
  options: { difficulty?: 'normal' | 'veteran'; party?: boolean } = {},
) {
  const instances = new ActiveInstanceRegistry();
  instances.ensure({
    userId: 'user:one',
    characterId: 'character:one',
    zoneId: 'corrupted_forest',
    difficulty: options.difficulty ?? 'normal',
    nowMs: 1_000,
  });
  if (options.party === true)
    instances.join({
      userId: 'user:two',
      characterId: 'character:two',
      hostCharacterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: options.difficulty ?? 'normal',
      nowMs: 1_000,
    });
  instances.replaceEnemies('character:one', [
    {
      enemyId: enemy.enemyId,
      archetype: enemy.archetype,
      position: enemy.position,
      status: 'active',
      health: enemy.health ?? 40,
      maxHealth: enemy.maxHealth ?? enemy.health ?? 40,
    },
  ]);
  return { instances, combat: new CombatAuthority(), enemies: new EnemyAuthority() };
}

function tick(
  instances: ActiveInstanceRegistry,
  enemies: EnemyAuthority,
  combat: CombatAuthority,
  atMs: number,
) {
  instances.advance('character:one', atMs);
  return enemies.advance('character:one', atMs, instances, combat);
}

describe('EnemyAuthority', () => {
  it('runs the server-owned AI and applies a deterministic melee attack to the Guardian', () => {
    const first = setup({
      enemyId: 'enemy:forest:minion',
      archetype: 'corrupted_minion',
      position: { x: 205, y: 160 },
    });
    expect(tick(first.instances, first.enemies, first.combat, 1_000)).toEqual([]);
    expect(tick(first.instances, first.enemies, first.combat, 1_400)).toEqual([]);
    const events = tick(first.instances, first.enemies, first.combat, 1_900);
    expect(events).toMatchObject([
      {
        type: 'damage',
        enemyId: 'enemy:forest:minion',
        targetId: 'character:one',
        amount: expect.any(Number),
      },
    ]);
    expect(first.instances.playerFor('character:one')?.health).toBeLessThan(220);
    expect(first.instances.stateFor('character:one')?.enemies[0]?.aiState).toBe('use_ability');

    const second = setup({
      enemyId: 'enemy:forest:minion',
      archetype: 'corrupted_minion',
      position: { x: 205, y: 160 },
    });
    tick(second.instances, second.enemies, second.combat, 1_000);
    tick(second.instances, second.enemies, second.combat, 1_400);
    expect(tick(second.instances, second.enemies, second.combat, 1_900)).toEqual(events);
    expect(second.instances.playerFor('character:one')?.health).toBe(
      first.instances.playerFor('character:one')?.health,
    );
  });

  it('spawns a ranged projectile and resolves it later against current server health', () => {
    const setupValue = setup({
      enemyId: 'enemy:forest:archer',
      archetype: 'possessed_archer',
      position: { x: 300, y: 160 },
    });
    tick(setupValue.instances, setupValue.enemies, setupValue.combat, 1_000);
    expect(tick(setupValue.instances, setupValue.enemies, setupValue.combat, 1_600)).toEqual([]);
    const spawned = tick(setupValue.instances, setupValue.enemies, setupValue.combat, 2_300);
    expect(spawned).toContainEqual(
      expect.objectContaining({ type: 'projectile', enemyId: 'enemy:forest:archer' }),
    );
    expect(setupValue.instances.playerFor('character:one')?.health).toBe(220);
    const resolved = tick(setupValue.instances, setupValue.enemies, setupValue.combat, 2_650);
    expect(resolved).toContainEqual(
      expect.objectContaining({ type: 'damage', targetId: 'character:one' }),
    );
    expect(setupValue.instances.playerFor('character:one')?.health).toBeLessThan(220);
  });

  it('does not act after the Guardian is downed', () => {
    const value = setup({
      enemyId: 'enemy:forest:brute',
      archetype: 'root_brute',
      position: { x: 190, y: 160 },
    });
    value.instances.updatePlayer('character:one', { actorState: 'downed', health: 0 });
    expect(tick(value.instances, value.enemies, value.combat, 1_000)).toEqual([]);
    expect(tick(value.instances, value.enemies, value.combat, 2_000)).toEqual([]);
    expect(value.instances.playerFor('character:one')).toMatchObject({
      actorState: 'downed',
      health: 0,
    });
  });

  it('keeps a defeated enemy for cleanup, then respawns it at a safe deterministic point', () => {
    const value = setup({
      enemyId: 'enemy:forest:respawned',
      archetype: 'corrupted_minion',
      position: { x: 220, y: 160 },
      health: 1,
      maxHealth: 1,
    });
    value.combat.apply(
      {
        userId: 'user:one',
        characterId: 'character:one',
        operationId: 'combat:respawn',
        abilityId: 'ability.guardian.slash',
        targetId: 'enemy:forest:respawned',
        nowMs: 1_000,
      },
      value.instances,
    );
    value.combat.advance('character:one', 1_200, value.instances);
    expect(value.instances.stateFor('character:one')?.enemies[0]).toMatchObject({
      status: 'dead',
      deadAtMs: 1_200,
    });
    expect(tick(value.instances, value.enemies, value.combat, 1_700)).toContainEqual(
      expect.objectContaining({ type: 'cleanup', enemyId: 'enemy:forest:respawned' }),
    );
    expect(value.instances.stateFor('character:one')?.enemies).toHaveLength(0);
    expect(tick(value.instances, value.enemies, value.combat, 3_200)).toContainEqual(
      expect.objectContaining({ type: 'spawn', enemyId: expect.stringContaining(':respawn:') }),
    );
    const respawned = value.instances.stateFor('character:one')?.enemies[0];
    expect(respawned).toMatchObject({ archetype: 'corrupted_minion', status: 'active' });
    expect(respawned?.position).toEqual({ x: 560, y: 160 });
  });

  it('applies veteran and party scaling when a defeated enemy respawns', () => {
    const value = setup(
      {
        enemyId: 'enemy:forest:scaled-respawn',
        archetype: 'corrupted_minion',
        position: { x: 220, y: 160 },
        health: 1,
        maxHealth: 1,
      },
      { difficulty: 'veteran', party: true },
    );
    value.combat.apply(
      {
        userId: 'user:one',
        characterId: 'character:one',
        operationId: 'combat:scaled-respawn',
        abilityId: 'ability.guardian.slash',
        targetId: 'enemy:forest:scaled-respawn',
        nowMs: 1_000,
      },
      value.instances,
    );
    value.combat.advance('character:one', 1_200, value.instances);
    tick(value.instances, value.enemies, value.combat, 1_700);
    tick(value.instances, value.enemies, value.combat, 3_200);
    expect(value.instances.stateFor('character:one')?.enemies[0]).toMatchObject({
      maxHealth: 76,
      health: 76,
    });
  });
});
