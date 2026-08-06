import { z } from 'zod';

import { IdSchema } from './ids.js';

/**
 * Data-driven class/branch/node registry — post-MVP class expansion, milestone M1
 * (`docs/plans/post-goal-class-expansion.md`). Guardian is expressed here as one
 * `ClassDefinition` entry so the shape is proven end-to-end against a class that already ships,
 * but its five existing abilities are deliberately NOT re-modeled as nodes in this milestone:
 * `GuardianDefinitionSchema`/`GuardianCombatSchema` in `@brecha/game-data` stay untouched, so
 * nothing that already works has to change to make this land. New classes populate their own
 * branches/nodes as each vertical slice ships (M2); a class with an empty `branchIds` is valid —
 * that is exactly the state `dark_knight`/`arcanist`/`hunter`/`summoner` start in.
 *
 * Deliberately excluded from this milestone: point budgets, respec cost, and balance numbers.
 * Those are `game-balance` concerns layered on top of a shape that is already known to be sound.
 */

export const SkillNodeKindSchema = z.enum(['active', 'passive', 'ultimate']);
export type SkillNodeKind = z.infer<typeof SkillNodeKindSchema>;

export const SkillNodeRequirementSchema = z.strictObject({
  unlockLevel: z.number().int().min(1).max(10),
  /** Omitted for a branch's entry node. */
  prerequisiteNodeId: IdSchema.optional(),
  pointCost: z.number().int().positive().max(10),
});
export type SkillNodeRequirement = z.infer<typeof SkillNodeRequirementSchema>;

export const SkillNodeDefinitionSchema = z.strictObject({
  nodeId: IdSchema,
  classId: IdSchema,
  branchId: IdSchema,
  kind: SkillNodeKindSchema,
  displayName: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(400),
  requirements: SkillNodeRequirementSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  schemaVersion: z.string().trim().min(1).max(64),
});
export type SkillNodeDefinition = z.infer<typeof SkillNodeDefinitionSchema>;

export const SkillBranchDefinitionSchema = z.strictObject({
  branchId: IdSchema,
  classId: IdSchema,
  displayName: z.string().trim().min(1).max(80),
  nodeIds: z.array(IdSchema),
});
export type SkillBranchDefinition = z.infer<typeof SkillBranchDefinitionSchema>;

export const ClassDefinitionSchema = z.strictObject({
  classId: IdSchema,
  schemaVersion: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(80),
  roleTags: z.array(z.string().trim().min(1).max(40)).min(1).max(6),
  resource: z.string().trim().min(1).max(40),
  attributeIds: z.array(z.enum(['strength', 'dexterity', 'intelligence', 'vitality'])).length(4),
  branchIds: z.array(IdSchema).max(3),
  ultimateNodeId: IdSchema.optional(),
});
export type ClassDefinition = z.infer<typeof ClassDefinitionSchema>;

export const ClassRegistrySchema = z.strictObject({
  registryVersion: z.string().trim().min(1).max(64),
  classes: z.array(ClassDefinitionSchema).min(1),
  branches: z.array(SkillBranchDefinitionSchema),
  nodes: z.array(SkillNodeDefinitionSchema),
});
export type ClassRegistry = z.infer<typeof ClassRegistrySchema>;

export type ClassRegistryIssue = Readonly<{ path: string; message: string }>;

/**
 * Pure structural validator: duplicate IDs, branches/nodes/ultimates that reference something
 * that doesn't exist, a node whose `classId` disagrees with its own branch's `classId`, and
 * cycles in the prerequisite chain. Returns every issue found rather than throwing on the first
 * one, so a caller (or a game-data cross-reference check) can report them all at once.
 */
export function validateClassRegistry(registry: ClassRegistry): readonly ClassRegistryIssue[] {
  const issues: ClassRegistryIssue[] = [];

  const classIds = new Set<string>();
  for (const classDefinition of registry.classes) {
    if (classIds.has(classDefinition.classId))
      issues.push({ path: `classes.${classDefinition.classId}`, message: 'Duplicate class ID' });
    classIds.add(classDefinition.classId);
  }

  const branchIds = new Set<string>();
  for (const branch of registry.branches) {
    if (branchIds.has(branch.branchId))
      issues.push({ path: `branches.${branch.branchId}`, message: 'Duplicate branch ID' });
    branchIds.add(branch.branchId);
    if (!classIds.has(branch.classId))
      issues.push({
        path: `branches.${branch.branchId}`,
        message: `References unknown class: ${branch.classId}`,
      });
  }

  const nodeIds = new Set<string>();
  const nodesById = new Map<string, SkillNodeDefinition>();
  for (const node of registry.nodes) {
    if (nodeIds.has(node.nodeId))
      issues.push({ path: `nodes.${node.nodeId}`, message: 'Duplicate node ID' });
    nodeIds.add(node.nodeId);
    nodesById.set(node.nodeId, node);

    const branch = registry.branches.find((candidate) => candidate.branchId === node.branchId);
    if (branch === undefined)
      issues.push({
        path: `nodes.${node.nodeId}`,
        message: `References unknown branch: ${node.branchId}`,
      });
    else if (branch.classId !== node.classId)
      issues.push({
        path: `nodes.${node.nodeId}`,
        message: `Class mismatch with its branch: node=${node.classId} branch=${branch.classId}`,
      });
  }

  for (const node of registry.nodes) {
    const prerequisiteNodeId = node.requirements.prerequisiteNodeId;
    if (prerequisiteNodeId !== undefined && !nodeIds.has(prerequisiteNodeId))
      issues.push({
        path: `nodes.${node.nodeId}`,
        message: `Prerequisite references unknown node: ${prerequisiteNodeId}`,
      });
  }

  for (const branch of registry.branches)
    for (const nodeId of branch.nodeIds)
      if (!nodeIds.has(nodeId))
        issues.push({
          path: `branches.${branch.branchId}`,
          message: `References unknown node: ${nodeId}`,
        });

  for (const classDefinition of registry.classes) {
    for (const branchId of classDefinition.branchIds)
      if (!branchIds.has(branchId))
        issues.push({
          path: `classes.${classDefinition.classId}`,
          message: `References unknown branch: ${branchId}`,
        });
    if (
      classDefinition.ultimateNodeId !== undefined &&
      !nodeIds.has(classDefinition.ultimateNodeId)
    )
      issues.push({
        path: `classes.${classDefinition.classId}`,
        message: `References unknown ultimate node: ${classDefinition.ultimateNodeId}`,
      });
  }

  // Cycle detection over the prerequisite graph: standard white/gray/black DFS. A cycle can only
  // be reached through nodes that exist (the unknown-reference check above already covers dangling
  // prerequisites), so this only walks edges into `nodesById`.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const path: string[] = [];
  function visit(nodeId: string): void {
    color.set(nodeId, GRAY);
    path.push(nodeId);
    const prerequisiteNodeId = nodesById.get(nodeId)?.requirements.prerequisiteNodeId;
    if (prerequisiteNodeId !== undefined && nodesById.has(prerequisiteNodeId)) {
      const state = color.get(prerequisiteNodeId) ?? WHITE;
      if (state === GRAY)
        issues.push({
          path: `nodes.${nodeId}`,
          message: `Prerequisite cycle detected: ${[...path, prerequisiteNodeId].join(' -> ')}`,
        });
      else if (state === WHITE) visit(prerequisiteNodeId);
    }
    path.pop();
    color.set(nodeId, BLACK);
  }
  for (const node of registry.nodes)
    if ((color.get(node.nodeId) ?? WHITE) === WHITE) visit(node.nodeId);

  return issues;
}
