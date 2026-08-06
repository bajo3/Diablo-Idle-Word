import { describe, expect, it } from 'vitest';

import {
  ClassRegistrySchema,
  validateClassRegistry,
  type ClassRegistry,
  type SkillNodeDefinition,
} from './class-tree.js';

function node(overrides: Partial<SkillNodeDefinition> & Pick<SkillNodeDefinition, 'nodeId'>) {
  return {
    classId: 'dark_knight',
    branchId: 'branch.dark_knight.fervor',
    kind: 'active' as const,
    displayName: 'Nodo',
    description: 'Descripción de prueba.',
    requirements: { unlockLevel: 1, pointCost: 1 },
    tags: [],
    schemaVersion: 'class-registry.1',
    ...overrides,
  };
}

function baseRegistry(): ClassRegistry {
  return {
    registryVersion: 'class-registry.1',
    classes: [
      {
        classId: 'guardian',
        schemaVersion: 'class-registry.1',
        displayName: 'Guardián',
        roleTags: ['melee_resilient'],
        resource: 'fury',
        attributeIds: ['strength', 'dexterity', 'intelligence', 'vitality'],
        branchIds: [],
      },
      {
        classId: 'dark_knight',
        schemaVersion: 'class-registry.1',
        displayName: 'Caballero Oscuro',
        roleTags: ['melee_hybrid', 'tank'],
        resource: 'fervor',
        attributeIds: ['strength', 'dexterity', 'intelligence', 'vitality'],
        branchIds: ['branch.dark_knight.fervor'],
      },
    ],
    branches: [
      {
        branchId: 'branch.dark_knight.fervor',
        classId: 'dark_knight',
        displayName: 'Fervor',
        nodeIds: ['node.dark_knight.fervor.strike', 'node.dark_knight.fervor.guard'],
      },
    ],
    nodes: [
      node({ nodeId: 'node.dark_knight.fervor.strike' }),
      node({
        nodeId: 'node.dark_knight.fervor.guard',
        requirements: {
          unlockLevel: 2,
          pointCost: 1,
          prerequisiteNodeId: 'node.dark_knight.fervor.strike',
        },
      }),
    ],
  };
}

describe('ClassRegistrySchema', () => {
  it('accepts a well-formed registry, including a class with no branches yet', () => {
    expect(() => ClassRegistrySchema.parse(baseRegistry())).not.toThrow();
  });
});

describe('validateClassRegistry', () => {
  it('reports no issues for a consistent registry', () => {
    expect(validateClassRegistry(baseRegistry())).toEqual([]);
  });

  it('flags a duplicate class ID', () => {
    const registry = baseRegistry();
    const issues = validateClassRegistry({
      ...registry,
      classes: [...registry.classes, registry.classes[0]!],
    });
    expect(issues).toContainEqual(expect.objectContaining({ message: 'Duplicate class ID' }));
  });

  it('flags a branch that references an unknown class', () => {
    const registry = baseRegistry();
    const issues = validateClassRegistry({
      ...registry,
      branches: [{ ...registry.branches[0]!, classId: 'arcanist' }],
    });
    expect(issues.some((issue) => issue.message.includes('unknown class'))).toBe(true);
  });

  it('flags a node whose classId disagrees with its branch', () => {
    const registry = baseRegistry();
    const issues = validateClassRegistry({
      ...registry,
      nodes: [{ ...registry.nodes[0]!, classId: 'arcanist' }, registry.nodes[1]!],
    });
    expect(issues.some((issue) => issue.message.includes('Class mismatch'))).toBe(true);
  });

  it('flags a node with a dangling prerequisite', () => {
    const registry = baseRegistry();
    const issues = validateClassRegistry({
      ...registry,
      nodes: [
        registry.nodes[0]!,
        {
          ...registry.nodes[1]!,
          requirements: { unlockLevel: 2, pointCost: 1, prerequisiteNodeId: 'node.ghost' },
        },
      ],
    });
    expect(issues.some((issue) => issue.message.includes('unknown node'))).toBe(true);
  });

  it('flags a branch referencing a node that does not exist', () => {
    const registry = baseRegistry();
    const issues = validateClassRegistry({
      ...registry,
      branches: [
        { ...registry.branches[0]!, nodeIds: [...registry.branches[0]!.nodeIds, 'node.ghost'] },
      ],
    });
    expect(issues.some((issue) => issue.message.includes('unknown node'))).toBe(true);
  });

  it('flags a class ultimateNodeId that does not exist', () => {
    const registry = baseRegistry();
    const issues = validateClassRegistry({
      ...registry,
      classes: [registry.classes[0]!, { ...registry.classes[1]!, ultimateNodeId: 'node.ghost' }],
    });
    expect(issues.some((issue) => issue.message.includes('unknown ultimate node'))).toBe(true);
  });

  it('detects a two-node prerequisite cycle', () => {
    const registry = baseRegistry();
    const cyclic: ClassRegistry = {
      ...registry,
      nodes: [
        node({
          nodeId: 'node.dark_knight.fervor.strike',
          requirements: {
            unlockLevel: 1,
            pointCost: 1,
            prerequisiteNodeId: 'node.dark_knight.fervor.guard',
          },
        }),
        node({
          nodeId: 'node.dark_knight.fervor.guard',
          requirements: {
            unlockLevel: 1,
            pointCost: 1,
            prerequisiteNodeId: 'node.dark_knight.fervor.strike',
          },
        }),
      ],
    };
    const issues = validateClassRegistry(cyclic);
    expect(issues.some((issue) => issue.message.includes('cycle detected'))).toBe(true);
  });

  it('allows a class with no branches yet (the starting state for the four new classes)', () => {
    const registry = baseRegistry();
    const issues = validateClassRegistry({
      ...registry,
      classes: [registry.classes[0]!, { ...registry.classes[1]!, branchIds: [] }],
      branches: [],
      nodes: [],
    });
    expect(issues).toEqual([]);
  });
});
