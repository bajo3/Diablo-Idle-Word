import { randomUUID } from 'node:crypto';
import { BALANCE_VERSION, GAME_DATA, GAME_DATA_VERSION } from '@brecha/game-data';
import { classAbilityIds } from '@brecha/shared';
import type { CharacterClassId } from '@brecha/shared';

import type { DatabaseClient } from '../persistence/database.js';

import type { CreateGuardianInput } from '../auth/contracts.js';

export type CharacterSummary = {
  id: string;
  name: string;
  class: CharacterClassId;
  level: number;
  availability: string;
  selected: boolean;
};

export class CharacterNotAvailableError extends Error {
  public constructor() {
    super('The character is not available for that operation.');
    this.name = 'CharacterNotAvailableError';
  }
}

export class CharacterNotFoundError extends Error {
  public constructor() {
    super('Character not found.');
    this.name = 'CharacterNotFoundError';
  }
}

export class CharacterNameConflictError extends Error {
  public constructor() {
    super('A Guardian with that name already exists.');
    this.name = 'CharacterNameConflictError';
  }
}

export class CharacterService {
  public constructor(private readonly prisma: DatabaseClient) {}

  public async list(userId: string): Promise<CharacterSummary[]> {
    const [characters, selection] = await this.prisma.$transaction([
      this.prisma.character.findMany({
        where: { userId, deletedAt: null },
        include: { progress: { select: { level: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.characterSelection.findUnique({ where: { userId } }),
    ]);
    return characters.map((character) => toSummary(character, selection?.characterId));
  }

  public async createGuardian(
    userId: string,
    input: CreateGuardianInput,
  ): Promise<CharacterSummary> {
    const id = `character:${randomUUID()}`;
    try {
      const character = await this.prisma.character.create({
        data: {
          id,
          userId,
          name: input.name,
          class: input.class,
          inventory: {
            create: { id: `inventory:${randomUUID()}`, capacity: 40, schemaVersion: 1 },
          },
          chest: {
            create: { id: `chest:${id}`, capacity: 80, schemaVersion: 1, items: [] },
          },
          progress: {
            create: {
              id: `progress:${randomUUID()}`,
              level: 1,
              experience: 0n,
              attributePoints: 0,
              schemaVersion: 1,
            },
          },
          skills: {
            create: {
              id: `skill:${randomUUID()}`,
              abilityId:
                input.class === 'BARBARIAN'
                  ? (classAbilityIds(GAME_DATA.classRegistry, 'barbarian')[0] ??
                    'ability.guardian.slash')
                  : 'ability.guardian.slash',
              level: 1,
              unlocked: true,
              equipped: true,
              barSlot: 0,
            },
          },
          forestProgress: {
            create: {
              id: `forest-progress:${id}`,
              formatVersion: 1,
              stateSchemaVersion: 1,
              dataVersion: GAME_DATA_VERSION,
              balanceVersion: BALANCE_VERSION,
              state: {
                level: 1,
                xpInLevel: 0,
                bestLevel: 1,
                totalXp: 0,
                totalGold: 0,
                totalMaterials: 0,
                countedDefeats: [],
              },
            },
          },
          interactionState: {
            create: {
              id: `interaction-state:${id}`,
              schemaVersion: 2,
              state: { consumedTargetIds: [], cooldowns: [] },
            },
          },
        },
        include: { progress: { select: { level: true } } },
      });
      return toSummary(character, undefined);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) throw new CharacterNameConflictError();
      throw error;
    }
  }

  public async select(userId: string, characterId: string): Promise<CharacterSummary> {
    return this.prisma.$transaction(async (transaction) => {
      const character = await transaction.character.findFirst({
        where: { id: characterId, userId, deletedAt: null },
        include: { progress: { select: { level: true } } },
      });
      if (character === null) throw new CharacterNotFoundError();
      if (character.availability !== 'AVAILABLE') throw new CharacterNotAvailableError();
      await transaction.characterSelection.upsert({
        where: { userId },
        create: { userId, characterId },
        update: { characterId },
      });
      return toSummary(character, character.id);
    });
  }

  public async delete(userId: string, characterId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const character = await transaction.character.findFirst({
        where: { id: characterId, userId, deletedAt: null },
      });
      if (character === null) throw new CharacterNotFoundError();
      if (character.availability !== 'AVAILABLE') throw new CharacterNotAvailableError();
      await transaction.characterSelection.deleteMany({ where: { userId, characterId } });
      await transaction.character.update({
        where: { id: characterId },
        data: { deletedAt: new Date(), revision: { increment: 1 } },
      });
    });
  }
}

function toSummary(
  character: {
    id: string;
    name: string;
    class: CharacterClassId;
    availability: string;
    progress: { level: number } | null;
  },
  selectedCharacterId: string | undefined,
): CharacterSummary {
  if (character.progress === null) throw new Error(`Character ${character.id} has no progress.`);
  return {
    id: character.id,
    name: character.name,
    class: character.class,
    level: character.progress.level,
    availability: character.availability,
    selected: character.id === selectedCharacterId,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
