import { createHash } from 'node:crypto';

import { BALANCE_VERSION, GAME_DATA, GAME_DATA_VERSION } from '@brecha/game-data';
import {
  EquipmentSlotSchema,
  ItemInstanceSchema,
  ItemRaritySchema,
  ItemStatKeySchema,
  generateItemInstance,
  type EquipmentSlot,
  type ItemDefinition,
  type ItemInstance,
  type ItemStatKey,
} from '@brecha/shared';
import { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';

import {
  CharacterNotAvailableError,
  CharacterNotFoundError,
} from '../characters/character-service.js';
import { InsufficientGoldError } from '../characters/progression-service.js';
import type { DatabaseClient } from './database.js';
import { TOWN_FORMULA_VERSION, merchantStockById } from './town-catalog.js';

const INVENTORY_SCHEMA_VERSION = 1 as const;
const INVENTORY_FORMULA_VERSION = 'inventory.mvp.1' as const;
const maxRetries = 3;

const OperationIdSchema = z.string().trim().min(1).max(128);
const InventoryCommandBaseSchema = z.strictObject({
  actorUserId: z.string().trim().min(1).max(128),
  characterId: z.string().trim().min(1).max(128),
  operationId: OperationIdSchema,
});
export const EquipItemInputSchema = InventoryCommandBaseSchema.extend({
  itemId: z.string().trim().min(1).max(128),
  slot: EquipmentSlotSchema.optional(),
});
export const UnequipItemInputSchema = InventoryCommandBaseSchema.extend({
  itemId: z.string().trim().min(1).max(128),
});
export const FavoriteItemInputSchema = InventoryCommandBaseSchema.extend({
  itemId: z.string().trim().min(1).max(128),
  favorite: z.boolean(),
});
export const SellItemInputSchema = InventoryCommandBaseSchema.extend({
  itemId: z.string().trim().min(1).max(128),
});
export const BuyItemInputSchema = InventoryCommandBaseSchema.extend({
  stockId: z.string().trim().min(1).max(64),
});
export const ChestDepositInputSchema = InventoryCommandBaseSchema.extend({
  itemId: z.string().trim().min(1).max(128),
});
export const ChestWithdrawInputSchema = InventoryCommandBaseSchema.extend({
  itemId: z.string().trim().min(1).max(128),
});
export type EquipItemInput = z.infer<typeof EquipItemInputSchema>;
export type UnequipItemInput = z.infer<typeof UnequipItemInputSchema>;
export type FavoriteItemInput = z.infer<typeof FavoriteItemInputSchema>;
export type SellItemInput = z.infer<typeof SellItemInputSchema>;
export type BuyItemInput = z.infer<typeof BuyItemInputSchema>;
export type ChestDepositInput = z.infer<typeof ChestDepositInputSchema>;
export type ChestWithdrawInput = z.infer<typeof ChestWithdrawInputSchema>;

export type InventoryItemSnapshot = ItemInstance & {
  displayName: string;
  type: string;
  slot?: EquipmentSlot;
  favorite: boolean;
  equippedSlot?: EquipmentSlot;
  sellValue: number;
};
export type InventorySnapshot = {
  characterId: string;
  capacity: number;
  revision: number;
  schemaVersion: number;
  items: InventoryItemSnapshot[];
  equipment: Array<{ itemId: string; slot: EquipmentSlot }>;
  gold: number;
  materials: number;
  derivedStats: Record<ItemStatKey, number>;
  gameDataVersion: string;
};
export type InventoryCommandReceipt = {
  operationId: string;
  requestHash: string;
  kind: string;
  replayed: boolean;
  snapshot: InventorySnapshot;
};
export type ChestSnapshot = {
  characterId: string;
  capacity: number;
  revision: number;
  schemaVersion: number;
  items: InventoryItemSnapshot[];
  gameDataVersion: string;
};
export type ChestCommandReceipt = {
  operationId: string;
  requestHash: string;
  kind: string;
  replayed: boolean;
  chest: ChestSnapshot;
  inventory: InventorySnapshot;
};

export class InventoryOperationConflictError extends Error {
  public constructor() {
    super('operationId was already used with a different inventory command.');
    this.name = 'InventoryOperationConflictError';
  }
}
export class InventoryItemNotFoundError extends Error {
  public constructor() {
    super('The inventory item does not exist or is not owned by this user.');
    this.name = 'InventoryItemNotFoundError';
  }
}
export class InventoryFullError extends Error {
  public constructor() {
    super('The inventory has no free slots.');
    this.name = 'InventoryFullError';
  }
}
export class InvalidEquipmentError extends Error {
  public constructor(message = 'The item cannot be equipped in that slot.') {
    super(message);
    this.name = 'InvalidEquipmentError';
  }
}
export class ProtectedInventoryItemError extends Error {
  public constructor(message = 'The item is protected and cannot be sold.') {
    super(message);
    this.name = 'ProtectedInventoryItemError';
  }
}
export class ChestFullError extends Error {
  public constructor() {
    super('The chest has no free slots.');
    this.name = 'ChestFullError';
  }
}
export class ChestItemNotFoundError extends Error {
  public constructor() {
    super('The chest item does not exist or is not owned by this character.');
    this.name = 'ChestItemNotFoundError';
  }
}

type InventoryDb = DatabaseClient | Prisma.TransactionClient;
type CommandInput =
  EquipItemInput | UnequipItemInput | FavoriteItemInput | SellItemInput | BuyItemInput;
type ChestCommandInput = ChestDepositInput | ChestWithdrawInput;

export function canonicalInventoryRequestHash(
  input: CommandInput | ChestCommandInput,
  kind: string,
): string {
  const canonical = JSON.stringify({
    kind,
    actorUserId: input.actorUserId,
    characterId: input.characterId,
    operationId: input.operationId,
    itemId: 'itemId' in input ? input.itemId : undefined,
    stockId: 'stockId' in input ? input.stockId : undefined,
    slot: 'slot' in input ? input.slot : undefined,
    favorite: 'favorite' in input ? input.favorite : undefined,
    versions: {
      data: GAME_DATA_VERSION,
      schema: INVENTORY_SCHEMA_VERSION,
      formula: INVENTORY_FORMULA_VERSION,
    },
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export class InventoryService {
  public constructor(private readonly prisma: DatabaseClient) {}

  public async getOwned(userId: string, characterId: string): Promise<InventorySnapshot> {
    return this.prisma.$transaction(async (transaction) => {
      await this.requireCharacter(transaction, userId, characterId);
      await this.ensureInventory(transaction, characterId);
      return this.snapshot(transaction, characterId);
    });
  }

  public equip(input: EquipItemInput): Promise<InventoryCommandReceipt> {
    return this.execute('equip', EquipItemInputSchema.parse(input), async (transaction, value) => {
      const item = await this.ownedItem(transaction, value.characterId, value.itemId);
      const definition = this.definition(item.definitionId);
      if (definition.type === 'material' || definition.slot === undefined)
        throw new InvalidEquipmentError('Materials cannot be equipped.');
      const slot = chooseSlot(
        definition,
        value.slot,
        await transaction.equipment.findMany({
          where: { characterId: value.characterId },
          select: { slot: true },
        }),
      );
      const current = await transaction.equipment.findUnique({
        where: { inventoryItemId: item.id },
        select: { id: true, slot: true },
      });
      if (current !== null && current.slot !== slot)
        await transaction.equipment.delete({ where: { id: current.id } });
      const occupying = await transaction.equipment.findUnique({
        where: { characterId_slot: { characterId: value.characterId, slot } },
        select: { id: true, inventoryItemId: true },
      });
      if (occupying !== null && occupying.inventoryItemId !== item.id)
        await transaction.equipment.delete({ where: { id: occupying.id } });
      if (current?.slot !== slot || occupying?.inventoryItemId !== item.id) {
        await transaction.equipment.create({
          data: {
            id: equipmentId(value.characterId, slot),
            characterId: value.characterId,
            inventoryItemId: item.id,
            slot,
          },
        });
        await this.bumpRevisions(transaction, value.characterId);
      }
    });
  }

  public unequip(input: UnequipItemInput): Promise<InventoryCommandReceipt> {
    return this.execute(
      'unequip',
      UnequipItemInputSchema.parse(input),
      async (transaction, value) => {
        await this.ownedItem(transaction, value.characterId, value.itemId);
        const current = await transaction.equipment.findUnique({
          where: { inventoryItemId: value.itemId },
          select: { id: true },
        });
        if (current !== null) {
          await transaction.equipment.delete({ where: { id: current.id } });
          await this.bumpRevisions(transaction, value.characterId);
        }
      },
    );
  }

  public favorite(input: FavoriteItemInput): Promise<InventoryCommandReceipt> {
    return this.execute(
      'favorite',
      FavoriteItemInputSchema.parse(input),
      async (transaction, value) => {
        const item = await this.ownedItem(transaction, value.characterId, value.itemId);
        if (item.favorite !== value.favorite) {
          await transaction.inventoryItem.update({
            where: { id: item.id },
            data: { favorite: value.favorite, revision: { increment: 1 } },
          });
          await this.bumpRevisions(transaction, value.characterId);
        }
      },
    );
  }

  public sell(input: SellItemInput): Promise<InventoryCommandReceipt> {
    return this.execute('sell', SellItemInputSchema.parse(input), async (transaction, value) => {
      const item = await this.ownedItem(transaction, value.characterId, value.itemId);
      if (item.favorite)
        throw new ProtectedInventoryItemError('Unfavorite the item before selling it.');
      const equipped = await transaction.equipment.findUnique({
        where: { inventoryItemId: item.id },
      });
      if (equipped !== null)
        throw new ProtectedInventoryItemError('Unequip the item before selling it.');
      const valueInGold = sellValue(item.rarity, item.itemPower, item.quantity);
      await transaction.inventoryItem.delete({ where: { id: item.id } });
      const updatedCharacter = await transaction.character.update({
        where: { id: value.characterId },
        data: { gold: { increment: BigInt(valueInGold) }, revision: { increment: 1 } },
        select: { gold: true, materials: true },
      });
      await transaction.inventory.update({
        where: { characterId: value.characterId },
        data: { revision: { increment: 1 } },
      });
      const progress = await transaction.characterProgress.findUniqueOrThrow({
        where: { characterId: value.characterId },
        select: { experience: true },
      });
      await transaction.rewardLog.create({
        data: economyLogData({
          operationId: economyOperationId('sell', value.operationId),
          characterId: value.characterId,
          requestHash: canonicalInventoryRequestHash(value, 'sell'),
          source: 'merchant_sell',
          sourceId: item.id,
          goldDelta: BigInt(valueInGold),
          materialsDelta: 0n,
          experienceDelta: 0n,
          goldBalanceAfter: updatedCharacter.gold,
          materialsBalanceAfter: updatedCharacter.materials,
          experienceBalanceAfter: progress.experience,
        }),
      });
    });
  }

  public buy(input: BuyItemInput): Promise<InventoryCommandReceipt> {
    return this.execute('buy', BuyItemInputSchema.parse(input), async (transaction, value) => {
      const stock = merchantStockById(value.stockId);
      const inventory = await transaction.inventory.findUniqueOrThrow({
        where: { characterId: value.characterId },
        select: { id: true, capacity: true },
      });
      const occupied = await transaction.inventoryItem.count({
        where: { inventoryId: inventory.id, characterId: value.characterId },
      });
      if (occupied >= inventory.capacity) throw new InventoryFullError();
      const character = await transaction.character.findUniqueOrThrow({
        where: { id: value.characterId },
        select: { gold: true, materials: true },
      });
      if (character.gold < BigInt(stock.price)) throw new InsufficientGoldError();
      const item = createGeneratedInventoryItem({
        instanceId: merchantItemId(value.operationId),
        definitionId: stock.definitionId,
        itemLevel: stock.itemLevel,
        seed: `merchant:${stock.stockId}:${value.operationId}`,
        source: 'merchant_buy',
        rarity: stock.rarity,
      });
      await transaction.inventoryItem.create({
        data: inventoryItemCreateData(item, value.characterId, inventory.id),
      });
      const updatedCharacter = await transaction.character.update({
        where: { id: value.characterId },
        data: { gold: { decrement: BigInt(stock.price) }, revision: { increment: 1 } },
        select: { gold: true, materials: true },
      });
      await transaction.inventory.update({
        where: { characterId: value.characterId },
        data: { revision: { increment: 1 } },
      });
      const progress = await transaction.characterProgress.findUniqueOrThrow({
        where: { characterId: value.characterId },
        select: { experience: true },
      });
      await transaction.rewardLog.create({
        data: economyLogData({
          operationId: economyOperationId('buy', value.operationId),
          characterId: value.characterId,
          requestHash: canonicalInventoryRequestHash(value, 'buy'),
          source: 'merchant_buy',
          sourceId: stock.stockId,
          goldDelta: -BigInt(stock.price),
          materialsDelta: 0n,
          experienceDelta: 0n,
          goldBalanceAfter: updatedCharacter.gold,
          materialsBalanceAfter: updatedCharacter.materials,
          experienceBalanceAfter: progress.experience,
          payload: { definitionId: stock.definitionId, itemId: item.instanceId },
        }),
      });
    });
  }

  public async getChest(
    userId: string,
    characterId: string,
  ): Promise<{
    chest: ChestSnapshot;
    inventory: InventorySnapshot;
  }> {
    return this.prisma.$transaction(async (transaction) => {
      await this.requireCharacter(transaction, userId, characterId);
      await this.ensureInventory(transaction, characterId);
      await this.ensureChest(transaction, characterId);
      return {
        chest: await this.chestSnapshot(transaction, characterId),
        inventory: await this.snapshot(transaction, characterId),
      };
    });
  }

  public depositToChest(input: ChestDepositInput): Promise<ChestCommandReceipt> {
    return this.executeChest(
      'chest_deposit',
      ChestDepositInputSchema.parse(input),
      async (transaction, value) => {
        const chest = await transaction.characterChest.findUniqueOrThrow({
          where: { characterId: value.characterId },
        });
        const stored = parseChestItems(chest.items);
        if (stored.length >= chest.capacity) throw new ChestFullError();
        const item = await this.ownedItem(transaction, value.characterId, value.itemId);
        const equipped = await transaction.equipment.findUnique({
          where: { inventoryItemId: item.id },
          select: { id: true },
        });
        if (equipped !== null)
          throw new ProtectedInventoryItemError('Unequip the item before storing it.');
        const itemInstance = itemDataToInstance(item);
        await transaction.inventoryItem.delete({ where: { id: item.id } });
        await transaction.characterChest.update({
          where: { characterId: value.characterId },
          data: {
            items: [
              ...stored,
              { item: itemInstance, favorite: item.favorite },
            ] as unknown as Prisma.InputJsonValue,
            revision: { increment: 1 },
          },
        });
        await transaction.inventory.update({
          where: { characterId: value.characterId },
          data: { revision: { increment: 1 } },
        });
        await transaction.character.update({
          where: { id: value.characterId },
          data: { revision: { increment: 1 } },
        });
      },
    );
  }

  public withdrawFromChest(input: ChestWithdrawInput): Promise<ChestCommandReceipt> {
    return this.executeChest(
      'chest_withdraw',
      ChestWithdrawInputSchema.parse(input),
      async (transaction, value) => {
        const chest = await transaction.characterChest.findUniqueOrThrow({
          where: { characterId: value.characterId },
        });
        const stored = parseChestItems(chest.items);
        const index = stored.findIndex((entry) => entry.item.instanceId === value.itemId);
        if (index < 0) throw new ChestItemNotFoundError();
        const inventory = await transaction.inventory.findUniqueOrThrow({
          where: { characterId: value.characterId },
          select: { id: true, capacity: true },
        });
        const occupied = await transaction.inventoryItem.count({
          where: { inventoryId: inventory.id, characterId: value.characterId },
        });
        if (occupied >= inventory.capacity) throw new InventoryFullError();
        const [entry] = stored.splice(index, 1);
        if (entry === undefined) throw new ChestItemNotFoundError();
        await transaction.inventoryItem.create({
          data: {
            ...inventoryItemCreateData(entry.item, value.characterId, inventory.id),
            favorite: entry.favorite,
          },
        });
        await transaction.characterChest.update({
          where: { characterId: value.characterId },
          data: { items: stored as unknown as Prisma.InputJsonValue, revision: { increment: 1 } },
        });
        await transaction.inventory.update({
          where: { characterId: value.characterId },
          data: { revision: { increment: 1 } },
        });
        await transaction.character.update({
          where: { id: value.characterId },
          data: { revision: { increment: 1 } },
        });
      },
    );
  }

  private async execute<T extends CommandInput>(
    kind: string,
    input: T,
    mutate: (transaction: Prisma.TransactionClient, value: T) => Promise<void>,
  ): Promise<InventoryCommandReceipt> {
    const requestHash = canonicalInventoryRequestHash(input, kind);
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await this.requireCharacter(transaction, input.actorUserId, input.characterId);
            const existing = await transaction.inventoryOperation.findUnique({
              where: { operationId: input.operationId },
            });
            if (existing !== null) {
              if (
                existing.characterId !== input.characterId ||
                existing.requestHash !== requestHash
              )
                throw new InventoryOperationConflictError();
              return receiptFromStored(existing, true);
            }
            await this.ensureInventory(transaction, input.characterId);
            await mutate(transaction, input);
            const snapshot = await this.snapshot(transaction, input.characterId);
            const result = { snapshot } satisfies { snapshot: InventorySnapshot };
            await transaction.inventoryOperation.create({
              data: {
                id: operationRecordId(input.operationId),
                characterId: input.characterId,
                operationId: input.operationId,
                requestHash,
                kind,
                result,
              },
            });
            return { operationId: input.operationId, requestHash, kind, replayed: false, snapshot };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (isRetryable(error) && attempt + 1 < maxRetries) continue;
        throw error;
      }
    }
    throw new Error('Inventory operation exhausted its serializable transaction retries.');
  }

  private async executeChest<T extends ChestCommandInput>(
    kind: string,
    input: T,
    mutate: (transaction: Prisma.TransactionClient, value: T) => Promise<void>,
  ): Promise<ChestCommandReceipt> {
    const requestHash = canonicalInventoryRequestHash(input, kind);
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await this.requireCharacter(transaction, input.actorUserId, input.characterId);
            const existing = await transaction.inventoryOperation.findUnique({
              where: { operationId: input.operationId },
            });
            if (existing !== null) {
              if (
                existing.characterId !== input.characterId ||
                existing.requestHash !== requestHash
              )
                throw new InventoryOperationConflictError();
              return chestReceiptFromStored(existing, true);
            }
            await this.ensureInventory(transaction, input.characterId);
            await this.ensureChest(transaction, input.characterId);
            await mutate(transaction, input);
            const chest = await this.chestSnapshot(transaction, input.characterId);
            const inventory = await this.snapshot(transaction, input.characterId);
            const result = { chest, inventory } satisfies {
              chest: ChestSnapshot;
              inventory: InventorySnapshot;
            };
            await transaction.inventoryOperation.create({
              data: {
                id: operationRecordId(input.operationId),
                characterId: input.characterId,
                operationId: input.operationId,
                requestHash,
                kind,
                result,
              },
            });
            return {
              operationId: input.operationId,
              requestHash,
              kind,
              replayed: false,
              chest,
              inventory,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        if (isRetryable(error) && attempt + 1 < maxRetries) continue;
        throw error;
      }
    }
    throw new Error('Chest operation exhausted its serializable transaction retries.');
  }

  private async requireCharacter(transaction: InventoryDb, userId: string, characterId: string) {
    const character = await transaction.character.findFirst({
      where: { id: characterId, userId, deletedAt: null },
      select: { id: true, availability: true },
    });
    if (character === null) throw new CharacterNotFoundError();
    if (character.availability !== 'AVAILABLE') throw new CharacterNotAvailableError();
    return character;
  }

  private async ensureInventory(transaction: InventoryDb, characterId: string): Promise<void> {
    await transaction.inventory.upsert({
      where: { characterId },
      create: {
        id: `inventory:${characterId}`,
        characterId,
        capacity: 40,
        schemaVersion: INVENTORY_SCHEMA_VERSION,
      },
      update: {},
    });
  }

  private async ensureChest(transaction: InventoryDb, characterId: string): Promise<void> {
    await transaction.characterChest.upsert({
      where: { characterId },
      create: {
        id: `chest:${characterId}`,
        characterId,
        capacity: 80,
        schemaVersion: 1,
        items: [],
      },
      update: {},
    });
  }

  private async ownedItem(transaction: InventoryDb, characterId: string, itemId: string) {
    const item = await transaction.inventoryItem.findFirst({ where: { id: itemId, characterId } });
    if (item === null) throw new InventoryItemNotFoundError();
    return item;
  }

  private definition(definitionId: string): ItemDefinition {
    const definition = GAME_DATA.itemDefinitions.find((candidate) => candidate.id === definitionId);
    if (definition === undefined)
      throw new InvalidEquipmentError('The item definition is not available.');
    return definition;
  }

  private async bumpRevisions(
    transaction: Prisma.TransactionClient,
    characterId: string,
  ): Promise<void> {
    await transaction.inventory.update({
      where: { characterId },
      data: { revision: { increment: 1 } },
    });
    await transaction.character.update({
      where: { id: characterId },
      data: { revision: { increment: 1 } },
    });
  }

  private async snapshot(
    transaction: InventoryDb,
    characterId: string,
  ): Promise<InventorySnapshot> {
    const record = await transaction.character.findUnique({
      where: { id: characterId },
      include: {
        inventory: { include: { items: { orderBy: { createdAt: 'asc' } } } },
        equipment: { include: { inventoryItem: true }, orderBy: { slot: 'asc' } },
      },
    });
    if (record === null || record.inventory === null) throw new CharacterNotFoundError();
    const equipment = record.equipment.map((entry) => ({
      itemId: entry.inventoryItemId,
      slot: slotFromDb(entry.slot),
    }));
    const equipped = new Map(equipment.map((entry) => [entry.itemId, entry.slot]));
    const items = record.inventory.items.map((item) =>
      this.toItemSnapshot(item, equipped.get(item.id)),
    );
    const derivedStats = deriveStats(record, items, equipped);
    return {
      characterId,
      capacity: record.inventory.capacity,
      revision: record.inventory.revision,
      schemaVersion: record.inventory.schemaVersion,
      items,
      equipment,
      gold: safeNumber(record.gold),
      materials: safeNumber(record.materials),
      derivedStats,
      gameDataVersion: GAME_DATA_VERSION,
    };
  }

  private async chestSnapshot(
    transaction: InventoryDb,
    characterId: string,
  ): Promise<ChestSnapshot> {
    const chest = await transaction.characterChest.findUnique({ where: { characterId } });
    if (chest === null) throw new CharacterNotFoundError();
    const items = parseChestItems(chest.items).map(chestItemSnapshot);
    return {
      characterId,
      capacity: chest.capacity,
      revision: chest.revision,
      schemaVersion: chest.schemaVersion,
      items,
      gameDataVersion: GAME_DATA_VERSION,
    };
  }

  private toItemSnapshot(
    item: {
      id: string;
      definitionId: string;
      rarity: string;
      itemPower: number;
      favorite: boolean;
      affixes: Prisma.JsonValue;
      generationData: Prisma.JsonValue;
      quantity: number;
      itemData: Prisma.JsonValue;
    },
    equippedSlot: EquipmentSlot | undefined,
  ): InventoryItemSnapshot {
    const definition = GAME_DATA.itemDefinitions.find(
      (candidate) => candidate.id === item.definitionId,
    );
    const data = itemDataToInstance(item);
    const snapshot: InventoryItemSnapshot = {
      ...data,
      displayName: definition?.displayName ?? item.definitionId,
      type: definition?.type ?? 'material',
      favorite: item.favorite,
      sellValue: sellValue(item.rarity, item.itemPower, item.quantity),
    };
    if (definition?.slot !== undefined) snapshot.slot = definition.slot;
    if (equippedSlot !== undefined) snapshot.equippedSlot = equippedSlot;
    return snapshot;
  }
}

export function createGeneratedInventoryItem(input: {
  instanceId: string;
  definitionId: string;
  itemLevel: number;
  seed: string;
  source: string;
  rarity?: z.infer<typeof ItemRaritySchema>;
}): ItemInstance {
  const definition = GAME_DATA.itemDefinitions.find(
    (candidate) => candidate.id === input.definitionId,
  );
  if (definition === undefined) throw new Error(`Unknown item definition: ${input.definitionId}`);
  return generateItemInstance({
    definition,
    affixes: GAME_DATA.affixes,
    config: GAME_DATA.itemGeneration,
    instanceId: input.instanceId,
    seed: input.seed,
    source: input.source,
    itemLevel: input.itemLevel,
    ...(input.rarity === undefined ? {} : { rarity: input.rarity }),
  });
}

export function inventoryItemCreateData(
  item: ItemInstance,
  characterId: string,
  inventoryId: string,
) {
  return {
    id: item.instanceId,
    characterId,
    inventoryId,
    definitionId: item.definitionId,
    rarity: item.rarity,
    itemPower: item.itemPower,
    affixes: item.affixes as Prisma.InputJsonValue,
    generationData: {
      seed: item.generationSeed,
      generatorVersion: item.generatorVersion,
      source: item.source,
      itemLevel: item.itemLevel,
    } as Prisma.InputJsonValue,
    quantity: item.quantity,
    itemData: item as unknown as Prisma.InputJsonValue,
  };
}

function itemDataToInstance(item: {
  id: string;
  definitionId: string;
  rarity: string;
  itemPower: number;
  affixes: Prisma.JsonValue;
  generationData: Prisma.JsonValue;
  quantity: number;
  itemData: Prisma.JsonValue;
}): ItemInstance {
  const parsed = ItemInstanceSchema.safeParse(item.itemData);
  if (parsed.success) return parsed.data;
  const generation = asRecord(item.generationData);
  const affixes = z
    .array(z.object({ id: z.string(), stat: ItemStatKeySchema, value: z.number().int() }))
    .parse(item.affixes);
  return ItemInstanceSchema.parse({
    instanceId: item.id,
    definitionId: item.definitionId,
    itemLevel: asPositiveInt(generation.itemLevel, 1),
    rarity: ItemRaritySchema.parse(item.rarity),
    itemPower: Math.max(1, item.itemPower),
    baseStats: [],
    affixes,
    generationSeed: typeof generation.seed === 'string' ? generation.seed : `legacy:${item.id}`,
    generatorVersion:
      typeof generation.generatorVersion === 'string' ? generation.generatorVersion : 'legacy.1',
    source: typeof generation.source === 'string' ? generation.source : 'legacy',
    quantity: Math.max(1, item.quantity),
  });
}

function deriveStats(
  record: { strength: number; dexterity: number; intelligence: number; vitality: number },
  items: readonly InventoryItemSnapshot[],
  equipped: ReadonlyMap<string, EquipmentSlot>,
): Record<ItemStatKey, number> {
  const stats: Record<ItemStatKey, number> = {
    strength: record.strength,
    dexterity: record.dexterity,
    intelligence: record.intelligence,
    vitality: record.vitality,
    armor: 0,
    physical_damage: 0,
    critical_chance: 0,
    attack_speed_minor: 0,
    max_health: 0,
  };
  for (const item of items) {
    if (!equipped.has(item.instanceId)) continue;
    for (const stat of [...item.baseStats, ...item.affixes]) stats[stat.stat] += stat.value;
  }
  return stats;
}

function chooseSlot(
  definition: ItemDefinition,
  requested: EquipmentSlot | undefined,
  occupied: readonly { slot: string }[],
):
  | never
  | 'HELMET'
  | 'CHEST'
  | 'GLOVES'
  | 'BOOTS'
  | 'MAIN_HAND'
  | 'OFF_HAND'
  | 'AMULET'
  | 'RING_1'
  | 'RING_2' {
  const allowed =
    definition.type === 'ring' ? (['ring_1', 'ring_2'] as const) : ([definition.slot!] as const);
  const slot =
    requested ??
    allowed.find((candidate) => !occupied.some((entry) => entry.slot === slotToDb(candidate))) ??
    allowed[0];
  if (!allowed.includes(slot as never)) throw new InvalidEquipmentError();
  return slotToDb(slot) as never;
}

function slotToDb(
  slot: EquipmentSlot,
):
  | 'HELMET'
  | 'CHEST'
  | 'GLOVES'
  | 'BOOTS'
  | 'MAIN_HAND'
  | 'OFF_HAND'
  | 'AMULET'
  | 'RING_1'
  | 'RING_2' {
  return slot.toUpperCase() as ReturnType<typeof slotToDb>;
}
function slotFromDb(slot: string): EquipmentSlot {
  return EquipmentSlotSchema.parse(slot.toLowerCase());
}
function equipmentId(characterId: string, slot: string): string {
  return `equipment:${createHash('sha256').update(`${characterId}:${slot}`).digest('hex').slice(0, 48)}`;
}
function operationRecordId(operationId: string): string {
  return `inventory-operation:${createHash('sha256').update(operationId).digest('hex').slice(0, 48)}`;
}
function sellValue(rarity: string, itemPower: number, quantity: number): number {
  const multiplier = { common: 1, magic: 2, rare: 5, legendary: 20 }[rarity] ?? 1;
  return Math.max(1, Math.round(itemPower * multiplier * Math.max(1, quantity)));
}

type StoredChestItem = { item: ItemInstance; favorite: boolean };
const StoredChestItemSchema = z.strictObject({
  item: ItemInstanceSchema,
  favorite: z.boolean(),
});

function parseChestItems(value: Prisma.JsonValue): StoredChestItem[] {
  const parsed = z.array(StoredChestItemSchema).safeParse(value);
  if (!parsed.success) throw new Error('Stored chest data failed schema validation.');
  return parsed.data;
}

function chestItemSnapshot(entry: StoredChestItem): InventoryItemSnapshot {
  const definition = GAME_DATA.itemDefinitions.find(
    (candidate) => candidate.id === entry.item.definitionId,
  );
  return {
    ...entry.item,
    displayName: definition?.displayName ?? entry.item.definitionId,
    type: definition?.type ?? 'material',
    ...(definition?.slot === undefined ? {} : { slot: definition.slot }),
    favorite: entry.favorite,
    sellValue: sellValue(entry.item.rarity, entry.item.itemPower, entry.item.quantity),
  };
}

function merchantItemId(operationId: string): string {
  return `item:merchant:${createHash('sha256').update(operationId).digest('hex').slice(0, 48)}`;
}

function economyOperationId(kind: 'buy' | 'sell', operationId: string): string {
  return `town:${kind}:${createHash('sha256').update(operationId).digest('hex').slice(0, 48)}`;
}

function economyLogData(input: {
  operationId: string;
  characterId: string;
  requestHash: string;
  source: string;
  sourceId: string;
  goldDelta: bigint;
  materialsDelta: bigint;
  experienceDelta: bigint;
  goldBalanceAfter: bigint;
  materialsBalanceAfter: bigint;
  experienceBalanceAfter: bigint;
  payload?: Record<string, unknown>;
}) {
  return {
    id: `reward:${input.operationId}`,
    characterId: input.characterId,
    operationId: input.operationId,
    requestHash: input.requestHash,
    kind: 'ECONOMY' as const,
    source: input.source,
    sourceId: input.sourceId,
    goldDelta: input.goldDelta,
    materialsDelta: input.materialsDelta,
    experienceDelta: input.experienceDelta,
    goldBalanceAfter: input.goldBalanceAfter,
    materialsBalanceAfter: input.materialsBalanceAfter,
    experienceBalanceAfter: input.experienceBalanceAfter,
    balanceVersion: BALANCE_VERSION,
    dataVersion: GAME_DATA_VERSION,
    formulaVersion: TOWN_FORMULA_VERSION,
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    ...(input.payload === undefined ? {} : { payload: input.payload as Prisma.InputJsonValue }),
  };
}
function isRetryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}
function receiptFromStored(
  record: { operationId: string; requestHash: string; kind: string; result: Prisma.JsonValue },
  replayed: boolean,
): InventoryCommandReceipt {
  const result = z.object({ snapshot: z.unknown() }).parse(record.result);
  return {
    operationId: record.operationId,
    requestHash: record.requestHash,
    kind: record.kind,
    replayed,
    snapshot: result.snapshot as InventorySnapshot,
  };
}
function chestReceiptFromStored(
  record: { operationId: string; requestHash: string; kind: string; result: Prisma.JsonValue },
  replayed: boolean,
): ChestCommandReceipt {
  const result = z.object({ chest: z.unknown(), inventory: z.unknown() }).parse(record.result);
  return {
    operationId: record.operationId,
    requestHash: record.requestHash,
    kind: record.kind,
    replayed,
    chest: result.chest as ChestSnapshot,
    inventory: result.inventory as InventorySnapshot,
  };
}
function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function asPositiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}
function safeNumber(value: bigint): number {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
}
