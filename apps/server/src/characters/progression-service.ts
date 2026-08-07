import { createHash, randomUUID } from 'node:crypto';

import { BALANCE_VERSION, GAME_DATA, GAME_DATA_VERSION } from '@brecha/game-data';
import {
  AttributesSchema,
  classRegistryIdForCharacterClass,
  classSkillNodes,
  type SkillNodeKind,
  deriveCharacterStats,
  totalAttributePoints,
  type CharacterClassId,
  type CharacterDerivedStats,
} from '@brecha/shared';
import { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';

import { CharacterNotAvailableError, CharacterNotFoundError } from './character-service.js';
import type { DatabaseClient } from '../persistence/database.js';

const PROGRESSION_SCHEMA_VERSION = 1 as const;
const DEFAULT_ATTRIBUTES = Object.freeze({
  strength: 10,
  dexterity: 10,
  intelligence: 10,
  vitality: 10,
});

const CommandBaseSchema = z.strictObject({
  actorUserId: z.string().trim().min(1).max(128),
  characterId: z.string().trim().min(1).max(128),
  operationId: z.string().trim().min(1).max(128),
});
export const AllocateAttributesInputSchema = CommandBaseSchema.extend({
  attribute: z.enum(['strength', 'dexterity', 'intelligence', 'vitality']),
  amount: z.number().int().positive().max(99),
});
export const LearnSkillInputSchema = CommandBaseSchema.extend({
  abilityId: z.string().trim().min(1).max(128),
});
export const SetSkillBarInputSchema = CommandBaseSchema.extend({
  abilityId: z.string().trim().min(1).max(128),
  barSlot: z.number().int().min(0).max(3).nullable(),
});
export const ResetAttributesInputSchema = CommandBaseSchema;
export type AllocateAttributesInput = z.infer<typeof AllocateAttributesInputSchema>;
export type LearnSkillInput = z.infer<typeof LearnSkillInputSchema>;
export type SetSkillBarInput = z.infer<typeof SetSkillBarInputSchema>;
export type ResetAttributesInput = z.infer<typeof ResetAttributesInputSchema>;

export type ProgressionSkillSnapshot = Readonly<{
  abilityId: string;
  displayName: string;
  description: string;
  unlockLevel: number;
  unlocked: boolean;
  equipped: boolean;
  barSlot: number | null;
  level: number;
  nodeId?: string;
  branchId?: string;
  kind?: SkillNodeKind | 'basic_attack';
  prerequisiteNodeId?: string;
  pointCost?: number;
  effectIds?: readonly string[];
}>;
export type ProgressionSnapshot = Readonly<{
  schemaVersion: 1;
  characterId: string;
  class: CharacterClassId;
  revision: number;
  level: number;
  experience: number;
  xpInLevel: number;
  xpToNextLevel: number;
  attributePoints: number;
  totalAttributePoints: number;
  attributes: Readonly<{
    strength: number;
    dexterity: number;
    intelligence: number;
    vitality: number;
  }>;
  derivedStats: CharacterDerivedStats;
  skills: readonly ProgressionSkillSnapshot[];
  equippedAbilityIds: readonly string[];
  buildFingerprint: string;
  gameDataVersion: string;
  balanceVersion: string;
  formulaVersion: string;
}>;

export type ProgressionReceipt = Readonly<{
  operationId: string;
  requestHash: string;
  kind: string;
  replayed: boolean;
  snapshot: ProgressionSnapshot;
}>;

export class ProgressionOperationConflictError extends Error {
  public constructor() {
    super('operationId was already used with a different progression command.');
    this.name = 'ProgressionOperationConflictError';
  }
}
export class InsufficientAttributePointsError extends Error {
  public constructor() {
    super('The character has insufficient attribute points.');
    this.name = 'InsufficientAttributePointsError';
  }
}
export class SkillLockedError extends Error {
  public constructor() {
    super('The skill is not unlocked at the current character level.');
    this.name = 'SkillLockedError';
  }
}
export class SkillNotFoundError extends Error {
  public constructor() {
    super('The requested Guardian skill does not exist.');
    this.name = 'SkillNotFoundError';
  }
}
export class InsufficientGoldError extends Error {
  public constructor() {
    super('The character does not have enough gold for this reset.');
    this.name = 'InsufficientGoldError';
  }
}

type ProgressionCharacter = Prisma.CharacterGetPayload<{
  include: { progress: true; skills: { orderBy: { abilityId: 'asc' } } };
}>;
type ProgressionCommand =
  AllocateAttributesInput | LearnSkillInput | SetSkillBarInput | ResetAttributesInput;

const characterInclude = {
  progress: true,
  skills: { orderBy: { abilityId: 'asc' } },
} as const;

export class ProgressionService {
  public constructor(private readonly prisma: DatabaseClient) {}

  public async getOwned(userId: string, characterId: string): Promise<ProgressionSnapshot> {
    const character = await this.prisma.character.findFirst({
      where: { id: characterId, userId, deletedAt: null },
      include: characterInclude,
    });
    if (character === null || character.progress === null) throw new CharacterNotFoundError();
    return toSnapshot(character);
  }

  public async assertAbilityUsable(
    userId: string,
    characterId: string,
    abilityId: string,
  ): Promise<ProgressionSnapshot> {
    const snapshot = await this.getOwned(userId, characterId);
    const skill = snapshot.skills.find(
      (entry) => entry.abilityId === normalizeAbilityId(abilityId),
    );
    if (skill === undefined || !skill.unlocked) throw new SkillLockedError();
    return snapshot;
  }

  public allocateAttributes(input: AllocateAttributesInput): Promise<ProgressionReceipt> {
    return this.execute(
      'allocate_attributes',
      AllocateAttributesInputSchema.parse(input),
      async (transaction, character, value) => {
        if (character.progress!.attributePoints < value.amount)
          throw new InsufficientAttributePointsError();
        await transaction.character.update({
          where: { id: value.characterId },
          data: {
            [value.attribute]: { increment: value.amount },
            revision: { increment: 1 },
          } as Prisma.CharacterUpdateInput,
        });
        await transaction.characterProgress.update({
          where: { characterId: value.characterId },
          data: { attributePoints: { decrement: value.amount }, revision: { increment: 1 } },
        });
      },
    );
  }

  public learnSkill(input: LearnSkillInput): Promise<ProgressionReceipt> {
    return this.execute(
      'learn_skill',
      LearnSkillInputSchema.parse(input),
      async (transaction, character, value) => {
        const ability = skillDefinitionFor(character.class, value.abilityId);
        if (ability === undefined) throw new SkillNotFoundError();
        if (character.progress!.level < ability.unlockLevel) throw new SkillLockedError();
        const existing = character.skills.find(
          (skill) => normalizeAbilityId(skill.abilityId) === normalizeAbilityId(ability.id),
        );
        if (existing === undefined) {
          await transaction.characterSkill.create({
            data: {
              id: `skill:${randomUUID()}`,
              characterId: value.characterId,
              abilityId: normalizeAbilityId(ability.id),
              level: 1,
              unlocked: true,
              equipped: false,
              barSlot: null,
            },
          });
        } else if (!existing.unlocked) {
          await transaction.characterSkill.update({
            where: { id: existing.id },
            data: { unlocked: true, revision: { increment: 1 } },
          });
        }
      },
    );
  }

  public setSkillBar(input: SetSkillBarInput): Promise<ProgressionReceipt> {
    return this.execute(
      'set_skill_bar',
      SetSkillBarInputSchema.parse(input),
      async (transaction, character, value) => {
        const skill = character.skills.find(
          (entry) => normalizeAbilityId(entry.abilityId) === value.abilityId,
        );
        if (skill === undefined || !skill.unlocked) throw new SkillLockedError();
        if (value.barSlot !== null) {
          await transaction.characterSkill.updateMany({
            where: { characterId: value.characterId, barSlot: value.barSlot },
            data: { barSlot: null, equipped: false, revision: { increment: 1 } },
          });
        }
        await transaction.characterSkill.update({
          where: { id: skill.id },
          data: {
            barSlot: value.barSlot,
            equipped: value.barSlot !== null,
            revision: { increment: 1 },
          },
        });
      },
    );
  }

  public resetAttributes(input: ResetAttributesInput): Promise<ProgressionReceipt> {
    return this.execute(
      'reset_attributes',
      ResetAttributesInputSchema.parse(input),
      async (transaction, character) => {
        const progress = character.progress;
        if (progress === null) throw new CharacterNotFoundError();
        const cost = progress.level * GAME_DATA.progression.resetCostPerLevel;
        if (character.gold < BigInt(cost)) throw new InsufficientGoldError();
        await transaction.character.update({
          where: { id: character.id },
          data: {
            strength: DEFAULT_ATTRIBUTES.strength,
            dexterity: DEFAULT_ATTRIBUTES.dexterity,
            intelligence: DEFAULT_ATTRIBUTES.intelligence,
            vitality: DEFAULT_ATTRIBUTES.vitality,
            gold: { decrement: cost },
            revision: { increment: 1 },
          },
        });
        await transaction.characterProgress.update({
          where: { characterId: character.id },
          data: {
            attributePoints: totalAttributePoints(progress.level, GAME_DATA.progression),
            revision: { increment: 1 },
          },
        });
      },
    );
  }

  private async execute<T extends ProgressionCommand>(
    kind: string,
    input: T,
    mutate: (
      transaction: Prisma.TransactionClient,
      character: ProgressionCharacter,
      value: T,
    ) => Promise<void>,
  ): Promise<ProgressionReceipt> {
    const requestHash = canonicalRequestHash(kind, input);
    return this.prisma.$transaction(
      async (transaction) => {
        const character = await transaction.character.findFirst({
          where: { id: input.characterId, userId: input.actorUserId, deletedAt: null },
          include: characterInclude,
        });
        if (character === null || character.progress === null) throw new CharacterNotFoundError();
        if (character.availability !== 'AVAILABLE') throw new CharacterNotAvailableError();
        const existing = await transaction.inventoryOperation.findUnique({
          where: { operationId: input.operationId },
        });
        if (existing !== null) {
          if (existing.characterId !== input.characterId || existing.requestHash !== requestHash)
            throw new ProgressionOperationConflictError();
          const result = existing.result as { snapshot?: unknown };
          if (result.snapshot === undefined) throw new ProgressionOperationConflictError();
          return {
            operationId: existing.operationId,
            requestHash: existing.requestHash,
            kind: existing.kind,
            replayed: true,
            snapshot: result.snapshot as ProgressionSnapshot,
          };
        }
        await mutate(transaction, character, input);
        const updated = await transaction.character.findUniqueOrThrow({
          where: { id: input.characterId },
          include: characterInclude,
        });
        const snapshot = toSnapshot(updated);
        await transaction.inventoryOperation.create({
          data: {
            id: `progression:${input.operationId}`,
            characterId: input.characterId,
            operationId: input.operationId,
            requestHash,
            kind,
            result: { snapshot } as Prisma.InputJsonValue,
          },
        });
        return { operationId: input.operationId, requestHash, kind, replayed: false, snapshot };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

type SkillDefinition = Readonly<{
  id: string;
  displayName: string;
  description: string;
  unlockLevel: number;
  nodeId?: string;
  branchId?: string;
  kind?: SkillNodeKind | 'basic_attack';
  prerequisiteNodeId?: string;
  pointCost?: number;
  effectIds?: readonly string[];
}>;

function skillDefinitionsFor(classId: CharacterClassId): readonly SkillDefinition[] {
  if (classId === 'GUARDIAN') return GAME_DATA.abilities;
  const registryId = classRegistryIdForCharacterClass(classId);
  return classSkillNodes(GAME_DATA.classRegistry, registryId).map((node) => ({
    id: node.abilityId ?? node.nodeId,
    displayName: node.displayName,
    description: node.description,
    unlockLevel: node.requirements.unlockLevel,
    nodeId: node.nodeId,
    branchId: node.branchId,
    kind: node.kind,
    ...(node.requirements.prerequisiteNodeId === undefined
      ? {}
      : { prerequisiteNodeId: node.requirements.prerequisiteNodeId }),
    pointCost: node.requirements.pointCost,
    ...(node.effectIds === undefined ? {} : { effectIds: node.effectIds }),
  }));
}

function skillDefinitionFor(classId: CharacterClassId, abilityId: string) {
  const normalized = normalizeAbilityId(abilityId);
  return skillDefinitionsFor(classId).find((ability) => ability.id === normalized);
}

function normalizeAbilityId(abilityId: string): string {
  return abilityId === 'guardian:basic_attack' ? 'ability.guardian.slash' : abilityId;
}

function canonicalRequestHash(
  kind: string,
  input: AllocateAttributesInput | LearnSkillInput | SetSkillBarInput | ResetAttributesInput,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        kind,
        ...input,
        versions: {
          gameData: GAME_DATA_VERSION,
          balance: BALANCE_VERSION,
          schema: PROGRESSION_SCHEMA_VERSION,
        },
      }),
    )
    .digest('hex');
}

function toSnapshot(character: ProgressionCharacter): ProgressionSnapshot {
  if (character.progress === null) throw new CharacterNotFoundError();
  const attributes = AttributesSchema.parse({
    strength: character.strength,
    dexterity: character.dexterity,
    intelligence: character.intelligence,
    vitality: character.vitality,
  });
  const xp = character.progress.experience;
  const level = character.progress.level;
  const thresholds = GAME_DATA.progression.xpToReachLevel;
  const xpStart = BigInt(thresholds[level - 1] ?? 0);
  const xpNext = BigInt(thresholds[level] ?? thresholds[level - 1] ?? 0);
  const skills = skillDefinitionsFor(character.class).map((ability) => {
    const stored = character.skills.find(
      (skill) => normalizeAbilityId(skill.abilityId) === ability.id,
    );
    return {
      abilityId: ability.id,
      displayName: ability.displayName,
      description: ability.description,
      unlockLevel: ability.unlockLevel,
      unlocked: stored?.unlocked ?? false,
      equipped: stored?.equipped ?? false,
      barSlot: stored?.barSlot ?? null,
      level: stored?.level ?? 0,
      ...(ability.nodeId === undefined ? {} : { nodeId: ability.nodeId }),
      ...(ability.branchId === undefined ? {} : { branchId: ability.branchId }),
      ...(ability.kind === undefined ? {} : { kind: ability.kind }),
      ...(ability.prerequisiteNodeId === undefined
        ? {}
        : { prerequisiteNodeId: ability.prerequisiteNodeId }),
      ...(ability.pointCost === undefined ? {} : { pointCost: ability.pointCost }),
      ...(ability.effectIds === undefined ? {} : { effectIds: ability.effectIds }),
    };
  });
  const equippedAbilityIds = skills
    .filter((skill) => skill.equipped && skill.unlocked)
    .sort((a, b) => (a.barSlot ?? 0) - (b.barSlot ?? 0))
    .map((skill) => skill.abilityId);
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        characterId: character.id,
        level,
        attributes,
        equippedAbilityIds,
      }),
    )
    .digest('hex');
  return {
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    characterId: character.id,
    class: character.class,
    revision: character.progress.revision,
    level,
    experience: Number(xp),
    xpInLevel: Number(xp - xpStart < 0n ? 0n : xp - xpStart),
    xpToNextLevel: Number(xpNext - xpStart),
    attributePoints: character.progress.attributePoints,
    totalAttributePoints: totalAttributePoints(level, GAME_DATA.progression),
    attributes,
    derivedStats: deriveCharacterStats(attributes),
    skills,
    equippedAbilityIds,
    buildFingerprint: fingerprint,
    gameDataVersion: GAME_DATA_VERSION,
    balanceVersion: BALANCE_VERSION,
    formulaVersion: GAME_DATA.progression.formulaVersion,
  };
}
