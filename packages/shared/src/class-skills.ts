import type { ClassRegistry, SkillNodeDefinition } from './class-tree.js';

export type SkillUnlockState = Readonly<{
  level: number;
  availablePoints: number;
  unlockedNodeIds: readonly string[];
}>;

export type SkillUnlockRejection =
  'unknown_node' | 'wrong_class' | 'level' | 'prerequisite' | 'points';

export type SkillUnlockResult =
  | Readonly<{ accepted: true; state: SkillUnlockState; node: SkillNodeDefinition }>
  | Readonly<{ accepted: false; reason: SkillUnlockRejection }>;

/** Returns the nodes exposed by a class, preserving the registry's authored order. */
export function classSkillNodes(
  registry: ClassRegistry,
  classId: string,
): readonly SkillNodeDefinition[] {
  const branchIds = new Set(
    registry.classes.find((classDefinition) => classDefinition.classId === classId)?.branchIds ??
      [],
  );
  return registry.nodes.filter((node) => node.classId === classId && branchIds.has(node.branchId));
}

/** Returns the combat ability IDs declared by a class's nodes, without duplicate commands. */
export function classAbilityIds(registry: ClassRegistry, classId: string): readonly string[] {
  return classSkillNodes(registry, classId)
    .flatMap((node) => (node.abilityId === undefined ? [] : [node.abilityId]))
    .filter((abilityId, index, all) => all.indexOf(abilityId) === index);
}

export type SkillRespecResult = Readonly<{
  state: SkillUnlockState;
  refundedPoints: number;
  /** Nodes actually cleared by this respec, in no particular order. */
  clearedNodeIds: readonly string[];
}>;

/**
 * Pure full respec for one class: every node the character unlocked in that class is cleared and
 * its point cost refunded in a single step, regardless of prerequisite order — a respec is a full
 * reset, not a sequence of individual un-learns that would have to walk the tree backwards.
 *
 * Nodes in `state.unlockedNodeIds` that don't belong to `classId` (e.g. a caller accidentally
 * passing the wrong class's state) are left untouched rather than silently dropped, so a bug
 * upstream shows up as those nodes surviving, not as lost progress on an unrelated class.
 *
 * Idempotent: respeccing a state with nothing left to clear for this class returns it unchanged
 * (`refundedPoints: 0`, `clearedNodeIds: []`), so a retried or duplicated respec command is a safe
 * no-op for the caller to persist.
 */
export function respecClassSkills(
  registry: ClassRegistry,
  classId: string,
  state: SkillUnlockState,
): SkillRespecResult {
  const ownNodesById = new Map(
    classSkillNodes(registry, classId).map((node) => [node.nodeId, node]),
  );
  const clearedNodeIds = state.unlockedNodeIds.filter((nodeId) => ownNodesById.has(nodeId));
  const refundedPoints = clearedNodeIds.reduce(
    (total, nodeId) => total + (ownNodesById.get(nodeId)?.requirements.pointCost ?? 0),
    0,
  );
  const keptNodeIds = state.unlockedNodeIds.filter((nodeId) => !ownNodesById.has(nodeId));
  return {
    state: {
      ...state,
      availablePoints: state.availablePoints + refundedPoints,
      unlockedNodeIds: keptNodeIds,
    },
    refundedPoints,
    clearedNodeIds,
  };
}

/** Pure server-side talent unlock check. Callers persist the returned state atomically. */
export function unlockClassSkillNode(
  registry: ClassRegistry,
  classId: string,
  state: SkillUnlockState,
  nodeId: string,
): SkillUnlockResult {
  const node = classSkillNodes(registry, classId).find((candidate) => candidate.nodeId === nodeId);
  if (node === undefined) {
    const knownNode = registry.nodes.find((candidate) => candidate.nodeId === nodeId);
    return { accepted: false, reason: knownNode === undefined ? 'unknown_node' : 'wrong_class' };
  }
  if (state.unlockedNodeIds.includes(node.nodeId)) return { accepted: true, state, node };
  if (state.level < node.requirements.unlockLevel) return { accepted: false, reason: 'level' };
  const prerequisite = node.requirements.prerequisiteNodeId;
  if (prerequisite !== undefined && !state.unlockedNodeIds.includes(prerequisite))
    return { accepted: false, reason: 'prerequisite' };
  if (state.availablePoints < node.requirements.pointCost)
    return { accepted: false, reason: 'points' };
  return {
    accepted: true,
    node,
    state: {
      ...state,
      availablePoints: state.availablePoints - node.requirements.pointCost,
      unlockedNodeIds: [...state.unlockedNodeIds, node.nodeId],
    },
  };
}
