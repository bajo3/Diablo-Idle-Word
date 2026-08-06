import { Prisma } from '../generated/prisma/client.js';
import { BALANCE_VERSION, GAME_DATA_VERSION } from '@brecha/game-data';

import {
  CreateCharacterInputSchema,
  type CharacterAggregate,
  type CreateCharacterInput,
} from './contracts.js';
import type { DatabaseClient } from './database.js';

const characterAggregateInclude = {
  inventory: { include: { items: { orderBy: { id: 'asc' } } } },
  equipment: { orderBy: { slot: 'asc' } },
  skills: { orderBy: { abilityId: 'asc' } },
  progress: true,
} as const;

type CharacterAggregateRecord = Prisma.CharacterGetPayload<{
  include: typeof characterAggregateInclude;
}>;

function toAggregate(record: CharacterAggregateRecord): CharacterAggregate {
  if (record.inventory === null || record.progress === null) {
    throw new Error(`Character ${record.id} violates its required aggregate invariant.`);
  }

  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    class: record.class,
    availability: record.availability,
    gold: record.gold,
    materials: record.materials,
    attributes: {
      strength: record.strength,
      dexterity: record.dexterity,
      intelligence: record.intelligence,
      vitality: record.vitality,
    },
    lastSeenAt: record.lastSeenAt,
    saveVersion: record.saveVersion,
    revision: record.revision,
    inventory: {
      id: record.inventory.id,
      capacity: record.inventory.capacity,
      schemaVersion: record.inventory.schemaVersion,
      revision: record.inventory.revision,
      items: record.inventory.items.map((item) => ({
        id: item.id,
        definitionId: item.definitionId,
        rarity: item.rarity,
        itemPower: item.itemPower,
        favorite: item.favorite,
        affixes: item.affixes as unknown[],
        generationData: item.generationData as Record<string, unknown>,
        quantity: item.quantity,
        revision: item.revision,
      })),
    },
    equipment: record.equipment.map((item) => ({
      id: item.id,
      slot: item.slot,
      inventoryItemId: item.inventoryItemId,
      revision: item.revision,
    })),
    skills: record.skills.map((skill) => ({
      id: skill.id,
      abilityId: skill.abilityId,
      level: skill.level,
      unlocked: skill.unlocked,
      equipped: skill.equipped,
      barSlot: skill.barSlot,
      revision: skill.revision,
    })),
    progress: {
      id: record.progress.id,
      level: record.progress.level,
      experience: record.progress.experience,
      attributePoints: record.progress.attributePoints,
      schemaVersion: record.progress.schemaVersion,
      revision: record.progress.revision,
    },
  };
}

export class CharacterRepository {
  public constructor(private readonly prisma: DatabaseClient) {}

  public async create(input: CreateCharacterInput): Promise<CharacterAggregate> {
    const value = CreateCharacterInputSchema.parse(input);
    const record = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.upsert({
        where: { id: value.user.id },
        create: { id: value.user.id, email: value.user.email },
        update: {},
      });

      return transaction.character.create({
        data: {
          id: value.character.id,
          userId: value.user.id,
          name: value.character.name,
          class: value.character.class,
          materials: value.character.materials,
          strength: value.character.attributes.strength,
          dexterity: value.character.attributes.dexterity,
          intelligence: value.character.attributes.intelligence,
          vitality: value.character.attributes.vitality,
          inventory: {
            create: {
              id: value.character.inventory.id,
              capacity: value.character.inventory.capacity,
              schemaVersion: value.character.inventory.schemaVersion,
              items: {
                create: value.character.inventory.items.map((item) => ({
                  id: item.id,
                  definitionId: item.definitionId,
                  rarity: item.rarity,
                  itemPower: item.itemPower,
                  favorite: item.favorite,
                  affixes: item.affixes as Prisma.InputJsonValue,
                  generationData: item.generationData as Prisma.InputJsonValue,
                  quantity: item.quantity,
                  character: { connect: { id: value.character.id } },
                })),
              },
            },
          },
          chest: {
            create: {
              id: `chest:${value.character.id}`,
              capacity: 80,
              schemaVersion: 1,
              items: [],
            },
          },
          equipment: {
            create: value.character.equipment.map((equipment) => ({
              id: equipment.id,
              inventoryItemId: equipment.inventoryItemId,
              slot: equipment.slot as never,
            })),
          },
          progress: {
            create: {
              id: value.character.progress.id,
              level: value.character.progress.level,
              experience: value.character.progress.experience,
              attributePoints: value.character.progress.attributePoints,
              schemaVersion: value.character.progress.schemaVersion,
            },
          },
          skills: {
            create: value.character.skills.map((skill) => ({
              id: skill.id,
              abilityId: skill.abilityId,
              level: skill.level,
              unlocked: skill.unlocked,
              equipped: skill.equipped,
              barSlot: skill.barSlot,
            })),
          },
          forestProgress: {
            create: {
              id: `forest-progress:${value.character.id}`,
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
              id: `interaction-state:${value.character.id}`,
              schemaVersion: 2,
              state: { consumedTargetIds: [], cooldowns: [] },
            },
          },
        },
        include: characterAggregateInclude,
      });
    });

    return toAggregate(record);
  }

  /** Reads an aggregate only when the authoritative user owns the character. */
  public async getOwned(userId: string, characterId: string): Promise<CharacterAggregate | null> {
    const record = await this.prisma.character.findFirst({
      where: { id: characterId, userId },
      include: characterAggregateInclude,
    });
    return record === null ? null : toAggregate(record);
  }
}
