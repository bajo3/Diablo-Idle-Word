import { describe, expect, it } from 'vitest';

import {
  classAbilityIds,
  classSkillNodes,
  respecClassSkills,
  unlockClassSkillNode,
} from './class-skills.js';
import type { ClassRegistry } from './class-tree.js';

const registry: ClassRegistry = {
  registryVersion: 'class-registry.1',
  classes: [
    {
      classId: 'barbarian',
      schemaVersion: 'class-registry.1',
      displayName: 'Bárbara',
      roleTags: ['melee'],
      resource: 'rage',
      attributeIds: ['strength', 'dexterity', 'intelligence', 'vitality'],
      branchIds: ['branch.barbarian.bloodsong'],
    },
  ],
  branches: [
    {
      branchId: 'branch.barbarian.bloodsong',
      classId: 'barbarian',
      displayName: 'Canto de sangre',
      nodeIds: [
        'node.barbarian.bloodsong.cleave',
        'node.barbarian.bloodsong.blood_rush',
        'node.barbarian.bloodsong.berserker_oath',
      ],
    },
  ],
  nodes: [
    {
      nodeId: 'node.barbarian.bloodsong.cleave',
      classId: 'barbarian',
      branchId: 'branch.barbarian.bloodsong',
      kind: 'active',
      displayName: 'Hachazo',
      description: 'Golpe frontal.',
      requirements: { unlockLevel: 1, pointCost: 1 },
      tags: ['melee'],
      abilityId: 'ability.barbarian.cleave',
      schemaVersion: 'class-registry.1',
    },
    {
      nodeId: 'node.barbarian.bloodsong.blood_rush',
      classId: 'barbarian',
      branchId: 'branch.barbarian.bloodsong',
      kind: 'passive',
      displayName: 'Impulso',
      description: 'Velocidad.',
      requirements: {
        unlockLevel: 2,
        prerequisiteNodeId: 'node.barbarian.bloodsong.cleave',
        pointCost: 1,
      },
      tags: ['mobility'],
      schemaVersion: 'class-registry.1',
    },
    {
      nodeId: 'node.barbarian.bloodsong.berserker_oath',
      classId: 'barbarian',
      branchId: 'branch.barbarian.bloodsong',
      kind: 'ultimate',
      displayName: 'Juramento',
      description: 'Frenesí.',
      requirements: {
        unlockLevel: 6,
        prerequisiteNodeId: 'node.barbarian.bloodsong.blood_rush',
        pointCost: 3,
      },
      tags: ['ultimate'],
      abilityId: 'ability.barbarian.berserker_oath',
      schemaVersion: 'class-registry.1',
    },
  ],
  effects: [],
};

describe('data-driven class skills', () => {
  it('exposes the Barbarian branch and ability IDs without id-specific branching', () => {
    expect(classSkillNodes(registry, 'barbarian')).toHaveLength(3);
    expect(classAbilityIds(registry, 'barbarian')).toEqual([
      'ability.barbarian.cleave',
      'ability.barbarian.berserker_oath',
    ]);
  });

  it('enforces level, prerequisite and points before returning an unlock state', () => {
    const base = { level: 1, availablePoints: 1, unlockedNodeIds: [] as string[] };
    expect(
      unlockClassSkillNode(registry, 'barbarian', base, 'node.barbarian.bloodsong.blood_rush'),
    ).toMatchObject({ accepted: false, reason: 'level' });
    const first = unlockClassSkillNode(
      registry,
      'barbarian',
      { level: 2, availablePoints: 1, unlockedNodeIds: [] },
      'node.barbarian.bloodsong.cleave',
    );
    expect(first).toMatchObject({ accepted: true, state: { availablePoints: 0 } });
    expect(
      unlockClassSkillNode(
        registry,
        'barbarian',
        { level: 2, availablePoints: 1, unlockedNodeIds: [] },
        'node.barbarian.bloodsong.blood_rush',
      ),
    ).toMatchObject({ accepted: false, reason: 'prerequisite' });
  });

  it('refunds every unlocked node of the class in one atomic step', () => {
    const state = {
      level: 6,
      availablePoints: 0,
      unlockedNodeIds: [
        'node.barbarian.bloodsong.cleave',
        'node.barbarian.bloodsong.blood_rush',
        'node.barbarian.bloodsong.berserker_oath',
      ],
    };
    const result = respecClassSkills(registry, 'barbarian', state);
    // cleave(1) + blood_rush(1) + berserker_oath(3), same order the fixture declares them.
    expect(result.refundedPoints).toBe(5);
    expect(result.clearedNodeIds).toEqual(state.unlockedNodeIds);
    expect(result.state).toEqual({ level: 6, availablePoints: 5, unlockedNodeIds: [] });
  });

  it('leaves nodes from another class untouched instead of dropping them', () => {
    const state = {
      level: 6,
      availablePoints: 0,
      unlockedNodeIds: ['node.barbarian.bloodsong.cleave', 'node.other_class.some_node'],
    };
    const result = respecClassSkills(registry, 'barbarian', state);
    expect(result.clearedNodeIds).toEqual(['node.barbarian.bloodsong.cleave']);
    expect(result.state.unlockedNodeIds).toEqual(['node.other_class.some_node']);
    expect(result.refundedPoints).toBe(1);
  });

  it('is idempotent: respeccing an already-clean state is a no-op', () => {
    const state = { level: 6, availablePoints: 3, unlockedNodeIds: [] as string[] };
    const result = respecClassSkills(registry, 'barbarian', state);
    expect(result).toEqual({ state, refundedPoints: 0, clearedNodeIds: [] });
    // Respeccing the result again changes nothing further — a retried command stays safe to persist.
    expect(respecClassSkills(registry, 'barbarian', result.state)).toEqual({
      state: result.state,
      refundedPoints: 0,
      clearedNodeIds: [],
    });
  });
});
